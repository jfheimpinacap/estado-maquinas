# generar_datos_fake.py
"""
Generador de datos falsos para:
- Usuarios (auth.User)
- Clientes
- Maquinaria elevadores (categoria='equipos_altura')
- Maquinaria camiones (categoria='camiones')
"""

import os
import sys
import random
from decimal import Decimal
from pathlib import Path

from faker import Faker

# ==========================================
# 1) Inicializar Django usando la MISMA
#    config que usa manage.py / start.py
# ==========================================
ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"

# Añadir carpeta backend al sys.path
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "estado_maquinas.settings")

import django  # ahora sí
django.setup()

# 2) Importar modelos de Django
from django.contrib.auth.models import User
from api.models import Maquinaria, Cliente  # nota: api.models, no backend.api

faker = Faker("es_CL")



# =========================
# Utilidades
# =========================
def input_entero(mensaje, minimo=0, por_defecto=0):
    """
    Pide un entero por consola.
    Si el usuario deja vacío, usa el valor por_defecto.
    """
    while True:
        valor = input(f"{mensaje} (por defecto {por_defecto}): ").strip()
        if not valor:
            return por_defecto
        try:
            n = int(valor)
            if n < minimo:
                print(f"Debe ser un número >= {minimo}")
                continue
            return n
        except ValueError:
            print("Por favor, ingresa un número válido.")


def generar_serie(prefijo: str) -> str:
    """
    Genera una serie única para Maquinaria, con el prefijo indicado.
    """
    while True:
        numero = faker.random_number(digits=6, fix_len=True)
        serie = f"{prefijo}-{numero}"
        if not Maquinaria.objects.filter(serie=serie).exists():
            return serie


def generar_rut_unico() -> str:
    """
    Genera un RUT chileno simple y único para Cliente.
    (No valida dígito verificador real, solo formato cuerpo-DV.)
    """
    while True:
        cuerpo = faker.random_number(digits=8, fix_len=True)
        dv = random.choice(list("0123456789K"))
        rut = f"{cuerpo}-{dv}"
        if not Cliente.objects.filter(rut=rut).exists():
            return rut


# =========================
# Creación de usuarios
# =========================
def crear_usuarios(cantidad: int):
    if cantidad <= 0:
        print("No se crearán usuarios.")
        return

    print(f"\nCreando {cantidad} usuarios de prueba...")

    for i in range(cantidad):
        base_username = faker.user_name()
        username = base_username

        # Asegurar username único
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{random.randint(100, 999)}"

        email = faker.unique.email()
        first_name = faker.first_name()
        last_name = faker.last_name()

        user = User.objects.create_user(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            password="Test1234!"  # contraseña genérica de pruebas
        )

        print(f"  [{i+1}/{cantidad}] Usuario creado: {user.username} - {user.email}")

    print("✅ Usuarios creados.\n")


# =========================
# Creación de clientes
# =========================
def crear_clientes(cantidad: int):
    if cantidad <= 0:
        print("No se crearán clientes.")
        return

    print(f"\nCreando {cantidad} clientes de prueba...")

    formas_pago_posibles = [op[0] for op in Cliente.FORMA_PAGO_CHOICES]

    for i in range(cantidad):
        razon = faker.company()
        rut = generar_rut_unico()
        direccion = faker.address().replace("\n", ", ")
        telefono = faker.phone_number()
        correo = faker.company_email()
        forma_pago = random.choice(formas_pago_posibles)

        cli = Cliente.objects.create(
            razon_social=razon,
            rut=rut,
            direccion=direccion,
            telefono=telefono,
            correo_electronico=correo,
            forma_pago=forma_pago,
        )

        print(f"  [{i+1}/{cantidad}] Cliente: {cli.razon_social} - {cli.rut}")

    print("✅ Clientes creados.\n")


# =========================
# Creación de elevadores
# =========================
def crear_elevadores(cantidad: int):
    if cantidad <= 0:
        print("No se crearán elevadores.")
        return

    print(f"\nCreando {cantidad} elevadores (categoria='equipos_altura')...")

    marcas_elevadores = ["JLG", "Genie", "Haulotte", "XCMG", "MPG", "Skyjack"]
    alturas_posibles = [8, 10, 12, 14, 16, 18, 20]  # metros
    cargas_posibles = [230, 300, 450, 500]          # kg

    for i in range(cantidad):
        marca = random.choice(marcas_elevadores)
        modelo = f"ELV-{faker.random_number(digits=3, fix_len=True)}"
        serie = generar_serie("ELV")

        altura = Decimal(str(random.choice(alturas_posibles)))
        carga = Decimal(str(random.choice(cargas_posibles)))
        anio = random.randint(2008, 2024)

        tipo_altura = random.choice(["tijera", "brazo"])
        combustible = random.choice(["electrico", "diesel"])

        maq = Maquinaria.objects.create(
            marca=marca,
            modelo=modelo,
            serie=serie,
            categoria="equipos_altura",
            descripcion=f"Elevador {tipo_altura} {marca} {modelo}, {altura} m, {combustible}.",
            altura=altura,
            anio=anio,
            tonelaje=None,
            carga=carga,
            tipo_altura=tipo_altura,
            combustible=combustible,
            estado="Disponible",
        )

        print(
            f"  [{i+1}/{cantidad}] Elevador: {maq.marca} {maq.modelo} "
            f"({maq.serie}) {maq.altura}m {maq.combustible}"
        )

    print("✅ Elevadores creados.\n")


# =========================
# Creación de camiones
# =========================
def crear_camiones(cantidad: int):
    if cantidad <= 0:
        print("No se crearán camiones.")
        return

    print(f"\nCreando {cantidad} camiones (categoria='camiones')...")

    marcas_camiones = ["Iveco", "Mercedes-Benz", "Scania", "Volvo", "Hino", "Fuso", "MPG"]
    tonelajes_posibles = [3.5, 5, 7.5, 10, 12, 15]  # toneladas
    cargas_posibles = [2000, 4000, 6000, 8000, 10000]  # kg

    for i in range(cantidad):
        marca = random.choice(marcas_camiones)
        modelo = f"TRK-{faker.random_number(digits=3, fix_len=True)}"
        serie = generar_serie("TRK")

        tonelaje = Decimal(str(random.choice(tonelajes_posibles)))
        carga = Decimal(str(random.choice(cargas_posibles)))
        anio = random.randint(2008, 2024)

        maq = Maquinaria.objects.create(
            marca=marca,
            modelo=modelo,
            serie=serie,
            categoria="camiones",
            descripcion=f"Camión {marca} {modelo}, {tonelaje} ton, carga útil {carga} kg.",
            altura=None,
            anio=anio,
            tonelaje=tonelaje,
            carga=carga,
            tipo_altura=None,
            combustible="diesel",
            estado="Disponible",
        )

        print(
            f"  [{i+1}/{cantidad}] Camión: {maq.marca} {maq.modelo} "
            f"({maq.serie}) {maq.tonelaje} ton"
        )

    print("✅ Camiones creados.\n")


# =========================
# main
# =========================
def main():
    print("=== Generador de datos falsos (Usuarios, Clientes, Elevadores, Camiones) ===\n")

    n_usuarios = input_entero("¿Cuántos usuarios quieres crear?", minimo=0, por_defecto=0)
    n_clientes = input_entero("¿Cuántos clientes quieres crear?", minimo=0, por_defecto=0)
    n_elevadores = input_entero("¿Cuántas máquinas elevadoras quieres crear?", minimo=0, por_defecto=0)
    n_camiones = input_entero("¿Cuántos camiones quieres crear?", minimo=0, por_defecto=0)

    print("\nResumen de lo solicitado:")
    print(f"  Usuarios:   {n_usuarios}")
    print(f"  Clientes:   {n_clientes}")
    print(f"  Elevadores: {n_elevadores}")
    print(f"  Camiones:   {n_camiones}")
    confirmar = input("\n¿Confirmas la creación? (s/N): ").strip().lower()

    if confirmar != "s":
        print("Operación cancelada.")
        return

    crear_usuarios(n_usuarios)
    crear_clientes(n_clientes)
    crear_elevadores(n_elevadores)
    crear_camiones(n_camiones)

    print("🎉 Listo. Datos de prueba generados.")


if __name__ == "__main__":
    main()
