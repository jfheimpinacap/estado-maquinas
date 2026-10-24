from copy import deepcopy
from datetime import date
from decimal import Decimal, localcontext
from unittest.mock import patch

from django.db import DatabaseError, connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.exceptions import ValidationError

from api.models import Arriendo, ArriendoItem, Cliente, Documento, Maquinaria, Obra, OrdenTrabajo
from api.services.multi_machine_alta import (
    MultiMachineAltaConditions,
    ValidatedMultiMachineAlta,
    validate_multi_machine_alta_payload,
)


class MultiMachineAltaValidationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.customer = Cliente.objects.create(razon_social="Cliente P030", rut="30-0")
        cls.work = Obra.objects.create(nombre="Obra P030", direccion="Dirección original")
        cls.first = Maquinaria.objects.create(marca="Primera", serie="P030-1")
        cls.second = Maquinaria.objects.create(marca="Segunda", serie="P030-2", estado="Para venta")
        cls.no_series = Maquinaria.objects.create(marca="Sin serie", serie=None)
        cls.rental = Arriendo.objects.create(
            maquinaria=cls.first, cliente=cls.customer, obra=cls.work,
            fecha_inicio="2026-10-01", periodo="Dia", tarifa="2000.00", estado="Activo",
        )
        ArriendoItem.objects.create(arriendo=cls.rental, maquinaria=cls.first)
        OrdenTrabajo.objects.create(
            arriendo=cls.rental, maquinaria=cls.first, cliente=cls.customer,
            tipo="ALTA", detalle_lineas=[{"serie": cls.first.serie}],
        )
        Documento.objects.create(
            arriendo=cls.rental, tipo="GD", numero="P030", fecha_emision="2026-10-01",
        )

    def payload(self, machine_ids=None):
        return {
            "cliente_id": self.customer.pk,
            "obra_id": self.work.pk,
            "condiciones_comunes": {
                "fecha_inicio": "2026-11-02", "fecha_termino": "2026-11-02",
                "periodo": "Dia", "tarifa": "1000.00",
            },
            "lineas": [{"maquinaria_id": pk} for pk in (
                [self.second.pk, self.first.pk] if machine_ids is None else machine_ids
            )],
        }

    def snapshot(self):
        return {
            model.__name__: list(model.objects.order_by("pk").values())
            for model in (Cliente, Obra, Maquinaria, Arriendo, ArriendoItem, OrdenTrabajo, Documento)
        }

    def assert_invalid(self, payload, path, *, before_queries=True):
        original = deepcopy(payload)
        persisted = self.snapshot()
        with CaptureQueriesContext(connection) as queries:
            with self.assertRaises(ValidationError) as error:
                validate_multi_machine_alta_payload(payload)
        detail = error.exception.detail
        for field in path:
            self.assertIn(field, detail)
            detail = detail[field]
        self.assertEqual(payload, original)
        self.assertEqual(self.snapshot(), persisted)
        self.assertTrue(all(q["sql"].lstrip().upper().startswith("SELECT") for q in queries))
        if before_queries:
            self.assertEqual(len(queries), 0)

    def test_valid_single_machine_returns_explicit_normalized_result(self):
        result = validate_multi_machine_alta_payload(self.payload([self.first.pk]))
        self.assertIsInstance(result, ValidatedMultiMachineAlta)
        self.assertEqual(result.cliente, self.customer)
        self.assertEqual(result.obra, self.work)
        self.assertEqual(result.maquinarias, (self.first,))
        self.assertIsInstance(result.condiciones_comunes, MultiMachineAltaConditions)
        conditions = result.condiciones_comunes
        self.assertIs(type(conditions.fecha_inicio), date)
        self.assertIs(type(conditions.fecha_termino), date)
        self.assertIs(type(conditions.tarifa), Decimal)
        self.assertEqual(conditions.fecha_inicio, date(2026, 11, 2))
        self.assertEqual(conditions.fecha_termino, date(2026, 11, 2))
        self.assertEqual(conditions.periodo, "Dia")
        self.assertEqual(conditions.tarifa.as_tuple(), Decimal("1000.00").as_tuple())

    def test_multiple_machines_and_reversed_input_have_the_same_pk_order(self):
        forward = self.payload([self.first.pk, self.second.pk, self.no_series.pk])
        reverse = self.payload([self.no_series.pk, self.second.pk, self.first.pk])
        self.assertEqual(validate_multi_machine_alta_payload(forward),
                         validate_multi_machine_alta_payload(reverse))
        result = validate_multi_machine_alta_payload(reverse)
        self.assertEqual(tuple(machine.pk for machine in result.maquinarias),
                         (self.first.pk, self.second.pk, self.no_series.pk))

    def test_success_does_not_mutate_input_or_persisted_data(self):
        payload = self.payload()
        original = deepcopy(payload)
        persisted = self.snapshot()
        with CaptureQueriesContext(connection) as queries:
            validate_multi_machine_alta_payload(payload)
        self.assertEqual(payload, original)
        self.assertEqual(self.snapshot(), persisted)
        self.assertTrue(all(q["sql"].lstrip().upper().startswith("SELECT") for q in queries))

    def test_machine_without_series_is_accepted(self):
        result = validate_multi_machine_alta_payload(self.payload([self.no_series.pk]))
        self.assertEqual(result.maquinarias, (self.no_series,))
        self.assertIsNone(result.maquinarias[0].serie)

    def test_validation_does_not_check_state_availability_or_client_work_ownership(self):
        # first already has an active rental; second is for sale. Obra has no client FK.
        result = validate_multi_machine_alta_payload(self.payload())
        self.assertEqual(result.maquinarias, (self.first, self.second))
        self.assertEqual(result.obra, self.work)

    def test_required_fields_at_all_levels(self):
        base = self.payload()
        for key in base:
            with self.subTest(level="root", key=key):
                payload = deepcopy(base)
                del payload[key]
                self.assert_invalid(payload, (key,))
        for key in base["condiciones_comunes"]:
            with self.subTest(level="conditions", key=key):
                payload = deepcopy(base)
                del payload["condiciones_comunes"][key]
                self.assert_invalid(payload, ("condiciones_comunes", key))
        payload = self.payload()
        del payload["lineas"][0]["maquinaria_id"]
        self.assert_invalid(payload, ("lineas", "0", "maquinaria_id"))

    def test_unknown_fields_at_all_levels(self):
        cases = (
            ((), "extra"), (("condiciones_comunes",), "flete"),
            (("lineas", 0), "valor"),
        )
        for parent, extra in cases:
            with self.subTest(parent=parent):
                payload = self.payload()
                obj = payload
                for field in parent:
                    obj = obj[field]
                obj[extra] = "not admitted"
                self.assert_invalid(payload, tuple(str(field) for field in parent) + (extra,))

    def test_root_and_conditions_must_be_objects(self):
        for value in (None, False, 1, 1.0, "object", [], [self.payload()]):
            with self.subTest(value=value):
                self.assert_invalid(value, ("non_field_errors",))
                payload = self.payload()
                payload["condiciones_comunes"] = value
                self.assert_invalid(payload, ("condiciones_comunes",))

    def test_lines_must_be_a_nonempty_list_of_objects(self):
        for value in (None, False, 1, 1.0, "lines", {}, []):
            with self.subTest(container=value):
                payload = self.payload()
                payload["lineas"] = value
                self.assert_invalid(payload, ("lineas",))
        for value in (None, False, 1, 1.0, "line", []):
            with self.subTest(line=value):
                payload = self.payload()
                payload["lineas"] = [value]
                self.assert_invalid(payload, ("lineas", "0"))

    def test_redundant_selectors_and_client_supplied_snapshots_are_rejected(self):
        root_fields = {
            "maquinaria_ids": [self.first.pk], "crear_arriendo_item": True, "tipo": "ALTA",
            "arriendo": self.rental.pk, "arriendo_id": self.rental.pk,
            "maquinaria": self.first.pk, "serie": self.first.serie, "series": [self.first.serie],
            "arriendo_item_id": 1, "detalle_lineas": [],
        }
        for key, value in root_fields.items():
            with self.subTest(field=key):
                payload = self.payload()
                payload[key] = value
                self.assert_invalid(payload, (key,))
        for value in (None, [], False):
            payload = self.payload()
            payload["maquinaria_ids"] = value
            self.assert_invalid(payload, ("maquinaria_ids",))
        for key, value in {"serie": self.first.serie, "arriendo_item_id": 1,
                           "serie_snapshot": self.first.serie, "detalle_lineas": []}.items():
            payload = self.payload()
            payload["lineas"][0][key] = value
            self.assert_invalid(payload, ("lineas", "0", key))

    def test_pk_types_and_nonpositive_values_are_rejected_for_every_reference(self):
        for path in (("cliente_id",), ("obra_id",), ("lineas", "0", "maquinaria_id")):
            for value in (True, False, 1.0, 1.5, "1", None, [], {}, 0, -1):
                with self.subTest(path=path, value=value):
                    payload = self.payload()
                    if path[0] == "lineas":
                        payload["lineas"][0]["maquinaria_id"] = value
                    else:
                        payload[path[0]] = value
                    self.assert_invalid(payload, path)

    def test_out_of_range_pks_fail_before_any_database_query(self):
        for model, path in ((Cliente, ("cliente_id",)), (Obra, ("obra_id",)),
                            (Maquinaria, ("lineas", "0", "maquinaria_id"))):
            low, high = connection.ops.integer_field_range(model._meta.pk.get_internal_type())
            for value in (low - 1, high + 1, 10 ** 100):
                with self.subTest(model=model.__name__, value=value):
                    payload = self.payload()
                    if path[0] == "lineas":
                        payload["lineas"][0]["maquinaria_id"] = value
                    else:
                        payload[path[0]] = value
                    self.assert_invalid(payload, path)

    def test_maximum_supported_pk_is_accepted_when_references_exist(self):
        customer = Cliente.objects.create(
            pk=connection.ops.integer_field_range(Cliente._meta.pk.get_internal_type())[1],
            razon_social="Cliente límite", rut="30-max",
        )
        work = Obra.objects.create(
            pk=connection.ops.integer_field_range(Obra._meta.pk.get_internal_type())[1],
            nombre="Obra límite",
        )
        machine = Maquinaria.objects.create(
            pk=connection.ops.integer_field_range(Maquinaria._meta.pk.get_internal_type())[1],
            marca="Máquina límite",
        )
        payload = self.payload([machine.pk])
        payload.update(cliente_id=customer.pk, obra_id=work.pk)
        result = validate_multi_machine_alta_payload(payload)
        self.assertEqual((result.cliente, result.obra, result.maquinarias),
                         (customer, work, (machine,)))

    def test_missing_references_produce_errors_on_the_corresponding_field(self):
        for path in (("cliente_id",), ("obra_id",), ("lineas", "1", "maquinaria_id")):
            with self.subTest(path=path):
                payload = self.payload()
                if path[0] == "lineas":
                    payload["lineas"][1]["maquinaria_id"] = 999999
                else:
                    payload[path[0]] = 999999
                self.assert_invalid(payload, path, before_queries=False)

    def test_duplicate_machine_ids_are_rejected_without_queries(self):
        self.assert_invalid(self.payload([self.first.pk, self.first.pk]),
                            ("lineas", "1", "maquinaria_id"))

    def test_a_later_malformed_line_prevents_reference_queries(self):
        payload = self.payload()
        payload["lineas"].append({"maquinaria_id": True})
        self.assert_invalid(payload, ("lineas", "2", "maquinaria_id"))

    def test_dates_require_strict_iso_strings_and_real_dates(self):
        invalid = (None, False, 20261102, 1.0, [], {}, date(2026, 11, 2),
                   "2026-1-02", "2026-11-2", "20261102", "02/11/2026", "2026-W45-1",
                   "2026-11-02T00:00:00", " 2026-11-02", "2026-11-02\n",
                   "2026-02-29", "2026-02-30", "2026-13-01", "0000-01-01", "２０２６-11-02")
        for field in ("fecha_inicio", "fecha_termino"):
            for value in invalid:
                with self.subTest(field=field, value=value):
                    payload = self.payload()
                    payload["condiciones_comunes"][field] = value
                    self.assert_invalid(payload, ("condiciones_comunes", field))

    def test_end_date_cannot_precede_start_date(self):
        payload = self.payload()
        payload["condiciones_comunes"]["fecha_termino"] = "2026-11-01"
        self.assert_invalid(payload, ("condiciones_comunes", "fecha_termino"))

    def test_valid_leap_date_and_date_boundaries(self):
        for text, expected in (("2028-02-29", date(2028, 2, 29)),
                               ("0001-01-01", date.min), ("9999-12-31", date.max)):
            payload = self.payload()
            payload["condiciones_comunes"].update(fecha_inicio=text, fecha_termino=text)
            result = validate_multi_machine_alta_payload(payload)
            self.assertEqual(result.condiciones_comunes.fecha_inicio, expected)
            self.assertEqual(result.condiciones_comunes.fecha_termino, expected)

    def test_period_requires_an_exact_supported_string(self):
        for value in (None, False, 1, 1.0, [], {}, "", "dia", "Día", "Dia ", "Semana\n", "Ano"):
            with self.subTest(value=value):
                payload = self.payload()
                payload["condiciones_comunes"]["periodo"] = value
                self.assert_invalid(payload, ("condiciones_comunes", "periodo"))
        for value in ("Dia", "Semana", "Mes"):
            payload = self.payload()
            payload["condiciones_comunes"]["periodo"] = value
            self.assertEqual(validate_multi_machine_alta_payload(payload).condiciones_comunes.periodo, value)

    def test_zero_maximum_tarifa_and_exact_precision_are_preserved(self):
        for value in ("0.00", "0.01", "1000.00", "99999999.99", "0001.00"):
            with self.subTest(value=value):
                payload = self.payload()
                payload["condiciones_comunes"]["tarifa"] = value
                with localcontext() as context:
                    context.prec = 3
                    result = validate_multi_machine_alta_payload(payload)
                self.assertEqual(result.condiciones_comunes.tarifa.as_tuple(), Decimal(value).as_tuple())

    def test_tarifa_rejects_wrong_types_formats_nonfinite_scale_and_range(self):
        invalid = (None, False, True, 0, 1000.0, Decimal("1000.00"), [], {}, "", "-1.00", "-0.00",
                   "+1.00", "1", "1.0", "1.000", ".00", "1.", " 1.00", "1.00\n", "1,00",
                   "1_000.00", "1e2", "1.00E+2", "NaN", "sNaN", "Infinity", "-Infinity",
                   "100000000.00", "99999999.999", "9" * 200 + ".00", "１.00")
        for value in invalid:
            with self.subTest(value=value):
                payload = self.payload()
                payload["condiciones_comunes"]["tarifa"] = value
                self.assert_invalid(payload, ("condiciones_comunes", "tarifa"))

    def test_machine_lookup_is_one_batch_and_does_not_grow_per_line(self):
        with CaptureQueriesContext(connection) as small:
            validate_multi_machine_alta_payload(self.payload([self.first.pk]))
        extra = [Maquinaria.objects.create(marca=f"Lote {index}") for index in range(12)]
        with CaptureQueriesContext(connection) as large:
            result = validate_multi_machine_alta_payload(self.payload(
                [machine.pk for machine in reversed(extra)] + [self.second.pk, self.first.pk]
            ))
        self.assertEqual(len(result.maquinarias), 14)
        self.assertEqual(len(small), 3)
        self.assertEqual(len(large), 3)
        machine_queries = [q["sql"] for q in large if f'FROM "{Maquinaria._meta.db_table}"' in q["sql"]]
        self.assertEqual(len(machine_queries), 1)
        self.assertIn(" IN ", machine_queries[0])
        self.assertTrue(all(q["sql"].lstrip().upper().startswith("SELECT") for q in large))

    def test_unexpected_database_errors_are_not_hidden_as_validation(self):
        payload = self.payload()
        original = deepcopy(payload)
        persisted = self.snapshot()
        with patch("api.services.multi_machine_alta.Maquinaria.objects.filter",
                   side_effect=DatabaseError("synthetic P030 failure")):
            with self.assertRaisesRegex(DatabaseError, "synthetic P030 failure"):
                validate_multi_machine_alta_payload(payload)
        self.assertEqual(payload, original)
        self.assertEqual(self.snapshot(), persisted)
