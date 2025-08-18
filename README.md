# Estado de Máquinas 🚜

Aplicación fullstack para la **gestión de maquinarias y clientes**, desarrollada con:

- **Backend:** Python (Flask)
- **Frontend:** React + Vite + TailwindCSS
- **Base de Datos:** SQL (usando `schema.sql` y `setup_db.py`)

---

## 📂 Estructura del Proyecto
```
Estado de maquinas/
│
├── backend/ # Servidor Flask (API REST)
│ ├── app.py # Punto de entrada del backend
│ ├── models.py # Modelos de la BD
│ ├── routes.py # Endpoints REST
│ ├── schema.sql # Script SQL para crear tablas
│ ├── setup_db.py # Configuración de la BD
│ └── ...
│
├── frontend/ # Aplicación React (interfaz)
│ ├── src/ # Componentes y lógica del frontend
│ ├── public/ # Archivos estáticos
│ ├── package.json # Dependencias de Node
│ └── ...
│
└── README.md # Este archivo
```

---

## ⚙️ Instalación y Ejecución

🔹 1. Clonar el repositorio
```
git clone https://github.com/jfheimpinacap/estado-maquinas.git
cd estado-maquinas
```

---


🔹 2. Backend (Flask)
Entrar a la carpeta del backend:
```
cd backend
```
Crear entorno virtual e instalar dependencias:
```
python -m venv .venv
.venv\Scripts\activate   # En Windows PowerShell
source .venv/bin/activate # En Linux/Mac
```
Instalar dependencias necesarias:
```
pip install flask flask-cors
```
Inicializar la base de datos (opcional):
```
python setup_db.py
```
Ejecutar el servidor:
```
python app.py
```
Por defecto corre en http://localhost:5000

---

🔹 3. Frontend (React + Vite)

Entrar a la carpeta del frontend:
```
cd frontend
```
Instalar dependencias:
```
npm install
```
Ejecutar el servidor de desarrollo:
```
npm run dev
```
Por defecto corre en http://localhost:5173

---

📡 API (Backend Flask)

Algunos endpoints expuestos:

- GET /maquinarias → Lista todas las maquinarias
- POST /maquinarias → Crea nueva maquinaria
- GET /clientes → Lista todos los clientes
- POST /clientes → Crea nuevo cliente
- GET /clientes/<id> → Ver cliente específico

---

🎨 Frontend (React)

El frontend incluye:
- Sidebar de navegación (secciones para clientes y maquinarias)
- CRUD de maquinarias
- CRUD de clientes
- Búsqueda y visualización de clientes
- Notificaciones con react-toastify

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
Proyecto creado por Franz Heimpel (INACAP)
GitHub: @jfheimpinacap
