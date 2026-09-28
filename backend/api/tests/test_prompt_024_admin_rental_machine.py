from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from api.admin import ProtectedInlineMixin, admin_site
from api.models import Arriendo, ArriendoItem, Cliente, Maquinaria, Obra


class AdminRentalMachineProtectionTests(TestCase):
    def setUp(self):
        self.superuser = User.objects.create_superuser(
            username="prompt024-root", password="test"
        )
        self.normal = User.objects.create_user(
            username="prompt024-normal", password="test"
        )
        self.client.force_login(self.superuser)
        self.customer = Cliente.objects.create(razon_social="Cliente P024", rut="24-0")
        self.site = Obra.objects.create(nombre="Obra P024")
        self.machine = Maquinaria.objects.create(marca="Marca", serie="P024-1")
        self.other_machine = Maquinaria.objects.create(marca="Otra", serie="P024-2")

    def _rental(self, machine=None):
        return Arriendo.objects.create(
            maquinaria=machine or self.machine,
            cliente=self.customer,
            fecha_inicio=date(2026, 9, 28),
            periodo="Dia",
            tarifa="1000.00",
        )

    def _change_url(self, rental):
        return reverse("appweb_admin:api_arriendo_change", args=(rental.pk,))

    def _payload(self, rental, **changes):
        payload = {
            "maquinaria": rental.maquinaria_id or "",
            "cliente": rental.cliente_id or "",
            "obra": rental.obra_id or "",
            "fecha_inicio": rental.fecha_inicio.isoformat(),
            "fecha_termino": "",
            "periodo": rental.periodo,
            "tarifa": str(rental.tarifa),
            "estado": rental.estado,
            "documentos-TOTAL_FORMS": "0",
            "documentos-INITIAL_FORMS": "0",
            "documentos-MIN_NUM_FORMS": "0",
            "documentos-MAX_NUM_FORMS": "0",
            "_save": "Guardar",
        }
        payload.update(changes)
        return payload

    def assert_rental_unchanged(self, rental, *, machine_id, state="Activo"):
        rental.refresh_from_db()
        self.assertEqual(rental.maquinaria_id, machine_id)
        self.assertEqual(rental.estado, state)

    def test_coherent_item_rejects_machine_change_and_clear_without_writes(self):
        rental = self._rental()
        item = ArriendoItem.objects.create(arriendo=rental, maquinaria=self.machine)

        for requested in (self.other_machine.pk, ""):
            with self.subTest(requested=requested):
                response = self.client.post(
                    self._change_url(rental),
                    self._payload(rental, maquinaria=requested, estado="Suspendido"),
                )

                self.assertEqual(response.status_code, 200)
                self.assertContains(
                    response,
                    "No se puede cambiar ni borrar la maquinaria de un arriendo que ya tiene ítems.",
                )
                self.assert_rental_unchanged(rental, machine_id=self.machine.pk)
                item.refresh_from_db()
                self.assertEqual(item.maquinaria_id, self.machine.pk)

    def test_coherent_item_allows_other_field_change_with_same_machine(self):
        rental = self._rental()
        ArriendoItem.objects.create(arriendo=rental, maquinaria=self.machine)

        response = self.client.post(
            self._change_url(rental), self._payload(rental, estado="Suspendido")
        )

        self.assertRedirects(response, reverse("appweb_admin:api_arriendo_changelist"))
        self.assert_rental_unchanged(
            rental, machine_id=self.machine.pk, state="Suspendido"
        )

    def test_plural_and_divergent_items_reject_machine_change_without_writes(self):
        cases = ("plural", "divergent")
        for case in cases:
            with self.subTest(case=case):
                rental = self._rental()
                if case == "plural":
                    ArriendoItem.objects.create(
                        arriendo=rental, maquinaria=self.machine
                    )
                ArriendoItem.objects.create(
                    arriendo=rental, maquinaria=self.other_machine
                )
                item_machine_ids = list(
                    rental.items.order_by("pk").values_list("maquinaria_id", flat=True)
                )

                response = self.client.post(
                    self._change_url(rental),
                    self._payload(rental, maquinaria=self.other_machine.pk, estado="Suspendido"),
                )

                self.assertEqual(response.status_code, 200)
                self.assertContains(
                    response,
                    "Los ítems existentes no coinciden de forma singular con la FK legacy; no se modificó la cabecera.",
                )
                self.assert_rental_unchanged(rental, machine_id=self.machine.pk)
                self.assertEqual(
                    list(
                        rental.items.order_by("pk").values_list(
                            "maquinaria_id", flat=True
                        )
                    ),
                    item_machine_ids,
                )

    def test_legacy_rental_without_items_keeps_machine_editing(self):
        rental = self._rental()

        response = self.client.post(
            self._change_url(rental),
            self._payload(rental, maquinaria=self.other_machine.pk),
        )

        self.assertRedirects(response, reverse("appweb_admin:api_arriendo_changelist"))
        self.assert_rental_unchanged(rental, machine_id=self.other_machine.pk)

    def test_user_without_admin_permission_cannot_modify_rental(self):
        rental = self._rental()
        self.client.force_login(self.normal)

        response = self.client.post(
            self._change_url(rental),
            self._payload(rental, maquinaria=self.other_machine.pk),
        )

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("appweb_admin:login"), response.url)
        self.assert_rental_unchanged(rental, machine_id=self.machine.pk)

    def test_existing_delete_and_inline_protections_remain_enabled(self):
        rental = self._rental()
        model_admin = admin_site._registry[Arriendo]
        response = self.client.get(self._change_url(rental))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(model_admin.has_delete_permission(response.wsgi_request, rental))
        self.assertNotIn("delete_selected", model_admin.get_actions(response.wsgi_request))
        parents = (
            (Arriendo, rental),
            (Maquinaria, self.machine),
            (Cliente, self.customer),
            (Obra, self.site),
        )
        for parent_model, parent in parents:
            parent_admin = admin_site._registry[parent_model]
            for inline in parent_admin.get_inline_instances(
                response.wsgi_request, parent
            ):
                self.assertIsInstance(inline, ProtectedInlineMixin)
                self.assertFalse(
                    inline.has_add_permission(response.wsgi_request, parent)
                )
                self.assertFalse(
                    inline.has_change_permission(response.wsgi_request, parent)
                )
                self.assertFalse(inline.can_delete)
