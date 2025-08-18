# setup_db.py

from app import db
from app import app

# Esto asegura que use la configuración correcta de app.py
with app.app_context():
    db.create_all()
    print("✅ Todas las tablas fueron creadas en la base de datos.")
