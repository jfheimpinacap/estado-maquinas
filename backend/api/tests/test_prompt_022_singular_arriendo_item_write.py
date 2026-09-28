from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from api.models import Arriendo, ArriendoItem, Cliente, Maquinaria, OrdenTrabajo


class SingularArriendoItemWriteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(
            "prompt022-staff", password="test-only", is_staff=True
        )
        self.normal = User.objects.create_user(
            "prompt022-normal", password="test-only"
        )
        self.client.force_authenticate(self.staff)
        self.customer = Cliente.objects.create(
            razon_social="Cliente P022", rut="22-0"
        )
        self.machine = Maquinaria.objects.create(
            marca="Marca", modelo="Modelo", serie="P022-1"
        )

    def _payload(self, **changes):
        payload = {
            "tipo": "ALTA",
            "meta_cliente": self.customer.razon_social,
            "meta_obra": "Obra P022",
            "meta_direccion": "Dirección P022",
            "crear_arriendo_item": True,
            "maquinaria_ids": [self.machine.pk],
            "lineas": [
                {
                    "serie": self.machine.serie,
                    "unidad": "Dia",
                    "cantidadPeriodo": 2,
                    "desde": "2026-09-28",
                    "hasta": "2026-09-29",
                    "valor": "1000",
                    "flete": "100",
                }
            ],
        }
        payload.update(changes)
        return payload

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_enabled_path_creates_one_header_item_and_alta_with_legacy_projection(self):
        response = self.client.post("/ordenes", self._payload(), format="json")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Arriendo.objects.count(), 1)
        self.assertEqual(ArriendoItem.objects.count(), 1)
        self.assertEqual(OrdenTrabajo.objects.count(), 1)
        rental = Arriendo.objects.get()
        item = ArriendoItem.objects.get()
        order = OrdenTrabajo.objects.get()
        self.assertEqual(rental.maquinaria_id, self.machine.pk)
        self.assertEqual((item.arriendo_id, item.maquinaria_id), (rental.pk, self.machine.pk))
        self.assertEqual(order.tipo, "ALTA")
        self.assertEqual(order.arriendo_id, rental.pk)
        self.assertEqual(order.maquinaria_id, self.machine.pk)
        self.assertEqual(response.data["id"], order.pk)

    def test_disabled_flag_preserves_legacy_singular_contract_without_shadow_item(self):
        payload = self._payload()
        payload.pop("crear_arriendo_item")
        payload.pop("maquinaria_ids")

        response = self.client.post("/ordenes", payload, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Arriendo.objects.count(), 1)
        self.assertEqual(OrdenTrabajo.objects.count(), 1)
        self.assertFalse(ArriendoItem.objects.exists())
        self.assertEqual(Arriendo.objects.get().maquinaria_id, self.machine.pk)

    def test_explicit_opt_in_is_rejected_while_feature_is_disabled(self):
        response = self.client.post("/ordenes", self._payload(), format="json")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Arriendo.objects.exists())
        self.assertFalse(ArriendoItem.objects.exists())
        self.assertFalse(OrdenTrabajo.objects.exists())

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_invalid_pk_selections_are_rejected_without_partial_writes(self):
        invalid_selections = (
            None,
            [],
            [self.machine.pk, self.machine.pk],
            [self.machine.pk, Maquinaria.objects.create(marca="Otra", serie="P022-2").pk],
            [999999],
        )
        for selection in invalid_selections:
            with self.subTest(selection=selection):
                response = self.client.post(
                    "/ordenes",
                    self._payload(maquinaria_ids=selection),
                    format="json",
                )
                self.assertEqual(response.status_code, 400)
                self.assertFalse(Arriendo.objects.exists())
                self.assertFalse(ArriendoItem.objects.exists())
                self.assertFalse(OrdenTrabajo.objects.exists())

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_line_series_must_match_explicit_machine_pk(self):
        lines = self._payload()["lineas"]
        lines[0]["serie"] = "OTRA-SERIE"
        response = self.client.post(
            "/ordenes", self._payload(lineas=lines), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Arriendo.objects.exists())
        self.assertFalse(ArriendoItem.objects.exists())
        self.assertFalse(OrdenTrabajo.objects.exists())

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_failure_after_header_creation_rolls_back_everything(self):
        with patch(
            "api.services.rental_writes.ArriendoItem.objects.create",
            side_effect=RuntimeError("forced item failure"),
        ), self.assertRaisesRegex(RuntimeError, "forced item failure"):
            self.client.post("/ordenes", self._payload(), format="json")

        self.assertFalse(Arriendo.objects.exists())
        self.assertFalse(ArriendoItem.objects.exists())
        self.assertFalse(OrdenTrabajo.objects.exists())

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_order_failure_also_rolls_back_header_and_item(self):
        with patch(
            "api.services.rental_writes.OrdenTrabajo.objects.create",
            side_effect=RuntimeError("forced order failure"),
        ), self.assertRaisesRegex(RuntimeError, "forced order failure"):
            self.client.post("/ordenes", self._payload(), format="json")

        self.assertFalse(Arriendo.objects.exists())
        self.assertFalse(ArriendoItem.objects.exists())
        self.assertFalse(OrdenTrabajo.objects.exists())

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_existing_write_permission_still_protects_opt_in_path(self):
        self.client.force_authenticate(self.normal)
        response = self.client.post("/ordenes", self._payload(), format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Arriendo.objects.exists())
        self.assertFalse(ArriendoItem.objects.exists())
        self.assertFalse(OrdenTrabajo.objects.exists())

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_excluded_order_types_cannot_activate_compatible_write(self):
        for order_type in ("PROL", "TRAS", "RETI", "SERV"):
            with self.subTest(order_type=order_type):
                response = self.client.post(
                    "/ordenes", self._payload(tipo=order_type), format="json"
                )
                self.assertEqual(response.status_code, 400)
                self.assertFalse(Arriendo.objects.exists())
                self.assertFalse(ArriendoItem.objects.exists())
                self.assertFalse(OrdenTrabajo.objects.exists())

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_direct_rental_endpoint_does_not_implicitly_create_shadow_item(self):
        response = self.client.post(
            "/arriendos",
            {
                "maquinaria": self.machine.pk,
                "cliente": self.customer.pk,
                "fecha_inicio": "2026-09-28",
                "periodo": "Dia",
                "tarifa": "1000",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(ArriendoItem.objects.exists())
        self.assertFalse(OrdenTrabajo.objects.exists())

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_document_emission_does_not_activate_shadow_write(self):
        payload = self._payload()
        payload.pop("crear_arriendo_item")
        payload.pop("maquinaria_ids")
        creation = self.client.post("/ordenes", payload, format="json")
        self.assertEqual(creation.status_code, 201, creation.data)

        emission = self.client.post(
            f"/ordenes/{creation.data['id']}/emitir",
            {
                "tipo_documento": "GD",
                "accion": "guia_no_facturable",
                "facturable": False,
                "crear_arriendo_item": True,
            },
            format="json",
        )

        self.assertEqual(emission.status_code, 200, emission.data)
        self.assertFalse(ArriendoItem.objects.exists())
