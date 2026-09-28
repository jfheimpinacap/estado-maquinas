from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from api.models import Arriendo, ArriendoItem, Cliente, Maquinaria


@override_settings(ENABLE_ARRIENDO_ITEM_SHADOW_READ=True)
class ArriendoItemShadowReadTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user("prompt025-user")
        self.staff = User.objects.create_user("prompt025-staff", is_staff=True)
        self.client.force_authenticate(self.user)
        self.customer = Cliente.objects.create(razon_social="Cliente P025", rut="25-0")
        self.first = Maquinaria.objects.create(marca="Primera", serie="P025-1")
        self.second = Maquinaria.objects.create(marca="Segunda", serie="P025-2")

    def rental(self, machine=None):
        return Arriendo.objects.create(
            maquinaria=machine,
            cliente=self.customer,
            fecha_inicio="2026-09-28",
            periodo="Dia",
            tarifa="1000.00",
        )

    def test_flag_off_preserves_list_and_detail_shape(self):
        rental = self.rental(self.first)
        ArriendoItem.objects.create(arriendo=rental, maquinaria=self.first)

        with override_settings(ENABLE_ARRIENDO_ITEM_SHADOW_READ=False):
            responses = (self.client.get("/arriendos"), self.client.get(f"/arriendos/{rental.pk}"))

        for response in responses:
            self.assertEqual(response.status_code, 200)
            row = response.data[0] if isinstance(response.data, list) else response.data
            self.assertNotIn("items_sombra", row)
            self.assertNotIn("diagnostico_items_sombra", row)

    def test_list_and_detail_return_identical_items_ordered_by_item_pk(self):
        rental = self.rental(self.first)
        first_item = ArriendoItem.objects.create(arriendo=rental, maquinaria=self.second)
        second_item = ArriendoItem.objects.create(arriendo=rental, maquinaria=self.first)

        listed = self.client.get("/arriendos").data[0]
        detailed = self.client.get(f"/arriendos/{rental.pk}").data
        expected = [
            {"id": first_item.pk, "maquinaria_id": self.second.pk},
            {"id": second_item.pk, "maquinaria_id": self.first.pk},
        ]
        self.assertEqual(listed["items_sombra"], expected)
        self.assertEqual(detailed["items_sombra"], expected)
        self.assertTrue(detailed["diagnostico_items_sombra"]["maquinaria_legacy_en_items"])
        self.assertFalse(detailed["diagnostico_items_sombra"]["cobertura_completa_demostrada"])

    def test_zero_items_does_not_invent_relation_for_present_or_null_legacy_fk(self):
        present = self.rental(self.first)
        null = self.rental()

        present_data = self.client.get(f"/arriendos/{present.pk}").data
        null_data = self.client.get(f"/arriendos/{null.pk}").data

        self.assertEqual(present_data["items_sombra"], [])
        self.assertEqual(present_data["diagnostico_items_sombra"]["estado"], "sin_items_fk_legacy_presente")
        self.assertEqual(null_data["items_sombra"], [])
        self.assertEqual(null_data["diagnostico_items_sombra"]["estado"], "sin_items_fk_legacy_nula")

    def test_single_matching_and_mismatching_items_are_distinguished(self):
        matching = self.rental(self.first)
        mismatching = self.rental(self.first)
        ArriendoItem.objects.create(arriendo=matching, maquinaria=self.first)
        ArriendoItem.objects.create(arriendo=mismatching, maquinaria=self.second)

        matching_diagnostic = self.client.get(f"/arriendos/{matching.pk}").data["diagnostico_items_sombra"]
        mismatching_diagnostic = self.client.get(f"/arriendos/{mismatching.pk}").data["diagnostico_items_sombra"]
        self.assertEqual(matching_diagnostic["estado"], "item_unico_coincidente")
        self.assertEqual(mismatching_diagnostic["estado"], "item_unico_discrepante")
        self.assertFalse(mismatching_diagnostic["maquinaria_legacy_en_items"])

    def test_multiple_distinct_items_report_legacy_presence_and_absence(self):
        included = self.rental(self.first)
        absent = self.rental(Maquinaria.objects.create(marca="Tercera", serie="P025-3"))
        for rental in (included, absent):
            ArriendoItem.objects.create(arriendo=rental, maquinaria=self.first)
            ArriendoItem.objects.create(arriendo=rental, maquinaria=self.second)

        included_diagnostic = self.client.get(f"/arriendos/{included.pk}").data["diagnostico_items_sombra"]
        absent_diagnostic = self.client.get(f"/arriendos/{absent.pk}").data["diagnostico_items_sombra"]
        self.assertEqual(included_diagnostic["estado"], "varias_maquinarias_distintas")
        self.assertTrue(included_diagnostic["maquinaria_legacy_en_items"])
        self.assertFalse(absent_diagnostic["maquinaria_legacy_en_items"])

    def test_duplicate_items_are_visible_and_not_counted_as_distinct_machines(self):
        rental = self.rental(self.first)
        ArriendoItem.objects.create(arriendo=rental, maquinaria=self.first)
        ArriendoItem.objects.create(arriendo=rental, maquinaria=self.first)

        data = self.client.get(f"/arriendos/{rental.pk}").data
        self.assertEqual(len(data["items_sombra"]), 2)
        self.assertEqual(data["diagnostico_items_sombra"]["estado"], "items_repetidos")
        self.assertEqual(data["diagnostico_items_sombra"]["cantidad_items"], 2)
        self.assertEqual(data["diagnostico_items_sombra"]["cantidad_maquinarias_distintas"], 1)

    def test_gets_do_not_modify_headers_or_items(self):
        rental = self.rental(self.first)
        item = ArriendoItem.objects.create(arriendo=rental, maquinaria=self.first)
        before = (list(Arriendo.objects.values()), list(ArriendoItem.objects.values()))

        self.client.get("/arriendos")
        self.client.get(f"/arriendos/{rental.pk}")

        self.assertEqual((list(Arriendo.objects.values()), list(ArriendoItem.objects.values())), before)
        self.assertTrue(ArriendoItem.objects.filter(pk=item.pk).exists())

    def test_permissions_and_write_responses_remain_legacy(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/arriendos").status_code, 401)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post("/arriendos", {}, format="json").status_code, 403)
        self.client.force_authenticate(self.staff)
        response = self.client.post(
            "/arriendos",
            {
                "maquinaria": self.first.pk,
                "cliente": self.customer.pk,
                "fecha_inicio": "2026-09-28",
                "periodo": "Dia",
                "tarifa": "1000.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn("items_sombra", response.data)
        self.assertNotIn("diagnostico_items_sombra", response.data)

    def test_list_prefetches_items_once_instead_of_querying_per_rental(self):
        for machine in (self.first, self.second):
            rental = self.rental(machine)
            ArriendoItem.objects.create(arriendo=rental, maquinaria=machine)

        with CaptureQueriesContext(connection) as queries:
            response = self.client.get("/arriendos")

        self.assertEqual(response.status_code, 200)
        item_queries = [q["sql"] for q in queries if 'FROM "ArriendoItem"' in q["sql"]]
        self.assertEqual(len(item_queries), 1, item_queries)
