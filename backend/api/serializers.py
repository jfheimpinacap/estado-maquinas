from rest_framework import serializers
from .models import Cliente, Maquinaria, Obra, Arriendo, Documento

class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = ['id','razon_social','rut','direccion','telefono','forma_pago']

class MaquinariaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Maquinaria
        fields = ['id','marca','modelo','serie','altura','estado']

class ObraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Obra
        fields = ['id','nombre','direccion','contacto_nombre','contacto_telefono','contacto_email']

class ArriendoSerializer(serializers.ModelSerializer):
    # Exponer FKs como IDs (PKs)
    maquinaria = serializers.PrimaryKeyRelatedField(queryset=Maquinaria.objects.all())
    cliente = serializers.PrimaryKeyRelatedField(queryset=Cliente.objects.all())
    obra = serializers.PrimaryKeyRelatedField(queryset=Obra.objects.all())

    class Meta:
        model = Arriendo
        fields = ['id','maquinaria','cliente','obra','fecha_inicio','fecha_termino','periodo','tarifa','estado']

class DocumentoSerializer(serializers.ModelSerializer):
    arriendo = serializers.PrimaryKeyRelatedField(queryset=Arriendo.objects.all())

    class Meta:
        model = Documento
        fields = ['id','arriendo','tipo','numero','fecha_emision','archivo_url']


