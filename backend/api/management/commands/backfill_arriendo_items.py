import hashlib
import json
import os
import uuid
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import Arriendo, ArriendoItem


SCHEMA_VERSION = 1
COMMAND = "backfill_arriendo_items"
PAIR_KEYS = {"arriendo_id", "maquinaria_id"}
ITEM_KEYS = {"arriendo_item_id", "arriendo_id", "maquinaria_id"}
MANIFEST_KEYS = {
    "schema_version", "command", "run_id", "preflight_sha256", "created_items"
}


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _positive_int(value):
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


class Command(BaseCommand):
    help = "Planifica, aplica o revierte el backfill controlado de ArriendoItem."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")
        parser.add_argument("--rollback", action="store_true")
        parser.add_argument("--preflight-report")
        parser.add_argument("--manifest")
        parser.add_argument("--confirm-run-id")

    def handle(self, *args, **options):
        mode = self._validate_mode(options)
        if mode == "plan":
            current, digest = self._current_preflight()
            result = self._plan(current)
            result.update({
                "schema_version": SCHEMA_VERSION,
                "command": COMMAND,
                "mode": "plan",
                "read_only": True,
                "preflight_sha256": digest,
            })
        elif mode == "apply":
            result = self._apply(options["preflight_report"], options["manifest"])
        else:
            result = self._rollback(options["manifest"], options["confirm_run_id"])
        self.stdout.write(_canonical(result))

    @staticmethod
    def _validate_mode(options):
        apply = options["apply"]
        rollback = options["rollback"]
        report = options.get("preflight_report")
        manifest = options.get("manifest")
        run_id = options.get("confirm_run_id")
        if apply and rollback:
            raise CommandError("--apply y --rollback son incompatibles.")
        if apply:
            if not report or not manifest or run_id:
                raise CommandError("Aplicación requiere solo --preflight-report y --manifest.")
            return "apply"
        if rollback:
            if not manifest or not run_id or report:
                raise CommandError("Rollback requiere solo --manifest y --confirm-run-id.")
            return "rollback"
        if report or manifest or run_id:
            raise CommandError("El modo planificación no acepta opciones de escritura.")
        return "plan"

    def _current_preflight(self):
        output = StringIO()
        call_command("multi_machine_preflight", stdout=output)
        try:
            report = json.loads(output.getvalue())
        except (TypeError, json.JSONDecodeError) as exc:
            raise CommandError("El preflight actual no produjo JSON válido.") from exc
        self._validate_preflight(report)
        canonical = _canonical(report)
        return report, hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def _read_json(path_value, label):
        path = Path(path_value)
        if not path.is_file():
            raise CommandError(f"{label} no existe o no es un archivo regular.")
        try:
            with path.open("r", encoding="utf-8") as source:
                value = json.load(source)
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise CommandError(f"{label} no es un archivo JSON UTF-8 legible.") from exc
        if not isinstance(value, dict):
            raise CommandError(f"{label} debe contener un objeto JSON.")
        return value

    @staticmethod
    def _validate_preflight(report):
        if not isinstance(report, dict):
            raise CommandError("El reporte preflight debe ser un objeto JSON.")
        if report.get("schema_version") != SCHEMA_VERSION:
            raise CommandError("Versión de reporte preflight incompatible.")
        if report.get("read_only") is not True:
            raise CommandError("El reporte preflight no es de solo lectura.")
        pairs = report.get("deterministic_pairs")
        if not isinstance(pairs, list):
            raise CommandError("Pares deterministas inválidos.")
        seen = set()
        for pair in pairs:
            if (not isinstance(pair, dict) or set(pair) != PAIR_KEYS
                    or not all(_positive_int(pair[key]) for key in PAIR_KEYS)):
                raise CommandError("Par determinista inválido.")
            key = (pair["arriendo_id"], pair["maquinaria_id"])
            if key in seen:
                raise CommandError("El reporte contiene pares deterministas duplicados.")
            seen.add(key)

    def _plan(self, preflight, *, lock=False):
        rentals_query = Arriendo.objects.order_by("id").values("id", "maquinaria_id")
        items_query = ArriendoItem.objects.order_by("arriendo_id", "id").values(
            "id", "arriendo_id", "maquinaria_id"
        )
        if lock:
            rentals_query = rentals_query.select_for_update()
            items_query = items_query.select_for_update()
        rentals = list(rentals_query)
        items = list(items_query)
        by_rental = {}
        for item in items:
            by_rental.setdefault(item["arriendo_id"], []).append(item)

        approved = {
            (pair["arriendo_id"], pair["maquinaria_id"])
            for pair in preflight["deterministic_pairs"]
        }
        planned, present, skipped, conflicts = [], [], [], []
        for rental in rentals:
            rental_id = rental["id"]
            machine_id = rental["maquinaria_id"]
            existing = by_rental.get(rental_id, [])
            if len(existing) > 1:
                conflicts.append({
                    "code": "MULTIPLE_EXISTING_ITEMS_FOR_ARRENDO",
                    "arriendo_id": rental_id,
                    "arriendo_item_ids": [item["id"] for item in existing],
                })
            elif machine_id is None:
                if existing:
                    conflicts.append({
                        "code": "EXISTING_ITEM_WITH_NULL_LEGACY_FK",
                        "arriendo_id": rental_id,
                        "arriendo_item_ids": [existing[0]["id"]],
                    })
                else:
                    skipped.append(rental_id)
            elif (rental_id, machine_id) not in approved:
                conflicts.append({
                    "code": "LEGACY_FK_NOT_IN_PREFLIGHT",
                    "arriendo_id": rental_id,
                    "maquinaria_id": machine_id,
                })
            elif not existing:
                planned.append({"arriendo_id": rental_id, "maquinaria_id": machine_id})
            elif existing[0]["maquinaria_id"] == machine_id:
                present.append({
                    "arriendo_item_id": existing[0]["id"],
                    "arriendo_id": rental_id,
                    "maquinaria_id": machine_id,
                })
            else:
                conflicts.append({
                    "code": "EXISTING_ITEM_DIFFERS_FROM_LEGACY_FK",
                    "arriendo_id": rental_id,
                    "arriendo_item_id": existing[0]["id"],
                    "legacy_maquinaria_id": machine_id,
                    "item_maquinaria_id": existing[0]["maquinaria_id"],
                })
        conflicts.sort(key=lambda row: (row["arriendo_id"], row["code"]))
        return {
            "summary": {
                "arriendos_total": len(rentals),
                "deterministic_pairs": len(preflight["deterministic_pairs"]),
                "arriendos_with_null_fk": len(skipped) + sum(
                    conflict["code"] == "EXISTING_ITEM_WITH_NULL_LEGACY_FK"
                    for conflict in conflicts
                ),
                "planned_creations": len(planned),
                "already_present": len(present),
                "conflicts": len(conflicts),
                "arriendo_items_total": len(items),
            },
            "planned_creations": planned,
            "already_present": present,
            "skipped_null_fk_arriendo_ids": skipped,
            "conflicts": conflicts,
        }

    def _apply(self, report_path, manifest_value):
        approved = self._read_json(report_path, "El reporte preflight")
        self._validate_preflight(approved)
        manifest_path = Path(manifest_value)
        if manifest_path.exists():
            raise CommandError("El manifiesto ya existe.")
        if not manifest_path.parent.is_dir():
            raise CommandError("El directorio padre del manifiesto no existe.")

        manifest_created = False
        try:
            with transaction.atomic():
                current, digest = self._current_preflight()
                if approved != current:
                    raise CommandError("El reporte aprobado difiere del preflight actual.")
                plan = self._plan(current, lock=True)
                if plan["conflicts"]:
                    raise CommandError("Existen conflictos bloqueantes de ArriendoItem.")
                created = []
                for pair in plan["planned_creations"]:
                    # The locked state must still contain no item immediately before insert.
                    if ArriendoItem.objects.filter(arriendo_id=pair["arriendo_id"]).exists():
                        raise CommandError("Apareció un conflicto concurrente de ArriendoItem.")
                    item = ArriendoItem.objects.create(**pair)
                    created.append({
                        "arriendo_item_id": item.id,
                        "arriendo_id": item.arriendo_id,
                        "maquinaria_id": item.maquinaria_id,
                    })
                run_id = str(uuid.uuid4())
                manifest = {
                    "schema_version": SCHEMA_VERSION,
                    "command": COMMAND,
                    "run_id": run_id,
                    "preflight_sha256": digest,
                    "created_items": created,
                }
                self._write_manifest(manifest_path, manifest)
                manifest_created = True
            return {
                "schema_version": SCHEMA_VERSION,
                "command": COMMAND,
                "mode": "apply",
                "read_only": False,
                "run_id": run_id,
                "preflight_sha256": digest,
                "summary": {
                    **plan["summary"], "created_items": len(created)
                },
                "created_items": created,
                "already_present": plan["already_present"],
                "skipped_null_fk_arriendo_ids": plan["skipped_null_fk_arriendo_ids"],
                "conflicts": [],
            }
        except Exception:
            if manifest_created:
                try:
                    manifest_path.unlink()
                except OSError:
                    pass
            raise

    @staticmethod
    def _write_manifest(path, manifest):
        payload = (_canonical(manifest) + "\n").encode("utf-8")
        try:
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            try:
                with os.fdopen(descriptor, "wb") as target:
                    target.write(payload)
                    target.flush()
                    os.fsync(target.fileno())
            except Exception:
                try:
                    path.unlink()
                except OSError:
                    pass
                raise
        except OSError as exc:
            raise CommandError("No fue posible crear exclusivamente el manifiesto.") from exc

    def _rollback(self, manifest_path, confirmed_run_id):
        manifest = self._read_json(manifest_path, "El manifiesto")
        self._validate_manifest(manifest)
        if manifest["run_id"] != confirmed_run_id:
            raise CommandError("El run_id confirmado no coincide con el manifiesto.")
        deleted, absent = [], []
        with transaction.atomic():
            ids = [row["arriendo_item_id"] for row in manifest["created_items"]]
            existing = {
                item.id: item
                for item in ArriendoItem.objects.select_for_update().filter(id__in=ids)
            }
            conflicts = []
            for expected in manifest["created_items"]:
                item = existing.get(expected["arriendo_item_id"])
                if item is None:
                    absent.append(expected)
                elif (item.arriendo_id != expected["arriendo_id"]
                      or item.maquinaria_id != expected["maquinaria_id"]):
                    conflicts.append({
                        "code": "MANIFEST_ITEM_MISMATCH",
                        "arriendo_item_id": expected["arriendo_item_id"],
                    })
            if conflicts:
                raise CommandError("El rollback encontró conflictos con el manifiesto.")
            for expected in manifest["created_items"]:
                item = existing.get(expected["arriendo_item_id"])
                if item is not None:
                    item.delete()
                    deleted.append(expected)
        return {
            "schema_version": SCHEMA_VERSION,
            "command": COMMAND,
            "mode": "rollback",
            "read_only": False,
            "run_id": manifest["run_id"],
            "summary": {
                "manifest_items": len(manifest["created_items"]),
                "deleted_items": len(deleted),
                "already_absent_items": len(absent),
                "conflicts": 0,
            },
            "deleted_items": deleted,
            "already_absent_items": absent,
            "conflicts": [],
        }

    @staticmethod
    def _validate_manifest(manifest):
        if set(manifest) != MANIFEST_KEYS:
            raise CommandError("Contrato de manifiesto inválido.")
        if manifest["schema_version"] != SCHEMA_VERSION or manifest["command"] != COMMAND:
            raise CommandError("Identidad de manifiesto inválida.")
        try:
            parsed_uuid = uuid.UUID(manifest["run_id"])
        except (ValueError, TypeError, AttributeError) as exc:
            raise CommandError("UUID de manifiesto inválido.") from exc
        if str(parsed_uuid) != manifest["run_id"]:
            raise CommandError("UUID de manifiesto no canónico.")
        digest = manifest["preflight_sha256"]
        if (not isinstance(digest, str) or len(digest) != 64
                or any(char not in "0123456789abcdef" for char in digest)):
            raise CommandError("SHA-256 de manifiesto inválido.")
        rows = manifest["created_items"]
        if not isinstance(rows, list):
            raise CommandError("Lista de ítems del manifiesto inválida.")
        seen = set()
        previous = None
        for row in rows:
            if (not isinstance(row, dict) or set(row) != ITEM_KEYS
                    or not all(_positive_int(row[key]) for key in ITEM_KEYS)):
                raise CommandError("Ítem de manifiesto inválido.")
            if row["arriendo_item_id"] in seen:
                raise CommandError("El manifiesto contiene IDs duplicados.")
            order_key = (row["arriendo_id"], row["maquinaria_id"], row["arriendo_item_id"])
            if previous is not None and order_key < previous:
                raise CommandError("Los ítems del manifiesto no están ordenados.")
            previous = order_key
            seen.add(row["arriendo_item_id"])
