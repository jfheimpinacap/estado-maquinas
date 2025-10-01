from django.db import IntegrityError
from django.db.models import Q, Case, When, IntegerField, F, Value
from django.db.models.functions import Replace
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Maquinaria, Cliente, Obra, Arriendo, Documento, UserSecurity
from .serializers import (
    MaquinariaSerializer, ClienteSerializer, ObraSerializer,
    ArriendoSerializer, DocumentoSerializer, UserSerializer
)

MAX_FAILED = 5


def _get_or_create_sec(u: User) -> UserSecurity:
    sec, _ = UserSecurity.objects.get_or_create(user=u)
    return sec


class MaquinariaViewSet(viewsets.ModelViewSet):
    queryset = Maquinaria.objects.all()
    serializer_class = MaquinariaSerializer

    def list(self, request, *args, **kwargs):
        q = (request.GET.get("query") or "").strip()
        qs = self.get_queryset()
        if q:
            qs = qs.filter(
                Q(serie__iexact=q) |
                Q(marca__icontains=q) |
                Q(modelo__icontains=q)
            ).annotate(
                serie_match=Case(
                    When(serie__iexact=q, then=1),
                    default=0,
                    output_field=IntegerField()
                )
            ).order_by('-serie_match', 'marca', 'modelo')

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def historial(self, request, pk=None):
        try:
            maq = Maquinaria.objects.get(pk=pk)
        except Maquinaria.DoesNotExist:
            return Response({"detail": "Maquinaria no encontrada"}, status=404)

        arriendos = (Arriendo.objects
                     .filter(maquinaria=maq)
                     .select_related('obra')
                     .prefetch_related('documentos')
                     .order_by('-fecha_inicio', '-id'))

        historial = []
        for arr in arriendos:
            doc = arr.documentos.all().order_by('-fecha_emision', '-id').first()
            doc_label = f"{doc.tipo} {doc.numero}" if doc else "—"
            historial.append({
                "documento": doc_label,
                "fecha_inicio": arr.fecha_inicio,
                "fecha_termino": arr.fecha_termino,
                "obra": arr.obra.nombre if arr.obra_id else "—",
            })
        return Response(historial, status=200)


class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError:
            return Response({"detail": "El RUT ya existe."}, status=status.HTTP_400_BAD_REQUEST)

    def list(self, request, *args, **kwargs):
        q = (request.GET.get("query") or "").strip()
        qs = self.get_queryset()
        if q:
            if q.isdigit():
                normalized = Replace(Replace(F('rut'), Value('.'), Value('')), Value('-'), Value(''))
                qs = qs.annotate(rut_norm=normalized).filter(rut_norm__startswith=q)
            else:
                qs = qs.filter(Q(razon_social__icontains=q) | Q(rut__icontains=q))
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class ObraViewSet(viewsets.ModelViewSet):
    queryset = Obra.objects.all()
    serializer_class = ObraSerializer


class ArriendoViewSet(viewsets.ModelViewSet):
    queryset = Arriendo.objects.all()
    serializer_class = ArriendoSerializer

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
    email = (request.data.get('email') or '').strip() or None
    if not username or not password:
        return Response({'detail': 'Usuario y contraseña son requeridos.'}, status=400)
    if User.objects.filter(username__iexact=username).exists():
        return Response({'detail': 'El usuario ya existe.'}, status=400)
    user = User.objects.create_user(username=username, password=password, email=email, is_staff=False)
    _get_or_create_sec(user)  # si ya tienes esto en tu views
    return Response({'id': user.id, 'username': user.username, 'email': user.email}, status=201)



@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''
    if not username or not password:
        return Response({'detail': 'Usuario y contraseña son requeridos.'}, status=400)

    user = User.objects.filter(username__iexact=username).first()
    if user:
        sec = _get_or_create_sec(user)
        if sec.is_locked:
            return Response({'detail': 'Cuenta bloqueada. Use "Recuperar clave".'}, status=403)

    user = authenticate(username=username, password=password)
    if user is None:
        # fallo: incrementar contador si existe usuario
        u = User.objects.filter(username__iexact=username).first()
        if u:
            sec = _get_or_create_sec(u)
            sec.failed_attempts += 1
            if sec.failed_attempts >= MAX_FAILED:
                sec.is_locked = True
                sec.locked_at = timezone.now()
            sec.save(update_fields=['failed_attempts', 'is_locked', 'locked_at'])
        return Response({'detail': 'Credenciales inválidas.'}, status=400)

    # éxito: si estaba bloqueado, no permitir hasta recuperar
    sec = _get_or_create_sec(user)
    if sec.is_locked:
        return Response({'detail': 'Cuenta bloqueada. Use "Recuperar clave".'}, status=403)

    # resetear contador al ingresar bien
    if sec.failed_attempts:
        sec.failed_attempts = 0
        sec.save(update_fields=['failed_attempts'])

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


@api_view(['POST'])
@permission_classes([AllowAny])
def recover_start(request):
    """
    Placeholder: inicia proceso de recuperación.
    Ahora acepta 'email' (preferido) o 'username' como respaldo.
    """
    email = (request.data.get('email') or '').strip()
    username = (request.data.get('username') or '').strip()

    # No revelar existencia de la cuenta
    if not email and not username:
        return Response({'detail': 'Falta correo electrónico.'}, status=400)

    # Buscar por email (preferido) o username
    user_qs = None
    if email:
        user_qs = User.objects.filter(email__iexact=email)
    elif username:
        user_qs = User.objects.filter(username__iexact=username)

    # Aquí después: generar código y enviar correo si user_qs.exists()
    # Siempre respondemos 200 para no filtrar información
    return Response({'detail': 'Si el correo existe, se enviarán instrucciones.'}, status=200)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.order_by('id')
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]

