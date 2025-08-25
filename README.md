# 📦 Proyecto Estado de Máquinas

Este proyecto es parte de la asignatura **Proyecto de Software**.  
Consiste en una aplicación web para la **gestión de maquinarias, clientes y arriendos**, con un **frontend en React** y un **backend en Django** conectado a **SQL Server**.

---

## 📂 Estructura de carpetas

```
App web Estado de maquinas/
├── backend/ # Backend con Django
│ ├── api/ # App principal con modelos, views, urls
│ ├── estado_maquinas/ # Configuración del proyecto Django
│ ├── manage.py
│ └── .env # Variables de entorno (no subir a GitHub)
│
├── frontend/ # Frontend con React + Vite + Tailwind
│ ├── src/ # Componentes React
│ ├── public/
│ ├── package.json
│ └── vite.config.js
│
└── README.md # Este archivo
```
---

## 🚀 Requisitos previos

- **Python 3.10+**  
- **Node.js 18+**  
- **SQL Server Express** (con usuario `sa` habilitado)  
- **Git**  

---

## ⚙️ Configuración del Backend (Django)

1. Entrar en la carpeta backend:
```
cd backend
```
---
Crear y activar un entorno virtual:
```
python -m venv .venv
.venv\Scripts\activate   # Windows PowerShell
```
---
Instalar dependencias:
```
pip install django djangorestframework mssql-django pyodbc python-dotenv django-cors-headers
```
Crear el archivo .env (basado en .env.example):
```
DJANGO_SECRET_KEY=clave-super-secreta
DB_NAME=MaquinasClientes
DB_USER=sa
DB_PASSWORD=TU_PASSWORD
DB_HOST=FRANZ-PC\SQLEXPRESS
DB_DRIVER=ODBC Driver 17 for SQL Server
DB_EXTRA=TrustServerCertificate=yes;
```

Aplicar migraciones:
```
python manage.py makemigrations api
python manage.py migrate
```

Levantar el servidor:
```
python manage.py runserver
```
👉 El backend estará en: http://127.0.0.1:8000/

---
🎨 Configuración del Frontend (React + Vite + Tailwind)

Entrar en la carpeta frontend:
```
cd frontend
```

Instalar dependencias:
```
npm install
```

Levantar el servidor de desarrollo:
```
npm run dev
```
👉 El frontend estará en: http://localhost:5173/
---
🔗 Conexión Frontend ↔ Backend

En el frontend usamos una variable de entorno para la URL del backend.
En frontend/.env:
```
VITE_BACKEND_URL=http://127.0.0.1:8000
```
Así, cuando React haga un fetch, apuntará al backend de Django.

---
📌 Endpoints principales (API REST)

GET /clientes → listar clientes
POST /clientes → crear cliente
GET /maquinarias → listar maquinarias
POST /maquinarias → crear maquinaria
GET /obras → listar obras
POST /obras → crear obra
GET /arriendos → listar arriendos
POST /arriendos → crear arriendo (verifica disponibilidad)
GET /documentos → listar documentos
POST /documentos → crear documento (si es Guía Retiro, libera maquinaria)

---
🚀 Despliegue futuro
Backend
- Puede desplegarse en Render, Railway o Heroku con una BD PostgreSQL o MySQL.
Frontend
- Puede desplegarse en Vercel o Netlify con una sola línea:
```
npm run build
```

---
👨‍💻 Autor
Proyecto creado por Franz Heim (INACAP)
GitHub: @jfheimpinacap
