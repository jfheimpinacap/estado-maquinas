from flask import Blueprint, request, jsonify
from models import db, Maquinaria, Cliente, Obra, Arriendo, Documento
from datetime import datetime

api_blueprint = Blueprint('api', __name__)

@api_blueprint.route('/maquinarias', methods=['POST'])
def create_maquinaria():
    data = request.json
    nueva = Maquinaria(
        marca=data['marca'],
        modelo=data['modelo'],
        serie=data['serie'],
        altura=data.get('altura')
    )
    db.session.add(nueva)
    db.session.commit()
    return jsonify({"message": "Maquinaria creada", "id": nueva.id}), 201

@api_blueprint.route('/clientes', methods=['POST'])
def create_cliente():
    data = request.json
    nuevo = Cliente(
        razon_social=data['razon_social'],
        rut=data['rut'],
        direccion=data.get('direccion'),
        telefono=data.get('telefono'),
        forma_pago=data.get('forma_pago')
    )
    db.session.add(nuevo)
    db.session.commit()
    return jsonify({"message": "Cliente creado", "id": nuevo.id}), 201

@api_blueprint.route('/obras', methods=['POST'])
def create_obra():
    data = request.json
    nueva = Obra(
        nombre=data['nombre'],
        direccion=data.get('direccion'),
        contacto_nombre=data.get('contacto_nombre'),
        contacto_telefono=data.get('contacto_telefono'),
        contacto_email=data.get('contacto_email')
    )
    db.session.add(nueva)
    db.session.commit()
    return jsonify({"message": "Obra creada", "id": nueva.id}), 201

@api_blueprint.route('/arriendos', methods=['POST'])
def create_arriendo():
    data = request.json
    maquinaria = Maquinaria.query.get(data['maquinaria_id'])

    if not maquinaria:
        return jsonify({"error": "Maquinaria no encontrada"}), 404

    if maquinaria.estado != 'Disponible':
        return jsonify({"error": "Maquinaria no disponible"}), 400

    nuevo = Arriendo(
        maquinaria_id=data['maquinaria_id'],
        cliente_id=data['cliente_id'],
        obra_id=data['obra_id'],
        fecha_inicio=datetime.strptime(data['fecha_inicio'], '%Y-%m-%d').date(),
        periodo=data['periodo'],
        tarifa=data['tarifa'],
        estado='Activo'
    )

    maquinaria.estado = 'Arrendada'

    db.session.add(nuevo)
    db.session.commit()
    return jsonify({"message": "Arriendo creado", "id": nuevo.id}), 201

@api_blueprint.route('/documentos', methods=['POST'])
def create_documento():
    data = request.json
    arriendo = Arriendo.query.get(data['arriendo_id'])
    if not arriendo:
        return jsonify({"error": "Arriendo no encontrado"}), 404

    nuevo_doc = Documento(
        arriendo_id=data['arriendo_id'],
        tipo=data['tipo'],
        numero=data['numero'],
        fecha_emision=datetime.strptime(data['fecha_emision'], '%Y-%m-%d').date(),
        archivo_url=data.get('archivo_url')
    )
    db.session.add(nuevo_doc)

    if data['tipo'] == 'Guia Retiro':
        maquinaria = arriendo.maquinaria
        maquinaria.estado = 'Disponible'
        arriendo.estado = 'Finalizado'

    db.session.commit()
    return jsonify({"message": "Documento registrado", "id": nuevo_doc.id}), 201

@api_blueprint.route('/maquinarias', methods=['GET'])
def get_maquinarias():
    maquinarias = Maquinaria.query.all()
    result = []
    for m in maquinarias:
        result.append({
            'id': m.id,
            'marca': m.marca,
            'modelo': m.modelo,
            'serie': m.serie,
            'altura': m.altura,
            'estado': m.estado
        })
    return jsonify(result)

from sqlalchemy import or_

@api_blueprint.route('/clientes', methods=['GET'])
def get_clientes():
    query_param = request.args.get('query', '').strip()

    if query_param:
        # Si hay query, filtra por razón social o rut (insensible a mayúsculas)
        clientes = Cliente.query.filter(
            or_(
                Cliente.razon_social.ilike(f"%{query_param}%"),
                Cliente.rut.ilike(f"%{query_param}%")
            )
        ).all()
    else:
        # Si no hay query, devuelve todos
        clientes = Cliente.query.all()

    result = []
    for c in clientes:
        result.append({
            'id': c.id,
            'razon_social': c.razon_social,
            'rut': c.rut,
            'direccion': c.direccion,
            'telefono': c.telefono,
            'forma_pago': c.forma_pago
        })
    return jsonify(result)



@api_blueprint.route('/obras', methods=['GET'])
def get_obras():
    obras = Obra.query.all()
    result = []
    for o in obras:
        result.append({
            'id': o.id,
            'nombre': o.nombre,
            'direccion': o.direccion,
            'contacto_nombre': o.contacto_nombre,
            'contacto_telefono': o.contacto_telefono,
            'contacto_email': o.contacto_email
        })
    return jsonify(result)

@api_blueprint.route('/arriendos', methods=['GET'])
def get_arriendos():
    arriendos = Arriendo.query.all()
    result = []
    for a in arriendos:
        result.append({
            'id': a.id,
            'maquinaria_id': a.maquinaria_id,
            'cliente_id': a.cliente_id,
            'obra_id': a.obra_id,
            'fecha_inicio': a.fecha_inicio.strftime('%Y-%m-%d'),
            'periodo': a.periodo,
            'tarifa': float(a.tarifa),
            'estado': a.estado
        })
    return jsonify(result)

@api_blueprint.route('/documentos', methods=['GET'])
def get_documentos():
    docs = Documento.query.all()
    result = []
    for d in docs:
        result.append({
            'id': d.id,
            'arriendo_id': d.arriendo_id,
            'tipo': d.tipo,
            'numero': d.numero,
            'fecha_emision': d.fecha_emision.strftime('%Y-%m-%d'),
            'archivo_url': d.archivo_url
        })
    return jsonify(result)
