from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import Arriendo, Cliente, Documento, Maquinaria, Obra, OrdenTrabajo


class RentalWarehouseStateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user("prompt013-staff", password="test-only", is_staff=True)
        self.client.force_authenticate(self.staff)
        self.customer = Cliente.objects.create(razon_social="Cliente Test", rut="76.013.000-1")
        self.obra = Obra.objects.create(nombre="Obra Test")
        self.today = timezone.now().date()

    def _machine(self, serie, estado="Disponible"):
        return Maquinaria.objects.create(marca="Marca", modelo="Modelo", serie=serie, estado=estado)

    def _rental(self, machine, *, estado="Activo", end_offset=10, documented=True):
        rental = Arriendo.objects.create(
            maquinaria=machine,
            cliente=self.customer,
            obra=self.obra,
            fecha_inicio=self.today - timedelta(days=10),
            fecha_termino=None if end_offset is None else self.today + timedelta(days=end_offset),
            periodo="Dia",
            tarifa=Decimal("100"),
            estado=estado,
        )
        if documented:
            Documento.objects.create(
                tipo="GD", numero=f"13{rental.id}", fecha_emision=self.today,
                arriendo=rental, cliente=self.customer,
            )
        return rental

    def _states(self):
        rentals = self.client.get("/ordenes/estado-arriendos")
        warehouse = self.client.get("/ordenes/estado-bodega")
        self.assertEqual(rentals.status_code, 200)
        self.assertEqual(warehouse.status_code, 200)
        return rentals.json(), warehouse.json()

    def test_active_available_machine_is_mutually_exclusive(self):
        machine = self._machine("ACTIVE-AVAILABLE")
        rental = self._rental(machine)

        rentals, warehouse = self._states()

        self.assertIn(rental.id, {row["id"] for row in rentals})
        self.assertNotIn(machine.id, {row["id"] for row in warehouse})
        rental_machine_ids = set(
            Arriendo.objects.filter(id__in=[row["id"] for row in rentals])
            .values_list("maquinaria_id", flat=True)
        )
        self.assertFalse(rental_machine_ids & {row["id"] for row in warehouse})

    def test_expired_active_rental_remains_operationally_assigned(self):
        machine = self._machine("EXPIRED-ACTIVE")
        rental = self._rental(machine, end_offset=-1)
        original_end = rental.fecha_termino

        rentals, warehouse = self._states()

        self.assertIn(rental.id, {row["id"] for row in rentals})
        self.assertNotIn(machine.id, {row["id"] for row in warehouse})
        rental.refresh_from_db()
        machine.refresh_from_db()
        self.assertEqual(rental.estado, "Activo")
        self.assertEqual(rental.fecha_termino, original_end)
        self.assertEqual(machine.estado, "Disponible")

    def test_active_rental_with_null_end_date_is_assigned(self):
        machine = self._machine("NULL-END")
        rental = self._rental(machine, end_offset=None)
        rentals, warehouse = self._states()
        self.assertIn(rental.id, {row["id"] for row in rentals})
        self.assertNotIn(machine.id, {row["id"] for row in warehouse})

    def test_available_machine_without_active_rental_is_in_warehouse(self):
        machine = self._machine("WAREHOUSE")
        rentals, warehouse = self._states()
        self.assertEqual(rentals, [])
        self.assertIn(machine.id, {row["id"] for row in warehouse})

    def test_terminated_rental_no_longer_excludes_available_machine(self):
        machine = self._machine("TERMINATED")
        rental = self._rental(machine, estado="Terminado")
        rentals, warehouse = self._states()
        self.assertNotIn(rental.id, {row["id"] for row in rentals})
        self.assertIn(machine.id, {row["id"] for row in warehouse})

    def test_for_sale_machine_preserves_legacy_warehouse_exclusion(self):
        unassigned = self._machine("SALE-FREE", estado="Para venta")
        assigned = self._machine("SALE-ACTIVE", estado="Para venta")
        rental = self._rental(assigned)
        rentals, warehouse = self._states()
        warehouse_ids = {row["id"] for row in warehouse}
        self.assertIn(rental.id, {row["id"] for row in rentals})
        self.assertNotIn(unassigned.id, warehouse_ids)
        self.assertNotIn(assigned.id, warehouse_ids)

    def test_active_rental_without_machine_is_ignored_safely(self):
        rental = self._rental(None)
        available = self._machine("NULL-RELATION-CONTROL")
        rentals, warehouse = self._states()
        self.assertNotIn(rental.id, {row["id"] for row in rentals})
        self.assertIn(available.id, {row["id"] for row in warehouse})

    def test_state_gets_are_read_only(self):
        machine = self._machine("READ-ONLY")
        rental = self._rental(machine, end_offset=-2)
        before = (
            Maquinaria.objects.count(), Arriendo.objects.count(), Documento.objects.count(),
            rental.estado, rental.fecha_inicio, rental.fecha_termino, rental.maquinaria_id,
            machine.estado,
        )
        self._states()
        rental.refresh_from_db()
        machine.refresh_from_db()
        after = (
            Maquinaria.objects.count(), Arriendo.objects.count(), Documento.objects.count(),
            rental.estado, rental.fecha_inicio, rental.fecha_termino, rental.maquinaria_id,
            machine.estado,
        )
        self.assertEqual(after, before)

    def test_reti_document_flow_moves_machine_to_warehouse(self):
        machine = self._machine("RETI-FLOW")
        rental = self._rental(machine)
        ot = OrdenTrabajo.objects.create(
            arriendo=rental, cliente=self.customer, maquinaria=machine,
            tipo="RETI", estado="PEND", detalle_lineas=[],
        )
        rentals, warehouse = self._states()
        self.assertIn(rental.id, {row["id"] for row in rentals})
        self.assertNotIn(machine.id, {row["id"] for row in warehouse})

        response = self.client.post(
            f"/ordenes/{ot.id}/emitir",
            {"accion": "guia_no_facturable", "tipo_documento": "GD", "facturable": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.json())
        rental.refresh_from_db()
        machine.refresh_from_db()
        self.assertEqual(rental.estado, "Terminado")
        self.assertEqual(machine.estado, "Disponible")
        rentals, warehouse = self._states()
        self.assertNotIn(rental.id, {row["id"] for row in rentals})
        self.assertIn(machine.id, {row["id"] for row in warehouse})
