# start.py (SQLite-ready + auto Node/NVM/npm)
import os
import sys
import subprocess
from pathlib import Path
import shutil
import webbrowser
import tempfile
import json
import platform
import urllib.request
import time

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

CANDIDATE_VENVS = [
    BACKEND / ".venv",
    ROOT / ".venv",
    BACKEND / "venv",
    ROOT / "venv",
]

NODE_VERSION = os.environ.get("APP_NODE_VERSION", "20.12.2")  # fija una LTS conocida

# ------------- utilidades -------------
def which_venv():
    for v in CANDIDATE_VENVS:
        py = v / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        if py.exists():
            return v
    return None

def has_command(cmd):
    return shutil.which(cmd) is not None

def run(cmd, cwd=None, env=None, check=True, capture=False, shell=False):
    return subprocess.run(
        cmd, cwd=cwd, env=env, check=check, shell=shell,
        stdout=(subprocess.PIPE if capture else None),
        stderr=(subprocess.PIPE if capture else None),
        text=True
    )

def run_ps(script):
    """Ejecuta un comando PowerShell inline (Windows)."""
    return run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])

def ensure_backend_venv_and_deps():
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

def run_manage(py_exe, *args, check=True):
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

# ------------- Node / NVM helpers -------------
def node_version():
    if not has_command("node"):
        return None
    p = run(["node", "-v"], capture=True, check=False)
    return (p.stdout or "").strip() if p.returncode == 0 else None

def npm_version():
    if not has_command("npm"):
        return None
    p = run(["npm", "-v"], capture=True, check=False)
    return (p.stdout or "").strip() if p.returncode == 0 else None

def ensure_node_windows():
    """Instala nvm-windows y Node si no están. Requiere admin y conexión a Internet."""
    if has_command("npm") and has_command("node"):
        return True

    # 1) Instalar NVM para Windows si falta
    if not has_command("nvm"):
        print("🧰 Instalando nvm-windows (requiere permisos de administrador)...")
        try:
            # Obtener release más reciente
            with urllib.request.urlopen("https://api.github.com/repos/coreybutler/nvm-windows/releases/latest", timeout=30) as r:
                data = json.loads(r.read().decode("utf-8"))
            asset = None
            for a in data.get("assets", []):
                if a.get("name", "").lower().endswith("nvm-setup.exe"):
                    asset = a["browser_download_url"]
                    break
            if not asset:
                raise RuntimeError("No se encontró el instalador de nvm-setup.exe en la release.")

            # Descargar a temp
            fd, temp_path = tempfile.mkstemp(suffix="-nvm-setup.exe")
            os.close(fd)
            urllib.request.urlretrieve(asset, temp_path)

            # Ejecutar instalador silencioso (NSIS/Inno: probamos /S)
            # Si tu entorno requiere /VERYSILENT /SUPPRESSMSGBOXES ajusta aquí.
            print("📥 Ejecutando instalador nvm-setup.exe (silencioso)...")
            run([temp_path, "/S"], check=False)
            time.sleep(3)  # darle tiempo al instalador
        except Exception as e:
            print(f"❌ No se pudo instalar nvm automáticamente: {e}")
            print("   Descarga manual: https://github.com/coreybutler/nvm-windows/releases/latest")
            return False

    # 2) Asegurar Node instalable por nvm
    try:
        # Nueva consola puede requerirse para que PATH se actualice;
        # aquí intentamos ejecutar nvm en el mismo proceso:
        run(["nvm", "install", NODE_VERSION], check=False)
        run(["nvm", "use", NODE_VERSION], check=False)
    except Exception as e:
        print(f"⚠️  No se pudo usar nvm para instalar Node: {e}")

    ok = has_command("node") and has_command("npm")
    if not ok:
        print("⚠️  Node/npm aún no disponibles en esta sesión. Abre una nueva consola o reinicia el script.")
    return ok

def ensure_node_unix():
    """Instala nvm (nvm-sh) y Node en macOS/Linux si faltan."""
    if has_command("npm") and has_command("node"):
        return True

    # Instalar nvm si falta
    if not os.path.exists(str(Path.home() / ".nvm")) and not has_command("nvm"):
        print("🧰 Instalando nvm (macOS/Linux)...")
        try:
            # Ejecuta instalador oficial
            run(["bash", "-lc", "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"], check=True)
        except Exception as e:
            print(f"❌ No se pudo instalar nvm automáticamente: {e}")
            print("   Instala manualmente: https://github.com/nvm-sh/nvm")
            return False

    # Cargar nvm y usarlo para instalar Node
    try:
        run(["bash", "-lc", f"source ~/.nvm/nvm.sh && nvm install {NODE_VERSION} && nvm alias default {NODE_VERSION} && nvm use {NODE_VERSION}"], check=False)
    except Exception as e:
        print(f"⚠️  No se pudo instalar/usar Node con nvm: {e}")

    ok = has_command("node") and has_command("npm")
    if not ok:
        print("⚠️  Puede que necesites abrir una nueva terminal para que nvm actualice tu PATH.")
    return ok

def ensure_node_tooling():
    """Garantiza npm/node (con nvm) en el sistema. Devuelve True si quedó listo."""
    print("🔎 Verificando Node/npm...")
    if has_command("npm") and has_command("node"):
        print(f"✅ Node {node_version()} / npm {npm_version()}")
        return True

    system = platform.system().lower()
    if "windows" in system:
        ok = ensure_node_windows()
    else:
        ok = ensure_node_unix()

    if ok:
        print(f"✅ Node {node_version()} / npm {npm_version()}")
    else:
        print("❌ No fue posible preparar Node/npm automáticamente.")
    return ok

def ensure_frontend_deps():
    if not (FRONTEND / "package.json").exists():
        print("ℹ️  No se encontró frontend/package.json. Se omitirá el frontend.")
        return False

    # Asegurar node/npm
    if not ensure_node_tooling():
        print("❌ npm no está disponible. Instala Node.js/NVM manualmente para levantar el frontend.")
        return False

    if not (FRONTEND / "node_modules").exists():
        print("📦 Instalando dependencias de frontend (npm install)...")
        try:
            run(["npm", "install"], cwd=str(FRONTEND))
        except subprocess.CalledProcessError as e:
            print("❌ Falló 'npm install'. Revisa tu conexión o permisos.")
            print(e)
            return False
    return True

# ------------- main -------------
def main():
    os.chdir(ROOT)
    print("🚀 Preparando proyecto (modo SQLite, sin MSSQL)...")

    # Backend
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

    # Frontend (instalar Node/npm si faltan + npm i)
    ok_fe = ensure_frontend_deps()

    # Lanzar servidores
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
    if ok_fe:
        print("   • Frontend (Vite): http://localhost:5173")
    else:
        print("   • Frontend: dependencias no instaladas (ver mensajes arriba)")
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

