"""Read-only validation for the proposed internal multi-machine ALTA contract."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import DecimalValidator
from django.db import connection
from rest_framework.exceptions import ValidationError

from api.models import Arriendo, Cliente, Maquinaria, Obra


@dataclass(frozen=True)
class MultiMachineAltaConditions:
    fecha_inicio: date
    fecha_termino: date
    periodo: str
    tarifa: Decimal


@dataclass(frozen=True)
class ValidatedMultiMachineAlta:
    """Internal result, with resolved model instances and machines ordered by PK."""

    cliente: Cliente
    obra: Obra
    condiciones_comunes: MultiMachineAltaConditions
    maquinarias: tuple[Maquinaria, ...]


def _raise_errors(path, details):
    for field in reversed(path):
        details = {field: details}
    raise ValidationError(details)


def _reject(path, message):
    _raise_errors(path, [message])


def _validate_object(value, required_fields, path=()):
    if not isinstance(value, dict):
        _reject(path or ("non_field_errors",), "Debe ser un objeto JSON.")
    if any(not isinstance(key, str) for key in value):
        _reject(path or ("non_field_errors",), "Las claves deben ser cadenas JSON.")
    errors = {
        field: ["Este campo es obligatorio."]
        for field in sorted(required_fields - value.keys())
    }
    errors.update({
        field: ["Este campo no está admitido."]
        for field in sorted(value.keys() - required_fields)
    })
    if errors:
        _raise_errors(path, errors)


def _validate_pk(value, model, path):
    minimum, maximum = connection.ops.integer_field_range(
        model._meta.pk.get_internal_type()
    )
    if type(value) is not int or not max(1, minimum) <= value <= maximum:
        _reject(path, "Debe ser una PK entera JSON positiva dentro del rango admitido.")
    return value


def _validate_date(value, path):
    if not isinstance(value, str) or re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value) is None:
        _reject(path, "Debe ser una fecha ISO YYYY-MM-DD.")
    try:
        return date.fromisoformat(value)
    except ValueError:
        _reject(path, "La fecha indicada no existe.")


def _validate_tarifa(value, path):
    if not isinstance(value, str) or re.fullmatch(r"[0-9]+\.[0-9]{2}", value) is None:
        _reject(path, "Debe ser una cadena decimal no negativa con exactamente dos decimales.")
    amount = Decimal(value)
    field = Arriendo._meta.get_field("tarifa")
    try:
        DecimalValidator(field.max_digits, field.decimal_places)(amount)
    except DjangoValidationError:
        _reject(path, "La tarifa excede la precisión o el rango admitido por Arriendo.tarifa.")
    return amount


def validate_multi_machine_alta_payload(payload: object) -> ValidatedMultiMachineAlta:
    """Validate without writes or input mutation; resolve existing references.

    Returns frozen dataclasses with Cliente/Obra instances, date/Decimal common
    conditions and a tuple of Maquinaria instances in ascending PK order. This
    is not an HTTP response or a write command. Existence is only a read-time
    check: a future writer must revalidate references inside its transaction.
    """
    _validate_object(payload, {"cliente_id", "obra_id", "condiciones_comunes", "lineas"})
    customer_id = _validate_pk(payload["cliente_id"], Cliente, ("cliente_id",))
    work_id = _validate_pk(payload["obra_id"], Obra, ("obra_id",))

    conditions = payload["condiciones_comunes"]
    conditions_path = ("condiciones_comunes",)
    _validate_object(
        conditions, {"fecha_inicio", "fecha_termino", "periodo", "tarifa"}, conditions_path
    )
    start = _validate_date(conditions["fecha_inicio"], conditions_path + ("fecha_inicio",))
    end = _validate_date(conditions["fecha_termino"], conditions_path + ("fecha_termino",))
    if end < start:
        _reject(conditions_path + ("fecha_termino",), "No puede ser anterior a fecha_inicio.")
    period = conditions["periodo"]
    if not isinstance(period, str) or period not in {"Dia", "Semana", "Mes"}:
        _reject(conditions_path + ("periodo",), "Debe ser Dia, Semana o Mes.")
    rate = _validate_tarifa(conditions["tarifa"], conditions_path + ("tarifa",))

    lines = payload["lineas"]
    if not isinstance(lines, list) or not lines:
        _reject(("lineas",), "Debe ser una lista no vacía de objetos JSON.")
    machine_ids = []
    seen = set()
    for index, line in enumerate(lines):
        path = ("lineas", str(index))
        _validate_object(line, {"maquinaria_id"}, path)
        machine_id = _validate_pk(line["maquinaria_id"], Maquinaria, path + ("maquinaria_id",))
        if machine_id in seen:
            _reject(path + ("maquinaria_id",), "No se permiten PK de maquinaria repetidas.")
        seen.add(machine_id)
        machine_ids.append(machine_id)

    # All input structure, types and ranges are checked before issuing queries.
    try:
        customer = Cliente.objects.get(pk=customer_id)
    except Cliente.DoesNotExist:
        _reject(("cliente_id",), "El cliente indicado no existe.")
    try:
        work = Obra.objects.get(pk=work_id)
    except Obra.DoesNotExist:
        _reject(("obra_id",), "La obra indicada no existe.")
    machines = tuple(Maquinaria.objects.filter(pk__in=machine_ids).order_by("pk"))
    existing_ids = {machine.pk for machine in machines}
    for index, machine_id in enumerate(machine_ids):
        if machine_id not in existing_ids:
            _reject(("lineas", str(index), "maquinaria_id"), "La maquinaria indicada no existe.")

    return ValidatedMultiMachineAlta(
        cliente=customer,
        obra=work,
        condiciones_comunes=MultiMachineAltaConditions(start, end, period, rate),
        maquinarias=machines,
    )
