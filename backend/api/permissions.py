"""Permisos reutilizables para controles críticos de autorización API."""

from rest_framework.permissions import BasePermission


class IsSuperUserOnly(BasePermission):
    """Permite acceso exclusivamente a usuarios autenticados, activos y superusuarios."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.is_superuser
        )


class CanEmitDocuments(BasePermission):
    """
    Permite emitir documentos solo a usuarios internos autenticados y activos.

    Esta es una capa temporal de autorización interna. Más adelante debe ser
    reemplazada por roles ERP explícitos como Administrador, Jefatura y Operador
    autorizado, sin depender únicamente de flags Django.
    """

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and (user.is_staff or user.is_superuser)
        )
