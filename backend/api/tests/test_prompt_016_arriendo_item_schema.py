import json
from datetime import date
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.db import IntegrityError, connection, migrations, models, transaction
from django.db.migrations.executor import MigrationExecutor
from django.db.models.deletion import ProtectedError
from django.test import TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext

from api.models import Arriendo, ArriendoItem, Cliente, Maquinaria, OrdenTrabajo


class ArriendoItemSchemaTests(TestCase):
    def setUp(self):
        self.customer = Cliente.objects.create(razon_social="Customer", rut="16-0")
        self.first_machine = Maquinaria.objects.create(marca="Brand", serie="P016-A")
        self.second_machine = Maquinaria.objects.create(marca="Brand", serie="P016-B")
        self.rental = self.make_rental(self.first_machine)

    def make_rental(self, machine):
        return Arriendo.objects.create(
            maquinaria=machine,
            cliente=self.customer,
            fecha_inicio=date.today(),
            periodo="Dia",
            tarifa=Decimal("1.00"),
        )

    def test_model_contract_is_minimal_and_non_unique(self):
        self.assertEqual(ArriendoItem._meta.db_table, "ArriendoItem")
        self.assertIsInstance(ArriendoItem._meta.pk, models.BigAutoField)
        self.assertEqual(
            {field.name for field in ArriendoItem._meta.local_fields},
            {"id", "arriendo", "maquinaria"},
        )

        arriendo = ArriendoItem._meta.get_field("arriendo")
        maquinaria = ArriendoItem._meta.get_field("maquinaria")
        for field, target, related_name in (
            (arriendo, Arriendo, "items"),
            (maquinaria, Maquinaria, "arriendo_items"),
        ):
            self.assertIsInstance(field, models.ForeignKey)
            self.assertIs(field.remote_field.model, target)
            self.assertFalse(field.null)
            self.assertFalse(field.blank)
            self.assertIs(field.remote_field.on_delete, models.PROTECT)
            self.assertEqual(field.remote_field.related_name, related_name)

        index = next(i for i in ArriendoItem._meta.indexes if i.name == "arri_item_arr_maq_idx")
        self.assertEqual(index.fields, ["arriendo", "maquinaria"])
        self.assertFalse(index.condition)
        self.assertFalse(ArriendoItem._meta.unique_together)
        self.assertFalse(ArriendoItem._meta.constraints)

    def test_many_relations_duplicates_and_reverse_accessors_are_allowed(self):
        first = ArriendoItem.objects.create(arriendo=self.rental, maquinaria=self.first_machine)
        second = ArriendoItem.objects.create(arriendo=self.rental, maquinaria=self.second_machine)
        duplicate = ArriendoItem.objects.create(arriendo=self.rental, maquinaria=self.first_machine)
        another_rental = self.make_rental(self.first_machine)
        other_header = ArriendoItem.objects.create(
            arriendo=another_rental, maquinaria=self.first_machine
        )

        self.assertEqual(set(self.rental.items.all()), {first, second, duplicate})
        self.assertEqual(
            set(self.first_machine.arriendo_items.all()), {first, duplicate, other_header}
        )

    def test_both_foreign_keys_are_required(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            ArriendoItem.objects.create(maquinaria=self.first_machine)
        with self.assertRaises(IntegrityError), transaction.atomic():
            ArriendoItem.objects.create(arriendo=self.rental)

    def test_relations_are_protected_and_item_deletion_is_not_cascading(self):
        item = ArriendoItem.objects.create(arriendo=self.rental, maquinaria=self.first_machine)
        with self.assertRaises(ProtectedError):
            self.rental.delete()
        with self.assertRaises(ProtectedError):
            self.first_machine.delete()

        rental_id, machine_id = self.rental.pk, self.first_machine.pk
        item.delete()
        self.assertTrue(Arriendo.objects.filter(pk=rental_id).exists())
        self.assertTrue(Maquinaria.objects.filter(pk=machine_id).exists())

    def test_legacy_creations_and_detail_lines_do_not_create_or_sync_items(self):
        self.assertFalse(ArriendoItem.objects.exists())
        order = OrdenTrabajo.objects.create(
            arriendo=self.rental,
            maquinaria=self.first_machine,
            cliente=self.customer,
            tipo="ALTA",
            detalle_lineas=[{"serie": self.first_machine.serie}],
        )
        self.assertFalse(ArriendoItem.objects.exists())

        item = ArriendoItem.objects.create(arriendo=self.rental, maquinaria=self.second_machine)
        self.rental.refresh_from_db()
        order.refresh_from_db()
        self.first_machine.refresh_from_db()
        self.assertEqual(self.rental.maquinaria_id, self.first_machine.pk)
        self.assertEqual(order.maquinaria_id, self.first_machine.pk)
        self.assertEqual(self.first_machine.estado, "Disponible")
        self.assertEqual(self.rental.estado, "Activo")
        self.assertEqual(item.maquinaria_id, self.second_machine.pk)
        self.assertNotIn("save", ArriendoItem.__dict__)
        self.assertNotIn("delete", ArriendoItem.__dict__)

    def test_preflight_ignores_items_and_remains_deterministic_and_read_only(self):
        ArriendoItem.objects.create(arriendo=self.rental, maquinaria=self.second_machine)
        before = list(ArriendoItem.objects.values())

        def report():
            output = StringIO()
            call_command("multi_machine_preflight", stdout=output)
            return output.getvalue(), json.loads(output.getvalue())

        with CaptureQueriesContext(connection) as captured:
            first_raw, first = report()
        second_raw, second = report()
        self.assertEqual(first_raw, second_raw)
        self.assertEqual(first, second)
        self.assertEqual(first["deterministic_pairs"], [
            {"arriendo_id": self.rental.pk, "maquinaria_id": self.first_machine.pk}
        ])
        self.assertEqual(before, list(ArriendoItem.objects.values()))
        mutating = ("INSERT", "UPDATE", "DELETE", "ALTER", "DROP", "CREATE")
        self.assertFalse([
            query["sql"] for query in captured.captured_queries
            if query["sql"].lstrip().upper().startswith(mutating)
        ])


class ArriendoItemMigrationTests(TransactionTestCase):
    reset_sequences = True
    previous = ("api", "0007_ordentrabajo_fecha_emision_doc_and_more")
    current = ("api", "0008_add_arriendo_item_schema")

    def test_migration_is_additive_and_reversible(self):
        executor = MigrationExecutor(connection)
        try:
            executor.migrate([self.previous])
            old_apps = executor.loader.project_state([self.previous]).apps
            Customer = old_apps.get_model("api", "Cliente")
            Machine = old_apps.get_model("api", "Maquinaria")
            Rental = old_apps.get_model("api", "Arriendo")
            customer = Customer.objects.create(razon_social="Legacy", rut="16-M")
            machine = Machine.objects.create(marca="Legacy")
            rental = Rental.objects.create(
                maquinaria=machine,
                cliente=customer,
                fecha_inicio=date.today(),
                periodo="Dia",
                tarifa=Decimal("1.00"),
            )
            rental_id = rental.pk
            tables_before = set(connection.introspection.table_names())
            self.assertNotIn("ArriendoItem", tables_before)

            executor = MigrationExecutor(connection)
            executor.migrate([self.current])
            new_apps = executor.loader.project_state([self.current]).apps
            NewRental = new_apps.get_model("api", "Arriendo")
            Item = new_apps.get_model("api", "ArriendoItem")
            self.assertTrue(NewRental.objects.filter(pk=rental_id).exists())
            self.assertIn("ArriendoItem", connection.introspection.table_names())
            self.assertEqual(Item.objects.count(), 0)

            executor = MigrationExecutor(connection)
            executor.migrate([self.previous])
            reverted_apps = executor.loader.project_state([self.previous]).apps
            RevertedRental = reverted_apps.get_model("api", "Arriendo")
            self.assertTrue(RevertedRental.objects.filter(pk=rental_id).exists())
            self.assertNotIn("ArriendoItem", connection.introspection.table_names())
            self.assertEqual(set(connection.introspection.table_names()), tables_before)
        finally:
            MigrationExecutor(connection).migrate([self.current])

    def test_migration_contains_only_create_model_schema_operation(self):
        migration = MigrationExecutor(connection).loader.get_migration(*self.current)
        self.assertEqual(migration.dependencies, [self.previous])
        self.assertEqual(len(migration.operations), 1)
        self.assertIsInstance(migration.operations[0], migrations.CreateModel)
        self.assertFalse(any(
            isinstance(operation, (migrations.RunPython, migrations.RunSQL))
            for operation in migration.operations
        ))
