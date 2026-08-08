"""Permisos reutilizables para controles críticos de autorización API."""

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAuthenticatedReadStaffWrite(BasePermission):
    """Conserva lecturas autenticadas y limita escrituras a usuarios internos."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.is_active):
            return False
        if request.method in SAFE_METHODS:
            return True
        return bool(user.is_staff or user.is_superuser)


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


class IsStaffOrSuperUser(BasePermission):
    """
    Permite acceso solo a usuarios internos autenticados y activos.

    Esta es una capa temporal mientras se implementan roles ERP reales:
    Administrador, Jefatura, Operador y Consulta.
    """

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and (user.is_staff or user.is_superuser)
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
