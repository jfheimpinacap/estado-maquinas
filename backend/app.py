from flask import Flask
from flask_cors import CORS
from models import db
from routes import api_blueprint

app = Flask(__name__)

# CORS abierto a tu puerto React
CORS(app, resources={r"/*": {"origins": "*"}})

app.config['SQLALCHEMY_DATABASE_URI'] = (
    'mssql+pyodbc://sa:Franz2024!@FRANZ-PC\\SQLEXPRESS/MaquinasClientes?driver=ODBC+Driver+17+for+SQL+Server'
)


app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

app.register_blueprint(api_blueprint)

if __name__ == '__main__':
    app.run(debug=True)
