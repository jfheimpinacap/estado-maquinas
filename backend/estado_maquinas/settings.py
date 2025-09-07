import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-secret-key')
DEBUG = True

ALLOWED_HOSTS = ['*']

# Para aceptar URLs sin slash final (p.ej. /clientes)
APPEND_SLASH = False

INSTALLED_APPS = [
    # Django
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Terceros
    'rest_framework',
    'corsheaders',
    'rest_framework_simplejwt',

    # Tu app
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # CORS primero
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    # Si no usas autenticación por sesión, no necesitas CSRF en el API
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'estado_maquinas.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': { 'context_processors': [
            'django.template.context_processors.debug',
            'django.template.context_processors.request',
            'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',
        ]},
    },
]

WSGI_APPLICATION = 'estado_maquinas.wsgi.application'

# ---------- SQL Server (mssql-django) ----------
import os

DATABASES = {
    "default": {
        "ENGINE": "mssql",  # requiere mssql-django
        "NAME": os.environ.get("DB_NAME", "MaquinasClientes"),
        "USER": os.environ.get("DB_USER", "sa"),
        "PASSWORD": os.environ.get("DB_PASSWORD", "Franz2024!"),
        "HOST": os.environ.get("DB_HOST", r"FRANZ-PC\SQLEXPRESS"),
        "PORT": os.environ.get("DB_PORT", ""),  # usualmente vacío con SQLEXPRESS
        "OPTIONS": {
            "driver": os.environ.get("DB_DRIVER", "ODBC Driver 17 for SQL Server"),
            # Lo siguiente es válido y útil para desarrollo local con certificados self-signed
            "extra_params": os.environ.get("DB_EXTRA", "TrustServerCertificate=yes;"),
            # Alternativa equivalente (cualquiera de las dos):
            # "trustServerCertificate": "yes",
        },
    }
}


LANGUAGE_CODE = 'es-cl'
TIME_ZONE = 'America/Santiago'
USE_I18N = True
USE_TZ = False  # para que Date se guarde como yyyy-mm-dd simple

STATIC_URL = 'static/'

# ---------- DRF ----------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',  # <— JWT
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',  # <— exigir login por defecto
    ],
}

# Opcional, pero explícito:
SIMPLE_JWT = {
    "AUTH_HEADER_TYPES": ("Bearer",),  # el frontend ya envía 'Bearer <token>'
}

# ---------- CORS ----------
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]
