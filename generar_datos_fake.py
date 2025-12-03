"""
Script para poblar la base con datos falsos (usuarios, clientes, elevadores y camiones).

Uso:

    py generar_datos_fake.py

Este script:
- Detecta el entorno virtual (backend/.venv, .venv, etc.).
- Si no se está ejecutando con ese python, lanza un subproceso con el python del venv.
"""

import os
import sys
import random
import string
from pathlib import Path
import subprocess

# =========================
#  Bootstrap: usar el .venv
# =========================

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"

CANDIDATE_VENVS = [
    BACKEND_DIR / ".venv",
    ROOT / ".venv",
    BACKEND_DIR / "venv",
    ROOT / "venv",
]


def find_venv_python():
    for v in CANDIDATE_VENVS:
        py_win = v / "Scripts" / "python.exe"
        py_unix = v / "bin" / "python"
        if py_win.exists():
            return py_win
        if py_unix.exists():
            return py_unix
    return None


# Solo hacemos el “salto” al venv una vez
if os.environ.get("FAKE_DATA_VENV_READY") != "1":
    venv_py = find_venv_python()
    if venv_py is not None:
        curr = Path(sys.executable).resolve()
        if curr != venv_py.resolve():
            # Lanzar subproceso con el Python del venv
            os.environ["FAKE_DATA_VENV_READY"] = "1"
            cmd = [str(venv_py), str(Path(__file__).resolve()), *sys.argv[1:]]
            # IMPORTANTE: no usamos shell, así maneja bien espacios en la ruta
            subprocess.run(cmd, check=False)
            sys.exit(0)
    # Si no encontramos venv, seguimos con el intérprete actual (asumiendo que tiene los paquetes)

# =========================
#  Configuración de Django
# =========================

if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "estado_maquinas.settings")

try:
    import django
    django.setup()
except Exception as e:
    print("❌ Error al configurar Django. Revisa DJANGO_SETTINGS_MODULE, el sys.path y el entorno virtual.")
    print(e)
    sys.exit(1)

from django.contrib.auth.models import User
from django.db import IntegrityError
from api.models import Cliente, Maquinaria

# =========================
#  Utilidades generales
# =========================

def ask_int(prompt: str, default: int = 0) -> int:
    """
    Pide un entero por consola. Enter = default.
    Si el valor es inválido, devuelve default.
    """
    txt = input(prompt).strip()
    if not txt:
        return default
    try:
        n = int(txt)
        if n < 0:
            return default
        return n
    except ValueError:
        print("⚠ Valor inválido, se usará", default)
        return default

# =========================
#  RUT chileno (módulo 11)
# =========================

def calcular_dv(rut_num: str) -> str:
    """
    Calcula el dígito verificador (DV) para un RUT chileno usando módulo 11.
    rut_num: string solo con dígitos, SIN puntos ni DV.
    """
    rut_reverso = list(map(int, rut_num[::-1]))
    factores = [2, 3, 4, 5, 6, 7]

    acumulado = 0
    for i, dig in enumerate(rut_reverso):
        acumulado += dig * factores[i % len(factores)]

    resto = acumulado % 11
    dv_num = 11 - resto

    if dv_num == 11:
        return "0"
    elif dv_num == 10:
        return "K"
    else:
        return str(dv_num)


def formatear_rut(rut_num: str, dv: str) -> str:
    """
    Formatea un RUT tipo '27962409' + '2' → '27.962.409-2'.
    Asume que rut_num tiene 8 dígitos (xx.xxx.xxx).
    """
    cuerpo = rut_num
    partes = []
    while len(cuerpo) > 3:
        partes.append(cuerpo[-3:])
        cuerpo = cuerpo[:-3]
    partes.append(cuerpo)
    partes = partes[::-1]
    return f"{'.'.join(partes)}-{dv}"


def generar_rut_unico() -> str:
    """
    Genera un RUT válido con formato xx.xxx.xxx-y que no exista aún en Cliente.rut.
    """
    while True:
        numero = random.randint(10_000_000, 99_999_999)
        rut_num = f"{numero}"
        dv = calcular_dv(rut_num)
        rut = formatear_rut(rut_num, dv).upper()
        if not Cliente.objects.filter(rut=rut).exists():
            return rut

# =========================
#  Fakers simples
# =========================

NOMBRES = [
    "Constructora", "Servicios", "Ingeniería", "Maestranza",
    "Transportes", "Montajes", "Arriendos", "Soluciones"
]
APELLIDOS = [
    "González", "Muñoz", "Rojas", "Díaz", "Pérez",
    "Soto", "Contreras", "Silva", "Martínez", "López"
]

MARCAS_ELEVADOR = ["Genie", "JLG", "Haulotte", "Skyjack", "Hidroplat", "MEC"]
MODELOS_ELEVADOR = ["GS-1930", "GS-2632", "3246ES", "450AJ", "STAR 10", "SJIII 3219"]

MARCAS_CAMION = ["Mercedes-Benz", "Volvo", "Scania", "Iveco", "Hino", "Isuzu"]
MODELOS_CAMION = ["Atego", "FH", "P310", "Eurocargo", "300", "Elf"]

def fake_razon_social(idx: int) -> str:
    return f"{random.choice(NOMBRES)} {random.choice(APELLIDOS)} #{idx}"

def fake_telefono() -> str:
    return "9" + "".join(random.choice(string.digits) for _ in range(8))

def fake_email_from_username(username: str) -> str:
    return f"{username}@test.local"

# =========================
#  Creación de usuarios
# =========================

def crear_usuarios(cantidad: int):
    if cantidad <= 0:
        return 0
    creados = 0
    for _ in range(cantidad):
        for _attempt in range(20):
            username = f"user{random.randint(1, 9999):04d}"
            if User.objects.filter(username=username).exists():
                continue
            try:
                user = User.objects.create_user(
                    username=username,
                    email=fake_email_from_username(username),
                    password="demo1234",
                    is_staff=False,
                    is_superuser=False,
                )
                creados += 1
                print(f"  ✔ Usuario creado: {user.username}")
                break
            except IntegrityError:
                continue
    return creados

# =========================
#  Creación de clientes
# =========================

def crear_clientes(cantidad: int):
    if cantidad <= 0:
        return 0
    formas_pago = [fp[0] for fp in Cliente.FORMA_PAGO_CHOICES]
    creados = 0
    for i in range(1, cantidad + 1):
        rut = generar_rut_unico()
        razon = fake_razon_social(i)
        cliente = Cliente.objects.create(
            razon_social=razon,
            rut=rut,
            direccion=f"Calle Falsa {random.randint(1, 999)}, Santiago",
            telefono=fake_telefono(),
            correo_electronico=f"contacto{i}@cliente-falso.cl",
            forma_pago=random.choice(formas_pago) if formas_pago else None,
        )
        creados += 1
        print(f"  ✔ Cliente creado: {cliente.razon_social} – {cliente.rut}")
    return creados

# =========================
#  Creación de maquinarias
# =========================

def generar_serie_unica(prefijo: str) -> str:
    while True:
        numeros = "".join(random.choice(string.digits) for _ in range(6))
        serie = f"{prefijo}{numeros}"
        if not Maquinaria.objects.filter(serie=serie).exists():
            return serie

def crear_elevadores(cantidad: int):
    if cantidad <= 0:
        return 0
    creados = 0
    for i in range(cantidad):
        es_tijera = (i % 2 == 0)
        tipo_altura = "tijera" if es_tijera else "brazo"
        prefijo = "TIJ" if es_tijera else "ART"
        serie = generar_serie_unica(prefijo)
        marca = random.choice(MARCAS_ELEVADOR)
        modelo = random.choice(MODELOS_ELEVADOR)
        altura = random.randint(6, 32)
        if es_tijera:
            combustible = random.choice(["electrico", "electrico", "diesel"])
        else:
            combustible = random.choice(["diesel", "diesel", "electrico"])
        maq = Maquinaria.objects.create(
            marca=marca,
            modelo=modelo,
            serie=serie,
            categoria="equipos_altura",
            descripcion=f"Elevador {tipo_altura} {marca} {modelo}",
            altura=altura,
            anio=random.randint(2010, 2025),
            tonelaje=None,
            carga=None,
            tipo_altura=tipo_altura,
            combustible=combustible,
            estado=random.choice(["Disponible", "Para venta"]),
        )
        creados += 1
        print(f"  ✔ Elevador creado: {maq.serie} – {maq.descripcion}")
    return creados

def crear_camiones(cantidad: int):
    if cantidad <= 0:
        return 0
    creados = 0
    for _ in range(cantidad):
        serie = generar_serie_unica("CAM")
        marca = random.choice(MARCAS_CAMION)
        modelo = random.choice(MODELOS_CAMION)
        tonelaje = random.choice([5, 8, 10, 12, 15, 18, 20, 25])
        maq = Maquinaria.objects.create(
            marca=marca,
            modelo=modelo,
            serie=serie,
            categoria="camiones",
            descripcion=f"Camión {marca} {modelo} {tonelaje}t",
            altura=None,
            anio=random.randint(2005, 2025),
            tonelaje=tonelaje,
            carga=tonelaje,
            tipo_altura=None,
            combustible="diesel",
            estado=random.choice(["Disponible", "Para venta"]),
        )
        creados += 1
        print(f"  ✔ Camión creado: {maq.serie} – {maq.descripcion}")
    return creados

# =========================
#  MAIN
# =========================

def main():
    print("=== Generador de datos falsos (App web máquinas) ===\n")
    n_users      = ask_int("¿Cuántos usuarios básicos (no admin) deseas crear? [0]: ", 0)
    n_clientes   = ask_int("¿Cuántos clientes deseas crear? [0]: ", 0)
    n_elevadores = ask_int("¿Cuántos elevadores deseas crear? [0]: ", 0)
    n_camiones   = ask_int("¿Cuántos camiones deseas crear? [0]: ", 0)

    print("\nCreando datos...\n")
    total_users    = crear_usuarios(n_users)
    total_clientes = crear_clientes(n_clientes)
    total_elev     = crear_elevadores(n_elevadores)
    total_cam      = crear_camiones(n_camiones)

    print("\n=== Resumen ===")
    print(f"  Usuarios creados:   {total_users}")
    print(f"  Clientes creados:   {total_clientes}")
    print(f"  Elevadores creados: {total_elev}")
    print(f"  Camiones creados:   {total_cam}")
    print("\nListo ✅")

if __name__ == "__main__":
    main()




