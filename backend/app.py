# backend/app.py
from flask import Flask
from flask_cors import CORS
from models import db
from routes import api_blueprint
import os
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Carga variables del .env ubicado en backend/
load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL no está definido. Crea backend/.env con una cadena válida."
    )

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
app.register_blueprint(api_blueprint)

if __name__ == '__main__':
    app.run(debug=True)


