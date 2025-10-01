from django.db import models
from django.contrib.auth.models import User

class Maquinaria(models.Model):
    marca = models.CharField(max_length=50)
    modelo = models.CharField(max_length=50)
    serie = models.CharField(max_length=50, unique=True)
    altura = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    estado = models.CharField(max_length=20, default="Disponible")
    categoria = models.CharField(max_length=30, null=True, blank=True)
    descripcion = models.CharField(max_length=400, null=True, blank=True)
    anio = models.IntegerField(null=True, blank=True)
    tonelaje = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    carga = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = 'Maquinaria'

    def __str__(self):
        return f"{self.marca} {self.modelo} ({self.serie})"


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
        db_table = 'Cliente'

    def __str__(self):
        return self.razon_social


class Obra(models.Model):
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=200, blank=True, null=True)
    contacto_nombre = models.CharField(max_length=100, blank=True, null=True)
    contacto_telefono = models.CharField(max_length=20, blank=True, null=True)
    contacto_email = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = 'Obra'

    def __str__(self):
        return self.nombre


class Arriendo(models.Model):
    PERIODO_CHOICES = (("Dia", "Dia"), ("Semana", "Semana"), ("Mes", "Mes"))

    maquinaria = models.ForeignKey('Maquinaria', on_delete=models.PROTECT, related_name="arriendos", null=True, blank=True)
    cliente = models.ForeignKey('Cliente', on_delete=models.PROTECT, related_name="arriendos", null=True, blank=True)
    obra = models.ForeignKey('Obra', on_delete=models.PROTECT, related_name="arriendos", null=True, blank=True)
    fecha_inicio = models.DateField()
    fecha_termino = models.DateField(blank=True, null=True)
    periodo = models.CharField(max_length=20, choices=PERIODO_CHOICES)
    tarifa = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.CharField(max_length=20, default="Activo")

    class Meta:
        db_table = 'Arriendo'

    def __str__(self):
        return f"Arriendo #{self.id}"


class Documento(models.Model):
    TIPO_CHOICES = (
        ("Guia Despacho", "Guia Despacho"),
        ("Guia Retiro", "Guia Retiro"),
        ("Factura", "Factura"),
    )

    arriendo = models.ForeignKey(Arriendo, on_delete=models.CASCADE, related_name="documentos")
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES)
    numero = models.CharField(max_length=50)
    fecha_emision = models.DateField()
    archivo_url = models.CharField(max_length=200, blank=True, null=True)

    class Meta:
        db_table = 'Documento'

    def __str__(self):
        return f"{self.tipo} {self.numero}"


# --- Seguridad de login: intentos fallidos y bloqueo ---
class UserSecurity(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="security")
    failed_attempts = models.PositiveIntegerField(default=0)
    is_locked = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'UserSecurity'

    def __str__(self):
        return f"Sec({self.user.username}) {self.failed_attempts} fallos - bloqueado={self.is_locked}"





