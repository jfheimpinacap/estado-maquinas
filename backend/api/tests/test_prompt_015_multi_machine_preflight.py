import json
from datetime import date, timedelta
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from api.models import Arriendo, Cliente, Documento, Maquinaria, OrdenTrabajo


class MultiMachinePreflightTests(TestCase):
    def setUp(self):
        self.customer = Cliente.objects.create(
            razon_social="PRIVATE CUSTOMER", rut="99.999.999-9"
        )

    def report(self):
        stdout = StringIO()
        call_command("multi_machine_preflight", stdout=stdout)
        return stdout.getvalue(), json.loads(stdout.getvalue())

    def machine(self, serie, **kwargs):
        return Maquinaria.objects.create(marca="PRIVATE BRAND", serie=serie, **kwargs)

    def rental(self, machine=None, **kwargs):
        defaults = {
            "maquinaria": machine,
            "cliente": self.customer,
            "fecha_inicio": date.today(),
            "periodo": "Dia",
            "tarifa": Decimal("123.45"),
            "estado": "Activo",
        }
        defaults.update(kwargs)
        return Arriendo.objects.create(**defaults)

    def order(self, *, rental=None, machine=None, lines=None):
        return OrdenTrabajo.objects.create(
            arriendo=rental, maquinaria=machine, cliente=self.customer,
            tipo="ALTA", detalle_lineas=[] if lines is None else lines,
        )

    @staticmethod
    def codes(report):
        return [finding["code"] for finding in report["manual_review"]]

    def test_empty_database_contract(self):
        Cliente.objects.all().delete()
        raw, report = self.report()
        self.assertEqual(raw.strip(), json.dumps(report, sort_keys=True, separators=(",", ":")))
        self.assertEqual(report["schema_version"], 1)
        self.assertIs(report["read_only"], True)
        self.assertEqual(report["summary"], {
            "active_duplicate_machine_groups": 0,
            "arriendos_total": 0,
            "arriendos_with_documents": 0,
            "arriendos_without_legacy_fk": 0,
            "deterministic_legacy_fk_pairs": 0,
            "manual_review_findings": 0,
            "ordenes_trabajo_total": 0,
            "ordenes_trabajo_without_arriendo": 0,
        })
        for key in ("deterministic_pairs", "manual_review",
                    "active_duplicate_machine_groups", "protected_document_links"):
            self.assertEqual(report[key], [])

    def test_persisted_fk_is_only_deterministic_pair_and_null_is_reviewed(self):
        machine = self.machine("EXACT")
        linked = self.rental(machine)
        unlinked = self.rental()
        self.order(rental=linked, machine=machine, lines=[{"serie": "exact"}])

        _, report = self.report()

        self.assertEqual(report["deterministic_pairs"], [
            {"arriendo_id": linked.id, "maquinaria_id": machine.id}
        ])
        null_findings = [f for f in report["manual_review"] if f["code"] == "LEGACY_FK_NULL"]
        self.assertEqual([f["arriendo_id"] for f in null_findings], [unlinked.id])
        self.assertEqual(report["summary"]["deterministic_legacy_fk_pairs"], 1)

    def test_relationship_and_machine_fk_findings(self):
        first = self.machine("FIRST")
        second = self.machine("SECOND")
        rental = self.rental(first)
        self.order(rental=rental, machine=second, lines=[{"serie": "SECOND"}])
        self.order(rental=rental, machine=None, lines=[])
        orphan = self.order(machine=first, lines=[])

        _, report = self.report()
        codes = self.codes(report)

        self.assertIn("MULTIPLE_WORK_ORDERS_FOR_RENTAL", codes)
        self.assertIn("WORK_ORDER_MACHINE_DIFFERS_FROM_RENTAL_FK", codes)
        self.assertIn("DETAIL_SERIES_MATCHES_DIFFERENT_MACHINE", codes)
        self.assertIn("WORK_ORDER_MACHINE_FK_NULL", codes)
        self.assertIn("WORK_ORDER_WITHOUT_RENTAL", codes)
        finding = next(f for f in report["manual_review"]
                       if f["code"] == "WORK_ORDER_WITHOUT_RENTAL")
        self.assertEqual(finding["orden_trabajo_id"], orphan.id)

    def test_defensive_detail_line_classification_and_zero_based_indexes(self):
        machine = self.machine("KNOWN")
        rental = self.rental(machine)
        malformed = self.order(rental=rental, machine=machine, lines={"serie": "KNOWN"})
        detailed = self.order(rental=rental, machine=machine, lines=[
            "not-an-object", {}, {"serie": None}, {"serie": 7},
            {"serie": ""}, {"serie": "   "}, {"serie": "MISSING"},
            {"serie": "KNOWN"}, {"serie": "known"},
        ])

        _, report = self.report()
        by_code = {}
        for finding in report["manual_review"]:
            by_code.setdefault(finding["code"], []).append(finding)

        self.assertEqual(by_code["DETAIL_LINES_NOT_LIST"][0]["entity_id"], malformed.id)
        self.assertEqual(by_code["DETAIL_LINE_NOT_OBJECT"][0]["line_index"], 0)
        self.assertEqual(by_code["DETAIL_SERIES_MISSING"][0]["line_index"], 1)
        self.assertEqual([f["line_index"] for f in by_code["DETAIL_SERIES_NOT_STRING"]], [2, 3])
        self.assertEqual([f["line_index"] for f in by_code["DETAIL_SERIES_BLANK"]], [4, 5])
        self.assertEqual(by_code["DETAIL_SERIES_NOT_FOUND"][0]["line_index"], 6)
        self.assertEqual([f["line_index"] for f in by_code["DETAIL_SERIES_DUPLICATE"]], [7, 8])
        self.assertEqual(report["deterministic_pairs"], [
            {"arriendo_id": rental.id, "maquinaria_id": machine.id}
        ])

    def test_exact_case_insensitive_matching_is_not_approximate_or_arbitrary(self):
        first = self.machine("CASE")
        second = self.machine("case")
        rental = self.rental(first)
        self.order(rental=rental, machine=first, lines=[
            {"serie": "CaSe"}, {"serie": "CASE "}, {"serie": "CAS"}
        ])

        _, report = self.report()
        ambiguous = next(f for f in report["manual_review"]
                         if f["code"] == "DETAIL_SERIES_AMBIGUOUS")
        self.assertEqual(ambiguous["related_ids"], [first.id, second.id])
        not_found_indexes = [f["line_index"] for f in report["manual_review"]
                             if f["code"] == "DETAIL_SERIES_NOT_FOUND"]
        self.assertEqual(not_found_indexes, [1, 2])
        self.assertEqual(Maquinaria.objects.count(), 2)

    def test_active_duplicates_ignore_dates_exclude_terminated_and_documents_are_protected(self):
        machine = self.machine("DUPLICATE")
        expired = self.rental(machine, fecha_termino=date.today() - timedelta(days=5))
        active = self.rental(machine)
        self.rental(machine, estado="Terminado")
        Documento.objects.create(
            tipo="GD", numero="PRIVATE-FOLIO", fecha_emision=date.today(),
            arriendo=expired, cliente=self.customer, monto_total=Decimal("999.99")
        )

        raw, report = self.report()

        self.assertEqual(report["active_duplicate_machine_groups"], [{
            "maquinaria_id": machine.id,
            "arriendo_ids": [expired.id, active.id],
        }])
        self.assertEqual(report["protected_document_links"], [{
            "arriendo_id": expired.id, "document_count": 1
        }])
        self.assertNotIn("PRIVATE-FOLIO", raw)
        self.assertNotIn("PRIVATE CUSTOMER", raw)
        self.assertNotIn("PRIVATE BRAND", raw)
        self.assertNotIn("999.99", raw)
        self.assertNotIn("DUPLICATE", raw)

    def test_rental_without_work_order(self):
        rental = self.rental(self.machine("NO-ORDER"))
        _, report = self.report()
        finding = next(f for f in report["manual_review"]
                       if f["code"] == "RENTAL_WITHOUT_WORK_ORDER")
        self.assertEqual(finding["arriendo_id"], rental.id)

    def test_output_is_deterministic_and_command_executes_only_selects(self):
        machine = self.machine("READONLY", estado="Disponible")
        rental = self.rental(machine)
        order = self.order(rental=rental, machine=machine, lines=[{"serie": "READONLY"}])
        document = Documento.objects.create(
            tipo="GD", numero="HIDDEN", fecha_emision=date.today(),
            arriendo=rental, cliente=self.customer,
        )
        before = (
            list(Maquinaria.objects.values()), list(Arriendo.objects.values()),
            list(OrdenTrabajo.objects.values()), list(Documento.objects.values()),
        )

        with CaptureQueriesContext(connection) as captured:
            first_raw, first = self.report()
        second_raw, second = self.report()

        self.assertEqual(first_raw, second_raw)
        self.assertEqual(first, second)
        mutating = ("INSERT", "UPDATE", "DELETE", "ALTER", "DROP", "CREATE")
        self.assertFalse([
            query["sql"] for query in captured.captured_queries
            if query["sql"].lstrip().upper().startswith(mutating)
        ])
        after = (
            list(Maquinaria.objects.values()), list(Arriendo.objects.values()),
            list(OrdenTrabajo.objects.values()), list(Documento.objects.values()),
        )
        self.assertEqual(before, after)
        machine.refresh_from_db()
        rental.refresh_from_db()
        order.refresh_from_db()
        document.refresh_from_db()
        self.assertEqual(machine.estado, "Disponible")
        self.assertEqual(rental.estado, "Activo")
