Sistema de Estado de Máquinas

Aplicación full-stack para gestionar clientes, maquinarias, arriendos y documentos.
Backend en Django + DRF con SQL Server; Frontend en React + Vite.
Autenticación con JWT y panel “Control de Usuarios” solo para administradores.

🧱 Tecnologías
Backend
- Python 3.11+ (probado en 3.13)
- Django 5.x, Django REST Framework
- djangorestframework-simplejwt (JWT)
- mssql-django + pyodbc (SQL Server)
- python-dotenv, django-cors-headers
Frontend
- React + Vite
- Tailwind CSS
- Framer Motion, lucide-react, react-toastify

---
## 📂 Estructura de carpetas

```
App web Estado de maquinas/
├── backend/
│   ├── api/                     # App principal (modelos, views, serializers, urls)
│   ├── estado_maquinas/         # Proyecto Django (settings/urls/wsgi/asgi)
│   ├── manage.py
│   └── .env                     # (no se versiona) credenciales DB y secret
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BuscarCliente.jsx
│   │   │   ├── ClientesForm.jsx
│   │   │   ├── EditarCliente.jsx
│   │   │   ├── VerCliente.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── auth/LoginOverlay.jsx
│   │   ├── context/AuthContext.jsx
│   │   ├── lib/api.js
│   │   ├── styles/FormStyles.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── start.py                     # Script de arranque (Windows)
└── README.md

```
---
🔐 Variables de entorno
backend/.env
```
DJANGO_SECRET_KEY=dev-secret-key
DB_NAME=MaquinasClientes
DB_USER=sa
DB_PASSWORD=TU_PASSWORD
DB_HOST=FRANZ-PC\SQLEXPRESS
DB_PORT=
DB_DRIVER=ODBC Driver 17 for SQL Server
DB_EXTRA=TrustServerCertificate=yes;
```
Ajusta DB_HOST/DB_DRIVER según tu equipo. Requiere Microsoft ODBC Driver 17/18 instalado.

frontend/.env (opcional)
```
VITE_BACKEND_URL=http://localhost:8000
```
---
⚡ Arranque rápido (Windows) con start.py

Desde la carpeta raíz del proyecto:
```
py start.py
```
El script:
1. Intenta iniciar el servicio SQL Server Express (MSSQL$SQLEXPRESS).
2. Crea/activa .venv en backend/ y verifica/instala dependencias mínimas.
3.Ejecuta migraciones (makemigrations + migrate).
4. Abre dos consolas: Django (http://127.0.0.1:8000) y Vite (http://localhost:5173).

Cierra esas consolas para detener los servicios.
---
🛠️ Arranque manual (opción B)
Backend
```
cd backend
python -m venv .venv
.\.venv\Scripts\activate          # PowerShell
pip install -U pip wheel
pip install django djangorestframework django-cors-headers mssql-django pyodbc python-dotenv djangorestframework-simplejwt

# Migraciones
python manage.py makemigrations api
python manage.py migrate

# (opcional) crear superusuario para admin:
# python manage.py createsuperuser

python manage.py runserver
```
Frontend
```
cd frontend
npm install
npm run dev
```
---
👤 Autenticación (JWT)

Registro: POST /auth/register { "username": "...", "password": "..." }
Login: POST /auth/login → devuelve { access, refresh, user }
Ejemplo curl:
```
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123"}'
```
Para consumir el API, añade el header:
```
Authorization: Bearer <access_token>
```
El frontend lo hace con authFetch (inyecta el token del AuthContext).
---
🌐 Endpoints principales
Todas las rutas sin slash final.
| Recurso          | Ruta base      | Métodos                                                          |
| ---------------- | -------------- | ---------------------------------------------------------------- |
| Clientes         | `/clientes`    | GET (lista + `?query=`), POST, GET/\:id, PATCH/\:id, DELETE/\:id |
| Maquinarias      | `/maquinarias` | CRUD                                                             |
| Obras            | `/obras`       | CRUD                                                             |
| Arriendos        | `/arriendos`   | POST valida disponibilidad y cambia estado de máquina            |
| Documentos       | `/documentos`  | POST; si `tipo="Guia Retiro"` libera máquina y finaliza arriendo |
| Usuarios (admin) | `/users`       | GET, PATCH (cambio de username/password). **Solo IsAdminUser**   |
---
🖥️ Frontend (flujo actual)
- Login Overlay: se muestra si no hay token. Incluye “Crear usuario”.
- Sidebar:
  - Letras blancas; “Cerrar sesión” (gris) y “Control de Usuarios” (naranja) al fondo; este último solo visible si eres admin.
- Clientes
  - Crear Cliente: formulario compacto, botón centrado.
  - Buscar Cliente: buscador + tabla; “Ver Cliente” abre ficha.
  - Ver Cliente: muestra todos los datos + botones “Editar datos” (va directo al formulario de edición) y “Ver movimientos” (placeholder).
  - Editar Cliente:
    - Si no hay selección: buscador compacto con resultados mínimos para elegir.
    - Si hay selección: solo formulario con campos bloqueados + botón “Editar” por campo para habilitarlo y “Guardar/Cancelar” individuales.
    - Botones “← Atrás” (vuelve a ficha) y “Editar otro cliente” (limpia selección y vuelve al buscador).
---
🧪 Comprobaciones rápidas
- Ping API: http://localhost:8000/clientes
- CORS: Frontend llama VITE_BACKEND_URL (por defecto http://localhost:8000).
- JWT: Respuestas 401 → revisa header Authorization.
---
🧯 Troubleshooting
- ModuleNotFoundError: No module named 'django'
  Activa el entorno: cd backend && .\.venv\Scripts\activate (o corre con el mismo Python de .venv).

- No module named 'rest_framework_simplejwt'
  pip install djangorestframework-simplejwt y reinicia runserver.

- ODBC: pyodbc / Driver no encontrado
  Instala Microsoft ODBC Driver 17/18 for SQL Server. Ajusta DB_DRIVER en .env.

- “python” no se reconoce (PowerShell)
  Usa py o .\.venv\Scripts\python.exe. El script start.py ya se encarga.

- CORS/401 desde React
  Asegúrate de usar authFetch y que CORS_ALLOWED_ORIGINS incluya http://localhost:5173.

- Login overlay se ve a la izquierda
  Asegura que LoginOverlay.jsx use el wrapper:
```
<div className="fixed inset-0 flex items-center justify-center" style={{background:'rgba(0,0,0,.5)'}}>
  <div className="form-section form-section--modal"> ... </div>
</div>
```
---
📘 Convenciones de código (frontend)
- Estilos comunes en src/styles/FormStyles.css
- Botones:
  - Naranja principal: .btn-form, variante mini .btn-mini
  - Gris: .btn-form--gray
  - Compactos inline: .btn-inline, .btn-inline--gray
- Tarjetas compactas: .form-section--compact
- Tablas: .panel-section + .table-wrap
---
🗺️ Roadmap / pendientes
- Módulo Movimientos (listado de documentos por cliente con filtros y formato tipo planilla).
- Validaciones específicas (por ejemplo, RUT).
- Paginación/ordenamiento en tablas.
- Deploy (prod):
  -Backend: gunicorn/uvicorn + reverse proxy;
  - Frontend: build con npm run build;
  - Configuración de ALLOWED_HOSTS, DEBUG=False, SECRET_KEY segura.
- Pruebas (pytest/pytest-django) y CI.
---
👨‍💻 Autor
Proyecto creado por Franz Heim (INACAP)
GitHub: @jfheimpinacap
