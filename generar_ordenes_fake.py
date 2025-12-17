"""
Script para poblar la base con Órdenes de Trabajo falsas
(arriendos, traslados facturables / no facturables, ventas).

Uso (desde la carpeta raíz del proyecto):

    py generar_ordenes_fake.py

El script:
- Detecta el entorno virtual (backend/.venv, .venv, backend/venv, venv).
- Si no se está ejecutando con ese python, se relanza a sí mismo con el python del venv.
- Ofrece un menú interactivo para:
    1) Borrar TODAS las OT / Documentos / Arriendos.
    2) Crear OT de ARRIENDO (ALTA) sin documentos.
    3) Crear OT de TRASLADO facturable (GD + facturación pendiente).
    4) Crear OT de TRASLADO NO facturable (guía no facturable).
    5) Crear OT de VENTA facturable (pendiente de factura).

Todas las OT creadas rellenan el campo fecha_emision_doc para probar
el comportamiento de “fecha de emisión del documento” en el flujo real.
"""

import os
import sys
import random
from pathlib import Path
from datetime import date, timedelta
from decimal import Decimal
import subprocess

# =========================
#  Bootstrap: usar el .venv
# =========================

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"

CANDIDATE_VENVS = [
    BACKEND_DIR / ".venv",
    ROOT / ".venv",
    BACKEND_DIR / "venv",
    ROOT / "venv",
]


def find_venv_python():
    for v in CANDIDATE_VENVS:
        py_win = v / "Scripts" / "python.exe"
        py_unix = v / "bin" / "python"
        if py_win.exists():
            return py_win
        if py_unix.exists():
            return py_unix
    return None


# Solo hacemos el salto al venv una vez
if os.environ.get("FAKE_OT_VENV_READY") != "1":
    venv_py = find_venv_python()
    if venv_py is not None:
        curr = Path(sys.executable).resolve()
        if curr != venv_py.resolve():
            os.environ["FAKE_OT_VENV_READY"] = "1"
            cmd = [str(venv_py), str(Path(__file__).resolve()), *sys.argv[1:]]
            subprocess.run(cmd, check=False)
            sys.exit(0)
    # Si no hay venv, seguimos con el intérprete actual.


# =========================
#  Configuración de Django
# =========================

if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "estado_maquinas.settings")

try:
    import django  # type: ignore

    django.setup()
except Exception as e:
    print("❌ Error al configurar Django. Revisa DJANGO_SETTINGS_MODULE, sys.path y el venv.")
    print(e)
    sys.exit(1)

# Ahora ya podemos importar los modelos
from django.db import transaction  # type: ignore

from api.models import (  # type: ignore
    Cliente,
    Maquinaria,
    Obra,
    Arriendo,
    Documento,
    OrdenTrabajo,
)

# =========================
#  Utilidades de consola
# =========================


def ask_int(prompt: str, default: int = 0) -> int:
    """
    Pide un entero por consola. Enter = default.
    Si el valor es inválido, devuelve default.
    """
    txt = input(prompt).strip()
    if not txt:
        return default
    try:
        n = int(txt)
        if n < 0:
            return default
        return n
    except ValueError:
        print("⚠ Valor inválido, se usará", default)
        return default


def ask_yes_no(prompt: str, default: bool = False) -> bool:
    """
    Pregunta Sí/No por consola.
    default=True  -> Enter = 's'
    default=False -> Enter = 'n'
    """
    suf = "[S/n]" if default else "[s/N]"
    while True:
        txt = input(f"{prompt} {suf} ").strip().lower()
        if not txt:
            return default
        if txt in ("s", "si", "sí", "y", "yes"):
            return True
        if txt in ("n", "no"):
            return False
        print("Responde con 's' o 'n'.")


# =========================
#  Helpers de modelo
# =========================

PERIODOS = ["Dia", "Semana", "Mes"]


def ensure_base_data():
    if not Cliente.objects.exists():
        print("❌ No hay clientes en la base. Crea primero clientes (script de datos fake).")
        sys.exit(1)
    if not Maquinaria.objects.exists():
        print("❌ No hay maquinarias en la base. Crea primero maquinarias (script de datos fake).")
        sys.exit(1)


def resumen_counts():
    print()
    print("=== Estado actual ===")
    print(f"Clientes:     {Cliente.objects.count()}")
    print(f"Maquinarias:  {Maquinaria.objects.count()}")
    print(f"Obras:        {Obra.objects.count()}")
    print(f"Arriendos:    {Arriendo.objects.count()}")
    print(f"Documentos:   {Documento.objects.count()}")
    print(f"Órdenes OT:   {OrdenTrabajo.objects.count()}")
    print("=====================\n")


def random_cliente():
    ids = list(Cliente.objects.values_list("id", flat=True))
    if not ids:
        raise RuntimeError("No hay clientes.")
    return Cliente.objects.get(id=random.choice(ids))


def random_maquinaria():
    qs = Maquinaria.objects.all()
    ids = list(qs.values_list("id", flat=True))
    if not ids:
        raise RuntimeError("No hay maquinarias.")
    return qs.get(id=random.choice(ids))


def random_obra():
    qs = Obra.objects.all()
    if qs.exists():
        ids = list(qs.values_list("id", flat=True))
        return qs.get(id=random.choice(ids))
    # Si no hay obras, creamos un set básico
    return Obra.objects.create(
        nombre="Obra falsa 1",
        direccion="Calle Falsa 123, Santiago",
        contacto_nombre="Contacto Falso",
        contacto_telefono="9" + "".join(str(random.randint(0, 9)) for _ in range(8)),
        contacto_email="contacto@obra-falsa.cl",
    )


def random_periodo() -> str:
    return random.choice(PERIODOS)


def build_fechas(periodo: str):
    """
    Devuelve (fecha_inicio, fecha_termino) usando hoy
    y un rango razonable según periodo.
    """
    hoy = date.today()
    if periodo == "Dia":
        dias = random.randint(3, 10)
    elif periodo == "Semana":
        semanas = random.randint(1, 4)
        dias = semanas * 7
    else:  # Mes
        meses = random.randint(1, 3)
        dias = meses * 30

    inicio = hoy
    termino = hoy + timedelta(days=dias - 1)
    return inicio, termino


def build_tarifa(periodo: str) -> Decimal:
    """
    Genera una tarifa neta aproximada según el periodo.
    """
    if periodo == "Dia":
        base = random.randint(40000, 120000)
    elif periodo == "Semana":
        base = random.randint(200000, 600000)
    else:  # Mes
        base = random.randint(500000, 1500000)
    return Decimal(str(base))


def build_flete(traslado: bool = False) -> Decimal:
    """
    Genera un valor de flete neto.
    """
    if traslado:
        return Decimal(str(random.randint(30000, 90000)))
    else:
        return Decimal(str(random.randint(50000, 150000)))


def next_doc_number(tipo: str) -> str:
    """
    Entrega correlativo simple por tipo de documento.
    Si los números no son puros, cae al id.
    """
    last = Documento.objects.filter(tipo=tipo).order_by("-id").first()
    if not last:
        base = 1
    else:
        try:
            base = int(last.numero) + 1
        except Exception:
            base = last.id + 1
    return str(base).zfill(4)  # 0001, 0002, ...


# =========================
#  Creadores concretos
# =========================


@transaction.atomic
def borrar_todo():
    print("⚠ Esto eliminará TODAS las Órdenes de Trabajo, Documentos y Arriendos.")
    if not ask_yes_no("¿Estás seguro de borrar todo?", default=False):
        print("Operación cancelada.\n")
        return

    OrdenTrabajo.objects.all().delete()
    Documento.objects.all().delete()
    Arriendo.objects.all().delete()

    print("✅ Se eliminaron todas las OT, documentos y arriendos.\n")
    resumen_counts()


@transaction.atomic
def crear_ot_arriendo_sin_doc(cantidad: int):
    """
    Crea OT de tipo ALTA (Arriendo), sin documentos asociados todavía.
    - Aparecerán en pestaña "Sin documento emitido".
    - fecha_emision_doc se toma = fecha_inicio del arriendo.
    """
    if cantidad <= 0:
        return

    print(f"\nCreando {cantidad} OT de ARRRIENDO (ALTA) sin documento...\n")
    for i in range(1, cantidad + 1):
        cli = random_cliente()
        maq = random_maquinaria()
        obra = random_obra()
        periodo = random_periodo()
        fecha_inicio, fecha_termino = build_fechas(periodo)
        tarifa = build_tarifa(periodo)
        flete = build_flete(traslado=False)

        # Fecha de emisión "planificada" del documento
        fecha_doc = fecha_inicio

        # Arriendo base
        arr = Arriendo.objects.create(
            maquinaria=maq,
            cliente=cli,
            obra=obra,
            fecha_inicio=fecha_inicio,
            fecha_termino=fecha_termino,
            periodo=periodo,
            tarifa=tarifa,
            estado="Activo",
        )

        lineas = [
            {
                "serie": maq.serie or "",
                "unidad": periodo,  # Dia / Semana / Mes
                "cantidadPeriodo": 1,
                "desde": fecha_inicio.isoformat(),
                "hasta": fecha_termino.isoformat(),
                "valor": float(tarifa),  # arriendo neto
                "flete": float(flete),
                "tipoFlete": "entrega_retiro",
            }
        ]

        monto_neto = tarifa + flete
        monto_iva = (monto_neto * Decimal("0.19")).quantize(Decimal("1."))
        monto_total = monto_neto + monto_iva

        ot = OrdenTrabajo.objects.create(
            arriendo=arr,
            cliente=cli,
            maquinaria=maq,
            tipo="ALTA",
            tipo_comercial="A",  # Arriendo
            estado="PEND",  # Pendiente
            es_facturable=False,  # Se define luego al emitir guía
            direccion=obra.direccion or "",
            obra_nombre=obra.nombre,
            contactos=obra.contacto_nombre or "",
            detalle_lineas=lineas,
            monto_neto=monto_neto,
            monto_iva=monto_iva,
            monto_total=monto_total,
            observaciones="[FAKE] OT Arriendo sin documento",
            # Nuevo campo: fecha que se usará al emitir GD/FACT
            fecha_emision_doc=fecha_doc,
        )
        print(f"  ✔ OT Arriendo creada: OT #{ot.id} – Cliente {cli.razon_social}")

    print("\n✅ Listo: se crearon OT de arriendo sin documento.\n")
    resumen_counts()


@transaction.atomic
def crear_ot_traslado_facturable(cantidad: int):
    """
    Crea OT de tipo TRAS (Traslado) con guía facturable:
    - Crea un Arriendo base.
    - Crea guía de despacho (GD) asociada (no retiro, es facturable).
    - Marca la OT como es_facturable=True y con guía asociada.
    - Deben aparecer en pestaña "Con facturación pendiente".
    - fecha_emision_doc = fecha_emision de la GD.
    """
    if cantidad <= 0:
        return

    print(f"\nCreando {cantidad} OT de TRASLADO FACTURABLE...\n")
    for i in range(1, cantidad + 1):
        cli = random_cliente()
        maq = random_maquinaria()
        obra = random_obra()
        periodo = random_periodo()
        fecha_inicio, fecha_termino = build_fechas(periodo)
        tarifa = build_tarifa(periodo)
        flete = build_flete(traslado=True)

        # Usamos la fecha de inicio como fecha de emisión del movimiento
        fecha_doc = fecha_inicio

        arr = Arriendo.objects.create(
            maquinaria=maq,
            cliente=cli,
            obra=obra,
            fecha_inicio=fecha_inicio,
            fecha_termino=fecha_termino,
            periodo=periodo,
            tarifa=tarifa,
            estado="Activo",
        )

        lineas = [
            {
                "serie": maq.serie or "",
                "unidad": periodo,
                "cantidadPeriodo": 1,
                "desde": fecha_inicio.isoformat(),
                "hasta": fecha_termino.isoformat(),
                "valor": 0.0,  # arriendo ya pactado; aquí solo flete
                "flete": float(flete),
                "tipoFlete": "solo_traslado",
            }
        ]

        monto_neto = flete
        monto_iva = (monto_neto * Decimal("0.19")).quantize(Decimal("1."))
        monto_total = monto_neto + monto_iva

        # Guía facturable (despacho / traslado facturable)
        num_gd = next_doc_number("GD")
        gd = Documento.objects.create(
            tipo="GD",
            numero=num_gd,
            fecha_emision=fecha_doc,
            monto_neto=monto_neto,
            monto_iva=monto_iva,
            monto_total=monto_total,
            arriendo=arr,
            cliente=cli,
            es_retiro=False,  # facturable
            obra_origen=None,
            obra_destino=obra,
        )

        ot = OrdenTrabajo.objects.create(
            arriendo=arr,
            cliente=cli,
            maquinaria=maq,
            tipo="TRAS",
            tipo_comercial="T",  # Traslado
            estado="PEND",
            es_facturable=True,  # Tiene movimiento facturable
            guia=gd,  # Guía ya emitida
            direccion=obra.direccion or "",
            obra_nombre=obra.nombre,
            contactos=obra.contacto_nombre or "",
            detalle_lineas=lineas,
            monto_neto=monto_neto,
            monto_iva=monto_iva,
            monto_total=monto_total,
            observaciones="[FAKE] Traslado facturable con guía",
            fecha_emision_doc=fecha_doc,
        )

        print(
            f"  ✔ OT Traslado facturable: OT #{ot.id} – Cliente {cli.razon_social} – GD {gd.numero}"
        )

    print("\n✅ Listo: se crearon OT de traslado facturable.\n")
    resumen_counts()


@transaction.atomic
def crear_ot_traslado_no_facturable(cantidad: int):
    """
    Crea OT de tipo TRAS (Traslado) NO facturable:
    - Crea Arriendo.
    - Crea guía GD con es_retiro=True y montos 0 (solo movimiento/logística).
    - OT queda es_facturable=False.
    - fecha_emision_doc = fecha_emision de la GD.
    """
    if cantidad <= 0:
        return

    print(f"\nCreando {cantidad} OT de TRASLADO NO FACTURABLE (guía no facturable)...\n")
    for i in range(1, cantidad + 1):
        cli = random_cliente()
        maq = random_maquinaria()
        obra = random_obra()
        periodo = random_periodo()
        fecha_inicio, fecha_termino = build_fechas(periodo)
        tarifa = build_tarifa(periodo)

        # Fecha de emisión del movimiento
        fecha_doc = fecha_inicio

        arr = Arriendo.objects.create(
            maquinaria=maq,
            cliente=cli,
            obra=obra,
            fecha_inicio=fecha_inicio,
            fecha_termino=fecha_termino,
            periodo=periodo,
            tarifa=tarifa,
            estado="Activo",
        )

        lineas = [
            {
                "serie": maq.serie or "",
                "unidad": periodo,
                "cantidadPeriodo": 1,
                "desde": fecha_inicio.isoformat(),
                "hasta": fecha_termino.isoformat(),
                "valor": 0.0,  # retiro sin cargo
                "flete": 0.0,
                "tipoFlete": "solo_traslado",
            }
        ]

        # Guía no facturable: montos en 0
        num_gd = next_doc_number("GD")
        gd = Documento.objects.create(
            tipo="GD",
            numero=num_gd,
            fecha_emision=fecha_doc,
            monto_neto=Decimal("0"),
            monto_iva=Decimal("0"),
            monto_total=Decimal("0"),
            arriendo=arr,
            cliente=cli,
            es_retiro=True,  # no facturable
            obra_origen=obra,
            obra_destino=None,
        )

        ot = OrdenTrabajo.objects.create(
            arriendo=arr,
            cliente=cli,
            maquinaria=maq,
            tipo="TRAS",
            tipo_comercial="T",
            estado="PEND",
            es_facturable=False,
            guia=gd,
            direccion=obra.direccion or "",
            obra_nombre=obra.nombre,
            contactos=obra.contacto_nombre or "",
            detalle_lineas=lineas,
            monto_neto=Decimal("0"),
            monto_iva=Decimal("0"),
            monto_total=Decimal("0"),
            observaciones="[FAKE] Traslado NO facturable (guía sin cobro)",
            fecha_emision_doc=fecha_doc,
        )

        print(
            f"  ✔ OT Traslado NO facturable: OT #{ot.id} – Cliente {cli.razon_social} – GD {gd.numero}"
        )

    print("\n✅ Listo: se crearon OT de traslado NO facturable.\n")
    resumen_counts()


@transaction.atomic
def crear_ot_venta(cantidad: int):
    """
    Crea OT de tipo SERV (Venta) FACTURABLE pero aún sin factura emitida.
    - No crea Documento (FACT); la factura nacerá cuando uses el botón "Emitir".
    - La OT queda en estado PEND y es_facturable=True para que salga en
      la pestaña "Con facturación pendiente".
    - fecha_emision_doc = hoy (fecha planificada de la factura/guía).
    """
    if cantidad <= 0:
        return

    print(f"\nCreando {cantidad} OT de VENTA facturable (pendiente de factura)...\n")
    for i in range(1, cantidad + 1):
        cli = random_cliente()
        maq = random_maquinaria()
        obra = random_obra()

        # Precio de venta neto aproximado
        precio_neto = Decimal(str(random.randint(800000, 8000000)))
        iva = (precio_neto * Decimal("0.19")).quantize(Decimal("1."))
        total = precio_neto + iva

        # Fecha planificada de emisión de la factura
        fecha_doc = date.today()

        lineas = [
            {
                "serie": maq.serie or "",
                "unidad": "Especial",
                "cantidadPeriodo": 1,
                "desde": fecha_doc.isoformat(),
                "hasta": fecha_doc.isoformat(),
                "valor": float(precio_neto),  # valor neto venta
                "flete": 0.0,
                "tipoFlete": "entrega_retiro",
            }
        ]

        ot = OrdenTrabajo.objects.create(
            arriendo=None,  # venta directa, sin arriendo asociado (se creará "fantasma" al facturar)
            cliente=cli,
            maquinaria=maq,
            tipo="SERV",  # servicio / venta
            tipo_comercial="V",  # V = Venta
            estado="PEND",  # pendiente
            es_facturable=True,  # tiene que aparecer como facturable
            factura=None,
            guia=None,
            direccion=obra.direccion or "",
            obra_nombre=obra.nombre,
            contactos=obra.contacto_nombre or "",
            detalle_lineas=lineas,
            monto_neto=precio_neto,
            monto_iva=iva,
            monto_total=total,
            observaciones="[FAKE] Venta facturable pendiente de factura",
            fecha_emision_doc=fecha_doc,
        )

        print(
            f"  ✔ OT Venta facturable creada: OT #{ot.id} – Cliente {cli.razon_social} – Máquina {maq.serie}"
        )

    print("\n✅ Listo: se crearon OT de venta facturables (pendientes).\n")
    resumen_counts()


# =========================
#  MAIN
# =========================


def main():
    print("=== Generador de Órdenes de Trabajo FAKE (App web máquinas) ===\n")
    ensure_base_data()
    resumen_counts()

    while True:
        print("Menú:")
        print("  1) BORRAR todas las OT / Documentos / Arriendos")
        print("  2) Crear OT de ARRIENDO (ALTA) sin documento")
        print("  3) Crear OT de TRASLADO FACTURABLE (GD, facturación pendiente)")
        print("  4) Crear OT de TRASLADO NO facturable (guía sin cobro)")
        print("  5) Crear OT de VENTA facturable (pendiente de factura)")
        print("  0) Salir")
        op = input("\nElige opción: ").strip()

        if op == "0":
            print("Saliendo.")
            break
        elif op == "1":
            borrar_todo()
        elif op == "2":
            n = ask_int("¿Cuántas OT de ARRIENDO deseas crear? [0]: ", 0)
            crear_ot_arriendo_sin_doc(n)
        elif op == "3":
            n = ask_int("¿Cuántas OT de TRASLADO FACTURABLE deseas crear? [0]: ", 0)
            crear_ot_traslado_facturable(n)
        elif op == "4":
            n = ask_int("¿Cuántas OT de TRASLADO NO facturable deseas crear? [0]: ", 0)
            crear_ot_traslado_no_facturable(n)
        elif op == "5":
            n = ask_int("¿Cuántas OT de VENTA facturable deseas crear? [0]: ", 0)
            crear_ot_venta(n)
        else:
            print("Opción no válida.\n")


if __name__ == "__main__":
    main()



