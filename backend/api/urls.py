from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import (
    MaquinariaViewSet, ClienteViewSet, ObraViewSet, ArriendoViewSet, DocumentoViewSet
)

# trailing_slash = "" -> no requiere "/" final (match con tu frontend)
router = SimpleRouter(trailing_slash="")

router.register(r"maquinarias", MaquinariaViewSet, basename="maquinarias")
router.register(r"clientes", ClienteViewSet, basename="clientes")
router.register(r"obras", ObraViewSet, basename="obras")
router.register(r"arriendos", ArriendoViewSet, basename="arriendos")
router.register(r"documentos", DocumentoViewSet, basename="documentos")

urlpatterns = [
    path("", include(router.urls)),
]

