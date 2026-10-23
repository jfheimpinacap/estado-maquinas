from copy import deepcopy
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from api.models import Arriendo, ArriendoItem, Cliente, Documento, Maquinaria, Obra, OrdenTrabajo
from api.services.rental_writes import validate_singular_machine_selection


class OrderInputContractTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user("p028-staff", is_staff=True)
        self.normal = User.objects.create_user("p028-normal")
        self.client.force_authenticate(self.staff)
        self.customer = Cliente.objects.create(razon_social="Cliente P028", rut="28-0")
        self.machine = Maquinaria.objects.create(marca="P028", serie="P028-1")
        self.other = Maquinaria.objects.create(marca="Otra", serie="P028-2")
        self.work = Obra.objects.create(nombre="Obra existente", direccion="Dirección original")
        self.rental = Arriendo.objects.create(
            maquinaria=self.machine, cliente=self.customer, obra=self.work,
            fecha_inicio="2026-10-01", periodo="Dia", tarifa="1000.00",
        )
        ArriendoItem.objects.create(arriendo=self.rental, maquinaria=self.machine)
        OrdenTrabajo.objects.create(
            arriendo=self.rental, maquinaria=self.machine, cliente=self.customer,
            tipo="ALTA", detalle_lineas=[{"serie": self.machine.serie}],
        )
        Documento.objects.create(
            arriendo=self.rental, tipo="GD", numero="P028", fecha_emision="2026-10-01",
        )

    def payload(self, singular=False, **changes):
        data = {
            "tipo": "ALTA", "meta_cliente": self.customer.razon_social,
            "meta_obra": "Obra nueva P028", "meta_direccion": "Dirección P028",
            "lineas": [{
                "serie": self.machine.serie, "unidad": "Dia", "cantidadPeriodo": 2,
                "desde": "2026-10-23", "hasta": "2026-10-24",
                "valor": "1000.00", "flete": "100.00",
            }],
        }
        if singular:
            data.update(crear_arriendo_item=True, maquinaria_ids=[self.machine.pk])
        data.update(changes)
        return data

    def snapshot(self):
        return {
            model.__name__: list(model.objects.order_by("pk").values())
            for model in (Cliente, Obra, Maquinaria, Arriendo, ArriendoItem, OrdenTrabajo, Documento)
        }

    def assert_rejected_without_writes(self, payload, field, url="/ordenes"):
        before = self.snapshot()
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn(field, response.data)
        self.assertEqual(self.snapshot(), before)

    def test_present_pk_selection_requires_true_opt_in_for_all_types_and_flag_states(self):
        for enabled in (False, True):
            with override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=enabled):
                for kind in ("ALTA", "PROL", "TRAS", "RETI", "RETIRO", "SERV"):
                    for selection in ([self.machine.pk], [], None, False, 0, "", {}):
                        for explicit_false in (False, True):
                            with self.subTest(flag=enabled, kind=kind, selection=selection,
                                              explicit_false=explicit_false):
                                data = self.payload(tipo=kind, maquinaria_ids=selection)
                                if kind in ("RETI", "RETIRO"):
                                    data["arriendo_id"] = self.rental.pk
                                if explicit_false:
                                    data["crear_arriendo_item"] = False
                                self.assert_rejected_without_writes(data, "maquinaria_ids")

    def test_opt_in_remains_strictly_boolean(self):
        for enabled in (False, True):
            with override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=enabled):
                for value in (None, 0, 1, "true", "false", [], {}):
                    with self.subTest(flag=enabled, value=value):
                        self.assert_rejected_without_writes(
                            self.payload(crear_arriendo_item=value), "crear_arriendo_item",
                        )

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_non_object_lines_are_rejected_in_legacy_and_singular(self):
        for singular in (False, True):
            for line in (None, False, True, 0, 42, "", "P028-1", [], ["P028-1"]):
                with self.subTest(singular=singular, line=line):
                    self.assert_rejected_without_writes(
                        self.payload(singular, lineas=[line]), "lineas",
                    )

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_non_string_series_are_rejected_even_when_falsey(self):
        for singular in (False, True):
            for series in (False, True, 0, 1, 1.5, [], ["P028-1"], {}, {"serie": "P028-1"}):
                with self.subTest(singular=singular, series=series):
                    data = self.payload(singular)
                    data["lineas"][0]["serie"] = series
                    self.assert_rejected_without_writes(data, "lineas")

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_invalid_series_are_not_coerced_even_if_their_text_matches_a_machine(self):
        for series in (False, True, 0, 1, 1.5, [], {}):
            machine = Maquinaria.objects.create(marca="Tipo inválido", serie=str(series))
            for singular in (False, True):
                with self.subTest(singular=singular, series=series):
                    data = self.payload(singular)
                    data["lineas"][0]["serie"] = series
                    if singular:
                        data["maquinaria_ids"] = [machine.pk]
                    self.assert_rejected_without_writes(data, "lineas")

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_later_malformed_line_is_validated_before_any_side_effect(self):
        for singular in (False, True):
            for kind in (("ALTA",) if singular else ("ALTA", "PROL", "TRAS", "RETI", "SERV")):
                for malformed in (None, [], {"serie": False}, {"serie": 1}, {"serie": {}}):
                    with self.subTest(singular=singular, kind=kind, malformed=malformed):
                        data = self.payload(singular, tipo=kind)
                        data["lineas"].append(malformed)
                        if kind == "RETI":
                            data["arriendo_id"] = self.rental.pk
                        # RETI would create the company client before its old line loop.
                        self.assert_rejected_without_writes(data, "lineas")

    def test_singular_service_also_validates_series_types(self):
        for series in (False, True, 0, 1, [], {}):
            with self.subTest(series=series):
                before = self.snapshot()
                with self.assertRaises(ValidationError) as error:
                    validate_singular_machine_selection([self.machine.pk], [{"serie": series}])
                self.assertIn("lineas", error.exception.detail)
                self.assertEqual(self.snapshot(), before)

    def test_legacy_omittable_lines_and_trimmed_case_insensitive_series_remain_valid(self):
        for enabled in (False, True):
            with override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=enabled):
                data = self.payload()
                data["lineas"][0]["serie"] = "  p028-1  "
                data["lineas"] = [{}, {"serie": None}, {"serie": ""}, {"serie": "  "}] + data["lineas"]
                before_items = ArriendoItem.objects.count()
                response = self.client.post("/ordenes", data, format="json")
                self.assertEqual(response.status_code, 201, response.data)
                order = OrdenTrabajo.objects.get(pk=response.data["id"])
                self.assertEqual(order.maquinaria_id, self.machine.pk)
                self.assertEqual(order.arriendo.maquinaria_id, self.machine.pk)
                self.assertEqual(len(order.detalle_lineas), 1)
                self.assertEqual(order.detalle_lineas[0]["serie"], "p028-1")
                self.assertEqual(ArriendoItem.objects.count(), before_items)

    def test_legacy_without_any_nonempty_series_keeps_controlled_error(self):
        self.assert_rejected_without_writes(
            self.payload(lineas=[{}, {"serie": None}, {"serie": ""}, {"serie": "  "}]), "detail",
        )

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_singular_still_requires_a_single_nonempty_matching_series(self):
        for lines in ([{}], [{"serie": None}], [{"serie": ""}], [{"serie": " "}],
                      [{"serie": self.other.serie}],
                      [{"serie": self.machine.serie}, {"serie": self.machine.serie}]):
            with self.subTest(lines=lines):
                self.assert_rejected_without_writes(self.payload(True, lineas=lines), "lineas")

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_valid_singular_alta_creates_matching_header_item_and_order(self):
        data = self.payload(True)
        data["lineas"][0]["serie"] = "  p028-1  "
        counts = (Arriendo.objects.count(), ArriendoItem.objects.count(), OrdenTrabajo.objects.count())
        response = self.client.post("/ordenes", data, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((Arriendo.objects.count(), ArriendoItem.objects.count(), OrdenTrabajo.objects.count()),
                         tuple(count + 1 for count in counts))
        order = OrdenTrabajo.objects.get(pk=response.data["id"])
        self.assertEqual(order.maquinaria_id, self.machine.pk)
        self.assertEqual(order.arriendo.maquinaria_id, self.machine.pk)
        self.assertEqual(order.arriendo.items.get().maquinaria_id, self.machine.pk)
        self.assertEqual(order.tipo, "ALTA")

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_singular_failure_rolls_back_new_work_header_item_and_order(self):
        before = self.snapshot()
        with patch("api.services.rental_writes.OrdenTrabajo.objects.create",
                   side_effect=RuntimeError("synthetic P028 failure")):
            with self.assertRaisesRegex(RuntimeError, "synthetic P028 failure"):
                self.client.post("/ordenes", self.payload(True), format="json")
        self.assertEqual(self.snapshot(), before)

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_singular_does_not_enable_other_types_existing_rentals_or_plural_selection(self):
        for changes in ({"tipo": "PROL"}, {"tipo": "TRAS"}, {"tipo": "RETI"}, {"tipo": "SERV"},
                        {"arriendo_id": self.rental.pk}, {"arriendo": self.rental.pk}):
            self.assert_rejected_without_writes(self.payload(True, **changes), "detail")
        for selection in ([], None, [True], [str(self.machine.pk)], [999999],
                          [self.machine.pk, self.machine.pk], [self.machine.pk, self.other.pk]):
            self.assert_rejected_without_writes(
                self.payload(True, maquinaria_ids=selection), "maquinaria_ids",
            )

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=False)
    def test_explicit_opt_in_still_requires_enabled_flag(self):
        self.assert_rejected_without_writes(self.payload(True), "detail")

    def test_direct_rental_selection_has_consistent_opt_in_protection(self):
        base = {"maquinaria": self.machine.pk, "cliente": self.customer.pk,
                "fecha_inicio": "2026-10-23", "periodo": "Dia", "tarifa": "1000.00"}
        for enabled in (False, True):
            with override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=enabled):
                for selection in ([self.machine.pk], [], None):
                    for explicit_false in (False, True):
                        data = deepcopy(base)
                        data["maquinaria_ids"] = selection
                        if explicit_false:
                            data["crear_arriendo_item"] = False
                        self.assert_rejected_without_writes(data, "maquinaria_ids", url="/arriendos")

    @override_settings(ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE=True)
    def test_create_permissions_remain_unchanged(self):
        for user, expected in ((None, 401), (self.normal, 403)):
            self.client.force_authenticate(user)
            for singular in (False, True):
                before = self.snapshot()
                response = self.client.post("/ordenes", self.payload(singular), format="json")
                self.assertEqual(response.status_code, expected)
                self.assertEqual(self.snapshot(), before)
