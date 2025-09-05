# start.py
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

def which_venv():
    for v in CANDIDATE_VENVS:
        py = v / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        if py.exists():
            return v
    return None

def has_command(cmd):
    return shutil.which(cmd) is not None

def run_ok(cmd, cwd=None, env=None):
    """Ejecuta y devuelve True si sale 0; no lanza excepción."""
    try:
        subprocess.run(cmd, cwd=cwd, env=env, check=True,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except subprocess.CalledProcessError:
        return False

def run(cmd, cwd=None, env=None):
    subprocess.run(cmd, cwd=cwd, env=env, check=True)

def ensure_sql_server():
    if os.name != "nt":
        return
    try:
        # No bloquea si falla o ya está iniciado.
        subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Start-Service -Name 'MSSQL$SQLEXPRESS'"],
            check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
    except Exception:
        pass

def ensure_backend_venv_and_deps():
    venv_dir = which_venv()
    if not venv_dir:
        venv_dir = BACKEND / ".venv"
        print(f"🔧 Creando entorno virtual en: {venv_dir}")
        run([sys.executable, "-m", "venv", str(venv_dir)])

    py = venv_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    pip = [str(py), "-m", "pip"]

    # ¿Ya están los paquetes? probamos imports en el venv
    test_code = (
        "import importlib as i; "
        "mods=['django','rest_framework','corsheaders','mssql','pyodbc','dotenv'];"
        "missing=[m for m in mods if not i.util.find_spec(m)]; "
        "print(','.join(missing))"
    )
    proc = subprocess.run([str(py), "-c", test_code],
                          capture_output=True, text=True)
    missing = [m for m in proc.stdout.strip().split(",") if m]

    if missing:
        print("🔧 Actualizando pip...")
        run(pip + ["install", "-U", "pip", "wheel"])

        req = BACKEND / "requirements.txt"
        if req.exists():
            print("📦 Instalando dependencias (requirements.txt)...")
            run(pip + ["install", "-r", str(req)])
        else:
            print("📦 Instalando dependencias mínimas (no hay requirements.txt)...")
            run(pip + ["install",
                       "django==5.*",
                       "djangorestframework",
                       "django-cors-headers",
                       "mssql-django",
                       "pyodbc",
                       "python-dotenv"])

    return py  # python del venv

def ensure_frontend_deps():
    if not (FRONTEND / "package.json").exists():
        print("❌ No se encontró frontend/package.json. Revisa la ruta del frontend.")
        return False
    if not (FRONTEND / "node_modules").exists():
        if not has_command("npm"):
            print("❌ npm no está disponible en PATH. Instala Node.js.")
            return False
        print("📦 Instalando dependencias de frontend (npm install)...")
        run(["npm", "install"], cwd=str(FRONTEND))
    return True

def open_new_console_windows(title, command, cwd=None):
    """
    Abre nueva ventana usando PowerShell Start-Process. Evita los problemas de `start`.
    command puede ser una cadena o lista.
    """
    if os.name != "nt":
        # UNIX: simplemente deja corriendo en el mismo proceso (ajústalo a tu terminal si quieres ventanas nuevas)
        return subprocess.Popen(command, cwd=cwd)

    if isinstance(command, (list, tuple)):
        # Construye una línea segura para cmd /K
        cmdline = " ".join(f'"{c}"' if " " in c or "\\" in c or "/" in c else c for c in command)
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
    # No queremos bloquear; si falla, mostramos mensaje pero seguimos
    try:
        subprocess.Popen(ps_cmd)
    except Exception as e:
        print(f"⚠️  No se pudo abrir ventana '{title}': {e}")

def main():
    os.chdir(ROOT)
    print("🚀 Preparando proyecto...")

    # 1) SQL Server Express (no bloqueante)
    print("🗄️  Intentando iniciar SQL Server Express (MSSQL$SQLEXPRESS)...")
    ensure_sql_server()

    # 2) Backend
    py = ensure_backend_venv_and_deps()

    # 3) Frontend
    ok_fe = ensure_frontend_deps()

    # 4) Abrir consolas
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
        # Abre navegador al frontend
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
