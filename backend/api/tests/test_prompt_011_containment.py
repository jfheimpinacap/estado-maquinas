from datetime import date

from django.contrib.auth.models import User
from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient

from api.admin import admin_site
from api.models import Arriendo, Cliente, Documento, Maquinaria, Obra, OrdenTrabajo


class CriticalApiContainmentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.normal = User.objects.create_user(username="p011-normal", password="test")
        self.staff = User.objects.create_user(
            username="p011-staff", password="test", is_staff=True
        )
        self.superuser = User.objects.create_superuser(
            username="p011-root", password="test"
        )
        self.cliente = Cliente.objects.create(razon_social="Original", rut="1-9")
        self.obra = Obra.objects.create(nombre="Obra original")
        self.maquinaria = Maquinaria.objects.create(marca="JLG", serie="P011-1")
        self.arriendo = Arriendo.objects.create(
            cliente=self.cliente,
            obra=self.obra,
            maquinaria=self.maquinaria,
            fecha_inicio=date(2026, 1, 1),
            periodo="Dia",
            tarifa="100.00",
        )

    def test_anonymous_writes_keep_authentication_boundary(self):
        requests = (
            ("post", "/clientes", {"razon_social": "Anon", "rut": "2-7"}),
            ("patch", f"/obras/{self.obra.pk}", {"nombre": "Anon"}),
            ("delete", f"/maquinarias/{self.maquinaria.pk}", None),
        )
        for method, url, payload in requests:
            response = getattr(self.client, method)(url, payload, format="json")
            self.assertEqual(response.status_code, 401)

    def test_normal_user_cannot_create_or_modify_critical_entities(self):
        self.client.force_authenticate(self.normal)
        responses = (
            self.client.post(
                "/clientes", {"razon_social": "Nuevo", "rut": "2-7"}, format="json"
            ),
            self.client.put(
                f"/obras/{self.obra.pk}", {"nombre": "Cambiada"}, format="json"
            ),
            self.client.patch(
                f"/maquinarias/{self.maquinaria.pk}",
                {"marca": "Cambiada"},
                format="json",
            ),
            self.client.patch(
                f"/arriendos/{self.arriendo.pk}", {"estado": "Cerrado"}, format="json"
            ),
        )
        self.assertTrue(all(response.status_code == 403 for response in responses))
        self.obra.refresh_from_db()
        self.maquinaria.refresh_from_db()
        self.arriendo.refresh_from_db()
        self.assertEqual(self.obra.nombre, "Obra original")
        self.assertEqual(self.maquinaria.marca, "JLG")
        self.assertEqual(self.arriendo.estado, "Activo")

    def test_staff_and_superuser_keep_non_destructive_writes(self):
        for user, suffix in ((self.staff, "staff"), (self.superuser, "root")):
            self.client.force_authenticate(user)
            response = self.client.post(
                "/clientes",
                {"razon_social": suffix, "rut": f"{user.pk + 10}-0"},
                format="json",
            )
            self.assertEqual(response.status_code, 201)
            response = self.client.patch(
                f"/obras/{self.obra.pk}", {"nombre": suffix}, format="json"
            )
            self.assertEqual(response.status_code, 200)

    def test_delete_is_blocked_for_every_critical_entity_and_record_persists(self):
        targets = (
            ("clientes", self.cliente),
            ("obras", self.obra),
            ("maquinarias", self.maquinaria),
            ("arriendos", self.arriendo),
        )
        for user in (self.normal, self.staff, self.superuser):
            self.client.force_authenticate(user)
            for route, obj in targets:
                response = self.client.delete(f"/{route}/{obj.pk}")
                expected = 403 if user is self.normal else 405
                self.assertEqual(response.status_code, expected)
                self.assertTrue(type(obj).objects.filter(pk=obj.pk).exists())

    def test_arriendo_delete_cannot_trigger_document_cascade(self):
        document = Documento.objects.create(
            tipo="GD",
            numero="P011",
            fecha_emision=date(2026, 1, 1),
            arriendo=self.arriendo,
            cliente=self.cliente,
        )
        before = (Arriendo.objects.count(), Documento.objects.count())
        for user in (self.staff, self.superuser):
            self.client.force_authenticate(user)
            response = self.client.delete(f"/arriendos/{self.arriendo.pk}")
            self.assertEqual(response.status_code, 405)
            self.assertEqual(
                (Arriendo.objects.count(), Documento.objects.count()), before
            )
            self.assertTrue(Arriendo.objects.filter(pk=self.arriendo.pk).exists())
            self.assertTrue(Documento.objects.filter(pk=document.pk).exists())

    def test_document_generic_mutations_remain_unavailable(self):
        document = Documento.objects.create(
            tipo="GD",
            numero="IMMUTABLE",
            fecha_emision=date(2026, 1, 1),
            arriendo=self.arriendo,
            cliente=self.cliente,
        )
        for user in (self.staff, self.superuser):
            self.client.force_authenticate(user)
            for method in ("put", "patch", "delete"):
                response = getattr(self.client, method)(
                    f"/documentos/{document.pk}", {"numero": "CHANGED"}, format="json"
                )
                self.assertEqual(response.status_code, 405)
            document.refresh_from_db()
            self.assertEqual(document.numero, "IMMUTABLE")


class CriticalAdminContainmentTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.superuser = User.objects.create_superuser(username="admin-root", password="test")
        self.request = self.factory.get("/admin/")
        self.request.user = self.superuser

    def test_critical_admins_disable_individual_and_bulk_delete(self):
        for model in (Cliente, Obra, Maquinaria, Arriendo, OrdenTrabajo, Documento):
            model_admin = admin_site._registry[model]
            self.assertFalse(model_admin.has_delete_permission(self.request))
            self.assertNotIn("delete_selected", model_admin.get_actions(self.request))

    def test_document_admin_is_read_only_but_viewable(self):
        model_admin = admin_site._registry[Documento]
        self.assertFalse(model_admin.has_add_permission(self.request))
        self.assertFalse(model_admin.has_change_permission(self.request))
        self.assertFalse(model_admin.has_delete_permission(self.request))
        self.assertTrue(model_admin.has_view_permission(self.request))

    def test_superuser_can_still_open_critical_admin_changelists(self):
        self.client.force_login(self.superuser)
        for model in (Cliente, Obra, Maquinaria, Arriendo, OrdenTrabajo, Documento):
            url = f"/admin/api/{model._meta.model_name}/"
            self.assertEqual(self.client.get(url).status_code, 200)
