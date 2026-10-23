from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from api.models import Arriendo, ArriendoItem, Cliente, Documento, Maquinaria, OrdenTrabajo


class MachineryShadowParticipationsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user("p027-staff", is_staff=True)
        self.superuser = User.objects.create_user("p027-super", is_superuser=True)
        self.ordinary = User.objects.create_user("p027-user")
        self.inactive = User.objects.create_user("p027-inactive", is_staff=True, is_active=False)
        self.client.force_authenticate(self.staff)
        self.machine = Maquinaria.objects.create(marca="P027", serie="P027-1")
        self.other = Maquinaria.objects.create(marca="P027", serie="P027-2")
        self.customer = Cliente.objects.create(razon_social="Cliente sintético", rut="27-0")
        self.url = f"/maquinarias/{self.machine.pk}/participaciones-sombra"

    def rental(self, machine=None, state="Activo"):
        return Arriendo.objects.create(
            maquinaria=machine, cliente=self.customer, fecha_inicio="2026-10-01",
            periodo="Dia", tarifa="1000.00", estado=state,
        )

    def row(self, item, legacy_id):
        return {
            "arriendo_item_id": item.pk,
            "arriendo_id": item.arriendo_id,
            "maquinaria_id": self.machine.pk,
            "maquinaria_legacy_id": legacy_id,
            "coincide_con_fk_legacy": legacy_id == self.machine.pk,
        }

    def envelope(self, rows):
        return {
            "maquinaria_id": self.machine.pk,
            "fuente": "ArriendoItem",
            "cobertura_completa_demostrada": False,
            "participaciones_sombra": rows,
        }

    def snapshot(self):
        return {
            model.__name__: list(model.objects.order_by("pk").values())
            for model in (Maquinaria, Arriendo, ArriendoItem, Documento, OrdenTrabajo, Cliente)
        }

    def test_flag_defaults_off_and_only_controlled_activation_exposes_route(self):
        self.assertEqual(self.client.get(self.url).status_code, 404)
        with override_settings(ENABLE_ARRIENDO_ITEM_SHADOW_READ=True):
            response = self.client.get(self.url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data, self.envelope([]))
        self.assertEqual(self.client.get(self.url).status_code, 404)

    @override_settings(ENABLE_ARRIENDO_ITEM_SHADOW_READ=True)
    def test_authentication_and_same_internal_permission_as_history(self):
        for user, expected in (
            (None, 401), (self.ordinary, 403), (self.inactive, 403),
            (self.staff, 200), (self.superuser, 200),
        ):
            with self.subTest(user=user):
                self.client.force_authenticate(user)
                self.assertEqual(self.client.get(self.url).status_code, expected)
                history = self.client.get(f"/maquinarias/{self.machine.pk}/historial")
                self.assertEqual(history.status_code, expected)

    @override_settings(ENABLE_ARRIENDO_ITEM_SHADOW_READ=False)
    def test_flag_off_does_not_bypass_permissions(self):
        self.client.force_authenticate(self.ordinary)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)

    @override_settings(ENABLE_ARRIENDO_ITEM_SHADOW_READ=True)
    def test_missing_machine_and_empty_machine(self):
        missing = max(self.machine.pk, self.other.pk) + 1000
        self.assertEqual(self.client.get(f"/maquinarias/{missing}/participaciones-sombra").status_code, 404)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, self.envelope([]))

    @override_settings(ENABLE_ARRIENDO_ITEM_SHADOW_READ=True)
    def test_exact_pk_filter_legacy_comparisons_all_states_order_and_duplicates(self):
        matching = self.rental(self.machine, "Terminado")
        different = self.rental(self.other, "Activo")
        null = self.rental(None, "Anulado")
        # Create in an order deliberately different from both header PK and state.
        first = ArriendoItem.objects.create(arriendo=null, maquinaria=self.machine)
        ArriendoItem.objects.create(arriendo=matching, maquinaria=self.other)
        second = ArriendoItem.objects.create(arriendo=different, maquinaria=self.machine)
        third = ArriendoItem.objects.create(arriendo=matching, maquinaria=self.machine)
        duplicate = ArriendoItem.objects.create(arriendo=matching, maquinaria=self.machine)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, self.envelope([
            self.row(first, None), self.row(second, self.other.pk),
            self.row(third, self.machine.pk), self.row(duplicate, self.machine.pk),
        ]))

    @override_settings(ENABLE_ARRIENDO_ITEM_SHADOW_READ=True)
    def test_legacy_and_textual_evidence_do_not_invent_participations(self):
        legacy = self.rental(self.machine)
        textual = self.rental()
        OrdenTrabajo.objects.create(
            arriendo=textual, cliente=self.customer, tipo="ALTA",
            detalle_lineas=[{"serie": self.machine.serie, "maquinaria_id": self.machine.pk}],
        )
        Documento.objects.create(arriendo=legacy, tipo="GD", numero="P027", fecha_emision="2026-10-01")
        self.assertEqual(self.client.get(self.url).data, self.envelope([]))
        self.assertFalse(ArriendoItem.objects.exists())

    @override_settings(ENABLE_ARRIENDO_ITEM_SHADOW_READ=True)
    def test_get_has_no_writes_and_does_not_attribute_header_documents(self):
        rental = self.rental(self.other)
        item = ArriendoItem.objects.create(arriendo=rental, maquinaria=self.machine)
        Documento.objects.create(arriendo=rental, tipo="GD", numero="P027", fecha_emision="2026-10-01")
        before = self.snapshot()
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, self.envelope([self.row(item, self.other.pk)]))
        self.assertEqual(self.snapshot(), before)
        self.assertTrue(all(query["sql"].lstrip().upper().startswith("SELECT") for query in queries))
        self.assertFalse(any('"Documento"' in query["sql"] for query in queries))

    @override_settings(ENABLE_ARRIENDO_ITEM_SHADOW_READ=True)
    def test_write_methods_are_rejected_without_modifications(self):
        before = self.snapshot()
        for method in ("post", "put", "patch", "delete"):
            with self.subTest(method=method):
                response = getattr(self.client, method)(self.url, {}, format="json")
                self.assertEqual(response.status_code, 405)
        self.assertEqual(self.snapshot(), before)

    def test_list_detail_history_and_rental_contracts_unchanged_by_new_action(self):
        legacy = self.rental(self.machine)
        shadow_only = self.rental(self.other)
        ArriendoItem.objects.create(arriendo=shadow_only, maquinaria=self.machine)
        Documento.objects.create(arriendo=legacy, tipo="GD", numero="P027", fecha_emision="2026-10-01")
        urls = ("/maquinarias", f"/maquinarias/{self.machine.pk}",
                f"/maquinarias/{self.machine.pk}/historial")
        before = [self.client.get(url).json() for url in urls]
        self.assertEqual(len(before[2]), 1)
        self.assertEqual(before[2][0]["documento"], "Guía de despacho P027")
        self.assertEqual(set(before[2][0]), {"documento", "fecha_inicio", "fecha_termino", "obra"})
        with override_settings(ENABLE_ARRIENDO_ITEM_SHADOW_READ=True):
            self.client.get(self.url)
            self.assertEqual([self.client.get(url).json() for url in urls], before)
            rental_data = self.client.get(f"/arriendos/{shadow_only.pk}").data
            self.assertEqual(rental_data["items_sombra"], [{"id": shadow_only.items.get().pk,
                                                          "maquinaria_id": self.machine.pk}])
        self.client.force_authenticate(self.ordinary)
        self.assertEqual(self.client.get("/maquinarias").status_code, 200)
        self.assertEqual(self.client.get(f"/maquinarias/{self.machine.pk}").status_code, 200)

    @override_settings(ENABLE_ARRIENDO_ITEM_SHADOW_READ=True)
    def test_query_count_is_constant_as_participations_grow(self):
        rental = self.rental(self.machine)
        ArriendoItem.objects.create(arriendo=rental, maquinaria=self.machine)
        with CaptureQueriesContext(connection) as small:
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        for index in range(12):
            header = self.rental(self.other if index % 2 else None)
            ArriendoItem.objects.create(arriendo=header, maquinaria=self.machine)
        with CaptureQueriesContext(connection) as large:
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["participaciones_sombra"]), 13)
        self.assertEqual(len(small), len(large))
        self.assertLessEqual(len(large), 2)
