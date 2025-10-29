# backend/api/models.py
from django.db import models
from django.contrib.auth.models import User


# -----------------------------
# Maquinaria / Clientes / Obra
# -----------------------------

class Maquinaria(models.Model):
    CATEGORIA = (
        ("equipos_altura", "Equipos para trabajo en altura"),
        ("camiones", "Camiones"),
        ("equipos_carga", "Equipos para carga"),
        ("otro", "Otro"),
    )
    ESTADO = (
        ("Disponible", "Disponible"),
        ("Para venta", "Para venta"),
    )
    TIPO_ALTURA = (
        ("tijera", "Tijera"),
        ("brazo", "Brazo articulado"),
    )
    COMBUSTIBLE = (
        ("electrico", "Eléctrico"),
        ("diesel", "Diésel"),
    )

    marca = models.CharField(max_length=120)
    modelo = models.CharField(max_length=120, blank=True, null=True)
    serie = models.CharField(max_length=120, blank=True, null=True, unique=True)
    categoria = models.CharField(max_length=32, choices=CATEGORIA, default="otro")
    descripcion = models.TextField(blank=True, null=True)

    # Campos técnicos
    altura = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    anio = models.IntegerField(blank=True, null=True)
    tonelaje = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    carga = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)

    # NUEVOS (solo relevantes para elevadores; quedan opcionales)
    tipo_altura = models.CharField(max_length=16, choices=TIPO_ALTURA, blank=True, null=True)
    combustible = models.CharField(max_length=16, choices=COMBUSTIBLE, blank=True, null=True)

    estado = models.CharField(max_length=20, choices=ESTADO, default="Disponible")

    def __str__(self):
        return f"{self.marca} {self.modelo or ''} ({self.serie or 's/serie'})".strip()


class Cliente(models.Model):
    razon_social = models.CharField(max_length=100)
    rut = models.CharField(max_length=20, unique=True)
    direccion = models.CharField(max_length=200, blank=True, null=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    correo_electronico = models.EmailField(max_length=254, blank=True, null=True)

    FORMA_PAGO_CHOICES = [
        ("Pago a 15 días", "Pago a 15 días"),
        ("Pago a 30 días", "Pago a 30 días"),
        ("Pago contado", "Pago contado"),
    ]
    forma_pago = models.CharField(max_length=50, blank=True, null=True, choices=FORMA_PAGO_CHOICES)

    class Meta:
        db_table = "Cliente"

    def __str__(self):
        return self.razon_social


class Obra(models.Model):
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=200, blank=True, null=True)
    contacto_nombre = models.CharField(max_length=100, blank=True, null=True)
    contacto_telefono = models.CharField(max_length=20, blank=True, null=True)
    contacto_email = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = "Obra"

    def __str__(self):
        return self.nombre


# -----------------------------
# Arriendo
# -----------------------------
class Arriendo(models.Model):
    PERIODO_CHOICES = (("Dia", "Dia"), ("Semana", "Semana"), ("Mes", "Mes"))

    maquinaria = models.ForeignKey("Maquinaria", on_delete=models.PROTECT, related_name="arriendos", null=True, blank=True)
    cliente = models.ForeignKey("Cliente", on_delete=models.PROTECT, related_name="arriendos", null=True, blank=True)
    obra = models.ForeignKey("Obra", on_delete=models.PROTECT, related_name="arriendos", null=True, blank=True)
    fecha_inicio = models.DateField()
    fecha_termino = models.DateField(blank=True, null=True)
    periodo = models.CharField(max_length=20, choices=PERIODO_CHOICES)
    tarifa = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.CharField(max_length=20, default="Activo")

    class Meta:
        db_table = "Arriendo"

    def __str__(self):
        return f"Arriendo #{self.id}"


# --------------------------------------------
# Seguridad de login: intentos fallidos/bloqueo
# --------------------------------------------
class UserSecurity(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="security")
    failed_attempts = models.PositiveIntegerField(default=0)
    is_locked = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "UserSecurity"

    def __str__(self):
        return f"Sec({self.user.username}) {self.failed_attempts} fallos - bloqueado={self.is_locked}"


# -----------------------------
# Documentos tributarios (CL)
# -----------------------------
DOC_TIPO = (
    ("FACT", "Factura"),
    ("GD",   "Guía de despacho"),
    ("NC",   "Nota de crédito"),
    ("ND",   "Nota de débito"),
)

class Documento(models.Model):
    # Códigos cortos -> max_length=4
    tipo = models.CharField(max_length=4, choices=DOC_TIPO)  # FACT, GD, NC, ND
    numero = models.CharField(max_length=50)
    fecha_emision = models.DateField()

    # Monto base (para FACT/NC/ND). Para GD puede ser 0 o null.
    monto_neto  = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    monto_iva   = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    monto_total = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Relación al arriendo (si aplica)
    arriendo = models.ForeignKey("Arriendo", on_delete=models.CASCADE, related_name="documentos")
    archivo_url = models.CharField(max_length=200, blank=True, null=True)

    # Cliente “congelado” al emitir (consulta directa)
    cliente = models.ForeignKey("Cliente", on_delete=models.PROTECT, related_name="documentos", null=True, blank=True)

    # Relaciones entre documentos:
    # FACT -> (opcional) GD asociada al periodo inicial
    # NC   -> FACT asociada
    # ND   -> NC asociada
    relacionado_con = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="relaciones_inversas",
        help_text="Documento fuente asociado (FACT→GD | NC→FACT | ND→NC)",
    )

    # Guía de despacho: metadatos de traslado/retiro
    es_retiro = models.BooleanField(default=False, help_text="Guía de retiro (no facturable)")
    obra_origen = models.ForeignKey("Obra", null=True, blank=True, on_delete=models.PROTECT, related_name="guias_salida")
    obra_destino = models.ForeignKey("Obra", null=True, blank=True, on_delete=models.PROTECT, related_name="guias_entrada")

    class Meta:
        db_table = "Documento"
        indexes = [
            models.Index(fields=["tipo", "numero"]),
            models.Index(fields=["fecha_emision"]),
        ]

    def __str__(self):
        return f"{self.get_tipo_display()} {self.numero}"


# --------------------------------------------
# Órdenes de trabajo (motor “pendiente de facturar”)
# --------------------------------------------
OT_TIPO = (
    ("ALTA", "Inicio arriendo"),
    ("PROL", "Prolongación arriendo"),
    ("TRAS", "Traslado (flete entre obras)"),
    ("RETI", "Retiro (guía retiro)"),
    ("SERV", "Servicio puntual"),
)

OT_ESTADO = (
    ("PEND", "Pendiente"),
    ("PROC", "Procesada"),
    ("ANUL", "Anulada"),
)

class OrdenTrabajo(models.Model):
    arriendo   = models.ForeignKey("Arriendo", on_delete=models.PROTECT, related_name="ordenes", null=True, blank=True)
    cliente    = models.ForeignKey("Cliente", on_delete=models.PROTECT, related_name="ordenes")
    maquinaria = models.ForeignKey("Maquinaria", on_delete=models.PROTECT, related_name="ordenes", null=True, blank=True)

    tipo   = models.CharField(max_length=4, choices=OT_TIPO)
    estado = models.CharField(max_length=4, choices=OT_ESTADO, default="PEND")

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_cierre   = models.DateTimeField(null=True, blank=True)

    # Lógica de facturación/documentación
    es_facturable = models.BooleanField(default=False)
    factura = models.ForeignKey("Documento", on_delete=models.SET_NULL, null=True, blank=True, related_name="ot_facturadas")
    guia    = models.ForeignKey("Documento", on_delete=models.SET_NULL, null=True, blank=True, related_name="ot_guias")

    observaciones = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "OrdenTrabajo"
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return f"OT #{self.id} [{self.get_tipo_display()}] – {self.get_estado_display()}"





