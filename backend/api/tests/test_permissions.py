from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Arriendo, Cliente, Documento, OrdenTrabajo


class CriticalPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.normal_user = User.objects.create_user(
            username="normal", password="test-pass-123"
        )
        self.staff_user = User.objects.create_user(
            username="staff", password="test-pass-123", is_staff=True
        )

    def _register_payload(self, username):
        return {
            "username": username,
            "password": "new-pass-123",
            "email": f"{username}@example.com",
        }

    def test_anonymous_user_cannot_register_user(self):
        response = self.client.post(
            "/auth/register", self._register_payload("created-anon"), format="json"
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(username="created-anon").exists())

    def test_normal_user_cannot_register_user(self):
        self.client.force_authenticate(user=self.normal_user)

        response = self.client.post(
            "/auth/register", self._register_payload("created-normal"), format="json"
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(username="created-normal").exists())

    def test_staff_non_superuser_cannot_register_user(self):
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.post(
            "/auth/register", self._register_payload("created-staff"), format="json"
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(username="created-staff").exists())

    def test_normal_user_cannot_list_users(self):
        self.client.force_authenticate(user=self.normal_user)

        response = self.client.get("/users/")

        self.assertEqual(response.status_code, 403)

    def test_staff_non_superuser_cannot_list_users(self):
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.get("/users/")

        self.assertEqual(response.status_code, 403)

    def test_normal_user_cannot_emit_documents(self):
        self.client.force_authenticate(user=self.normal_user)

        response = self.client.post(
            "/ordenes/999999/emitir", {"tipo_documento": "GD"}, format="json"
        )

        self.assertEqual(response.status_code, 403)


class OrdenTrabajoDeletePermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.normal_user = User.objects.create_user(
            username="ot-normal", password="test-pass-123"
        )
        self.staff_user = User.objects.create_user(
            username="ot-staff", password="test-pass-123", is_staff=True
        )
        self.superuser = User.objects.create_superuser(
            username="ot-root", password="test-pass-123"
        )
        self.cliente = Cliente.objects.create(
            razon_social="Cliente Prueba", rut="76.123.456-7"
        )

    def _create_ot(self):
        return OrdenTrabajo.objects.create(
            cliente=self.cliente,
            tipo="SERV",
            estado="PEND",
            detalle_lineas=[],
        )

    def _create_arriendo(self):
        return Arriendo.objects.create(
            cliente=self.cliente,
            fecha_inicio=date(2026, 1, 1),
            fecha_termino=date(2026, 1, 2),
            periodo="Dia",
            tarifa="10000.00",
            estado="Activo",
        )

    def _create_documented_ot(self):
        ot = self._create_ot()
        arriendo = self._create_arriendo()
        documento = Documento.objects.create(
            tipo="GD",
            numero="0001",
            fecha_emision=date(2026, 1, 1),
            monto_neto="0.00",
            monto_iva="0.00",
            monto_total="0.00",
            arriendo=arriendo,
            cliente=self.cliente,
        )
        ot.arriendo = arriendo
        ot.guia = documento
        ot.save(update_fields=["arriendo", "guia"])
        return ot, documento

    def test_normal_user_cannot_delete_ot(self):
        ot = self._create_ot()
        self.client.force_authenticate(user=self.normal_user)

        response = self.client.delete(f"/ordenes/{ot.id}/")

        self.assertEqual(response.status_code, 403)
        self.assertTrue(OrdenTrabajo.objects.filter(id=ot.id).exists())

    def test_staff_non_superuser_cannot_delete_ot(self):
        ot = self._create_ot()
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.delete(f"/ordenes/{ot.id}/")

        self.assertEqual(response.status_code, 403)
        self.assertTrue(OrdenTrabajo.objects.filter(id=ot.id).exists())

    def test_superuser_can_delete_ot_without_documents(self):
        ot = self._create_ot()
        self.client.force_authenticate(user=self.superuser)

        response = self.client.delete(f"/ordenes/{ot.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(OrdenTrabajo.objects.filter(id=ot.id).exists())

    def test_superuser_cannot_delete_ot_with_associated_document(self):
        ot, documento = self._create_documented_ot()
        self.client.force_authenticate(user=self.superuser)

        response = self.client.delete(f"/ordenes/{ot.id}/")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "ot_has_emitted_documents")
        self.assertTrue(OrdenTrabajo.objects.filter(id=ot.id).exists())
        self.assertTrue(Documento.objects.filter(id=documento.id).exists())

    def test_ot_and_document_still_exist_after_delete_conflict(self):
        ot, documento = self._create_documented_ot()
        self.client.force_authenticate(user=self.superuser)

        response = self.client.delete(f"/ordenes/{ot.id}/")

        self.assertEqual(response.status_code, 409)
        self.assertTrue(OrdenTrabajo.objects.filter(id=ot.id, guia=documento).exists())
        self.assertTrue(Documento.objects.filter(id=documento.id).exists())


class OrdenTrabajoWritePermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.normal_user = User.objects.create_user(
            username="write-normal", password="test-pass-123"
        )
        self.staff_user = User.objects.create_user(
            username="write-staff", password="test-pass-123", is_staff=True
        )
        self.superuser = User.objects.create_superuser(
            username="write-root", password="test-pass-123"
        )
        self.cliente = Cliente.objects.create(
            razon_social="Cliente Escritura", rut="77.123.456-7"
        )

    def _valid_ot_payload(self):
        return {
            "cliente": self.cliente.id,
            "tipo": "SERV",
            "estado": "PEND",
            "tipo_comercial": "V",
            "es_facturable": False,
            "detalle_lineas": [],
            "monto_neto": "10000.00",
            "monto_iva": "1900.00",
            "monto_total": "11900.00",
            "observaciones": "OT válida para pruebas de permisos",
        }

    def _create_ot(self):
        return OrdenTrabajo.objects.create(
            cliente=self.cliente,
            tipo="SERV",
            estado="PEND",
            tipo_comercial="V",
            detalle_lineas=[],
            monto_neto="10000.00",
            monto_iva="1900.00",
            monto_total="11900.00",
        )

    def test_normal_authenticated_user_can_list_but_cannot_create_or_edit_ot(self):
        ot = self._create_ot()
        self.client.force_authenticate(user=self.normal_user)

        list_response = self.client.get("/ordenes/")
        create_response = self.client.post(
            "/ordenes/", self._valid_ot_payload(), format="json"
        )
        patch_response = self.client.patch(
            f"/ordenes/{ot.id}/", {"observaciones": "No autorizado"}, format="json"
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(create_response.status_code, 403)
        self.assertEqual(patch_response.status_code, 403)
        self.assertFalse(
            OrdenTrabajo.objects.filter(observaciones="No autorizado").exists()
        )

    def test_staff_non_superuser_can_create_and_edit_ot(self):
        ot = self._create_ot()
        self.client.force_authenticate(user=self.staff_user)

        create_response = self.client.post(
            "/ordenes/", self._valid_ot_payload(), format="json"
        )
        patch_response = self.client.patch(
            f"/ordenes/{ot.id}/", {"observaciones": "Editada por staff"}, format="json"
        )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(patch_response.status_code, 200)
        ot.refresh_from_db()
        self.assertEqual(ot.observaciones, "Editada por staff")

    def test_superuser_can_create_and_edit_ot(self):
        ot = self._create_ot()
        self.client.force_authenticate(user=self.superuser)

        create_response = self.client.post(
            "/ordenes/", self._valid_ot_payload(), format="json"
        )
        patch_response = self.client.patch(
            f"/ordenes/{ot.id}/", {"observaciones": "Editada por root"}, format="json"
        )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(patch_response.status_code, 200)
        ot.refresh_from_db()
        self.assertEqual(ot.observaciones, "Editada por root")

    def test_normal_user_still_cannot_emit_documents(self):
        ot = self._create_ot()
        self.client.force_authenticate(user=self.normal_user)

        response = self.client.post(
            f"/ordenes/{ot.id}/emitir", {"tipo_documento": "GD"}, format="json"
        )

        self.assertEqual(response.status_code, 403)

    def test_staff_non_superuser_still_cannot_delete_ot(self):
        ot = self._create_ot()
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.delete(f"/ordenes/{ot.id}/")

        self.assertEqual(response.status_code, 403)
        self.assertTrue(OrdenTrabajo.objects.filter(id=ot.id).exists())
