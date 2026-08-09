import json
from collections import Counter, defaultdict

from django.core.management.base import BaseCommand
from django.db.models import Count

from api.models import Arriendo, Maquinaria, OrdenTrabajo


class Command(BaseCommand):
    help = "Inventario de solo lectura para el preflight de la migración multi-máquina."

    def handle(self, *args, **options):
        arriendos = list(
            Arriendo.objects.order_by("id").values("id", "maquinaria_id", "estado")
        )
        ordenes = list(
            OrdenTrabajo.objects.order_by("id").values(
                "id", "arriendo_id", "maquinaria_id", "detalle_lineas"
            )
        )

        machines_by_series = defaultdict(list)
        for machine_id, serie in Maquinaria.objects.order_by("id").values_list("id", "serie"):
            if isinstance(serie, str):
                machines_by_series[serie.casefold()].append(machine_id)

        findings = []

        def add(code, entity, entity_id, *, arriendo_id=None, orden_id=None,
                line_index=None, related_ids=()):
            findings.append({
                "code": code,
                "entity": entity,
                "entity_id": entity_id,
                "arriendo_id": arriendo_id,
                "orden_trabajo_id": orden_id,
                "line_index": line_index,
                "related_ids": sorted(set(related_ids)),
            })

        orders_by_rental = defaultdict(list)
        for order in ordenes:
            if order["arriendo_id"] is not None:
                orders_by_rental[order["arriendo_id"]].append(order["id"])

        deterministic_pairs = []
        for rental in arriendos:
            rental_id = rental["id"]
            machine_id = rental["maquinaria_id"]
            order_ids = orders_by_rental[rental_id]
            if machine_id is None:
                add("LEGACY_FK_NULL", "arriendo", rental_id, arriendo_id=rental_id)
            else:
                deterministic_pairs.append({
                    "arriendo_id": rental_id, "maquinaria_id": machine_id
                })
            if not order_ids:
                add("RENTAL_WITHOUT_WORK_ORDER", "arriendo", rental_id,
                    arriendo_id=rental_id)
            elif len(order_ids) > 1:
                add("MULTIPLE_WORK_ORDERS_FOR_RENTAL", "arriendo", rental_id,
                    arriendo_id=rental_id, related_ids=order_ids)

        rental_machine = {row["id"]: row["maquinaria_id"] for row in arriendos}
        for order in ordenes:
            order_id = order["id"]
            rental_id = order["arriendo_id"]
            order_machine_id = order["maquinaria_id"]
            rental_machine_id = rental_machine.get(rental_id)
            if rental_id is None:
                add("WORK_ORDER_WITHOUT_RENTAL", "orden_trabajo", order_id,
                    orden_id=order_id)
            if order_machine_id is None:
                add("WORK_ORDER_MACHINE_FK_NULL", "orden_trabajo", order_id,
                    arriendo_id=rental_id, orden_id=order_id)
            elif rental_id is not None and order_machine_id != rental_machine_id:
                related = [order_machine_id]
                if rental_machine_id is not None:
                    related.append(rental_machine_id)
                add("WORK_ORDER_MACHINE_DIFFERS_FROM_RENTAL_FK", "orden_trabajo",
                    order_id, arriendo_id=rental_id, orden_id=order_id,
                    related_ids=related)

            lines = order["detalle_lineas"]
            if not isinstance(lines, list):
                add("DETAIL_LINES_NOT_LIST", "orden_trabajo", order_id,
                    arriendo_id=rental_id, orden_id=order_id)
                continue

            valid_series = [
                line.get("serie") for line in lines
                if isinstance(line, dict) and isinstance(line.get("serie"), str)
                and line.get("serie").strip()
            ]
            duplicate_keys = {
                key for key, count in Counter(value.casefold() for value in valid_series).items()
                if count > 1
            }
            for index, line in enumerate(lines):
                common = {"arriendo_id": rental_id, "orden_id": order_id,
                          "line_index": index}
                if not isinstance(line, dict):
                    add("DETAIL_LINE_NOT_OBJECT", "orden_trabajo", order_id, **common)
                    continue
                if "serie" not in line:
                    add("DETAIL_SERIES_MISSING", "orden_trabajo", order_id, **common)
                    continue
                serie = line["serie"]
                if not isinstance(serie, str):
                    add("DETAIL_SERIES_NOT_STRING", "orden_trabajo", order_id, **common)
                    continue
                if not serie.strip():
                    add("DETAIL_SERIES_BLANK", "orden_trabajo", order_id, **common)
                    continue
                key = serie.casefold()
                if key in duplicate_keys:
                    add("DETAIL_SERIES_DUPLICATE", "orden_trabajo", order_id, **common)
                matching_ids = machines_by_series.get(key, [])
                if not matching_ids:
                    add("DETAIL_SERIES_NOT_FOUND", "orden_trabajo", order_id, **common)
                elif len(matching_ids) > 1:
                    add("DETAIL_SERIES_AMBIGUOUS", "orden_trabajo", order_id,
                        related_ids=matching_ids, **common)
                elif rental_id is not None and matching_ids[0] != rental_machine_id:
                    related = [matching_ids[0]]
                    if rental_machine_id is not None:
                        related.append(rental_machine_id)
                    add("DETAIL_SERIES_MATCHES_DIFFERENT_MACHINE", "orden_trabajo",
                        order_id, related_ids=related, **common)

        findings.sort(key=lambda item: (
            item["code"], item["entity"], item["entity_id"],
            -1 if item["orden_trabajo_id"] is None else item["orden_trabajo_id"],
            -1 if item["line_index"] is None else item["line_index"],
            item["related_ids"],
        ))

        active_rows = (
            Arriendo.objects.filter(estado__iexact="Activo", maquinaria_id__isnull=False)
            .order_by("maquinaria_id", "id")
            .values_list("maquinaria_id", "id")
        )
        active_by_machine = defaultdict(list)
        for machine_id, rental_id in active_rows:
            active_by_machine[machine_id].append(rental_id)
        duplicate_groups = [
            {"maquinaria_id": machine_id, "arriendo_ids": rental_ids}
            for machine_id, rental_ids in active_by_machine.items()
            if len(rental_ids) > 1
        ]

        document_links = list(
            Arriendo.objects.annotate(document_count=Count("documentos"))
            .filter(document_count__gt=0).order_by("id")
            .values("id", "document_count")
        )
        protected_document_links = [
            {"arriendo_id": row["id"], "document_count": row["document_count"]}
            for row in document_links
        ]

        report = {
            "schema_version": 1,
            "read_only": True,
            "summary": {
                "arriendos_total": len(arriendos),
                "ordenes_trabajo_total": len(ordenes),
                "deterministic_legacy_fk_pairs": len(deterministic_pairs),
                "arriendos_without_legacy_fk": sum(
                    row["maquinaria_id"] is None for row in arriendos
                ),
                "ordenes_trabajo_without_arriendo": sum(
                    row["arriendo_id"] is None for row in ordenes
                ),
                "manual_review_findings": len(findings),
                "active_duplicate_machine_groups": len(duplicate_groups),
                "arriendos_with_documents": len(protected_document_links),
            },
            "deterministic_pairs": deterministic_pairs,
            "manual_review": findings,
            "active_duplicate_machine_groups": duplicate_groups,
            "protected_document_links": protected_document_links,
        }
        self.stdout.write(json.dumps(report, sort_keys=True, separators=(",", ":")))
