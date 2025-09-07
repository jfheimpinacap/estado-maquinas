# api/urls.py
from django.urls import path, include
from rest_framework.routers import SimpleRouter

from .views import (
    MaquinariaViewSet,
    ClienteViewSet,
    ObraViewSet,
    ArriendoViewSet,
    DocumentoViewSet,
    UserViewSet,     # ← importa el viewset de usuarios
    register,        # ← importa la view de registro
    login,           # ← importa la view de login
)

router = SimpleRouter(trailing_slash="")  # sin barra final

router.register(r"maquinarias", MaquinariaViewSet, basename="maquinarias")
router.register(r"clientes",    ClienteViewSet,    basename="clientes")
router.register(r"obras",       ObraViewSet,       basename="obras")
router.register(r"arriendos",   ArriendoViewSet,   basename="arriendos")
router.register(r"documentos",  DocumentoViewSet,  basename="documentos")
router.register(r"users",       UserViewSet,       basename="users")  # solo admin

urlpatterns = [
    path("auth/register", register),  # AllowAny
    path("auth/login",    login),     # AllowAny (devuelve tokens)
    path("", include(router.urls)),
]


