from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from .models import Cliente, Maquinaria, Obra, Arriendo, Documento, OrdenTrabajo, DOC_TIPO
from django.contrib.auth.models import User

class ClienteSerializer(serializers.ModelSerializer):
    telefono = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    direccion = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    forma_pago = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    correo_electronico = serializers.EmailField(allow_blank=True, allow_null=True, required=False)

    class Meta:
        model = Cliente
        fields = [
            'id','razon_social','rut','direccion','telefono',
            'correo_electronico','forma_pago'
        ]

    def validate(self, attrs):
        for k in ['direccion','telefono','forma_pago','correo_electronico']:
            if attrs.get(k, None) == '':
                attrs[k] = None

        is_partial = getattr(self, 'partial', False)

        if (not is_partial) or ('rut' in attrs):
            rut = (attrs.get('rut') or '').strip()
            if not rut:
                raise serializers.ValidationError({'rut': 'El RUT es obligatorio.'})
            attrs['rut'] = rut.upper()

        if (not is_partial) or ('razon_social' in attrs):
            rs = (attrs.get('razon_social') or '').strip()
            if not rs:
                raise serializers.ValidationError({'razon_social': 'La razón social es obligatoria.'})
            attrs['razon_social'] = rs

        return attrs


class MaquinariaSerializer(serializers.ModelSerializer):
    obra = serializers.SerializerMethodField()

    class Meta:
        model = Maquinaria
        fields = [
            'id', 'marca', 'modelo', 'serie',
            'categoria', 'descripcion',
            'altura', 'anio', 'tonelaje', 'carga',
            'estado', 'obra'
        ]

    def get_obra(self, obj):
        arriendo_activo = obj.arriendos.filter(estado="Activo").select_related("obra").order_by('-fecha_inicio').first()
        if arriendo_activo and arriendo_activo.obra:
            return arriendo_activo.obra.nombre
        return "Bodega"


class ObraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Obra
        fields = ['id','nombre','direccion','contacto_nombre','contacto_telefono','contacto_email']


class ArriendoSerializer(serializers.ModelSerializer):
    maquinaria = serializers.PrimaryKeyRelatedField(queryset=Maquinaria.objects.all(), allow_null=True, required=False)
    cliente = serializers.PrimaryKeyRelatedField(queryset=Cliente.objects.all(), allow_null=True, required=False)
    obra = serializers.PrimaryKeyRelatedField(queryset=Obra.objects.all(), allow_null=True, required=False)

    class Meta:
        model = Arriendo
        fields = ['id','maquinaria','cliente','obra','fecha_inicio','fecha_termino','periodo','tarifa','estado']


class DocumentoSerializer(serializers.ModelSerializer):
    arriendo = serializers.PrimaryKeyRelatedField(queryset=Arriendo.objects.all())

    class Meta:
        model = Documento
        fields = ['id','arriendo','tipo','numero','fecha_emision','archivo_url']


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8, max_length=10)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'is_staff', 'is_superuser', 'date_joined']
        read_only_fields = ['id', 'date_joined']

    def validate(self, attrs):
        """
        Seguridad:
        - Sólo un superusuario puede cambiar is_superuser.
        - Un admin (is_staff) o superuser puede cambiar is_staff.
        """
        request = self.context.get('request')
        if request and 'is_superuser' in attrs:
            if not request.user.is_superuser:
                raise PermissionDenied("No tiene permisos para cambiar 'is_superuser'.")
        if request and 'is_staff' in attrs:
            if not (request.user.is_staff or request.user.is_superuser):
                raise PermissionDenied("No tiene permisos para cambiar 'is_staff'.")
        return attrs

    def create(self, validated_data):
        pwd = validated_data.pop('password', None)
        user = User(**validated_data)
        if pwd:
            user.set_password(pwd)
        user.save()
        return user

    def update(self, instance, validated_data):
        pwd = validated_data.pop('password', None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if pwd:
            instance.set_password(pwd)
        instance.save()
        return instance

class DocumentoRelacionSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = Documento
        fields = ['id', 'tipo', 'tipo_display', 'numero', 'fecha_emision', 'monto_neto', 'monto_iva', 'monto_total']

class DocumentoDetalleSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    cliente_razon = serializers.CharField(source='cliente.razon_social', read_only=True)
    arriendo_id = serializers.IntegerField(source='arriendo.id', read_only=True)
    # Relación principal (ej: FACT -> GD | NC -> FACT | ND -> NC)
    relacionado_con = DocumentoRelacionSerializer(read_only=True)
    # Hijas inversas (p.ej. FACT -> [NC...], GD no suele tener hijas)
    relaciones_inversas = DocumentoRelacionSerializer(many=True, read_only=True)

    class Meta:
        model = Documento
        fields = [
            'id', 'tipo', 'tipo_display', 'numero', 'fecha_emision',
            'monto_neto', 'monto_iva', 'monto_total',
            'cliente', 'cliente_razon', 'arriendo_id',
            'relacionado_con', 'relaciones_inversas',
            'es_retiro', 'obra_origen', 'obra_destino', 'archivo_url'
        ]


class OrdenTrabajoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    cliente_razon = serializers.CharField(source='cliente.razon_social', read_only=True)
    maquinaria_label = serializers.SerializerMethodField()
    factura = DocumentoRelacionSerializer(read_only=True)
    guia = DocumentoRelacionSerializer(read_only=True)

    class Meta:
        model = OrdenTrabajo
        fields = [
            'id', 'tipo', 'tipo_display', 'estado', 'estado_display',
            'es_facturable', 'fecha_creacion', 'fecha_cierre',
            'cliente', 'cliente_razon', 'arriendo', 'maquinaria', 'maquinaria_label',
            'factura', 'guia', 'observaciones'
        ]

    def get_maquinaria_label(self, obj):
        if obj.maquinaria_id:
            m = obj.maquinaria
            return f"{m.marca} {m.modelo} ({m.serie})" if m.serie else f"{m.marca} {m.modelo}"
        return None

