import hashlib
import json
from collections import defaultdict
from io import StringIO

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError


TOP_KEYS = {
    "schema_version", "read_only", "summary", "deterministic_pairs",
    "manual_review", "active_duplicate_machine_groups", "protected_document_links",
}
SUMMARY_KEYS = {
    "active_duplicate_machine_groups", "arriendos_total", "arriendos_with_documents",
    "arriendos_without_legacy_fk", "deterministic_legacy_fk_pairs",
    "manual_review_findings", "ordenes_trabajo_total",
    "ordenes_trabajo_without_arriendo",
}
FINDING_KEYS = {
    "code", "entity", "entity_id", "arriendo_id", "orden_trabajo_id",
    "line_index", "related_ids",
}
CATEGORIES = {
    "LEGACY_FK_NULL": "LEGACY_FK_MISSING",
    "RENTAL_WITHOUT_WORK_ORDER": "WORK_ORDER_CARDINALITY_REVIEW",
    "MULTIPLE_WORK_ORDERS_FOR_RENTAL": "WORK_ORDER_CARDINALITY_REVIEW",
    "WORK_ORDER_WITHOUT_RENTAL": "WORK_ORDER_LINKAGE_REVIEW",
    "WORK_ORDER_MACHINE_FK_NULL": "WORK_ORDER_MACHINE_REVIEW",
    "WORK_ORDER_MACHINE_DIFFERS_FROM_RENTAL_FK": "WORK_ORDER_MACHINE_REVIEW",
    "DETAIL_LINES_NOT_LIST": "DETAIL_STRUCTURE_REVIEW",
    "DETAIL_LINE_NOT_OBJECT": "DETAIL_STRUCTURE_REVIEW",
    "DETAIL_SERIES_MISSING": "DETAIL_STRUCTURE_REVIEW",
    "DETAIL_SERIES_NOT_STRING": "DETAIL_STRUCTURE_REVIEW",
    "DETAIL_SERIES_BLANK": "DETAIL_STRUCTURE_REVIEW",
    "DETAIL_SERIES_DUPLICATE": "DETAIL_MACHINE_REVIEW",
    "DETAIL_SERIES_NOT_FOUND": "DETAIL_MACHINE_REVIEW",
    "DETAIL_SERIES_AMBIGUOUS": "DETAIL_MACHINE_REVIEW",
    "DETAIL_SERIES_MATCHES_DIFFERENT_MACHINE": "DETAIL_MACHINE_REVIEW",
}
ARRENDAMIENTO_CODES = {
    "LEGACY_FK_NULL", "RENTAL_WITHOUT_WORK_ORDER",
    "MULTIPLE_WORK_ORDERS_FOR_RENTAL",
}
LINE_CODES = {
    "DETAIL_LINE_NOT_OBJECT", "DETAIL_SERIES_MISSING", "DETAIL_SERIES_NOT_STRING",
    "DETAIL_SERIES_BLANK", "DETAIL_SERIES_DUPLICATE", "DETAIL_SERIES_NOT_FOUND",
    "DETAIL_SERIES_AMBIGUOUS", "DETAIL_SERIES_MATCHES_DIFFERENT_MACHINE",
}
ALL_CATEGORIES = sorted(set(CATEGORIES.values()) | {
    "ACTIVE_DUPLICATE_REVIEW", "PROTECTED_DOCUMENT_REVIEW",
})


def _int(value, *, positive=False):
    return type(value) is int and value >= (1 if positive else 0)


def _ordered_unique_ids(value, *, minimum=1):
    return (isinstance(value, list) and all(type(item) is int and item >= minimum for item in value)
            and value == sorted(value) and len(value) == len(set(value)))


def _fail():
    raise CommandError("La salida de multi_machine_preflight no cumple el contrato requerido.")


def _finding_key(item):
    return (
        item["code"], item["entity"], item["entity_id"],
        -1 if item["orden_trabajo_id"] is None else item["orden_trabajo_id"],
        -1 if item["line_index"] is None else item["line_index"], tuple(item["related_ids"]),
    )


def validate(report):
    if not isinstance(report, dict) or set(report) != TOP_KEYS:
        _fail()
    if report["schema_version"] != 1 or report["read_only"] is not True:
        _fail()
    summary = report["summary"]
    if (not isinstance(summary, dict) or set(summary) != SUMMARY_KEYS
            or not all(_int(value) for value in summary.values())):
        _fail()
    pairs = report["deterministic_pairs"]
    findings = report["manual_review"]
    groups = report["active_duplicate_machine_groups"]
    documents = report["protected_document_links"]
    if not all(isinstance(value, list) for value in (pairs, findings, groups, documents)):
        _fail()

    pair_ids = []
    pair_rows = []
    for row in pairs:
        if (not isinstance(row, dict) or set(row) != {"arriendo_id", "maquinaria_id"}
                or not _int(row["arriendo_id"], positive=True)
                or not _int(row["maquinaria_id"], positive=True)):
            _fail()
        pair_ids.append(row["arriendo_id"])
        pair_rows.append((row["arriendo_id"], row["maquinaria_id"]))
    if pair_ids != sorted(pair_ids) or len(pair_ids) != len(set(pair_ids)) or len(pair_rows) != len(set(pair_rows)):
        _fail()

    null_ids = []
    unlinked_order_ids = set()
    unlinked_linkage_ids = set()
    referenced_order_ids = set()
    previous = None
    seen_findings = set()
    for item in findings:
        if not isinstance(item, dict) or set(item) != FINDING_KEYS or item.get("code") not in CATEGORIES:
            _fail()
        if item["entity"] not in {"arriendo", "orden_trabajo"} or not _int(item["entity_id"], positive=True):
            _fail()
        if item["arriendo_id"] is not None and not _int(item["arriendo_id"], positive=True):
            _fail()
        if item["orden_trabajo_id"] is not None and not _int(item["orden_trabajo_id"], positive=True):
            _fail()
        if item["line_index"] is not None and not _int(item["line_index"]):
            _fail()
        if not _ordered_unique_ids(item["related_ids"]):
            _fail()
        if item["entity"] == "arriendo":
            if item["entity_id"] != item["arriendo_id"] or item["orden_trabajo_id"] is not None or item["line_index"] is not None:
                _fail()
        else:
            if item["entity_id"] != item["orden_trabajo_id"]:
                _fail()
            referenced_order_ids.add(item["orden_trabajo_id"])
        if (item["code"] in ARRENDAMIENTO_CODES) != (item["entity"] == "arriendo"):
            _fail()
        if item["code"] in LINE_CODES:
            if item["line_index"] is None:
                _fail()
        elif item["line_index"] is not None:
            _fail()
        if item["arriendo_id"] is None:
            if item["entity"] != "orden_trabajo" or item["orden_trabajo_id"] is None:
                _fail()
            unlinked_order_ids.add(item["orden_trabajo_id"])
        if item["code"] == "WORK_ORDER_WITHOUT_RENTAL" and item["arriendo_id"] is not None:
            _fail()
        if item["code"] == "WORK_ORDER_WITHOUT_RENTAL":
            unlinked_linkage_ids.add(item["orden_trabajo_id"])
        if item["code"] == "LEGACY_FK_NULL":
            null_ids.append(item["arriendo_id"])
        key = _finding_key(item)
        if key in seen_findings or (previous is not None and key < previous):
            _fail()
        seen_findings.add(key)
        previous = key

    if len(null_ids) != len(set(null_ids)) or set(pair_ids) & set(null_ids):
        _fail()
    inventory = set(pair_ids) | set(null_ids)
    if len(inventory) != summary["arriendos_total"]:
        _fail()
    if any(item["arriendo_id"] is not None and item["arriendo_id"] not in inventory for item in findings):
        _fail()
    if (len(pairs) != summary["deterministic_legacy_fk_pairs"]
            or len(null_ids) != summary["arriendos_without_legacy_fk"]
            or len(findings) != summary["manual_review_findings"]
            or len(unlinked_order_ids) != summary["ordenes_trabajo_without_arriendo"]):
        _fail()
    if summary["ordenes_trabajo_without_arriendo"] > summary["ordenes_trabajo_total"]:
        _fail()
    if (unlinked_order_ids != unlinked_linkage_ids
            or len(referenced_order_ids) > summary["ordenes_trabajo_total"]):
        _fail()

    prior_machine = None
    grouped_rentals = set()
    for group in groups:
        if (not isinstance(group, dict) or set(group) != {"maquinaria_id", "arriendo_ids"}
                or not _int(group["maquinaria_id"], positive=True)
                or not _ordered_unique_ids(group["arriendo_ids"])
                or len(group["arriendo_ids"]) < 2
                or not set(group["arriendo_ids"]) <= inventory
                or group["maquinaria_id"] <= (prior_machine or 0)
                or grouped_rentals & set(group["arriendo_ids"])):
            _fail()
        if any(dict(pair_rows).get(rental) != group["maquinaria_id"] for rental in group["arriendo_ids"]):
            _fail()
        grouped_rentals.update(group["arriendo_ids"])
        prior_machine = group["maquinaria_id"]
    if len(groups) != summary["active_duplicate_machine_groups"]:
        _fail()

    document_ids = []
    for link in documents:
        if (not isinstance(link, dict) or set(link) != {"arriendo_id", "document_count"}
                or not _int(link["arriendo_id"], positive=True)
                or not _int(link["document_count"], positive=True)
                or link["arriendo_id"] not in inventory):
            _fail()
        document_ids.append(link["arriendo_id"])
    if (document_ids != sorted(document_ids) or len(document_ids) != len(set(document_ids))
            or len(documents) != summary["arriendos_with_documents"]):
        _fail()
    return report


def classify(report):
    pairs = {row["arriendo_id"]: row["maquinaria_id"] for row in report["deterministic_pairs"]}
    null_ids = {row["arriendo_id"] for row in report["manual_review"] if row["code"] == "LEGACY_FK_NULL"}
    rental_findings = defaultdict(list)
    order_findings = defaultdict(list)
    for finding in report["manual_review"]:
        target = rental_findings[finding["arriendo_id"]] if finding["arriendo_id"] is not None else order_findings[finding["orden_trabajo_id"]]
        target.append(finding)
    groups = {}
    for group in report["active_duplicate_machine_groups"]:
        for rental_id in group["arriendo_ids"]:
            groups[rental_id] = group
    documents = {row["arriendo_id"]: row["document_count"] for row in report["protected_document_links"]}
    case_ids = sorted(set(rental_findings) | set(groups) | set(documents))
    rental_cases = []
    for rental_id in case_ids:
        findings = sorted(rental_findings[rental_id], key=_finding_key)
        categories = {CATEGORIES[row["code"]] for row in findings}
        if rental_id in groups:
            categories.add("ACTIVE_DUPLICATE_REVIEW")
        if rental_id in documents:
            categories.add("PROTECTED_DOCUMENT_REVIEW")
        rental_cases.append({
            "active_duplicate_group": groups.get(rental_id),
            "arriendo_id": rental_id,
            "document_count": documents.get(rental_id, 0),
            "findings": findings,
            "legacy_maquinaria_id": pairs.get(rental_id),
            "pair_status": ("NO_DETERMINISTIC_PAIR" if rental_id in null_ids
                            else "DETERMINISTIC_PAIR_WITH_REVIEW"),
            "review_categories": sorted(categories),
        })
    order_cases = []
    for order_id in sorted(order_findings):
        findings = sorted(order_findings[order_id], key=_finding_key)
        categories = sorted({CATEGORIES[row["code"]] for row in findings})
        if "WORK_ORDER_LINKAGE_REVIEW" not in categories:
            _fail()
        order_cases.append({"findings": findings, "orden_trabajo_id": order_id,
                            "review_categories": categories})
    counts = {category: 0 for category in ALL_CATEGORIES}
    for case in rental_cases + order_cases:
        for category in case["review_categories"]:
            counts[category] += 1
    summary = report["summary"]
    return {
        "arriendo_cases": rental_cases,
        "command": "classify_multi_machine_cases",
        "mode": "inventory",
        "preflight_sha256": hashlib.sha256(json.dumps(report, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "read_only": True,
        "review_category_counts": counts,
        "schema_version": 1,
        "summary": {
            "active_duplicate_machine_groups": len(report["active_duplicate_machine_groups"]),
            "arriendo_cases": len(rental_cases),
            "arriendos_total": summary["arriendos_total"],
            "clean_deterministic_pairs": len(pairs) - sum(case["arriendo_id"] in pairs for case in rental_cases),
            "deterministic_pair_with_review_cases": sum(case["pair_status"] == "DETERMINISTIC_PAIR_WITH_REVIEW" for case in rental_cases),
            "deterministic_pairs": len(pairs),
            "manual_review_findings": len(report["manual_review"]),
            "no_deterministic_pair_cases": sum(case["pair_status"] == "NO_DETERMINISTIC_PAIR" for case in rental_cases),
            "ordenes_trabajo_total": summary["ordenes_trabajo_total"],
            "protected_document_links": len(report["protected_document_links"]),
            "unlinked_work_order_cases": len(order_cases),
        },
        "unlinked_work_order_cases": order_cases,
    }


class Command(BaseCommand):
    help = "Clasifica en memoria los casos técnicos del preflight multi-máquina."

    def handle(self, *args, **options):
        captured = StringIO()
        call_command("multi_machine_preflight", stdout=captured)
        try:
            decoder = json.JSONDecoder()
            raw = captured.getvalue()
            report, end = decoder.raw_decode(raw)
            if raw[end:].strip():
                _fail()
        except (json.JSONDecodeError, TypeError):
            _fail()
        result = classify(validate(report))
        self.stdout.write(json.dumps(result, sort_keys=True, separators=(",", ":")))
