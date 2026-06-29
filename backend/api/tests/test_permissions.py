from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient


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
