from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Arriendo, Cliente, Documento, Maquinaria, Obra, OrdenTrabajo


class BillableDispatchFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(
            username="p012-staff", password="test", is_staff=True
        )
        self.client.force_authenticate(self.staff)
        self.cliente = Cliente.objects.create(razon_social="Cliente P012", rut="12-3")
        self.obra = Obra.objects.create(nombre="Obra P012")
        self.maquinaria = Maquinaria.objects.create(
            marca="JLG", modelo="1930ES", serie="P012-1", estado="Arrendada"
        )

    def _create_ot(self):
        arriendo = Arriendo.objects.create(
            cliente=self.cliente,
            obra=self.obra,
            maquinaria=self.maquinaria,
            fecha_inicio=date(2026, 8, 1),
            periodo="Dia",
            tarifa=Decimal("100000.00"),
            estado="Activo",
        )
        return OrdenTrabajo.objects.create(
            cliente=self.cliente,
            maquinaria=self.maquinaria,
            arriendo=arriendo,
            tipo="ALTA",
            estado="PEND",
            detalle_lineas=[],
            monto_neto=Decimal("100000.00"),
            monto_iva=Decimal("19000.00"),
            monto_total=Decimal("119000.00"),
        )

    def _emit(self, ot, payload):
        return self.client.post(f"/ordenes/{ot.pk}/emitir", payload, format="json")

    def _assert_billable_guide(self, ot, response):
        self.assertEqual(response.status_code, 200)
        ot.refresh_from_db()
        self.assertEqual(Documento.objects.filter(tipo="GD").count(), 1)
        self.assertIsNotNone(ot.guia)
        self.assertEqual(ot.guia.tipo, "GD")
        self.assertEqual(ot.guia.arriendo_id, ot.arriendo_id)
        self.assertEqual(ot.guia.monto_total, Decimal("119000.00"))
        self.assertTrue(ot.es_facturable)
        self.assertEqual(ot.estado, "PEND")
        self.assertEqual(response.data["guia"]["numero"], ot.guia.numero)

    def test_legacy_billable_action_infers_true_even_with_explicit_gd_type(self):
        ot = self._create_ot()
        response = self._emit(
            ot, {"accion": "guia_facturable", "tipo_documento": "GD"}
        )
        self._assert_billable_guide(ot, response)

    def test_explicit_billable_payload(self):
        ot = self._create_ot()
        response = self._emit(
            ot,
            {
                "accion": "guia_facturable",
                "tipo_documento": "GD",
                "facturable": True,
            },
        )
        self._assert_billable_guide(ot, response)

    def test_explicit_facturable_without_action_remains_supported(self):
        ot = self._create_ot()
        response = self._emit(ot, {"tipo_documento": "GD", "facturable": True})
        self._assert_billable_guide(ot, response)

    def test_non_billable_guide_remains_zero_and_processed(self):
        ot = self._create_ot()
        response = self._emit(
            ot,
            {
                "accion": "guia_no_facturable",
                "tipo_documento": "GD",
                "facturable": False,
            },
        )
        self.assertEqual(response.status_code, 200)
        ot.refresh_from_db()
        self.assertFalse(ot.es_facturable)
        self.assertEqual(ot.estado, "PROC")
        self.assertEqual(ot.guia.monto_total, Decimal("0.00"))

    def test_contradictory_billable_action_is_rejected_without_side_effects(self):
        ot = self._create_ot()
        before = (Documento.objects.count(), ot.arriendo.documentos.count())
        response = self._emit(
            ot,
            {
                "accion": "guia_facturable",
                "tipo_documento": "GD",
                "facturable": False,
            },
        )
        self.assertEqual(response.status_code, 400)
        ot.refresh_from_db()
        self.assertEqual((Documento.objects.count(), ot.arriendo.documentos.count()), before)
        self.assertIsNone(ot.guia_id)
        self.assertEqual(ot.estado, "PEND")

    def test_inverse_contradiction_is_rejected_without_side_effects(self):
        ot = self._create_ot()
        response = self._emit(
            ot,
            {
                "accion": "guia_no_facturable",
                "tipo_documento": "GD",
                "facturable": True,
            },
        )
        self.assertEqual(response.status_code, 400)
        ot.refresh_from_db()
        self.assertEqual(Documento.objects.count(), 0)
        self.assertIsNone(ot.guia_id)
        self.assertEqual(ot.estado, "PEND")

    def test_string_boolean_is_rejected_instead_of_using_python_truthiness(self):
        ot = self._create_ot()
        response = self._emit(
            ot,
            {
                "accion": "guia_no_facturable",
                "tipo_documento": "GD",
                "facturable": "false",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Documento.objects.count(), 0)

    def test_billable_guide_can_continue_once_to_invoice(self):
        ot = self._create_ot()
        guide_response = self._emit(
            ot, {"accion": "guia_facturable", "tipo_documento": "GD"}
        )
        self.assertEqual(guide_response.status_code, 200)
        ot.refresh_from_db()
        guide = ot.guia
        self.assertEqual(ot.estado, "PEND")

        invoice_response = self._emit(
            ot, {"accion": "facturar", "tipo_documento": "FACT"}
        )
        self.assertEqual(invoice_response.status_code, 200)
        ot.refresh_from_db()
        self.assertEqual(ot.factura.tipo, "FACT")
        self.assertEqual(ot.factura.relacionado_con_id, guide.pk)
        self.assertEqual(ot.factura.arriendo_id, ot.arriendo_id)
        self.assertEqual(ot.estado, "PROC")
        self.assertFalse(ot.es_facturable)


class BillableDispatchPermissionTests(TestCase):
    def test_normal_authenticated_user_cannot_emit_billable_guide(self):
        user = User.objects.create_user(username="p012-normal", password="test")
        cliente = Cliente.objects.create(razon_social="Cliente permiso", rut="45-6")
        ot = OrdenTrabajo.objects.create(
            cliente=cliente, tipo="ALTA", estado="PEND", detalle_lineas=[]
        )
        client = APIClient()
        client.force_authenticate(user)
        response = client.post(
            f"/ordenes/{ot.pk}/emitir",
            {"accion": "guia_facturable", "tipo_documento": "GD"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Documento.objects.count(), 0)
