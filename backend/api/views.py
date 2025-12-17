# backend/api/views.py
from django.db import IntegrityError, transaction
from django.db.models import Q, Case, When, IntegerField, F, Value
from django.db.models.functions import Replace
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from decimal import Decimal
import re

from .models import (
    Maquinaria, Cliente, Obra, Arriendo,
    Documento, OrdenTrabajo, UserSecurity, DOC_TIPO
)
from .serializers import (
    MaquinariaSerializer, ClienteSerializer, ObraSerializer,
    ArriendoSerializer,
    DocumentoDetalleSerializer, OrdenTrabajoSerializer,
    UserSerializer
)

MAX_FAILED = 5


def _get_or_create_sec(u: User) -> UserSecurity:
    sec, _ = UserSecurity.objects.get_or_create(user=u)
    return sec


def _next_doc_number(tipo: str) -> str:
    """
    Genera un número correlativo simple por tipo de documento,
    devolviendo SIEMPRE 4 dígitos: "0001", "0002", etc.

    El prefijo visible (F/G) se arma en la vista (F0001, G0001),
    NO se guarda dentro de 'numero'.
    """
    last = Documento.objects.filter(tipo=tipo).order_by("-id").first()
    if not last or not last.numero:
        return "0001"

    # Buscamos los dígitos finales (por si el número tiene letras)
    m = re.search(r"(\d+)$", str(last.numero))
    if not m:
        return "0001"

    n = int(m.group(1)) + 1
    return f"{n:04d}"


# =======================
#   Maquinarias
# =======================
class MaquinariaViewSet(viewsets.ModelViewSet):
    queryset = Maquinaria.objects.all()
    serializer_class = MaquinariaSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        q = (request.GET.get("query") or "").strip()
        qs = self.get_queryset()
        if q:
            qs = (
                qs.filter(
                    Q(serie__iexact=q)
                    | Q(marca__icontains=q)
                    | Q(modelo__icontains=q)
                )
                .annotate(
                    serie_match=Case(
                        When(serie__iexact=q, then=1),
                        default=0,
                        output_field=IntegerField(),
                    )
                )
                .order_by("-serie_match", "marca", "modelo")
            )

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def historial(self, request, pk=None):
        """
        Historial cronológico de arriendos de la máquina
        con doc más reciente de cada arriendo.
        """
        try:
            maq = Maquinaria.objects.get(pk=pk)
        except Maquinaria.DoesNotExist:
            return Response({"detail": "Maquinaria no encontrada"}, status=404)

        arriendos = (
            Arriendo.objects.filter(maquinaria=maq)
            .select_related("obra")
            .prefetch_related("documentos")
            .order_by("-fecha_inicio", "-id")
        )

        historial = []
        for arr in arriendos:
            doc = (
                arr.documentos.all()
                .order_by("-fecha_emision", "-id")
                .first()
            )
            doc_label = (
                f"{doc.get_tipo_display()} {doc.numero}" if doc else "—"
            )
            historial.append(
                {
                    "documento": doc_label,
                    "fecha_inicio": arr.fecha_inicio,
                    "fecha_termino": arr.fecha_termino,
                    "obra": arr.obra.nombre if arr.obra_id else "—",
                }
            )
        return Response(historial, status=200)


# =======================
#   Clientes
# =======================
class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        q = (request.GET.get("query") or "").strip()
        qs = self.get_queryset()
        if q:
            if q.isdigit():
                normalized = Replace(
                    Replace(F("rut"), Value("."), Value("")),
                    Value("-"),
                    Value(""),
                )
                qs = qs.annotate(rut_norm=normalized).filter(
                    rut_norm__startswith=q
                )
            else:
                qs = qs.filter(
                    Q(razon_social__icontains=q) | Q(rut__icontains=q)
                )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


# =======================
#   Obras
# =======================
class ObraViewSet(viewsets.ModelViewSet):
    queryset = Obra.objects.all()
    serializer_class = ObraSerializer
    permission_classes = [IsAuthenticated]


# =======================
#   Arriendos
# =======================
class ArriendoViewSet(viewsets.ModelViewSet):
    queryset = Arriendo.objects.all()
    serializer_class = ArriendoSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        maq_id = request.data.get("maquinaria")
        try:
            maq = Maquinaria.objects.get(pk=maq_id)
        except Maquinaria.DoesNotExist:
            return Response({"error": "Maquinaria no encontrada"}, status=404)

        # En tu modelo actual sólo tienes Disponible / Para venta,
        # así que no cambiamos aquí el estado
        resp = super().create(request, *args, **kwargs)
        return resp


# =======================
#   Documentos (consulta)
# =======================
class DocumentoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consulta de documentos tributarios con asociaciones:
    - FACT -> (opcional) GD en relacionado_con (periodo inicial)
    - FACT -> puede tener varias NC (relaciones_inversas)
    - NC   -> puede tener varias ND (relaciones_inversas)
    - GD   -> es_retiro indica retiro (no facturable) vs despacho (facturable)
    Filtros: tipo, numero, cliente (razón social o RUT), desde, hasta.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = DocumentoDetalleSerializer
    queryset = (
        Documento.objects.select_related(
            "cliente", "arriendo", "obra_origen", "obra_destino", "relacionado_con"
        ).prefetch_related("relaciones_inversas")
    )

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        tipo = (request.GET.get("tipo") or "").upper().strip()
        numero = (request.GET.get("numero") or "").strip()
        cliente = (request.GET.get("cliente") or "").strip()
        desde = request.GET.get("desde")
        hasta = request.GET.get("hasta")

        if tipo in dict(DOC_TIPO):
            qs = qs.filter(tipo=tipo)
        if numero:
            qs = qs.filter(numero__icontains=numero)
        if cliente:
            qs = qs.filter(
                Q(cliente__razon_social__icontains=cliente)
                | Q(cliente__rut__icontains=cliente)
            )
        if desde:
            qs = qs.filter(fecha_emision__gte=desde)
        if hasta:
            qs = qs.filter(fecha_emision__lte=hasta)

        qs = qs.order_by("-fecha_emision", "-id")
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)


class OrdenTrabajoViewSet(viewsets.ModelViewSet):
    """
    - /ordenes                         -> listado general OT
    - /ordenes?solo_pendientes=1
    - /ordenes?solo_facturacion_pendiente=1
    - /ordenes/estado-arriendos       -> estado de máquinas en arriendo
    - /ordenes/estado-bodega          -> máquinas disponibles en bodega
    - /ordenes/<pk>/emitir            -> emitir FACT / GD (venta, arriendo, traslado, retiro)
    """

    permission_classes = [IsAuthenticated]
    serializer_class = OrdenTrabajoSerializer
    queryset = (
        OrdenTrabajo.objects.select_related(
            "cliente", "arriendo", "maquinaria", "factura", "guia"
        )
    )

    # ---------- helper: enriquecer filas con RUT, OC, vendedor y series ----------
    def _enrich_ot_rows(self, queryset, base_data):
        """
        Agrega a cada fila campos derivados:
        - rut_cliente / cliente_rut / rut
        - serie / maquinaria_serie
        - series (todas las series en detalle_lineas)
        - orden_compra / oc
        - vendedor
        """
        filas = []
        for ot, row in zip(queryset, base_data):
            cli = ot.cliente
            maq = ot.maquinaria

            rut = cli.rut if cli else ""
            razon = cli.razon_social if cli else ""
            serie_principal = maq.serie if maq else ""

            # series de las líneas
            series_lineas = []
            det = getattr(ot, "detalle_lineas", None) or []
            try:
                for l in det:
                    s = (l.get("serie") or "").strip()
                    if s and s not in series_lineas:
                        series_lineas.append(s)
            except Exception:
                pass

            # orden de compra: campo directo si existe, si no tratamos de inferir de observaciones
            oc_attr = getattr(ot, "orden_compra", None)
            if oc_attr:
                oc = str(oc_attr)
            else:
                oc = ""
                obs = getattr(ot, "observaciones", "") or ""
                m = re.search(r"OC:\s*(.+)", obs)
                if m:
                    oc = m.group(1).strip()

            vendedor = getattr(ot, "vendedor", "") or ""

            r = dict(row)
            # nombres amigables + sinónimos
            r.setdefault("cliente_nombre", razon)
            r.setdefault("cliente_razon_social", razon)
            r.setdefault("cliente_razon", razon)

            r["rut_cliente"] = rut
            r["cliente_rut"] = rut
            r["rut"] = rut

            r["serie"] = serie_principal
            r["maquinaria_serie"] = serie_principal

            r["series_maquinas"] = series_lineas
            r["series"] = series_lineas

            r["orden_compra"] = oc
            r["oc"] = oc
            r["vendedor"] = vendedor

            # fecha de emisión sugerida (para GD/FACT)
            r.setdefault("fecha_emision_doc", getattr(ot, "fecha_emision_doc", None))

            filas.append(r)
        return filas

    # ---------- CREAR OT DESDE CrearOT.jsx ----------
    def create(self, request, *args, **kwargs):
        """
        Crear OT desde el formulario de CrearOT.jsx.

        Espera (entre otros):
        - tipo: "ALTA" | "SERV" | "TRAS" | "RETI" (o "RETIRO" desde el front)
        - meta_cliente: texto con RUT o razón social
        - meta_obra, meta_direccion, meta_contactos
        - meta_orden_compra
        - meta_fecha_emision: "YYYY-MM-DD" (opcional)
        - arriendo_id (opcional pero OBLIGATORIO en RETI)
        - lineas: [{serie, unidad, cantidadPeriodo, desde, hasta, valor, flete, tipoFlete}, ...]
        """
        data = request.data or {}

        tipo_raw = (data.get("tipo") or "ALTA").upper()
        # Aceptamos "RETIRO" desde el front, pero guardamos "RETI" en BD
        tipo = "RETI" if tipo_raw == "RETIRO" else tipo_raw

        lineas = data.get("lineas") or []
        if not isinstance(lineas, list) or len(lineas) == 0:
            return Response(
                {"detail": "Debes indicar al menos una máquina en 'lineas'."},
                status=400,
            )

        meta_cliente = data.get("meta_cliente") or ""
        meta_obra = data.get("meta_obra") or ""
        meta_direccion = data.get("meta_direccion") or ""
        meta_contactos = data.get("meta_contactos") or ""
        meta_oc = data.get("meta_orden_compra") or ""
        meta_fecha_emision = data.get("meta_fecha_emision") or ""
        observaciones = data.get("observaciones") or ""

        arriendo_id = data.get("arriendo_id") or data.get("arriendo") or None

        # ---------- Arriendo asociado (especialmente para RETI) ----------
        arr = None
        maquinaria_principal = None
        if arriendo_id:
            try:
                arr = (
                    Arriendo.objects.select_related("maquinaria", "obra", "cliente")
                    .get(pk=arriendo_id)
                )
            except Arriendo.DoesNotExist:
                return Response(
                    {"detail": f"Arriendo asociado (id={arriendo_id}) no encontrado."},
                    status=400,
                )
            if arr.maquinaria_id:
                maquinaria_principal = arr.maquinaria

            # Si no viene obra/dirección y hay arriendo, las tomamos desde ahí
            if not meta_obra and arr.obra_id:
                meta_obra = arr.obra.nombre
            if not meta_direccion and arr.obra_id and arr.obra.direccion:
                meta_direccion = arr.obra.direccion

        # Para RETI sin arriendo asociado, avisamos explícitamente
        if tipo == "RETI" and not arr:
            return Response(
                {
                    "detail": (
                        "Para una OT de tipo Retiro debes indicar el arriendo asociado. "
                        "Usa el botón 'Retiro' desde Estado de arriendo de máquinas."
                    )
                },
                status=400,
            )

        # ---------- Resolver cliente ----------
        cli = None

        if tipo == "RETI" and arr and arr.cliente_id:
            # En RETI usamos SIEMPRE el cliente del arriendo
            cli = arr.cliente
        elif meta_cliente:
            # Buscar un RUT en el texto: 11.111.111-1
            m = re.search(r"\d{1,3}(?:\.\d{3}){2}-[\dkK]", meta_cliente)
            if m:
                rut = m.group(0)
                cli = Cliente.objects.filter(rut__iexact=rut).first()

            # Si no lo encontramos por RUT, intentamos por razón social
            if not cli:
                cli = Cliente.objects.filter(
                    Q(razon_social__icontains=meta_cliente)
                    | Q(rut__icontains=meta_cliente)
                ).first()

        if not cli:
            return Response(
                {
                    "detail": (
                        "No se pudo identificar el cliente. "
                        "Selecciona un cliente desde la lista para que coincida con la base de datos."
                    )
                },
                status=400,
            )

        # ---------- Procesar líneas / totales ----------
        detalle_lineas = []
        total_neto = Decimal("0")
        total_iva = Decimal("0")
        total_total = Decimal("0")

        for l in lineas:
            serie = (l.get("serie") or "").strip()
            if not serie:
                # Ignoramos líneas sin serie
                continue

            unidad = l.get("unidad") or "Dia"
            try:
                cantidad = int(l.get("cantidadPeriodo") or 0)
            except (TypeError, ValueError):
                cantidad = 0

            desde = l.get("desde") or None
            hasta = l.get("hasta") or None

            # Valores monetarios
            valor = Decimal(str(l.get("valor") or "0") or "0")
            flete = Decimal(str(l.get("flete") or "0") or "0")
            tipo_flete = l.get("tipoFlete") or ""

            neto = valor + flete
            iva = (neto * Decimal("0.19")).quantize(Decimal("0.01"))
            total = neto + iva

            total_neto += neto
            total_iva += iva
            total_total += total

            maq = Maquinaria.objects.filter(serie__iexact=serie).first()
            if maq and maquinaria_principal is None:
                maquinaria_principal = maq

            detalle_lineas.append(
                {
                    "serie": serie,
                    "unidad": unidad,
                    "cantidadPeriodo": cantidad,
                    "desde": desde,
                    "hasta": hasta,
                    "valor": float(valor),
                    "flete": float(flete),
                    "tipoFlete": tipo_flete,
                    "neto": float(neto),
                    "iva": float(iva),
                    "total": float(total),
                }
            )

        if not detalle_lineas:
            return Response(
                {"detail": "Debes indicar al menos una máquina con serie válida."},
                status=400,
            )

        # ---------- Tipo comercial / facturable ----------
        tipo_comercial = None
        if tipo in ("ALTA", "PROL"):
            tipo_comercial = "A"
        elif tipo == "SERV":
            tipo_comercial = "V"
        elif tipo in ("TRAS", "RETI"):
            tipo_comercial = "T"

        # - Venta (SERV): facturable de inmediato
        # - Traslado con guía facturable se marcará después en emitir()
        # - Retiro (RETI): NO facturable (GD no facturable)
        es_facturable = (tipo == "SERV")

        # ---------- Parsear fecha_emision_doc ----------
        fecha_emision_doc = None
        if meta_fecha_emision:
            from datetime import date as _date

            try:
                fecha_emision_doc = _date.fromisoformat(meta_fecha_emision)
            except ValueError:
                fecha_emision_doc = None

        extra_kwargs = {}
        if hasattr(OrdenTrabajo, "orden_compra"):
            extra_kwargs["orden_compra"] = meta_oc
        if hasattr(OrdenTrabajo, "vendedor"):
            extra_kwargs["vendedor"] = data.get("vendedor") or ""
        if hasattr(OrdenTrabajo, "fecha_emision_doc"):
            extra_kwargs["fecha_emision_doc"] = fecha_emision_doc
        if arr:
            extra_kwargs["arriendo"] = arr

        ot = OrdenTrabajo.objects.create(
            tipo=tipo,
            estado="PEND",
            tipo_comercial=tipo_comercial,
            cliente=cli,
            maquinaria=maquinaria_principal,
            direccion=meta_direccion,
            obra_nombre=meta_obra,
            contactos=meta_contactos,
            detalle_lineas=detalle_lineas,
            monto_neto=total_neto,
            monto_iva=total_iva,
            monto_total=total_total,
            observaciones=observaciones,
            es_facturable=es_facturable,
            **extra_kwargs,
        )

        # Si el modelo NO tuviera campo orden_compra (legacy), guardamos OC en observaciones
        if meta_oc and not hasattr(OrdenTrabajo, "orden_compra"):
            texto = (ot.observaciones or "").strip()
            if texto:
                texto += "\n"
            texto += f"OC: {meta_oc}"
            ot.observaciones = texto
            ot.save(update_fields=["observaciones"])

        ser = self.get_serializer(ot)
        data_resp = self._enrich_ot_rows([ot], [ser.data])[0]
        return Response(data_resp, status=201)

    # ---------- LISTADO / FILTROS ----------
    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()

        # Solo OT pendientes (estado lógico)
        solo_pend = (
            (request.GET.get("solo_pendientes") or "")
            .lower()
            .strip()
            in ("1", "true", "t", "yes", "y")
        )
        if solo_pend:
            qs = qs.filter(estado="PEND")

        # Solo OT con facturación pendiente
        solo_fact = (
            (request.GET.get("solo_facturacion_pendiente") or "")
            .lower()
            .strip()
            in ("1", "true", "t", "yes", "y")
        )
        if solo_fact:
            qs = qs.filter(
                estado="PEND",
                es_facturable=True,
                factura__isnull=True,
            )

        qs = qs.order_by("-fecha_creacion")
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            data = self._enrich_ot_rows(page, list(ser.data))
            return self.get_paginated_response(data)

        ser = self.get_serializer(qs, many=True)
        data = self._enrich_ot_rows(qs, list(ser.data))
        return Response(data)

    # ------- EMITIR DOCUMENTO DESDE LA OT -------
    @action(detail=True, methods=["post"], url_path="emitir")
    def emitir(self, request, pk=None):
        """
        Emitir documento asociado a la OT.

        Front envía (EstadoOrdenes.jsx):
        - tipo_documento: "GD" | "FACT"
        - facturable: boolean (solo aplica a GD)

        Reglas:
        - FACT:
          * SERV (Venta): permite facturar sin arriendo previo
            (crea un arriendo "fantasma" de venta y NO aparece en Estado de arriendo).
          * Otros tipos: requiere arriendo ya asociado.
        - GD:
          * facturable=True  -> guía facturable (montos, deja OT es_facturable=True para luego FACT).
          * facturable=False -> guía NO facturable.
          * RETI (Retiro)    -> siempre GD NO facturable + cierra arriendo y libera máquina.
        """
        ot = self.get_object()
        data = request.data or {}

        tipo_doc = (data.get("tipo_documento") or "").upper().strip()
        facturable_flag = data.get("facturable", None)

        # Compatibilidad con el campo 'accion' antiguo
        if not tipo_doc:
            accion_raw = str(data.get("accion") or "").lower().strip()
            if accion_raw in ("facturar", "emitir_factura", "factura"):
                tipo_doc = "FACT"
            elif accion_raw in (
                "guia_no_facturable",
                "emitir_guia_no_facturable",
                "gd_no_facturable",
                "gd_retiro",
                "retiro",
            ):
                tipo_doc = "GD"
                if facturable_flag is None:
                    facturable_flag = False

        if tipo_doc not in ("FACT", "GD"):
            return Response(
                {"detail": "tipo_documento inválido. Debe ser 'GD' o 'FACT'."},
                status=400,
            )

        # Fecha de emisión: la que venga configurada en la OT o hoy
        fecha_emision = getattr(ot, "fecha_emision_doc", None) or timezone.now().date()

        # ------- EMITIR FACTURA -------
        if tipo_doc == "FACT":
            hoy = fecha_emision
            cliente = ot.cliente
            if not cliente:
                return Response(
                    {"detail": "La orden no tiene cliente asociado."},
                    status=400,
                )

            # Venta directa (SERV): permitir sin arriendo previo
            if ot.tipo == "SERV":
                arr = ot.arriendo
                if arr is None:
                    maq = ot.maquinaria
                    if maq is None:
                        # Intentar inferir desde la primera línea
                        det = getattr(ot, "detalle_lineas", None) or []
                        serie_maquina = None
                        try:
                            for l in det:
                                s = (l.get("serie") or "").strip()
                                if s:
                                    serie_maquina = s
                                    break
                        except Exception:
                            pass
                        if serie_maquina:
                            maq = Maquinaria.objects.filter(
                                serie__iexact=serie_maquina
                            ).first()

                    fecha_desde = hoy
                    fecha_hasta = hoy
                    det = getattr(ot, "detalle_lineas", None) or []
                    try:
                        if det:
                            l0 = det[0]
                            if l0.get("desde"):
                                fecha_desde = l0["desde"]
                            if l0.get("hasta"):
                                fecha_hasta = l0["hasta"]
                    except Exception:
                        pass

                    # Arriendo "fantasma" para satisfacer FK de Documento
                    arr = Arriendo.objects.create(
                        cliente=cliente,
                        maquinaria=maq,
                        obra=None,
                        fecha_inicio=fecha_desde,
                        fecha_termino=fecha_hasta,
                        periodo="Dia",
                        tarifa=ot.monto_neto or Decimal("0"),
                        estado="Terminado",  # NO se mostrará en Estado de arriendos
                    )
                    ot.arriendo = arr
                    ot.save(update_fields=["arriendo"])
            else:
                # Para ALTA / TRAS / otros tipos, exigimos arriendo asociado
                if not ot.arriendo_id:
                    return Response(
                        {
                            "detail": (
                                "La orden no tiene arriendo asociado; "
                                "no se puede facturar todavía (falta enlazarla al arriendo correspondiente)."
                            )
                        },
                        status=400,
                    )

            arr = ot.arriendo
            numero = _next_doc_number("FACT")  # "0001", "0002", ...
            with transaction.atomic():
                fact = Documento.objects.create(
                    tipo="FACT",
                    numero=numero,
                    fecha_emision=hoy,
                    monto_neto=ot.monto_neto or 0,
                    monto_iva=ot.monto_iva or 0,
                    monto_total=ot.monto_total or 0,
                    arriendo=arr,
                    cliente=cliente,
                    obra_destino=arr.obra if arr and arr.obra_id else None,
                    relacionado_con=ot.guia if ot.guia_id else None,
                )

                ot.factura = fact
                ot.estado = "PROC"          # deja de estar pendiente
                ot.es_facturable = False    # ya está facturada
                ot.fecha_cierre = timezone.now()
                ot.save(
                    update_fields=[
                        "factura",
                        "estado",
                        "es_facturable",
                        "fecha_cierre",
                    ]
                )

            # Devolvemos la OT completa y enriquecida
            ser = self.get_serializer(ot)
            data_resp = self._enrich_ot_rows([ot], [ser.data])[0]
            return Response(data_resp, status=200)

        # ------- EMITIR GUÍA (GD) -------
        # Si llegamos aquí tipo_doc == "GD"
        if ot.guia_id:
            return Response(
                {"detail": "La orden ya tiene una guía asociada."},
                status=400,
            )

        if not ot.arriendo_id:
            return Response(
                {
                    "detail": (
                        "La orden no tiene arriendo asociado; "
                        "no se puede emitir una guía todavía."
                    )
                },
                status=400,
            )

        arr = ot.arriendo
        cliente = ot.cliente or (arr.cliente if arr and arr.cliente_id else None)
        if not cliente:
            return Response(
                {"detail": "La orden no tiene cliente asociado."},
                status=400,
            )

        numero = _next_doc_number("GD")  # "0001", "0002", ...

        # facturable=True -> GD con montos (para luego FACT)
        es_gd_facturable = bool(facturable_flag)
        es_retiro = not es_gd_facturable  # por defecto, GD no facturable se marca retiro

        # Montos en GD
        if es_gd_facturable:
            monto_neto = ot.monto_neto or Decimal("0")
            monto_iva = ot.monto_iva or Decimal("0")
            monto_total = ot.monto_total or Decimal("0")
        else:
            monto_neto = Decimal("0")
            monto_iva = Decimal("0")
            monto_total = Decimal("0")

        # Obra origen/destino según tipo de OT
        if ot.tipo == "ALTA":
            obra_origen = None
            obra_destino = arr.obra if arr and arr.obra_id else None
        elif ot.tipo == "TRAS":
            obra_origen = None
            obra_destino = arr.obra if arr and arr.obra_id else None
        elif ot.tipo == "RETI":
            obra_origen = arr.obra if arr and arr.obra_id else None
            obra_destino = None
            es_retiro = True
        else:
            obra_origen = arr.obra if arr and arr.obra_id else None
            obra_destino = None

        with transaction.atomic():
            gd = Documento.objects.create(
                tipo="GD",
                numero=numero,
                fecha_emision=fecha_emision,
                monto_neto=monto_neto,
                monto_iva=monto_iva,
                monto_total=monto_total,
                arriendo=arr,
                cliente=cliente,
                obra_origen=obra_origen,
                obra_destino=obra_destino,
                es_retiro=es_retiro,
            )

            # Actualizar OT
            ot.guia = gd

            if ot.tipo == "RETI":
                # Retiro: NO genera factura, cierra arriendo y libera máquina
                ot.es_facturable = False
                ot.estado = "PROC"
                ot.fecha_cierre = timezone.now()

                # cerrar arriendo
                arr.estado = "Terminado"
                arr.fecha_termino = fecha_emision
                arr.save(update_fields=["estado", "fecha_termino"])

                # liberar máquina
                if arr.maquinaria_id:
                    maq = arr.maquinaria
                    maq.estado = "Disponible"
                    maq.save(update_fields=["estado"])
            else:
                # Otras OT:
                if es_gd_facturable:
                    # GD facturable -> quedará pendiente de FACT
                    ot.es_facturable = True
                    ot.estado = "PEND"
                else:
                    # GD no facturable -> OT se da por procesada
                    ot.es_facturable = False
                    ot.estado = "PROC"

            ot.save(update_fields=["guia", "es_facturable", "estado", "fecha_cierre"])

        # Devolvemos la OT completa y enriquecida
        ser = self.get_serializer(ot)
        data_resp = self._enrich_ot_rows([ot], [ser.data])[0]
        return Response(data_resp, status=200)

    # ------- ESTADO ARRIENDO MÁQUINAS -------
    @action(detail=False, methods=["get"], url_path="estado-arriendos")
    def estado_arriendos(self, request):
        """
        Devuelve la tabla para "Estado de arriendo de máquinas".

        Una FILA por ARRIENDO ACTIVO:
        - Usa el ÚLTIMO documento de guía de despacho (GD) del arriendo si existe.
        - Muestra también la última FACTURA asociada en columnas separadas.
        - NO muestra arriendos que no tengan ningún documento.
        - NO muestra arriendos ya terminados (estado != 'Activo').
        """
        hoy = timezone.now().date()
        q = (request.GET.get("query") or "").strip()

        arr_qs = (
            Arriendo.objects.select_related(
                "cliente", "maquinaria", "obra"
            )
            .prefetch_related("documentos", "ordenes")
            .filter(
                Q(estado__iexact="Activo")
                & (
                    Q(fecha_termino__isnull=True)
                    | Q(fecha_termino__gte=hoy)
                )
            )
        )

        if q:
            arr_qs = arr_qs.filter(
                Q(cliente__razon_social__icontains=q)
                | Q(cliente__rut__icontains=q)
                | Q(maquinaria__marca__icontains=q)
                | Q(maquinaria__modelo__icontains=q)
                | Q(maquinaria__serie__icontains=q)
            )

        filas = []

        for arr in arr_qs.order_by("id"):
            # Si el arriendo no tiene documentos, no se muestra
            if not arr.documentos.exists():
                continue

            # Última guía de despacho (no retiro) del arriendo
            gd = (
                arr.documentos.filter(tipo="GD", es_retiro=False)
                .order_by("fecha_emision", "id")
                .last()
            )

            # Última factura del arriendo
            fact = (
                arr.documentos.filter(tipo="FACT")
                .order_by("fecha_emision", "id")
                .last()
            )

            # Helper para mostrar código amigable
            def _label(doc):
                if not doc:
                    return ""
                if doc.tipo == "FACT":
                    pref = "F"
                elif doc.tipo == "GD":
                    pref = "G"
                else:
                    pref = doc.get_tipo_display()[0]
                return f"{pref}{doc.numero}"

            # Documento de movimiento: preferimos la GD; si no hay, usamos cualquier doc
            ultimo_mov = gd or (
                arr.documentos.order_by("fecha_emision", "id").last()
            )

            if not ultimo_mov:
                continue

            doc_label = _label(ultimo_mov)
            doc_tipo = ultimo_mov.tipo
            doc_numero = ultimo_mov.numero
            doc_fecha = ultimo_mov.fecha_emision

            factura_label = _label(fact) if fact else ""
            factura_numero = fact.numero if fact else None
            factura_fecha = fact.fecha_emision if fact else None

            # Última OT asociada al arriendo
            ot = (
                arr.ordenes.all()
                .order_by("-fecha_creacion", "-id")
                .first()
            )
            if ot:
                pref_ot = ot.tipo_comercial or (ot.tipo[:1] if ot.tipo else "OT")
                folio_ot = f"{pref_ot}{str(ot.id).zfill(4)}"
                oc = getattr(ot, "orden_compra", "") or ""
                vendedor = getattr(ot, "vendedor", "") or ""
                ot_tipo = ot.tipo
            else:
                folio_ot = ""
                oc = ""
                vendedor = ""
                ot_tipo = ""

            filas.append(
                {
                    "id": arr.id,  # id del arriendo
                    "documento": doc_label or "—",
                    "doc_tipo": doc_tipo,
                    "doc_numero": doc_numero,
                    "doc_fecha": doc_fecha,
                    "factura": factura_label,
                    "factura_numero": factura_numero,
                    "factura_fecha": factura_fecha,
                    "marca": arr.maquinaria.marca if arr.maquinaria_id else "",
                    "modelo": arr.maquinaria.modelo if arr.maquinaria_id else "",
                    "altura": getattr(arr.maquinaria, "altura", None)
                    if arr.maquinaria_id
                    else None,
                    "serie": arr.maquinaria.serie if arr.maquinaria_id else "",
                    "desde": arr.fecha_inicio,
                    "hasta": arr.fecha_termino,
                    "cliente": arr.cliente.razon_social if arr.cliente_id else "",
                    "rut_cliente": arr.cliente.rut if arr.cliente_id else "",
                    "obra": arr.obra.nombre if arr.obra_id else "",
                    "ot_id": ot.id if ot else None,
                    "ot_folio": folio_ot,
                    "orden_compra": oc,
                    "vendedor": vendedor,
                    "ot_tipo": ot_tipo,
                }
            )

        return Response(filas, status=200)

    # ------- BODEGA: máquinas disponibles -------
    @action(detail=False, methods=["get"], url_path="estado-bodega")
    def estado_bodega(self, request):
        """
        Devuelve la pestaña "Bodega" del Estado de máquinas.

        Una FILA por MÁQUINA con estado 'Disponible':
        - Cliente: empresa propia (para mostrar en la tabla).
        - Obra: última obra donde estuvo la máquina (último arriendo).
        - Documento: última guía de retiro (GD con es_retiro=True), si existe.
        - Factura: última factura asociada a esa máquina, si existe.
        - El resto de columnas (desde / hasta) se dejan en blanco.
        """
        q = (request.GET.get("query") or "").strip()

        maq_qs = Maquinaria.objects.filter(estado__iexact="Disponible")

        if q:
            maq_qs = maq_qs.filter(
                Q(marca__icontains=q)
                | Q(modelo__icontains=q)
                | Q(serie__icontains=q)
            )

        filas = []

        for maq in maq_qs.order_by("marca", "modelo", "serie"):
            # Último arriendo registrado (para saber la última obra)
            arr_last = (
                Arriendo.objects.filter(maquinaria=maq)
                .select_related("obra", "cliente")
                .order_by("-fecha_inicio", "-id")
                .first()
            )

            # Última guía de RETIRO de esa máquina
            gd_retiro = (
                Documento.objects.filter(
                    arriendo__maquinaria=maq,
                    tipo="GD",
                    es_retiro=True,
                )
                .order_by("fecha_emision", "id")
                .last()
            )

            # Helper label
            def _label(doc):
                if not doc:
                    return ""
                if doc.tipo == "GD":
                    pref = "G"
                elif doc.tipo == "FACT":
                    pref = "F"
                else:
                    pref = doc.get_tipo_display()[0]
                return f"{pref}{doc.numero}"

            doc_label = _label(gd_retiro)
            doc_fecha = gd_retiro.fecha_emision if gd_retiro else None
            doc_numero = gd_retiro.numero if gd_retiro else None
            doc_tipo = gd_retiro.tipo if gd_retiro else None

            # Última factura asociada a la máquina
            fact = (
                Documento.objects.filter(
                    arriendo__maquinaria=maq,
                    tipo="FACT",
                )
                .order_by("fecha_emision", "id")
                .last()
            )
            factura_label = _label(fact) if fact else ""
            factura_numero = fact.numero if fact else None
            factura_fecha = fact.fecha_emision if fact else None

            # OT asociada a la guía de retiro (si existe)
            ot_retiro = (
                OrdenTrabajo.objects.filter(guia=gd_retiro)
                .order_by("-fecha_creacion", "-id")
                .first()
                if gd_retiro
                else None
            )
            if ot_retiro:
                pref_ot = ot_retiro.tipo_comercial or (
                    ot_retiro.tipo[:1] if ot_retiro.tipo else "OT"
                )
                folio_ot = f"{pref_ot}{str(ot_retiro.id).zfill(4)}"
                oc = getattr(ot_retiro, "orden_compra", "") or ""
                vendedor = getattr(ot_retiro, "vendedor", "") or ""
                ot_tipo = ot_retiro.tipo
                ot_id = ot_retiro.id
            else:
                folio_ot = ""
                oc = ""
                vendedor = ""
                ot_tipo = ""
                ot_id = None

            obra_nombre = ""
            if arr_last and arr_last.obra_id:
                obra_nombre = arr_last.obra.nombre

            filas.append(
                {
                    "id": maq.id,  # aquí es id de la maquinaria
                    "marca": maq.marca,
                    "modelo": maq.modelo or "",
                    "altura": getattr(maq, "altura", None),
                    "serie": maq.serie or "",
                    "cliente": "Franz Heim SPA",  # se puede parametrizar luego
                    "rut_cliente": "16.357.179-K",
                    "obra": obra_nombre,
                    "desde": None,
                    "hasta": None,
                    "documento": doc_label,
                    "doc_tipo": doc_tipo,
                    "doc_numero": doc_numero,
                    "doc_fecha": doc_fecha,
                    "factura": factura_label,
                    "factura_numero": factura_numero,
                    "factura_fecha": factura_fecha,
                    "ot_id": ot_id,
                    "ot_folio": folio_ot,
                    "orden_compra": oc,
                    "vendedor": vendedor,
                    "ot_tipo": ot_tipo,
                }
            )

        return Response(filas, status=200)


# =======================
#   Auth & Users
# =======================
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""
    email = (request.data.get("email") or "").strip() or None
    if not username or not password:
        return Response(
            {"detail": "Usuario y contraseña son requeridos."}, status=400
        )
    if User.objects.filter(username__iexact=username).exists():
        return Response({"detail": "El usuario ya existe."}, status=400)
    user = User.objects.create_user(
        username=username, password=password, email=email, is_staff=False
    )
    _get_or_create_sec(user)
    return Response(
        {"id": user.id, "username": user.username, "email": user.email},
        status=201,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    username = (request.data.get("username") or "").strip()
    password = (request.data.get("password") or "")
    if not username or not password:
        return Response(
            {"detail": "Usuario y contraseña son requeridos."}, status=400
        )

    user = User.objects.filter(username__iexact=username).first()
    if user:
        sec = _get_or_create_sec(user)
        if sec.is_locked:
            return Response(
                {"detail": 'Cuenta bloqueada. Use "Recuperar clave".'},
                status=403,
            )

    user = authenticate(username=username, password=password)
    if user is None:
        u = User.objects.filter(username__iexact=username).first()
        if u:
            sec = _get_or_create_sec(u)
            sec.failed_attempts += 1
            if sec.failed_attempts >= MAX_FAILED:
                sec.is_locked = True
                sec.locked_at = timezone.now()
            sec.save(
                update_fields=[
                    "failed_attempts",
                    "is_locked",
                    "locked_at",
                ]
            )
        return Response({"detail": "Credenciales inválidas."}, status=400)

    sec = _get_or_create_sec(user)
    if sec.is_locked:
        return Response(
            {"detail": 'Cuenta bloqueada. Use "Recuperar clave".'},
            status=403,
        )

    if sec.failed_attempts:
        sec.failed_attempts = 0
        sec.save(update_fields=["failed_attempts"])

    refresh = RefreshToken.for_user(user)
    data = {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": user.id,
            "username": user.username,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
        },
    }
    return Response(data, status=200)


@api_view(["POST"])
@permission_classes([AllowAny])
def recover_start(request):
    """
    Placeholder: inicia proceso de recuperación (email o username).
    """
    email = (request.data.get("email") or "").strip()
    username = (request.data.get("username") or "").strip()

    if not email and not username:
        return Response({"detail": "Falta correo electrónico."}, status=400)

    return Response(
        {"detail": "Si el correo existe, se enviarán instrucciones."}, status=200
    )


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.order_by("id")
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]

