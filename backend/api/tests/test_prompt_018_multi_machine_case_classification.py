import copy
import hashlib
import json
import os
import tempfile
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase


def finding(code, entity, entity_id, arriendo_id=None, order_id=None,
            line_index=None, related_ids=None):
    return {
        "code": code, "entity": entity, "entity_id": entity_id,
        "arriendo_id": arriendo_id, "orden_trabajo_id": order_id,
        "line_index": line_index, "related_ids": related_ids or [],
    }


def report(pairs=None, findings=None, groups=None, documents=None,
           arriendos=None, orders=0, unlinked=None):
    pairs = pairs or []
    findings = sorted(findings or [], key=lambda row: (
        row["code"], row["entity"], row["entity_id"],
        -1 if row["orden_trabajo_id"] is None else row["orden_trabajo_id"],
        -1 if row["line_index"] is None else row["line_index"], row["related_ids"],
    ))
    groups = groups or []
    documents = documents or []
    null_count = sum(row["code"] == "LEGACY_FK_NULL" for row in findings)
    unlinked_ids = {row["orden_trabajo_id"] for row in findings
                    if row["arriendo_id"] is None}
    return {
        "schema_version": 1, "read_only": True,
        "summary": {
            "active_duplicate_machine_groups": len(groups),
            "arriendos_total": len(pairs) + null_count if arriendos is None else arriendos,
            "arriendos_with_documents": len(documents),
            "arriendos_without_legacy_fk": null_count,
            "deterministic_legacy_fk_pairs": len(pairs),
            "manual_review_findings": len(findings),
            "ordenes_trabajo_total": orders,
            "ordenes_trabajo_without_arriendo": len(unlinked_ids) if unlinked is None else unlinked,
        },
        "deterministic_pairs": pairs, "manual_review": findings,
        "active_duplicate_machine_groups": groups,
        "protected_document_links": documents,
    }


class MultiMachineCaseClassificationTests(TestCase):
    def run_mocked(self, payload):
        output = StringIO()

        def fake_preflight(name, stdout):
            self.assertEqual(name, "multi_machine_preflight")
            stdout.write(payload if isinstance(payload, str) else json.dumps(payload))

        with patch("api.management.commands.classify_multi_machine_cases.call_command",
                   side_effect=fake_preflight):
            call_command("classify_multi_machine_cases", stdout=output)
        return output.getvalue(), json.loads(output.getvalue())

    def assert_rejected(self, payload):
        output = StringIO()
        with patch("api.management.commands.classify_multi_machine_cases.call_command",
                   side_effect=lambda name, stdout: stdout.write(
                       payload if isinstance(payload, str) else json.dumps(payload))):
            with self.assertRaises(CommandError):
                call_command("classify_multi_machine_cases", stdout=output)
        self.assertEqual(output.getvalue(), "")

    def test_empty_database_exact_compact_deterministic_read_only_contract(self):
        before = connection.queries_log.copy()
        first = StringIO()
        second = StringIO()
        with self.assertNumQueries(5):
            call_command("classify_multi_machine_cases", stdout=first)
        call_command("classify_multi_machine_cases", stdout=second)
        self.assertEqual(first.getvalue(), second.getvalue())
        self.assertTrue(first.getvalue().endswith("\n"))
        self.assertNotIn(": ", first.getvalue())
        data = json.loads(first.getvalue())
        self.assertEqual(set(data), {"arriendo_cases", "command", "mode",
            "preflight_sha256", "read_only", "review_category_counts",
            "schema_version", "summary", "unlinked_work_order_cases"})
        self.assertEqual((data["command"], data["mode"], data["read_only"]),
                         ("classify_multi_machine_cases", "inventory", True))
        self.assertEqual(data["arriendo_cases"], [])
        self.assertTrue(all(value == 0 for value in data["summary"].values()))
        sql = " ".join(row["sql"] for row in list(connection.queries_log)[len(before):]).upper()
        self.assertFalse(any(word in sql for word in ("INSERT", "UPDATE", "DELETE", "ALTER", "CREATE")))

    def test_no_custom_write_or_file_options_and_creates_no_files(self):
        with tempfile.TemporaryDirectory() as directory:
            before = os.listdir(directory)
            self.run_mocked(report())
            self.assertEqual(os.listdir(directory), before)
        for option in ("--apply", "--rollback", "--output", "--repair"):
            with self.assertRaises(CommandError):
                call_command("classify_multi_machine_cases", option, stdout=StringIO())

    def test_hash_is_full_canonical_preflight(self):
        source = report()
        _, data = self.run_mocked(source)
        expected = hashlib.sha256(json.dumps(source, sort_keys=True,
                                  separators=(",", ":")).encode()).hexdigest()
        self.assertEqual(data["preflight_sha256"], expected)

    def test_rejects_json_identity_and_top_level_contract_errors(self):
        self.assert_rejected("not-json")
        self.assert_rejected("{} {}")
        for change in (lambda row: row.update(schema_version=2),
                       lambda row: row.update(read_only=False),
                       lambda row: row.update(extra=True),
                       lambda row: row.pop("summary")):
            value = report()
            change(value)
            self.assert_rejected(value)

    def test_rejects_summary_counts_and_boolean_integers(self):
        for key, value in (("arriendos_total", True),
                           ("manual_review_findings", 1),
                           ("ordenes_trabajo_without_arriendo", 2)):
            source = report()
            source["summary"][key] = value
            self.assert_rejected(source)
        source = report()
        source["summary"]["extra"] = 0
        self.assert_rejected(source)

    def test_rejects_invalid_duplicate_and_multiple_pairs(self):
        invalid_sets = [
            [{"arriendo_id": 0, "maquinaria_id": 1}],
            [{"arriendo_id": True, "maquinaria_id": 1}],
            [{"arriendo_id": 1, "maquinaria_id": 1}, {"arriendo_id": 1, "maquinaria_id": 1}],
            [{"arriendo_id": 1, "maquinaria_id": 1}, {"arriendo_id": 1, "maquinaria_id": 2}],
            [{"arriendo_id": 2, "maquinaria_id": 1}, {"arriendo_id": 1, "maquinaria_id": 2}],
        ]
        for pairs in invalid_sets:
            self.assert_rejected(report(pairs=pairs))

    def test_rejects_invalid_findings_unknown_codes_and_assignment(self):
        valid = finding("LEGACY_FK_NULL", "arriendo", 1, arriendo_id=1)
        variants = []
        for field, value in (("code", "UNKNOWN"), ("entity_id", 0),
                             ("line_index", -1), ("related_ids", [1, 1]),
                             ("related_ids", [2, 1])):
            row = copy.deepcopy(valid)
            row[field] = value
            variants.append(row)
        row = copy.deepcopy(valid)
        row["extra"] = 1
        variants.append(row)
        variants.append(finding("WORK_ORDER_MACHINE_FK_NULL", "orden_trabajo", 1,
                                order_id=1))
        for row in variants:
            self.assert_rejected(report(findings=[row], orders=1))

    def test_rejects_malformed_groups_and_document_links(self):
        pairs = [{"arriendo_id": 1, "maquinaria_id": 3},
                 {"arriendo_id": 2, "maquinaria_id": 3}]
        bad_groups = [
            [{"maquinaria_id": 3, "arriendo_ids": [1]}],
            [{"maquinaria_id": 3, "arriendo_ids": [2, 1]}],
            [{"maquinaria_id": 4, "arriendo_ids": [1, 2]}],
            [{"maquinaria_id": 3, "arriendo_ids": [1, 1]}],
        ]
        for groups in bad_groups:
            self.assert_rejected(report(pairs=pairs, groups=groups))
        for documents in ([{"arriendo_id": 9, "document_count": 1}],
                          [{"arriendo_id": 1, "document_count": 0}],
                          [{"arriendo_id": 1, "document_count": True}]):
            self.assert_rejected(report(pairs=pairs, documents=documents))

    def test_classifies_and_groups_all_finding_categories_without_replacing_fk(self):
        pairs = [{"arriendo_id": 1, "maquinaria_id": 10}]
        findings = [
            finding("WORK_ORDER_MACHINE_DIFFERS_FROM_RENTAL_FK", "orden_trabajo", 4, 1, 4, related_ids=[10, 11]),
            finding("MULTIPLE_WORK_ORDERS_FOR_RENTAL", "arriendo", 1, 1, related_ids=[4, 5]),
            finding("DETAIL_LINE_NOT_OBJECT", "orden_trabajo", 4, 1, 4, 0),
            finding("DETAIL_SERIES_NOT_FOUND", "orden_trabajo", 4, 1, 4, 1),
            finding("DETAIL_SERIES_DUPLICATE", "orden_trabajo", 4, 1, 4, 2),
        ]
        _, data = self.run_mocked(report(pairs=pairs, findings=findings, orders=2))
        case = data["arriendo_cases"][0]
        self.assertEqual(case["legacy_maquinaria_id"], 10)
        self.assertEqual(case["pair_status"], "DETERMINISTIC_PAIR_WITH_REVIEW")
        self.assertEqual(len(case["findings"]), len(findings))
        self.assertEqual(case["review_categories"], sorted(set(case["review_categories"])))
        self.assertEqual(data["review_category_counts"]["DETAIL_MACHINE_REVIEW"], 1)

    def test_null_fk_and_unlinked_order_never_create_inferred_pairs(self):
        findings = [
            finding("LEGACY_FK_NULL", "arriendo", 2, 2),
            finding("DETAIL_SERIES_MATCHES_DIFFERENT_MACHINE", "orden_trabajo", 7, 2, 7, 0, [20]),
            finding("WORK_ORDER_WITHOUT_RENTAL", "orden_trabajo", 8, order_id=8),
            finding("WORK_ORDER_MACHINE_FK_NULL", "orden_trabajo", 8, order_id=8),
        ]
        _, data = self.run_mocked(report(findings=findings, orders=2))
        rental = data["arriendo_cases"][0]
        self.assertEqual((rental["pair_status"], rental["legacy_maquinaria_id"]),
                         ("NO_DETERMINISTIC_PAIR", None))
        self.assertEqual(data["summary"]["deterministic_pairs"], 0)
        orphan = data["unlinked_work_order_cases"][0]
        self.assertEqual(orphan["orden_trabajo_id"], 8)
        self.assertIn("WORK_ORDER_LINKAGE_REVIEW", orphan["review_categories"])

    def test_clean_pairs_duplicates_and_documents_create_expected_cases(self):
        pairs = [{"arriendo_id": 1, "maquinaria_id": 9},
                 {"arriendo_id": 2, "maquinaria_id": 9},
                 {"arriendo_id": 3, "maquinaria_id": 10}]
        groups = [{"maquinaria_id": 9, "arriendo_ids": [1, 2]}]
        documents = [{"arriendo_id": 3, "document_count": 2}]
        _, data = self.run_mocked(report(pairs=pairs, groups=groups, documents=documents))
        self.assertEqual([row["arriendo_id"] for row in data["arriendo_cases"]], [1, 2, 3])
        self.assertTrue(all(not row["findings"] for row in data["arriendo_cases"]))
        self.assertEqual(data["arriendo_cases"][2]["document_count"], 2)
        self.assertEqual(data["summary"]["clean_deterministic_pairs"], 0)
        self.assertEqual(data["review_category_counts"]["ACTIVE_DUPLICATE_REVIEW"], 2)
        self.assertEqual(data["review_category_counts"]["PROTECTED_DOCUMENT_REVIEW"], 1)

    def test_clean_pair_does_not_create_case_and_output_is_sanitized(self):
        source = report(pairs=[{"arriendo_id": 1, "maquinaria_id": 2}])
        output, data = self.run_mocked(source)
        self.assertEqual(data["arriendo_cases"], [])
        self.assertEqual(data["summary"]["clean_deterministic_pairs"], 1)
        for marker in ("secret-marker", "customer-marker", "series-marker",
                       "amount-marker", "https://marker.invalid"):
            self.assertNotIn(marker, output)
