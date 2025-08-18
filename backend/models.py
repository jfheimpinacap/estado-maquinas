from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Maquinaria(db.Model):
    __tablename__ = 'Maquinaria'
    id = db.Column(db.Integer, primary_key=True)
    marca = db.Column(db.String(50), nullable=False)
    modelo = db.Column(db.String(50), nullable=False)
    serie = db.Column(db.String(50), unique=True, nullable=False)
    altura = db.Column(db.Numeric(5, 2))
    estado = db.Column(db.String(20), nullable=False, default='Disponible')

    arriendos = db.relationship('Arriendo', back_populates='maquinaria')

class Cliente(db.Model):
    __tablename__ = 'Cliente'
    id = db.Column(db.Integer, primary_key=True)
    razon_social = db.Column(db.String(100), nullable=False)
    rut = db.Column(db.String(20), unique=True, nullable=False)
    direccion = db.Column(db.String(200))
    telefono = db.Column(db.String(20))
    forma_pago = db.Column(db.String(50))

    arriendos = db.relationship('Arriendo', back_populates='cliente')

class Obra(db.Model):
    __tablename__ = 'Obra'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    direccion = db.Column(db.String(200))
    contacto_nombre = db.Column(db.String(100))
    contacto_telefono = db.Column(db.String(20))
    contacto_email = db.Column(db.String(100))

    arriendos = db.relationship('Arriendo', back_populates='obra')

class Arriendo(db.Model):
    __tablename__ = 'Arriendo'
    id = db.Column(db.Integer, primary_key=True)
    maquinaria_id = db.Column(db.Integer, db.ForeignKey('Maquinaria.id'), nullable=False)
    cliente_id = db.Column(db.Integer, db.ForeignKey('Cliente.id'), nullable=False)
    obra_id = db.Column(db.Integer, db.ForeignKey('Obra.id'), nullable=False)
    fecha_inicio = db.Column(db.Date, nullable=False)
    fecha_termino = db.Column(db.Date)
    periodo = db.Column(db.String(20), nullable=False)
    tarifa = db.Column(db.Numeric(10, 2), nullable=False)
    estado = db.Column(db.String(20), nullable=False, default='Activo')

    maquinaria = db.relationship('Maquinaria', back_populates='arriendos')
    cliente = db.relationship('Cliente', back_populates='arriendos')
    obra = db.relationship('Obra', back_populates='arriendos')
    documentos = db.relationship('Documento', back_populates='arriendo', cascade='all, delete-orphan')

class Documento(db.Model):
    __tablename__ = 'Documento'
    id = db.Column(db.Integer, primary_key=True)
    arriendo_id = db.Column(db.Integer, db.ForeignKey('Arriendo.id'), nullable=False)
    tipo = db.Column(db.String(30), nullable=False)
    numero = db.Column(db.String(50), nullable=False)
    fecha_emision = db.Column(db.Date, nullable=False)
    archivo_url = db.Column(db.String(200))

    arriendo = db.relationship('Arriendo', back_populates='documentos')

