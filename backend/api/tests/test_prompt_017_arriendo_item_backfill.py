import json
import tempfile
import uuid
from datetime import date
from decimal import Decimal
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from api.models import Arriendo, ArriendoItem, Cliente, Documento, Maquinaria, OrdenTrabajo


class ArriendoItemBackfillTests(TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.customer = Cliente.objects.create(razon_social="Synthetic", rut="17-0")

    def machine(self, suffix):
        return Maquinaria.objects.create(marca="Synthetic", serie=f"P017-{suffix}")

    def rental(self, machine=None, **overrides):
        values = {
            "maquinaria": machine,
            "cliente": self.customer,
            "fecha_inicio": date(2026, 1, 1),
            "periodo": "Dia",
            "tarifa": Decimal("10.00"),
            "estado": "Activo",
        }
        values.update(overrides)
        return Arriendo.objects.create(**values)

    def command(self, *args):
        output = StringIO()
        call_command("backfill_arriendo_items", *args, stdout=output)
        return output.getvalue(), json.loads(output.getvalue())

    def approved_report(self, name="approved.json"):
        output = StringIO()
        call_command("multi_machine_preflight", stdout=output)
        path = self.root / name
        path.write_text(output.getvalue(), encoding="utf-8")
        return path, json.loads(output.getvalue())

    def apply(self, report, manifest):
        return self.command(
            "--apply", "--preflight-report", str(report), "--manifest", str(manifest)
        )

    def rollback(self, manifest, run_id):
        return self.command(
            "--rollback", "--manifest", str(manifest), "--confirm-run-id", run_id
        )

    def test_default_plan_is_compact_deterministic_read_only(self):
        machine = self.machine("A")
        rental = self.rental(machine)
        skipped = self.rental()
        before = (list(Arriendo.objects.values()), list(ArriendoItem.objects.values()))
        with CaptureQueriesContext(connection) as captured:
            raw, report = self.command()
        second_raw, second = self.command()

        self.assertEqual(raw, second_raw)
        self.assertEqual(report, second)
        self.assertTrue(raw.endswith("\n"))
        self.assertEqual(raw.strip(), json.dumps(report, sort_keys=True, separators=(",", ":")))
        self.assertEqual((report["mode"], report["read_only"]), ("plan", True))
        self.assertEqual(report["planned_creations"], [{
            "arriendo_id": rental.id, "maquinaria_id": machine.id
        }])
        self.assertEqual(report["skipped_null_fk_arriendo_ids"], [skipped.id])
        self.assertEqual(before, (list(Arriendo.objects.values()), list(ArriendoItem.objects.values())))
        mutating = ("INSERT", "UPDATE", "DELETE", "ALTER", "DROP", "CREATE")
        self.assertFalse([q["sql"] for q in captured.captured_queries
                          if q["sql"].lstrip().upper().startswith(mutating)])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_invalid_mode_combinations_fail_without_writes(self):
        invalid = [
            ("--apply", "--rollback"),
            ("--apply",),
            ("--rollback",),
            ("--manifest", str(self.root / "x")),
            ("--preflight-report", str(self.root / "x")),
            ("--confirm-run-id", str(uuid.uuid4())),
        ]
        for args in invalid:
            with self.subTest(args=args), self.assertRaises(CommandError):
                self.command(*args)
        self.assertFalse(ArriendoItem.objects.exists())

    def test_existing_item_classification_and_conflicts_are_sorted(self):
        first, second = self.machine("A"), self.machine("B")
        matching = self.rental(first)
        matched_item = ArriendoItem.objects.create(arriendo=matching, maquinaria=first)
        divergent = self.rental(first)
        wrong = ArriendoItem.objects.create(arriendo=divergent, maquinaria=second)
        null = self.rental()
        null_item = ArriendoItem.objects.create(arriendo=null, maquinaria=second)
        multiple = self.rental(first)
        multiple_items = [
            ArriendoItem.objects.create(arriendo=multiple, maquinaria=first),
            ArriendoItem.objects.create(arriendo=multiple, maquinaria=first),
        ]

        _, report = self.command()

        self.assertEqual(report["already_present"], [{
            "arriendo_item_id": matched_item.id,
            "arriendo_id": matching.id,
            "maquinaria_id": first.id,
        }])
        self.assertEqual([row["code"] for row in report["conflicts"]], [
            "EXISTING_ITEM_DIFFERS_FROM_LEGACY_FK",
            "EXISTING_ITEM_WITH_NULL_LEGACY_FK",
            "MULTIPLE_EXISTING_ITEMS_FOR_ARRENDO",
        ])
        self.assertEqual(report["conflicts"][0]["arriendo_item_id"], wrong.id)
        self.assertEqual(report["conflicts"][1]["arriendo_item_ids"], [null_item.id])
        self.assertEqual(report["conflicts"][2]["arriendo_item_ids"],
                         [item.id for item in multiple_items])

    def test_only_legacy_fk_drives_creation_and_manual_findings_are_preserved(self):
        legacy, other = self.machine("LEGACY"), self.machine("OTHER")
        rental = self.rental(legacy)
        null = self.rental()
        order = OrdenTrabajo.objects.create(
            arriendo=rental, maquinaria=other, cliente=self.customer, tipo="ALTA",
            detalle_lineas=[
                {"serie": other.serie}, {"serie": "DOES-NOT-EXIST"},
                {"serie": other.serie},
            ],
        )
        OrdenTrabajo.objects.create(
            arriendo=null, maquinaria=other, cliente=self.customer, tipo="ALTA",
            detalle_lineas=[{"serie": other.serie}],
        )
        report_path, approved = self.approved_report()
        manifest = self.root / "manifest.json"
        before_lines = order.detalle_lineas

        _, result = self.apply(report_path, manifest)

        self.assertEqual(result["created_items"][0]["arriendo_id"], rental.id)
        self.assertEqual(result["created_items"][0]["maquinaria_id"], legacy.id)
        self.assertEqual(ArriendoItem.objects.count(), 1)
        self.assertEqual(Maquinaria.objects.count(), 2)
        self.assertEqual(result["skipped_null_fk_arriendo_ids"], [null.id])
        self.assertTrue(approved["manual_review"])
        order.refresh_from_db()
        self.assertEqual(order.detalle_lineas, before_lines)

    def test_approved_report_contract_and_full_divergence_validation(self):
        self.rental(self.machine("A"))
        malformed = self.root / "bad.json"
        malformed.write_text("not-json", encoding="utf-8")
        for content in (
            None,
            {"schema_version": 2, "read_only": True, "deterministic_pairs": []},
            {"schema_version": 1, "read_only": False, "deterministic_pairs": []},
            {"schema_version": 1, "read_only": True,
             "deterministic_pairs": [{"arriendo_id": 1, "maquinaria_id": 1}] * 2},
            {"schema_version": 1, "read_only": True,
             "deterministic_pairs": [{"arriendo_id": True, "maquinaria_id": 1}]},
        ):
            if content is not None:
                malformed.write_text(json.dumps(content), encoding="utf-8")
            with self.subTest(content=content), self.assertRaises(CommandError):
                self.apply(malformed, self.root / f"m-{uuid.uuid4()}.json")

        valid, report = self.approved_report("valid.json")
        report["summary"]["manual_review_findings"] += 1
        valid.write_text(json.dumps(report, indent=2), encoding="utf-8")
        with self.assertRaises(CommandError):
            self.apply(valid, self.root / "divergent.json")
        self.assertFalse(ArriendoItem.objects.exists())

    def test_apply_manifest_contract_and_domain_preservation(self):
        machine = self.machine("A")
        rental = self.rental(machine)
        order = OrdenTrabajo.objects.create(
            arriendo=rental, maquinaria=machine, cliente=self.customer,
            tipo="ALTA", detalle_lineas=[{"serie": machine.serie}],
        )
        document = Documento.objects.create(
            tipo="GD", numero="SYNTHETIC", fecha_emision=date(2026, 1, 2),
            arriendo=rental, cliente=self.customer, monto_total=Decimal("20.00"),
        )
        snapshots = {
            "rental": Arriendo.objects.values().get(pk=rental.pk),
            "machine": Maquinaria.objects.values().get(pk=machine.pk),
            "order": OrdenTrabajo.objects.values().get(pk=order.pk),
            "document": Documento.objects.values().get(pk=document.pk),
        }
        approved, _ = self.approved_report()
        manifest_path = self.root / "manifest.json"

        raw, result = self.apply(approved, manifest_path)
        manifest_raw = manifest_path.read_text(encoding="utf-8")
        manifest = json.loads(manifest_raw)

        self.assertEqual(result["created_items"], manifest["created_items"])
        self.assertEqual(set(manifest), {
            "schema_version", "command", "run_id", "preflight_sha256", "created_items"
        })
        uuid.UUID(manifest["run_id"])
        self.assertEqual(manifest["preflight_sha256"], result["preflight_sha256"])
        self.assertEqual(manifest_raw,
                         json.dumps(manifest, sort_keys=True, separators=(",", ":")) + "\n")
        self.assertNotIn(machine.serie, manifest_raw)
        self.assertNotIn("detalle_lineas", manifest_raw)
        self.assertEqual(raw.strip(), json.dumps(result, sort_keys=True, separators=(",", ":")))
        self.assertEqual(snapshots["rental"], Arriendo.objects.values().get(pk=rental.pk))
        self.assertEqual(snapshots["machine"], Maquinaria.objects.values().get(pk=machine.pk))
        self.assertEqual(snapshots["order"], OrdenTrabajo.objects.values().get(pk=order.pk))
        self.assertEqual(snapshots["document"], Documento.objects.values().get(pk=document.pk))

    def test_apply_is_idempotent_and_preexisting_item_is_never_manifested(self):
        first, second = self.machine("A"), self.machine("B")
        first_rental, second_rental = self.rental(first), self.rental(second)
        preexisting = ArriendoItem.objects.create(arriendo=first_rental, maquinaria=first)
        approved, _ = self.approved_report()
        first_manifest = self.root / "first.json"
        _, first_result = self.apply(approved, first_manifest)
        created_pk = first_result["created_items"][0]["arriendo_item_id"]
        second_manifest = self.root / "second.json"

        _, second_result = self.apply(approved, second_manifest)

        self.assertEqual(second_result["created_items"], [])
        self.assertEqual(json.loads(second_manifest.read_text())["created_items"], [])
        self.assertEqual(ArriendoItem.objects.count(), 2)
        self.assertTrue(ArriendoItem.objects.filter(pk=created_pk).exists())
        self.assertNotIn(preexisting.id, [row["arriendo_item_id"]
                                         for row in first_result["created_items"]])
        _, rollback = self.rollback(first_manifest, first_result["run_id"])
        self.assertEqual(rollback["deleted_items"], first_result["created_items"])
        self.assertTrue(ArriendoItem.objects.filter(pk=preexisting.id).exists())
        self.assertFalse(ArriendoItem.objects.filter(arriendo=second_rental).exists())

    def test_conflict_blocks_entire_application(self):
        first, second = self.machine("A"), self.machine("B")
        self.rental(first)
        conflict = self.rental(first)
        ArriendoItem.objects.create(arriendo=conflict, maquinaria=second)
        approved, _ = self.approved_report()
        with self.assertRaises(CommandError):
            self.apply(approved, self.root / "manifest.json")
        self.assertEqual(ArriendoItem.objects.count(), 1)
        self.assertFalse((self.root / "manifest.json").exists())

    def test_creation_failure_rolls_back_prior_creation(self):
        self.rental(self.machine("A"))
        self.rental(self.machine("B"))
        approved, _ = self.approved_report()
        original = ArriendoItem.objects.create
        calls = 0

        def failing_create(**kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise RuntimeError("controlled")
            return original(**kwargs)

        with patch("api.management.commands.backfill_arriendo_items.ArriendoItem.objects.create",
                   side_effect=failing_create), self.assertRaises(RuntimeError):
            self.apply(approved, self.root / "manifest.json")
        self.assertFalse(ArriendoItem.objects.exists())
        self.assertFalse((self.root / "manifest.json").exists())

    def test_manifest_failure_rolls_back_and_never_overwrites(self):
        self.rental(self.machine("A"))
        approved, _ = self.approved_report()
        existing = self.root / "existing.json"
        existing.write_text("preserve", encoding="utf-8")
        with self.assertRaises(CommandError):
            self.apply(approved, existing)
        self.assertEqual(existing.read_text(encoding="utf-8"), "preserve")

        missing_parent = self.root / "missing" / "manifest.json"
        with self.assertRaises(CommandError):
            self.apply(approved, missing_parent)
        self.assertFalse(ArriendoItem.objects.exists())

        with patch("api.management.commands.backfill_arriendo_items.Command._write_manifest",
                   side_effect=CommandError("controlled")), self.assertRaises(CommandError):
            self.apply(approved, self.root / "write-failure.json")
        self.assertFalse(ArriendoItem.objects.exists())

    def test_rollback_is_exact_and_idempotent(self):
        first, second = self.machine("A"), self.machine("B")
        first_rental, second_rental = self.rental(first), self.rental(second)
        preexisting = ArriendoItem.objects.create(arriendo=first_rental, maquinaria=first)
        approved, _ = self.approved_report()
        manifest = self.root / "manifest.json"
        _, applied = self.apply(approved, manifest)
        rental_count, machine_count = Arriendo.objects.count(), Maquinaria.objects.count()

        _, rolled_back = self.rollback(manifest, applied["run_id"])
        self.assertEqual(rolled_back["deleted_items"], applied["created_items"])
        self.assertTrue(ArriendoItem.objects.filter(pk=preexisting.id).exists())
        self.assertFalse(ArriendoItem.objects.filter(arriendo=second_rental).exists())
        self.assertEqual((Arriendo.objects.count(), Maquinaria.objects.count()),
                         (rental_count, machine_count))
        first_rental.refresh_from_db()
        self.assertEqual(first_rental.maquinaria_id, first.id)

        _, repeated = self.rollback(manifest, applied["run_id"])
        self.assertEqual(repeated["deleted_items"], [])
        self.assertEqual(repeated["already_absent_items"], applied["created_items"])

    def test_rollback_rejects_invalid_uuid_manifest_and_mismatched_row_atomically(self):
        self.rental(self.machine("A"))
        self.rental(self.machine("B"))
        approved, _ = self.approved_report()
        manifest_path = self.root / "manifest.json"
        _, applied = self.apply(approved, manifest_path)
        with self.assertRaises(CommandError):
            self.rollback(manifest_path, str(uuid.uuid4()))
        self.assertEqual(ArriendoItem.objects.count(), 2)

        bad = self.root / "bad.json"
        bad.write_text("{}", encoding="utf-8")
        with self.assertRaises(CommandError):
            self.rollback(bad, applied["run_id"])

        first_created = applied["created_items"][0]
        ArriendoItem.objects.filter(pk=first_created["arriendo_item_id"]).update(
            maquinaria=self.machine("CHANGED")
        )
        with self.assertRaises(CommandError):
            self.rollback(manifest_path, applied["run_id"])
        self.assertEqual(ArriendoItem.objects.count(), 2)

    def test_rollback_tolerates_an_already_absent_row(self):
        self.rental(self.machine("A"))
        self.rental(self.machine("B"))
        approved, _ = self.approved_report()
        manifest = self.root / "manifest.json"
        _, applied = self.apply(approved, manifest)
        absent = applied["created_items"][0]
        ArriendoItem.objects.get(pk=absent["arriendo_item_id"]).delete()

        _, result = self.rollback(manifest, applied["run_id"])

        self.assertEqual(result["already_absent_items"], [absent])
        self.assertEqual(len(result["deleted_items"]), 1)
        self.assertFalse(ArriendoItem.objects.exists())

    def test_legacy_creations_remain_without_dual_write(self):
        machine = self.machine("A")
        rental = self.rental(machine)
        OrdenTrabajo.objects.create(
            arriendo=rental, maquinaria=machine, cliente=self.customer,
            tipo="ALTA", detalle_lineas=[{"serie": machine.serie}],
        )
        self.assertFalse(ArriendoItem.objects.exists())
        self.assertNotIn("save", ArriendoItem.__dict__)
