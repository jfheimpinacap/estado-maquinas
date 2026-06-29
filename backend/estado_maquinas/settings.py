# backend/estado_maquinas/settings.py
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def env_list(name, default=None):
    value = os.environ.get(name)
    if value is None:
        return list(default or [])
    return [item.strip() for item in value.split(',') if item.strip()]


SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError(
        'DJANGO_SECRET_KEY is required. Create backend/.env from backend/.env.example '
        'and set a long, secure secret key.'
    )

DEBUG = env_bool('DJANGO_DEBUG', default=False)

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS')
if not ALLOWED_HOSTS:
    raise RuntimeError('DJANGO_ALLOWED_HOSTS is required and must not be empty.')
if '*' in ALLOWED_HOSTS and not DEBUG:
    raise RuntimeError("DJANGO_ALLOWED_HOSTS must not contain '*' when DJANGO_DEBUG is False.")

DEV_FRONTEND_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

CORS_ALLOWED_ORIGINS = env_list(
    'CORS_ALLOWED_ORIGINS',
    default=DEV_FRONTEND_ORIGINS if DEBUG else [],
)
CSRF_TRUSTED_ORIGINS = env_list(
    'CSRF_TRUSTED_ORIGINS',
    default=DEV_FRONTEND_ORIGINS if DEBUG else [],
)

# Para aceptar URLs sin slash final (p.ej. /clientes)
APPEND_SLASH = False

INSTALLED_APPS = [
    # Admin
    #'api.apps.AppWebAdminConfig',

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
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'estado_maquinas.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {'context_processors': [
            'django.template.context_processors.debug',
            'django.template.context_processors.request',
            'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',
        ]},
    },
]

WSGI_APPLICATION = 'estado_maquinas.wsgi.application'

# --- Base de datos: SQLite portable ---
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
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

# ---------- SIMPLE JWT ----------
SIMPLE_JWT = {
    'AUTH_HEADER_TYPES': ('Bearer',),  # el frontend ya envía 'Bearer <token>'

    # Duración del access token (antes tal vez era 5 min por defecto)
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),

    # Duración del refresh token
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),

    # Opcional: si quisieras rotar refresh tokens
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': False,
}

# ---------- CORS ----------
CORS_ALLOW_ALL_ORIGINS = False

# Asegura métodos y headers usados por fetch y JWT
CORS_ALLOW_METHODS = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
]
CORS_ALLOW_HEADERS = [
    'authorization',
    'content-type',
    'x-requested-with',
]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
