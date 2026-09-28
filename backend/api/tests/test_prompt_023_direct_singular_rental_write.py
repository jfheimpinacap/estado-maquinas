from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from api.models import Arriendo, ArriendoItem, Cliente, Maquinaria, OrdenTrabajo


class DirectSingularRentalWriteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user("prompt023-staff", is_staff=True)
        self.normal = User.objects.create_user("prompt023-normal")
        self.client.force_authenticate(self.staff)
        self.customer = Cliente.objects.create(razon_social="Cliente P023", rut="23-0")
        self.machine = Maquinaria.objects.create(marca="Marca", serie="P023-1")
        self.other_machine = Maquinaria.objects.create(marca="Otra", serie="P023-2")

    def _payload(self, **changes):
        payload = {
            "maquinaria": self.machine.pk,
            "cliente": self.customer.pk,
            "fecha_inicio": "2026-09-28",
            "periodo": "Dia",
            "tarifa": "1000.00",
            "crear_arriendo_item": True,
            "maquinaria_ids": [self.machine.pk],
        }
        payload.update(changes)
        return payload

    def _rental(self, machine=None):
        return Arriendo.objects.create(
            maquinaria=machine or self.machine,
            cliente=self.customer,
            fecha_inicio="2026-09-28",
            periodo="Dia",
            tarifa="1000.00",
        )

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_opt_in_creates_compatible_header_and_item_without_order(self):
        response = self.client.post("/arriendos", self._payload(), format="json")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["maquinaria"], self.machine.pk)
        rental = Arriendo.objects.get()
        self.assertTrue(
            ArriendoItem.objects.filter(arriendo=rental, maquinaria=self.machine).exists()
        )
        self.assertFalse(OrdenTrabajo.objects.exists())
        self.assertNotIn("crear_arriendo_item", response.data)
        self.assertNotIn("maquinaria_ids", response.data)

    def test_disabled_flag_and_absent_opt_in_preserve_legacy_behaviour(self):
        payload = self._payload()
        payload.pop("crear_arriendo_item")
        payload.pop("maquinaria_ids")

        response = self.client.post("/arriendos", payload, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Arriendo.objects.get().maquinaria_id, self.machine.pk)
        self.assertFalse(ArriendoItem.objects.exists())

    def test_explicit_opt_in_is_rejected_while_flag_is_disabled(self):
        response = self.client.post("/arriendos", self._payload(), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Arriendo.objects.exists())
        self.assertFalse(ArriendoItem.objects.exists())

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_invalid_inputs_leave_no_partial_writes(self):
        invalid_changes = (
            {"crear_arriendo_item": 1},
            {"crear_arriendo_item": "true"},
            {"maquinaria_ids": None},
            {"maquinaria_ids": []},
            {"maquinaria_ids": [True]},
            {"maquinaria_ids": ["1"]},
            {"maquinaria_ids": [999999]},
            {"maquinaria_ids": [self.machine.pk, self.machine.pk]},
            {"maquinaria_ids": [self.machine.pk, self.other_machine.pk]},
            {"maquinaria_ids": [self.other_machine.pk]},
        )
        for changes in invalid_changes:
            with self.subTest(changes=changes):
                response = self.client.post(
                    "/arriendos", self._payload(**changes), format="json"
                )
                self.assertEqual(response.status_code, 400, response.data)
                self.assertFalse(Arriendo.objects.exists())
                self.assertFalse(ArriendoItem.objects.exists())

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_item_failure_rolls_back_header(self):
        with patch(
            "api.services.rental_writes.ArriendoItem.objects.create",
            side_effect=RuntimeError("forced item failure"),
        ), self.assertRaisesRegex(RuntimeError, "forced item failure"):
            self.client.post("/arriendos", self._payload(), format="json")
        self.assertFalse(Arriendo.objects.exists())

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_existing_write_permission_still_applies(self):
        self.client.force_authenticate(self.normal)
        response = self.client.post("/arriendos", self._payload(), format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Arriendo.objects.exists())

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_alta_path_still_creates_header_item_and_order(self):
        response = self.client.post(
            "/ordenes",
            {
                "tipo": "ALTA",
                "meta_cliente": self.customer.razon_social,
                "crear_arriendo_item": True,
                "maquinaria_ids": [self.machine.pk],
                "lineas": [
                    {
                        "serie": self.machine.serie,
                        "unidad": "Dia",
                        "desde": "2026-09-28",
                        "hasta": "2026-09-29",
                        "valor": "1000.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        rental = Arriendo.objects.get()
        self.assertTrue(
            ArriendoItem.objects.filter(arriendo=rental, maquinaria=self.machine).exists()
        )
        self.assertTrue(
            OrdenTrabajo.objects.filter(
                arriendo=rental, maquinaria=self.machine, tipo="ALTA"
            ).exists()
        )

    def test_put_and_patch_cannot_change_or_clear_machine_when_item_exists(self):
        rental = self._rental()
        ArriendoItem.objects.create(arriendo=rental, maquinaria=self.machine)
        for method, payload in (
            (self.client.patch, {"maquinaria": self.other_machine.pk}),
            (self.client.patch, {"maquinaria": None}),
            (self.client.put, {**self._payload(), "maquinaria": self.other_machine.pk}),
        ):
            payload.pop("crear_arriendo_item", None)
            payload.pop("maquinaria_ids", None)
            with self.subTest(method=method.__name__, payload=payload):
                response = method(f"/arriendos/{rental.pk}", payload, format="json")
                self.assertEqual(response.status_code, 400, response.data)
                rental.refresh_from_db()
                self.assertEqual(rental.maquinaria_id, self.machine.pk)

    def test_updates_that_preserve_machine_or_omit_it_remain_valid(self):
        rental = self._rental()
        ArriendoItem.objects.create(arriendo=rental, maquinaria=self.machine)
        response = self.client.patch(
            f"/arriendos/{rental.pk}",
            {"maquinaria": self.machine.pk, "estado": "Suspendido"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.patch(
            f"/arriendos/{rental.pk}", {"estado": "Activo"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)

    def test_plural_or_divergent_items_are_not_arbitrarily_selected(self):
        rental = self._rental()
        ArriendoItem.objects.create(arriendo=rental, maquinaria=self.machine)
        ArriendoItem.objects.create(arriendo=rental, maquinaria=self.other_machine)

        response = self.client.patch(
            f"/arriendos/{rental.pk}",
            {"maquinaria": self.machine.pk, "estado": "Suspendido"},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        rental.refresh_from_db()
        self.assertEqual(rental.estado, "Activo")

    def test_legacy_header_without_items_keeps_machine_editing(self):
        rental = self._rental()
        response = self.client.patch(
            f"/arriendos/{rental.pk}",
            {"maquinaria": self.other_machine.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        rental.refresh_from_db()
        self.assertEqual(rental.maquinaria_id, self.other_machine.pk)
