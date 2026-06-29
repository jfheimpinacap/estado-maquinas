# 📊 Sistema de Estado de Máquinas

Aplicación **full-stack** para gestionar clientes, maquinarias, arriendos y documentos.  
Incluye autenticación con **JWT** y un panel de **“Control de Usuarios”** exclusivo para administradores.

---

## 🧱 Tecnologías

### Backend
- Python 3.11+ (probado en 3.13)
- Django 5.x
- Django REST Framework
- djangorestframework-simplejwt (JWT)
- sqlite3 (base de datos por defecto en desarrollo)
- python-dotenv
- django-cors-headers

### Frontend
- React + Vite
- Tailwind CSS
- Framer Motion
- lucide-react
- react-toastify

---

## 🚀 Preparación local controlada

No uses `start.py` para desarrollo controlado: ese script puede instalar dependencias, ejecutar migraciones, levantar servidores y abrir el navegador automáticamente.

1️⃣ Clonar el repositorio
```bash
git clone https://github.com/jfheimpinacap/estado-maquinas.git
cd estado-maquinas
```

2️⃣ Crear y activar un entorno virtual manualmente
```bash
python -m venv backend/.venv
source backend/.venv/bin/activate
```

En Windows:
```powershell
py -m venv backend/.venv
backend\.venv\Scripts\Activate.ps1
```

3️⃣ Instalar dependencias mínimas del backend
```bash
pip install -r backend/requirements.txt
```

4️⃣ Crear configuración local

Revisa `backend/.env.example` y crea `backend/.env` con valores locales seguros. El archivo `.env` no debe versionarse.

5️⃣ Ejecutar validaciones seguras antes de modificar datos
```bash
cd backend
python manage.py check
python manage.py showmigrations --plan
```

No ejecutes `makemigrations` ni `migrate` automáticamente durante esta preparación.

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
│   │   ├── components
│   │   │   ├── auth
│   │   │   │    ├── LoginPage.jsx
│   │   │   │    ├── RecoveryPage.jsx
│   │   │   │    └── RegisterPage.jsx
│   │   │   ├── users
│   │   │   │    ├── UsersAdmin.jsx
│   │   │   │    └── UsersEdit.jsx
│   │   │   ├── BuscarCliente.jsx
│   │   │   ├── BuscarMaquina.jsx
│   │   │   ├── ClientesForm.jsx
│   │   │   ├── ClientesList.jsx
│   │   │   ├── EditarCliente.jsx
│   │   │   ├── HistorialMaquina.jsx
│   │   │   ├── MaquinariaForm.jsx
│   │   │   ├── MaquinariaList.jsx
│   │   │   ├── MovimientoCliente.jsx
│   │   │   ├── VerCliente.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── context/AuthContext.jsx
│   │   ├── lib/api.js
│   │   ├── styles/FormStyles.css
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── Index.css
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── start.py                     # Script de arranque (Windows)
└── README.md
```
---
🔑 Autenticación
- El sistema usa JWT (JSON Web Tokens) para manejar sesiones.
- Los endpoints protegidos requieren incluir el token en el header:
```
Authorization: Bearer <token>
```
---
🔌 Endpoints principales
Ejemplos (ajustar según api/urls.py):
- Clientes
  - GET /clientes/ — Listar clientes
  - POST /clientes/ — Crear cliente
  - PUT /clientes/{id}/ — Editar cliente
  - DELETE /clientes/{id}/ — Eliminar cliente
- Maquinarias
  - GET /maquinarias/?query= — Buscar maquinarias
  - POST /maquinarias/ — Registrar nueva maquinaria
  - GET /maquinarias/{id}/ — Detalle
  - PATCH /maquinarias/{id}/ — Actualizar estado
-Usuarios
  - POST /auth/login/ — Iniciar sesión (JWT)
  - POST /auth/register/ — Registrar nuevo usuario
---
🧪 Comprobaciones rápidas
- Ping API: http://localhost:8000/clientes
- CORS: Frontend llama VITE_BACKEND_URL (por defecto http://localhost:8000).
- JWT: Respuestas 401 → revisa header Authorization.
---
⚠️ Notas importantes
- Mantener un solo entorno virtual (backend/.venv/).
- El archivo .env no se versiona; usar .env.example como referencia.
- La base de datos por defecto es SQLite (db.sqlite3), suficiente para desarrollo y pruebas.
- Para producción se puede migrar fácilmente a SQL Server u otro motor compatible.
---
📌 Estado actual

✅ Backend funcionando con Django + DRF + JWT

✅ Frontend operativo con React + Vite

✅ Script de instalación automática (start.py) probado en Windows

🔄 En desarrollo: mejoras al panel de control de usuarios y búsqueda avanzada de maquinarias

---
👨‍💻 Autor
Proyecto creado por Franz Heim (INACAP)
GitHub: @jfheimpinacap
