from rest_framework import viewsets
from rest_framework.response import Response
from django.db.models import Q
from .models import Maquinaria, Cliente, Obra, Arriendo, Documento
from .serializers import (
    MaquinariaSerializer, ClienteSerializer, ObraSerializer,
    ArriendoSerializer, DocumentoSerializer
)

class MaquinariaViewSet(viewsets.ModelViewSet):
    queryset = Maquinaria.objects.all()
    serializer_class = MaquinariaSerializer

class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer

    # GET /clientes?query=...
    def list(self, request, *args, **kwargs):
        q = (request.GET.get("query") or "").strip()
        qs = self.get_queryset()
        if q:
            qs = qs.filter(Q(razon_social__icontains=q) | Q(rut__icontains=q))
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

class ObraViewSet(viewsets.ModelViewSet):
    queryset = Obra.objects.all()
    serializer_class = ObraSerializer

class ArriendoViewSet(viewsets.ModelViewSet):
    queryset = Arriendo.objects.all()
    serializer_class = ArriendoSerializer

    # POST /arriendos – valida disponibilidad
    def create(self, request, *args, **kwargs):
        maq_id = request.data.get("maquinaria")
        try:
            maq = Maquinaria.objects.get(pk=maq_id)
        except Maquinaria.DoesNotExist:
            return Response({"error": "Maquinaria no encontrada"}, status=404)

        if maq.estado != "Disponible":
            return Response({"error": "Maquinaria no disponible"}, status=400)

        resp = super().create(request, *args, **kwargs)
        if resp.status_code in (200, 201):
            maq.estado = "Arrendada"
            maq.save(update_fields=["estado"])
        return resp

class DocumentoViewSet(viewsets.ModelViewSet):
    queryset = Documento.objects.all()
    serializer_class = DocumentoSerializer

    # POST /documentos – si tipo = "Guia Retiro": setear estados
    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        if resp.status_code in (200, 201):
            doc_id = resp.data.get("id")
            try:
                doc = Documento.objects.get(pk=doc_id)
            except Documento.DoesNotExist:
                return resp

            if doc.tipo == "Guia Retiro":
                arriendo = doc.arriendo
                maq = arriendo.maquinaria
                maq.estado = "Disponible"
                maq.save(update_fields=["estado"])
                arriendo.estado = "Finalizado"
                arriendo.save(update_fields=["estado"])
        return resp

