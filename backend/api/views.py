from django.db import IntegrityError
from django.db.models import Q, Case, When, IntegerField, F, Value
from django.db.models.functions import Replace
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone
import json

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    Maquinaria, Cliente, Obra, Arriendo,
    Documento, OrdenTrabajo, UserSecurity, DOC_TIPO
)
from .serializers import (
    MaquinariaSerializer, ClienteSerializer, ObraSerializer,
    ArriendoSerializer,
    # nuevos serializers para documentos/OT:
    DocumentoDetalleSerializer, OrdenTrabajoSerializer,
    # admin users:
    UserSerializer
)

MAX_FAILED = 5


def _get_or_create_sec(u: User) -> UserSecurity:
    sec, _ = UserSecurity.objects.get_or_create(user=u)
    return sec


# =======================
#   Maquinarias
# =======================
class MaquinariaViewSet(viewsets.ModelViewSet):
    queryset = Maquinaria.objects.all()
    serializer_class = MaquinariaSerializer
    permission_classes = [IsAuthenticated]

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
        """
        Historial cronológico de arriendos de la máquina con doc más reciente
        de cada arriendo.
        """
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
            doc_label = f"{doc.get_tipo_display()} {doc.numero}" if doc else "—"
            historial.append({
                "documento": doc_label,
                "fecha_inicio": arr.fecha_inicio,
                "fecha_termino": arr.fecha_termino,
                "obra": arr.obra.nombre if arr.obra_id else "—",
            })
        return Response(historial, status=200)


# =======================
#   Clientes
# =======================
class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        """
        Crear cliente leyendo el JSON crudo del body.
        Sin validaciones manuales de campos obligatorios
        (ya las haces en el frontend).
        """
        # DEBUG: ver qué llega realmente (si quieres mirar la consola del servidor)
        print(">>> [Clientes] request.body:", request.body)
        print(">>> [Clientes] request.data:", request.data)

        # Intentamos parsear JSON crudo
        try:
            raw_body = request.body.decode("utf-8")
            data = json.loads(raw_body or "{}")
        except Exception:
            # fallback: lo que DRF haya parseado
            data = request.data

        # Extraemos campos; si no vienen, quedan como string vacío o None
        razon_social = (data.get("razon_social") or "").strip()
        rut = (data.get("rut") or "").strip()
        direccion = (data.get("direccion") or "").strip() or None
        telefono = (data.get("telefono") or "").strip() or None
        correo = (data.get("correo_electronico") or "").strip() or None
        forma_pago = (data.get("forma_pago") or "").strip() or None

        try:
            cliente = Cliente.objects.create(
                razon_social=razon_social,
                rut=rut,
                direccion=direccion,
                telefono=telefono,
                correo_electronico=correo,
                forma_pago=forma_pago,
            )
        except IntegrityError:
            # RUT duplicado
            return Response(
                {"rut": ["El RUT ya existe."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(cliente)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        q = (request.GET.get("query") or "").strip()
        qs = self.get_queryset()
        if q:
            if q.isdigit():
                from django.db.models import F, Value
                from django.db.models.functions import Replace
                from django.db.models import Q

                normalized = Replace(
                    Replace(F("rut"), Value("."), Value("")),
                    Value("-"), Value("")
                )
                qs = qs.annotate(rut_norm=normalized).filter(rut_norm__startswith=q)
            else:
                from django.db.models import Q
                qs = qs.filter(
                    Q(razon_social__icontains=q) |
                    Q(rut__icontains=q)
                )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


# =======================
#   Obras
# =======================
class ObraViewSet(viewsets.ModelViewSet):
    queryset = Obra.objects.all()
    serializer_class = ObraSerializer
    permission_classes = [IsAuthenticated]


# =======================
#   Arriendos
# =======================
class ArriendoViewSet(viewsets.ModelViewSet):
    queryset = Arriendo.objects.all()
    serializer_class = ArriendoSerializer
    permission_classes = [IsAuthenticated]

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


# =======================
#   Documentos (consulta)
# =======================
class DocumentoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consulta de documentos tributarios con asociaciones:
    - FACT -> (opcional) GD en relacionado_con (periodo inicial)
    - FACT -> puede tener varias NC (relaciones_inversas)
    - NC   -> puede tener varias ND (relaciones_inversas)
    - GD   -> es_retiro indica retiro (no facturable) vs despacho (facturable)
    Filtros: tipo, numero, cliente (razón social o RUT), desde, hasta.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = DocumentoDetalleSerializer
    queryset = (Documento.objects
                .select_related('cliente', 'arriendo', 'obra_origen', 'obra_destino', 'relacionado_con')
                .prefetch_related('relaciones_inversas'))

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        tipo = (request.GET.get("tipo") or "").upper().strip()
        numero = (request.GET.get("numero") or "").strip()
        cliente = (request.GET.get("cliente") or "").strip()
        desde = request.GET.get("desde")
        hasta = request.GET.get("hasta")

        if tipo in dict(DOC_TIPO):
            qs = qs.filter(tipo=tipo)
        if numero:
            qs = qs.filter(numero__icontains=numero)
        if cliente:
            qs = qs.filter(Q(cliente__razon_social__icontains=cliente) | Q(cliente__rut__icontains=cliente))
        if desde:
            qs = qs.filter(fecha_emision__gte=desde)
        if hasta:
            qs = qs.filter(fecha_emision__lte=hasta)

        qs = qs.order_by('-fecha_emision', '-id')
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)


# =======================
#   Órdenes de Trabajo (estado)
# =======================
class OrdenTrabajoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    “Estado de arriendos y servicios activos”
    GET /ordenes?solo_pendientes=true   -> solo PEND
    """
    permission_classes = [IsAuthenticated]
    serializer_class = OrdenTrabajoSerializer
    queryset = (OrdenTrabajo.objects
                .select_related('cliente', 'arriendo', 'maquinaria', 'factura', 'guia'))

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        solo_pend = (request.GET.get("solo_pendientes") or "").lower() in ("1", "true", "t", "yes", "y")
        if solo_pend:
            qs = qs.filter(estado="PEND")
        qs = qs.order_by('-fecha_creacion')
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)


# =======================
#   Auth & Users (igual que tenías)
# =======================
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
    _get_or_create_sec(user)
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
        u = User.objects.filter(username__iexact=username).first()
        if u:
            sec = _get_or_create_sec(u)
            sec.failed_attempts += 1
            if sec.failed_attempts >= MAX_FAILED:
                sec.is_locked = True
                sec.locked_at = timezone.now()
            sec.save(update_fields=['failed_attempts', 'is_locked', 'locked_at'])
        return Response({'detail': 'Credenciales inválidas.'}, status=400)

    sec = _get_or_create_sec(user)
    if sec.is_locked:
        return Response({'detail': 'Cuenta bloqueada. Use "Recuperar clave".'}, status=403)

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
    Placeholder: inicia proceso de recuperación (email o username).
    """
    email = (request.data.get('email') or '').strip()
    username = (request.data.get('username') or '').strip()

    if not email and not username:
        return Response({'detail': 'Falta correo electrónico.'}, status=400)

    # Luego: generar código y enviar correo si existe
    return Response({'detail': 'Si el correo existe, se enviarán instrucciones.'}, status=200)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.order_by('id')
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]

