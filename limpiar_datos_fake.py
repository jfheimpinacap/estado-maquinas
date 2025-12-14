"""
Script para limpiar datos de prueba (App web máquinas).

Uso:

    py limpiar_datos_fake.py

Opciones:
  1) Eliminar TODOS los clientes (no protegidos)
  2) Eliminar TODAS las maquinarias (no protegidas)
  3) Eliminar usuarios NO superusuario
  4) Hacer 1 + 2 + 3
  0) Salir
"""

import os
import sys
import subprocess
from pathlib import Path

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


if os.environ.get("CLEAN_DATA_VENV_READY") != "1":
    venv_py = find_venv_python()
    if venv_py is not None:
        curr = Path(sys.executable).resolve()
        if curr != venv_py.resolve():
            os.environ["CLEAN_DATA_VENV_READY"] = "1"
            cmd = [str(venv_py), str(Path(__file__).resolve()), *sys.argv[1:]]
            subprocess.run(cmd, check=False)
            sys.exit(0)
    # si no hay venv, seguimos con el intérprete actual

# =========================
#  Configuración Django
# =========================

if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "estado_maquinas.settings")

try:
    import django
    django.setup()
except Exception as e:
    print("❌ Error al configurar Django. Revisa DJANGO_SETTINGS_MODULE y el entorno virtual.")
    print(e)
    sys.exit(1)

from django.contrib.auth.models import User  # noqa: E402
from django.db.models import ProtectedError  # noqa: E402
from api.models import Cliente, Maquinaria  # noqa: E402


# =========================
#  Utilidades
# =========================

def ask_yes_no(prompt: str, default: bool = False) -> bool:
    txt = input(prompt).strip().lower()
    if not txt:
        return default
    return txt.startswith("s")  # s / si / sí


def borrar_clientes():
    qs = Cliente.objects.all()
    n = qs.count()
    if n == 0:
        print("No hay clientes para eliminar.")
        return
    if not ask_yes_no(f"Se eliminarán {n} clientes. ¿Continuar? [s/N]: ", False):
        print("Operación cancelada.")
        return
    try:
        deleted, _ = qs.delete()
    except ProtectedError as e:
        print("⚠ No se pudieron eliminar todos los clientes por registros relacionados (arriendos, documentos, OT...).")
        print(e)
    else:
        print(f"✔ Clientes eliminados (objetos totales borrados: {deleted})")


def borrar_maquinarias():
    qs = Maquinaria.objects.all()
    n = qs.count()
    if n == 0:
        print("No hay maquinarias para eliminar.")
        return
    if not ask_yes_no(f"Se eliminarán {n} maquinarias. ¿Continuar? [s/N]: ", False):
        print("Operación cancelada.")
        return
    try:
        deleted, _ = qs.delete()
    except ProtectedError as e:
        print("⚠ No se pudieron eliminar todas las maquinarias por registros relacionados.")
        print(e)
    else:
        print(f"✔ Maquinarias eliminadas (objetos totales borrados: {deleted})")


def borrar_usuarios_no_super():
    qs = User.objects.filter(is_superuser=False)
    n = qs.count()
    if n == 0:
        print("No hay usuarios no superusuario para eliminar.")
        return
    if not ask_yes_no(
        f"Se eliminarán {n} usuarios NO superusuario. "
        "Los superusuarios (como 'admin') se conservarán. ¿Continuar? [s/N]: ",
        False,
    ):
        print("Operación cancelada.")
        return
    deleted, _ = qs.delete()
    print(f"✔ Usuarios eliminados (objetos totales borrados: {deleted})")


# =========================
#  MAIN
# =========================

def main():
    print("=== Limpiador de datos falsos (App web máquinas) ===\n")

    while True:
        print("\n--- MENÚ ---")
        print("1) Eliminar TODOS los clientes")
        print("2) Eliminar TODAS las maquinarias")
        print("3) Eliminar usuarios NO superusuario")
        print("4) Eliminar 1 + 2 + 3")
        print("0) Salir\n")

        opcion = input("Opción [0]: ").strip() or "0"

        if opcion == "1":
            borrar_clientes()
        elif opcion == "2":
            borrar_maquinarias()
        elif opcion == "3":
            borrar_usuarios_no_super()
        elif opcion == "4":
            borrar_clientes()
            borrar_maquinarias()
            borrar_usuarios_no_super()
        elif opcion in ("0", "q", "salir"):
            print("Saliendo…")
            break
        else:
            print("Opción no válida.")

        input("\nPulsa Enter para volver al menú...")

    print("\nListo ✅")


if __name__ == "__main__":
    main()



