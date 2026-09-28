from django.db import transaction
from rest_framework.exceptions import ValidationError

from api.models import Arriendo, ArriendoItem, Maquinaria, OrdenTrabajo


def validate_singular_machine_selection(machine_ids, lineas):
    """Validate the explicit, singular PK contract used by the shadow write path."""
    if not isinstance(machine_ids, list) or not machine_ids:
        raise ValidationError(
            {"maquinaria_ids": ["Debes indicar exactamente una maquinaria por PK."]}
        )
    if any(type(machine_id) is not int for machine_id in machine_ids):
        raise ValidationError(
            {"maquinaria_ids": ["Cada PK debe ser un entero JSON."]}
        )
    if len(set(machine_ids)) != len(machine_ids):
        raise ValidationError(
            {"maquinaria_ids": ["No se permiten PK repetidas."]}
        )
    if len(machine_ids) != 1:
        raise ValidationError(
            {"maquinaria_ids": ["Esta ruta admite exactamente una maquinaria."]}
        )

    try:
        machine = Maquinaria.objects.get(pk=machine_ids[0])
    except Maquinaria.DoesNotExist:
        raise ValidationError(
            {"maquinaria_ids": ["La maquinaria indicada no existe."]}
        )

    if not isinstance(lineas, list) or len(lineas) != 1:
        raise ValidationError(
            {"lineas": ["La selección singular requiere exactamente una línea."]}
        )
    line = lineas[0]
    if not isinstance(line, dict):
        raise ValidationError({"lineas": ["La línea debe ser un objeto JSON."]})
    line_series = (line.get("serie") or "").strip()
    machine_series = (machine.serie or "").strip()
    if (
        not line_series
        or not machine_series
        or line_series.casefold() != machine_series.casefold()
    ):
        raise ValidationError(
            {
                "lineas": [
                    "La serie de la línea debe corresponder a la PK seleccionada."
                ]
            }
        )
    return machine


@transaction.atomic
def create_singular_rental_with_item_and_order(*, machine, rental_data, order_data):
    """Atomically create the compatible singular rental projection and its ALTA OT."""
    rental = Arriendo.objects.create(maquinaria=machine, **rental_data)
    ArriendoItem.objects.create(arriendo=rental, maquinaria=machine)
    order = OrdenTrabajo.objects.create(
        arriendo=rental,
        maquinaria=machine,
        tipo="ALTA",
        **order_data,
    )
    return rental, order
