# start.py (SQLite-ready)
import os
import sys
import subprocess
from pathlib import Path
import shutil
import webbrowser

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

CANDIDATE_VENVS = [
    BACKEND / ".venv",
    ROOT / ".venv",
    BACKEND / "venv",
    ROOT / "venv",
]

# -------- utilidades --------
def which_venv():
    for v in CANDIDATE_VENVS:
        py = v / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        if py.exists():
            return v
    return None

def has_command(cmd):
    return shutil.which(cmd) is not None

def run(cmd, cwd=None, env=None, check=True, capture=False):
    return subprocess.run(
        cmd, cwd=cwd, env=env, check=check,
        stdout=(subprocess.PIPE if capture else None),
        stderr=(subprocess.PIPE if capture else None),
        text=True
    )

def ensure_backend_venv_and_deps():
    """
    Crea/usa venv y asegura dependencias mínimas para Django + SQLite.
    NO instala mssql-django ni pyodbc.
    """
    venv_dir = which_venv()
    if not venv_dir:
        venv_dir = BACKEND / ".venv"
        print(f"🔧 Creando entorno virtual en: {venv_dir}")
        run([sys.executable, "-m", "venv", str(venv_dir)])

    py = venv_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    pip = [str(py), "-m", "pip"]

    # Verificar módulos requeridos
    test_code = (
        "import importlib.util as u;"
        "mods=['django','rest_framework','corsheaders','dotenv','rest_framework_simplejwt'];"
        "missing=[m for m in mods if u.find_spec(m) is None];"
        "print(','.join(missing))"
    )
    proc = run([str(py), "-c", test_code], capture=True, check=False)
    missing = [m for m in (proc.stdout or '').strip().split(",") if m]

    print("🔧 Actualizando pip...")
    run(pip + ["install", "-U", "pip", "wheel"])

    req = BACKEND / "requirements.txt"
    if req.exists():
        print("📦 Instalando dependencias (requirements.txt)...")
        run(pip + ["install", "-r", str(req)])
    else:
        base_pkgs = [
            "Django>=5.1,<6",
            "djangorestframework>=3.15",
            "django-cors-headers>=4.4",
            "python-dotenv>=1.0",
            "djangorestframework-simplejwt>=5.3",
        ]
        if missing:
            print("📦 Instalando dependencias mínimas (no hay requirements.txt)...")
            run(pip + ["install"] + base_pkgs)

    return py

def ensure_frontend_deps():
    if not (FRONTEND / "package.json").exists():
        print("ℹ️  No se encontró frontend/package.json. Se omitirá el frontend.")
        return False
    if not (FRONTEND / "node_modules").exists():
        if not has_command("npm"):
            print("❌ npm no está disponible en PATH. Instala Node.js para levantar el frontend.")
            return False
        print("📦 Instalando dependencias de frontend (npm install)...")
        run(["npm", "install"], cwd=str(FRONTEND))
    return True

def run_manage(py_exe, *args, check=True):
    """Ejecuta manage.py con args indicados en el directorio backend."""
    manage = BACKEND / "manage.py"
    if not manage.exists():
        raise FileNotFoundError(f"No se encontró {manage}")
    cmd = [str(py_exe), str(manage), *args]
    return run(cmd, cwd=str(BACKEND), check=check)

def open_new_console_windows(title, command, cwd=None):
    if os.name != "nt":
        return subprocess.Popen(command, cwd=cwd)

    if isinstance(command, (list, tuple)):
        cmdline = " ".join(f'"{c}"' if (" " in c or "\\" in c or "/" in c) else c for c in command)
    else:
        cmdline = command

    ps_cmd = [
        "powershell", "-NoProfile", "-Command",
        "Start-Process",
        "-FilePath", "cmd.exe",
        "-ArgumentList", f"'/K', 'cd /d \"{cwd}\" && {cmdline}'",
        "-WorkingDirectory", f"\"{cwd}\"",
        "-WindowStyle", "Normal",
        "-Verb", "Open",
        "-Wait:$false"
    ]
    try:
        subprocess.Popen(ps_cmd)
    except Exception as e:
        print(f"⚠️  No se pudo abrir ventana '{title}': {e}")

def warn_if_not_sqlite(py_exe):
    """
    Advierte si la BD por settings.py no es SQLite (por si olvidaste cambiar DATABASES).
    """
    code = (
        "import os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','estado_maquinas.settings');"
        "import django; django.setup();"
        "from django.conf import settings;"
        "db = settings.DATABASES.get('default',{});"
        "print(db.get('ENGINE',''))"
    )
    try:
        proc = run([str(py_exe), "-c", code], capture=True, check=True, cwd=str(BACKEND))
        engine = (proc.stdout or "").strip()
        if "sqlite3" not in engine:
            print(f"⚠️  Advertencia: la BD activa no es SQLite (ENGINE='{engine}'). Revisa settings.DATABASES.")
    except Exception:
        pass

def main():
    os.chdir(ROOT)
    print("🚀 Preparando proyecto (modo SQLite, sin MSSQL)...")

    py = ensure_backend_venv_and_deps()
    warn_if_not_sqlite(py)

    try:
        print("🧱 Django: makemigrations (todas las apps, sin preguntas)...")
        run_manage(py, "makemigrations", "--noinput", check=False)
        print("🧱 Django: migrate (sin preguntas)...")
        run_manage(py, "migrate", "--noinput")
    except subprocess.CalledProcessError as e:
        print("❌ Error al aplicar migraciones.")
        print(e)

    ok_fe = ensure_frontend_deps()

    print("▶️  Iniciando Django (puerto 8000) en nueva ventana...")
    open_new_console_windows(
        "Django",
        [str(py), "manage.py", "runserver"],
        cwd=str(BACKEND)
    )

    if ok_fe:
        print("▶️  Iniciando Vite (puerto 5173) en nueva ventana...")
        open_new_console_windows(
            "Vite",
            ["npm", "run", "dev"],
            cwd=str(FRONTEND)
        )
        try:
            webbrowser.open("http://localhost:5173", new=2)
        except Exception:
            pass

    print("\n✅ Todo lanzado.")
    print("   • Backend (Django): http://127.0.0.1:8000")
    print("   • Frontend (Vite): http://localhost:5173")
    print("ℹ️ Cierra las consolas abiertas para detener servicios.\n")

if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        print("\n❌ Error ejecutando un comando:")
        print("   ", e)
        sys.exit(e.returncode)
    except KeyboardInterrupt:
        print("\n⏹️  Interrumpido por el usuario.")
