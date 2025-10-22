from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import (
    MaquinariaViewSet, ClienteViewSet, ObraViewSet,
    ArriendoViewSet,
    DocumentoViewSet,           # ← consulta de documentos
    OrdenTrabajoViewSet,        # ← estado de arriendos/servicios
    UserViewSet,
    register, login, recover_start,
)

router = SimpleRouter(trailing_slash="")
router.register(r"maquinarias", MaquinariaViewSet, basename="maquinarias")
router.register(r"clientes",    ClienteViewSet,    basename="clientes")
router.register(r"obras",       ObraViewSet,       basename="obras")
router.register(r"arriendos",   ArriendoViewSet,   basename="arriendos")

# Nuevos módulos:
router.register(r"documentos",  DocumentoViewSet,  basename="documentos")
router.register(r"ordenes",     OrdenTrabajoViewSet, basename="ordenes")

# Administración de usuarios (solo admin)
router.register(r"users",       UserViewSet,       basename="users")

urlpatterns = [
    path("auth/register", register),
    path("auth/login",    login),
    path("auth/recover",  recover_start),
    path("", include(router.urls)),
]



