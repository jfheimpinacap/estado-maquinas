# backend/api/serializers.py
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from django.db import IntegrityError
from .models import Cliente, Maquinaria, Obra, Arriendo, Documento, OrdenTrabajo, DOC_TIPO
from django.contrib.auth.models import User


class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = [
            "id",
            "razon_social",
            "rut",
            "direccion",
            "telefono",
            "correo_electronico",
            "forma_pago",
        ]
        # 🔴 Nada es estrictamente requerido a nivel de API
        extra_kwargs = {
            "razon_social": {"required": False, "allow_blank": True},
            "rut": {"required": False, "allow_blank": True},
            "direccion": {"required": False, "allow_blank": True, "allow_null": True},
            "telefono": {"required": False, "allow_blank": True, "allow_null": True},
            "correo_electronico": {
                "required": False,
                "allow_blank": True,
                "allow_null": True,
            },
            "forma_pago": {"required": False, "allow_blank": True, "allow_null": True},
        }

    def validate(self, attrs):
        """
        Limpieza suave: cadenas vacías -> None en campos opcionales.
        (No hacemos validación de RUT ni razón social aquí; eso lo controla el front.)
        """
        for k in ["direccion", "telefono", "correo_electronico", "forma_pago"]:
            if attrs.get(k, "") == "":
                attrs[k] = None
        return attrs
    
    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except IntegrityError:
            raise serializers.ValidationError({"rut": ["El RUT ya existe."]})
    

class MaquinariaSerializer(serializers.ModelSerializer):
    """
    Serializer con reglas por categoría:
      - Acepta etiquetas de UI: 'elevador', 'camion', 'otro'
      - Normaliza a BD: 'equipos_altura', 'camiones', 'equipos_carga'
      - Descarta campos que no aplican según categoría.
      - Todos opcionales salvo 'marca'.
    """
    obra = serializers.SerializerMethodField()

    class Meta:
        model = Maquinaria
        fields = [
            'id', 'marca', 'modelo', 'serie',
            'categoria', 'descripcion',
            'altura', 'anio', 'tonelaje', 'carga',
            'estado', 'combustible', 'tipo_altura',  
            'obra'
        ]
        # Hacemos opcionales (menos 'marca')
        extra_kwargs = {
            'marca':       {'required': True},
            'modelo':      {'required': False, 'allow_null': True, 'allow_blank': True},
            'serie':       {'required': False, 'allow_null': True, 'allow_blank': True},
            'descripcion': {'required': False, 'allow_null': True, 'allow_blank': True},
            'categoria':   {'required': False, 'allow_null': True, 'allow_blank': True},
            'altura':      {'required': False, 'allow_null': True},
            'anio':        {'required': False, 'allow_null': True},
            'tonelaje':    {'required': False, 'allow_null': True},
            'carga':       {'required': False, 'allow_null': True},
            'estado':      {'required': False, 'allow_null': True, 'allow_blank': True},
            'combustible': {'required': False, 'allow_null': True, 'allow_blank': True},  
            'tipo_altura': {'required': False, 'allow_null': True, 'allow_blank': True},            
        }

    # ---------- helpers ----------
    def _canon_categoria(self, v: str | None) -> str | None:
        if not v:
            return None
        s = str(v).strip().lower()
        # etiquetas de UI → valores de tu BD
        mapping = {
            'elevador': 'equipos_altura',
            'elevadores': 'equipos_altura',
            'altura': 'equipos_altura',
            'camion': 'camiones',
            'camiones': 'camiones',
            'otro': 'equipos_carga',
            'carga': 'equipos_carga',
            'generico': 'equipos_carga',
        }
        return mapping.get(s, s)  # si ya viene 'equipos_altura', 'camiones' o 'equipos_carga', lo respeta

    def _clean_blank_to_none(self, data: dict, keys: list[str]):
        for k in keys:
            if data.get(k, None) == '':
                data[k] = None

    # ---------- fields calculados ----------
    def get_obra(self, obj):
        arriendo_activo = obj.arriendos.filter(estado="Activo").select_related("obra").order_by('-fecha_inicio').first()
        if arriendo_activo and arriendo_activo.obra:
            return arriendo_activo.obra.nombre
        return "Bodega"

    # ---------- validación principal ----------
    def validate(self, attrs):
        # Mezcla con instancia (en updates) para validar con estado completo
        base = {}
        if self.instance:
            # sólo tomamos campos del serializer
            for f in self.fields.keys():
                if hasattr(self.instance, f):
                    base[f] = getattr(self.instance, f)
        data = {**base, **attrs}

        # Normaliza categoría desde la UI
        data['categoria'] = self._canon_categoria(data.get('categoria'))

        # Limpia textos vacíos → None
        self._clean_blank_to_none(data, ['modelo', 'serie', 'descripcion', 'estado'])

        # Reglas por categoría
        cat = data.get('categoria')

        # ELEVADOR (equipos_altura): no usa carga/tonelaje, sí puede usar altura
        if cat == 'equipos_altura':
            data['carga'] = None
            data['tonelaje'] = None
            # altura opcional pero si viene, debe ser >= 0
            if data.get('altura') is not None:
                try:
                    if float(data['altura']) < 0:
                        raise serializers.ValidationError({'altura': 'La altura no puede ser negativa.'})
                except (TypeError, ValueError):
                    raise serializers.ValidationError({'altura': 'Altura debe ser numérica.'})

        # CAMIÓN (camiones): no usa altura; si mandas sólo "carga" la mapeamos a "tonelaje"
        elif cat == 'camiones':
            data['altura'] = None
            # Si sólo llega 'carga' (kg/ton), úsala como tonelaje si 'tonelaje' no viene
            if data.get('tonelaje') is None and data.get('carga') is not None:
                data['tonelaje'] = data['carga']

            # Validaciones suaves (opcionales)
            for key in ('tonelaje', 'carga', 'anio'):
                if data.get(key) is not None:
                    try:
                        float(data[key])
                    except (TypeError, ValueError):
                        raise serializers.ValidationError({key: f'{key.capitalize()} debe ser numérico.'})

        # OTRO (equipos_carga u omiso): todo opcional; sin reglas extra
        else:
            pass

        # Marca requerida siempre (como en Django admin)
        marca = (data.get('marca') or '').strip()
        if not marca:
            raise serializers.ValidationError({'marca': 'La marca es obligatoria.'})
        data['marca'] = marca

        # Devolvemos sólo lo que pertenece al serializer
        cleaned = {k: v for k, v in data.items() if k in self.fields}
        return cleaned


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

    # para mostrar también el tipo comercial legible
    tipo_comercial_display = serializers.CharField(
        source='get_tipo_comercial_display',
        read_only=True,
    )

    # líneas de detalle (multi-máquina)
    detalle_lineas = serializers.JSONField(required=False)

    class Meta:
        model = OrdenTrabajo
        fields = [
            'id',
            'tipo', 'tipo_display',
            'tipo_comercial', 'tipo_comercial_display',
            'estado', 'estado_display',
            'es_facturable',
            'fecha_creacion', 'fecha_cierre',

            'cliente', 'cliente_razon',
            'arriendo', 'maquinaria', 'maquinaria_label',

            'factura', 'guia',
            'observaciones',

            # datos generales de la OT
            'direccion', 'obra_nombre', 'contactos',
            'orden_compra', 'vendedor', 'fecha_emision_doc',

            # económicos
            'detalle_lineas', 'monto_neto', 'monto_iva', 'monto_total',
        ]
        extra_kwargs = {
            'orden_compra': {
                'required': False,
                'allow_blank': True,
                'allow_null': True,
            },
            'vendedor': {
                'required': False,
                'allow_blank': True,
                'allow_null': True,
            },
            'fecha_emision_doc': {
                'required': False,
                'allow_null': True,
            },
        }

    def get_maquinaria_label(self, obj):
        if obj.maquinaria_id:
            m = obj.maquinaria
            if m.serie:
                return f"{m.marca} {m.modelo} ({m.serie})"
            return f"{m.marca} {m.modelo}"
        return None



