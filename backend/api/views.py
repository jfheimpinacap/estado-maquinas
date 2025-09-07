from rest_framework import viewsets
from rest_framework.response import Response
from django.db.models import Q
from .models import Maquinaria, Cliente, Obra, Arriendo, Documento
from .serializers import (
    MaquinariaSerializer, ClienteSerializer, ObraSerializer,
    ArriendoSerializer, DocumentoSerializer
)
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import UserSerializer


class MaquinariaViewSet(viewsets.ModelViewSet):
    queryset = Maquinaria.objects.all()
    serializer_class = MaquinariaSerializer

class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer

    # GET /clientes?query=...
    def list(self, request, *args, **kwargs):
        q = (request.GET.get("query") or "").strip()
        qs = self.get_queryset()
        if q:
            qs = qs.filter(Q(razon_social__icontains=q) | Q(rut__icontains=q))
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

class ObraViewSet(viewsets.ModelViewSet):
    queryset = Obra.objects.all()
    serializer_class = ObraSerializer

class ArriendoViewSet(viewsets.ModelViewSet):
    queryset = Arriendo.objects.all()
    serializer_class = ArriendoSerializer

    # POST /arriendos – valida disponibilidad
    def create(self, request, *args, **kwargs):
        maq_id = request.data.get("maquinaria")
        try:
            maq = Maquinaria.objects.get(pk=maq_id)
        except Maquinaria.DoesNotExist:
            return Response({"error": "Maquinaria no encontrada"}, status=404)

        if maq.estado != "Disponible":
            return Response({"error": "Maquinaria no disponible"}, status=400)

        resp = super().create(request, *args, **kwargs)
        if resp.status_code in (200, 201):
            maq.estado = "Arrendada"
            maq.save(update_fields=["estado"])
        return resp

class DocumentoViewSet(viewsets.ModelViewSet):
    queryset = Documento.objects.all()
    serializer_class = DocumentoSerializer

    # POST /documentos – si tipo = "Guia Retiro": setear estados
    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        if resp.status_code in (200, 201):
            doc_id = resp.data.get("id")
            try:
                doc = Documento.objects.get(pk=doc_id)
            except Documento.DoesNotExist:
                return resp

            if doc.tipo == "Guia Retiro":
                arriendo = doc.arriendo
                maq = arriendo.maquinaria
                maq.estado = "Disponible"
                maq.save(update_fields=["estado"])
                arriendo.estado = "Finalizado"
                arriendo.save(update_fields=["estado"])
        return resp

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''
    if not username or not password:
        return Response({'detail': 'Usuario y contraseña son requeridos.'}, status=400)
    if User.objects.filter(username__iexact=username).exists():
        return Response({'detail': 'El usuario ya existe.'}, status=400)
    user = User.objects.create_user(username=username, password=password, is_staff=False)
    return Response({'id': user.id, 'username': user.username}, status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get('username') or ''
    password = request.data.get('password') or ''
    user = authenticate(username=username, password=password)
    if user is None:
        return Response({'detail': 'Credenciales inválidas.'}, status=400)
    refresh = RefreshToken.for_user(user)
    data = {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'username': user.username,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
        }
    }
    return Response(data, status=200)

from rest_framework import viewsets

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.order_by('id')
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]  # solo admin

    # Al actualizar, si envías {"password": "..."} se aplicará set_password en el serializer
