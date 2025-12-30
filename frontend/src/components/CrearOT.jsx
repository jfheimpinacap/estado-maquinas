// src/components/CrearOT.jsx
import { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

const TIPO_OT = [
  { value: "ALTA", label: "Arriendo" },
  { value: "SERV", label: "Venta" },
  { value: "TRAS", label: "Traslado" },
  { value: "RETI", label: "Retiro" }, // backend usa "RETI"
];

const UNIDADES = [
  { value: "Dia", label: "Día" },
  { value: "Semana", label: "Semana" },
  { value: "Mes", label: "Mes (30 días corridos)" },
  { value: "Especial", label: "Arriendo especial (manual)" },
];

const TIPO_FLETE = [
  { value: "entrega_retiro", label: "Entrega y retiro" },
  { value: "solo_traslado", label: "Solo traslado" },
];

// Datos fijos para OT de RETIRO (cliente = nuestra empresa)
const CLIENTE_EMPRESA = {
  rut: "16.357.179-K",
  razon: "Franz Heim SPA",
  direccion: "Bodega 4061, Macul",
};

function nuevaLinea() {
  return {
    id: `${Date.now()}-${Math.random()}`,
    serie: "",
    maquinaInfo: null, // {marca, modelo, altura}
    unidad: "Dia",
    cantidadPeriodo: 1,
    desde: "",
    hasta: "",
    valor: "",
    flete: "",
    tipoFlete: "entrega_retiro",
  };
}

function aplicarPresetLineaRetiro(it) {
  return {
    ...it,
    unidad: "Dia",
    cantidadPeriodo: 1,
    desde: "",
    hasta: "",
    valor: "0",
    flete: "0",
    tipoFlete: "solo_traslado",
  };
}

// =========================
//  Utilidades RUT
// =========================
function normalizeRutNumberOnly(value) {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  return digits.length ? digits : "";
}

function formatRutFromClean(clean) {
  if (!clean) return "";
  const up = clean.toUpperCase();
  if (up.length <= 1) return up;

  const cuerpo = up.slice(0, -1);
  const dv = up.slice(-1);

  const rev = cuerpo.split("").reverse();
  let conPuntos = "";
  for (let i = 0; i < rev.length; i++) {
    if (i > 0 && i % 3 === 0) conPuntos = "." + conPuntos;
    conPuntos = rev[i] + conPuntos;
  }
  return `${conPuntos}-${dv}`;
}

function formatRutOnType(value) {
  const trimmed = value.replace(/\s+/g, "").toUpperCase();
  const letrasNoRut = trimmed.replace(/[0-9.\-K]/g, "");
  if (letrasNoRut.length > 0) return value;

  const clean = trimmed.replace(/[^0-9K]/g, "");
  if (!clean) return "";
  return formatRutFromClean(clean);
}

// Cálculo fechas incluyendo el día inicial
function calcularHasta(desdeStr, unidad, cantidad) {
  if (!desdeStr || !cantidad || cantidad <= 0) return "";
  if (unidad === "Especial") return "";

  const [y, m, d] = desdeStr.split("-").map(Number);
  if (!y || !m || !d) return "";

  const base = new Date(y, m - 1, d);
  let diasAgregar = 0;

  if (unidad === "Dia") diasAgregar = cantidad - 1;
  else if (unidad === "Semana") diasAgregar = cantidad * 7 - 1;
  else if (unidad === "Mes") diasAgregar = cantidad * 30 - 1;
  else return "";

  base.setDate(base.getDate() + diasAgregar);

  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function CrearOT() {
  const { auth, backendURL } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [saving, setSaving] = useState(false);

  // "NUEVA" | "RETIRO" | "EDITAR"
  const [modo, setModo] = useState("NUEVA");

  // 🔹 OT actual (para eliminar)
  const [otId, setOtId] = useState(null);
  const [otTieneDocs, setOtTieneDocs] = useState(false); // guía o factura

  // N° de OT sugerido (solo UI)
  const [otNumero, setOtNumero] = useState("");

  // Datos generales OT
  const [tipo, setTipo] = useState("ALTA");
  const [fechaEmision, setFechaEmision] = useState(""); // para guía / retiro
  const [clienteTerm, setClienteTerm] = useState("");
  const [ordenCompra, setOrdenCompra] = useState("");
  const [obra, setObra] = useState("");
  const [direccion, setDireccion] = useState("");
  const [contactos, setContactos] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // 🔹 Arriendo asociado (para RETIRO)
  const [arriendoId, setArriendoId] = useState(null);

  // Autocomplete cliente
  const [clienteSugerencias, setClienteSugerencias] = useState([]);
  const [clienteBuscando, setClienteBuscando] = useState(false);

  // Modal de búsqueda de clientes
  const [clienteModalOpen, setClienteModalOpen] = useState(false);
  const [clienteModalTerm, setClienteModalTerm] = useState("");
  const [clienteModalResultados, setClienteModalResultados] = useState([]);
  const [clienteModalLoading, setClienteModalLoading] = useState(false);

  // Líneas de máquinas
  const [items, setItems] = useState([nuevaLinea()]);

  // --------- MODAL DE MÁQUINAS DISPONIBLES ---------
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLineaId, setModalLineaId] = useState(null);
  const [maquinasDisponibles, setMaquinasDisponibles] = useState([]);
  const [maquinaSeleccionadaId, setMaquinaSeleccionadaId] = useState(null);

  const usedSeries = useMemo(
    () => items.map((it) => (it.serie || "").trim()).filter(Boolean),
    [items]
  );

  const listasPorCategoria = useMemo(() => {
    const base = Array.isArray(maquinasDisponibles) ? maquinasDisponibles : [];
    const filtradas = base.filter(
      (m) => !usedSeries.includes((m.serie || "").trim())
    );

    return {
      elevadores: filtradas.filter((m) => m.categoria === "equipos_altura"),
      camiones: filtradas.filter((m) => m.categoria === "camiones"),
      otras: filtradas.filter(
        (m) => m.categoria !== "equipos_altura" && m.categoria !== "camiones"
      ),
    };
  }, [maquinasDisponibles, usedSeries]);

  const abrirModalParaLinea = async (idLinea) => {
    setModalLineaId(idLinea);
    setMaquinaSeleccionadaId(null);
    setModalOpen(true);

    try {
      const res = await authFetch(`${backendURL}/maquinarias`, {
        token: auth?.access,
        refreshToken: auth?.refresh,
        backendURL,
      });
      if (!res.ok) throw new Error("Error al cargar maquinarias");
      const data = await res.json();
      setMaquinasDisponibles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar máquinas disponibles.");
      setMaquinasDisponibles([]);
    }
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setModalLineaId(null);
    setMaquinaSeleccionadaId(null);
  };

  const confirmarSeleccionMaquina = () => {
    if (!modalLineaId || !maquinaSeleccionadaId) {
      toast.info("Debes seleccionar una máquina.");
      return;
    }
    const m = maquinasDisponibles.find((x) => x.id === maquinaSeleccionadaId);
    if (!m) {
      toast.error("No se encontró la máquina seleccionada.");
      return;
    }

    setItems((prev) =>
      prev.map((it) =>
        it.id === modalLineaId
          ? {
              ...it,
              serie: m.serie || "",
              maquinaInfo: {
                marca: m.marca,
                modelo: m.modelo,
                altura: m.altura,
              },
            }
          : it
      )
    );
    cerrarModal();
  };

  // --------- Cambio de TIPO OT (incluye Retiro) ---------
  const handleChangeTipo = (nuevoTipo) => {
    setTipo(nuevoTipo);

    if (nuevoTipo === "RETI") {
      // Cliente/dirección SIEMPRE fijos para RETIRO
      setClienteTerm(`${CLIENTE_EMPRESA.rut} – ${CLIENTE_EMPRESA.razon}`);
      setDireccion(CLIENTE_EMPRESA.direccion);
      setContactos("");

      // Forzar preset de líneas
      setItems((prev) =>
        (prev && prev.length ? prev : [nuevaLinea()]).map((it) =>
          aplicarPresetLineaRetiro(it)
        )
      );
      return;
    }
  };

  // --------- HANDLERS LÍNEAS ---------
  const handleChangeItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };

        // Si es RETIRO, no calculamos fechas/periodos (se ocultan igual)
        if (tipo === "RETI") return updated;

        if (["unidad", "cantidadPeriodo", "desde"].includes(field)) {
          const unidadActual = field === "unidad" ? value : updated.unidad;
          if (unidadActual !== "Especial") {
            const cantidad =
              field === "cantidadPeriodo"
                ? Number(value) || 0
                : Number(updated.cantidadPeriodo) || 0;
            updated.hasta = calcularHasta(updated.desde, unidadActual, cantidad);
          }
        }

        return updated;
      })
    );
  };

  const addLinea = () => {
    setItems((prev) => {
      const n = nuevaLinea();
      return [...prev, tipo === "RETI" ? aplicarPresetLineaRetiro(n) : n];
    });
  };

  const removeLinea = (id) => {
    setItems((prev) =>
      prev.length === 1 ? prev : prev.filter((it) => it.id !== id)
    );
  };

  // --------- BÚSQUEDA POR SERIE (validación manual) ---------
  const buscarMaquinaPorSerie = async (idLinea) => {
    const linea = items.find((it) => it.id === idLinea);
    if (!linea) return;
    const serie = (linea.serie || "").trim();
    if (!serie) return;

    try {
      const url = `${backendURL}/maquinarias?query=${encodeURIComponent(serie)}`;
      const res = await authFetch(url, {
        token: auth?.access,
        refreshToken: auth?.refresh,
        backendURL,
      });
      if (!res.ok) throw new Error("Error al buscar maquinarias");
      let data = await res.json();
      if (!Array.isArray(data)) data = [];

      const exact = data.find(
        (m) => String(m.serie || "").toLowerCase() === serie.toLowerCase()
      );

      if (!exact) {
        toast.warn("No se encontró ninguna máquina con esa serie.");
        setItems((prev) =>
          prev.map((it) => (it.id === idLinea ? { ...it, maquinaInfo: null } : it))
        );
        return;
      }

      setItems((prev) =>
        prev.map((it) =>
          it.id === idLinea
            ? {
                ...it,
                maquinaInfo: {
                  marca: exact.marca,
                  modelo: exact.modelo,
                  altura: exact.altura,
                },
              }
            : it
        )
      );
      toast.success("Máquina encontrada.");
    } catch (e) {
      console.error(e);
      toast.error("Error al validar la serie de la máquina.");
    }
  };

  // --------- RESÚMENES ---------
  const resumenPorLinea = (it) => {
    const valor = parseFloat(it.valor || "0") || 0;
    const flete = parseFloat(it.flete || "0") || 0;
    const neto = valor + flete;
    const iva = Math.round(neto * 0.19 * 100) / 100;
    const total = Math.round((neto + iva) * 100) / 100;
    return { neto, iva, total };
  };

  const resumenGlobal = useMemo(() => {
    return items.reduce(
      (acc, it) => {
        const { neto, iva, total } = resumenPorLinea(it);
        acc.neto += neto;
        acc.iva += iva;
        acc.total += total;
        return acc;
      },
      { neto: 0, iva: 0, total: 0 }
    );
  }, [items]);

  // --------- RESET (para salir de RETIRO o luego de eliminar) ---------
  const resetFormulario = () => {
    setModo("NUEVA");
    setTipo("ALTA");
    setFechaEmision("");
    setClienteTerm("");
    setOrdenCompra("");
    setObra("");
    setDireccion("");
    setContactos("");
    setObservaciones("");
    setItems([nuevaLinea()]);
    setClienteSugerencias([]);
    setArriendoId(null);

    setOtId(null);
    setOtTieneDocs(false);

    try {
      localStorage.removeItem("ot_borrador_retiro");
      localStorage.removeItem("ot_editar_ot");
    } catch {}
  };

  // --------- Inicializar desde URL + localStorage (EDITAR / RETIRO) ---------
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tipoUrl = (params.get("tipo") || "").toUpperCase().trim();
    const quiereRetiro = tipoUrl === "RETIRO" || tipoUrl === "RETI";

    // 1) Intentar cargar OT a editar
    try {
      const rawEdit = localStorage.getItem("ot_editar_ot");
      if (rawEdit) {
        const ot = JSON.parse(rawEdit);
        localStorage.removeItem("ot_editar_ot");

        setModo("EDITAR");
        setOtId(ot.id ?? null);
        setOtTieneDocs(Boolean(ot.guia) || Boolean(ot.factura));

        handleChangeTipo(ot.tipo || "ALTA");

        const rutCli = ot.rut_cliente || ot.cliente_rut || "";
        const razonCli = ot.cliente_razon_social || ot.cliente_nombre || "";
        if (rutCli || razonCli) {
          setClienteTerm(
            rutCli && razonCli ? `${rutCli} – ${razonCli}` : rutCli || razonCli
          );
        } else if (ot.meta_cliente) {
          setClienteTerm(ot.meta_cliente);
        }

        setOrdenCompra(ot.orden_compra || ot.oc || "");
        setObra(ot.obra_nombre || ot.meta_obra || "");
        setDireccion(ot.direccion || ot.meta_direccion || "");
        setContactos(ot.contactos || ot.meta_contactos || "");
        setObservaciones(ot.observaciones || "");

        const arriendoIdOrigen =
          ot.arriendo_id ||
          (typeof ot.arriendo === "number"
            ? ot.arriendo
            : ot.arriendo && ot.arriendo.id
            ? ot.arriendo.id
            : null);
        if (arriendoIdOrigen) setArriendoId(arriendoIdOrigen);

        const det = Array.isArray(ot.detalle_lineas)
          ? ot.detalle_lineas
          : Array.isArray(ot.lineas)
          ? ot.lineas
          : [];

        if (det.length > 0) {
          setItems(
            det.map((l, idx) => ({
              id: `${Date.now()}-${idx}`,
              serie: l.serie || "",
              maquinaInfo: null,
              unidad: l.unidad || "Dia",
              cantidadPeriodo: l.cantidadPeriodo != null ? l.cantidadPeriodo : 1,
              desde: l.desde || "",
              hasta: l.hasta || "",
              valor: l.valor != null && l.valor !== "" ? String(l.valor) : "",
              flete: l.flete != null && l.flete !== "" ? String(l.flete) : "",
              tipoFlete: l.tipoFlete || "entrega_retiro",
            }))
          );
        }

        toast.info("Editando OT basada en una existente.");
        return; // si estamos en edición, no aplicamos modo RETIRO
      }
    } catch (e) {
      console.error("Error al leer ot_editar_ot desde localStorage", e);
    }

    // 2) Intentar cargar borrador de RETIRO (si viene por URL o si existe borrador)
    try {
      const rawRetiro = localStorage.getItem("ot_borrador_retiro");
      if (rawRetiro || quiereRetiro) {
        const borr = rawRetiro ? JSON.parse(rawRetiro) : null;
        if (rawRetiro) localStorage.removeItem("ot_borrador_retiro");

        setModo("RETIRO");
        setOtId(null);
        setOtTieneDocs(false);
        handleChangeTipo("RETI");

        if (!borr) {
          toast.warn(
            "No se encontró borrador de retiro. Vuelve a Estado de arriendo y usa el botón Retiro."
          );
          return;
        }

        // arriendo asociado (viene desde estado arriendos)
        setArriendoId(borr.arriendo_id || borr.id || null);

        // obra origen (desde donde se retira)
        setObra(borr.obra || "");
        setOrdenCompra(borr.orden_compra || "");

        // Fecha sugerida: doc_fecha si viene, si no hoy
        const fechaSugerida = borr.doc_fecha
          ? String(borr.doc_fecha).slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        setFechaEmision(fechaSugerida);

        // Observación sugerida si está vacía
        setObservaciones((prev) =>
          prev?.trim()
            ? prev
            : `Retiro desde obra: ${borr.obra || "—"} → ${CLIENTE_EMPRESA.direccion}`
        );

        // Solo serie
        setItems([
          aplicarPresetLineaRetiro({
            ...nuevaLinea(),
            serie: borr.serie || "",
          }),
        ]);

        toast.info("OT de Retiro preparada desde estado de arriendos.");
      }
    } catch (e) {
      console.error("Error al leer ot_borrador_retiro desde localStorage", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // --------- CORRELATIVO N° OT (solo UI) ---------
  useEffect(() => {
    const fetchNextNumero = async () => {
      try {
        const res = await authFetch(`${backendURL}/ordenes`, {
          method: "GET",
          backendURL,
          token: auth?.access,
          refreshToken: auth?.refresh,
        });
        if (!res.ok) throw new Error("Error al obtener correlativo OT");
        const data = await res.json();

        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data.results)
          ? data.results
          : [];

        if (!arr || arr.length === 0) {
          setOtNumero("1");
          return;
        }

        const first = arr[0];
        const raw = first.numero ?? first.id;
        const actual = typeof raw === "number" ? raw : parseInt(String(raw), 10);
        if (!isNaN(actual)) setOtNumero(String(actual + 1));
        else setOtNumero("");
      } catch (e) {
        console.error(e);
        setOtNumero("");
      }
    };

    fetchNextNumero();
  }, [backendURL, auth?.access, auth?.refresh]);

  // --------- AUTOCOMPLETE CLIENTE ---------
  const buscarClientes = async (term) => {
    if (!term) {
      setClienteSugerencias([]);
      return;
    }
    try {
      setClienteBuscando(true);
      const url = `${backendURL}/clientes?query=${encodeURIComponent(term)}`;
      const res = await authFetch(url, {
        token: auth?.access,
        refreshToken: auth?.refresh,
        backendURL,
      });
      if (!res.ok) throw new Error("Error al buscar clientes");
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setClienteSugerencias(arr.slice(0, 10));
    } catch (e) {
      console.error(e);
      setClienteSugerencias([]);
    } finally {
      setClienteBuscando(false);
    }
  };

  useEffect(() => {
    if (tipo === "RETI") {
      setClienteSugerencias([]);
      return;
    }

    const raw = (clienteTerm || "").trim();
    if (!raw) {
      setClienteSugerencias([]);
      return;
    }

    const letrasNombre = raw
      .replace(/[0-9.\-\sKk]/g, "")
      .match(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/);

    let searchTerm = "";

    if (!letrasNombre) {
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 3) {
        setClienteSugerencias([]);
        return;
      }
      searchTerm = digits;
    } else {
      if (raw.length < 3) {
        setClienteSugerencias([]);
        return;
      }
      searchTerm = raw;
    }

    const handle = setTimeout(() => {
      buscarClientes(searchTerm);
    }, 300);

    return () => clearTimeout(handle);
  }, [clienteTerm, tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClienteInputChange = (e) => {
    const value = e.target.value;
    const formatted = formatRutOnType(value);
    setClienteTerm(formatted);
  };

  const handleSelectClienteSugerido = (cli) => {
    setClienteTerm(`${cli.rut} – ${cli.razon_social}`);
    setClienteSugerencias([]);
  };

  // --------- MODAL CLIENTE ---------
  const abrirModalCliente = () => {
    setClienteModalOpen(true);
    setClienteModalTerm("");
    setClienteModalResultados([]);
  };

  const cerrarModalCliente = () => {
    setClienteModalOpen(false);
    setClienteModalTerm("");
    setClienteModalResultados([]);
  };

  const buscarClienteEnModal = async () => {
    const term = (clienteModalTerm || "").trim();
    if (!term) {
      setClienteModalResultados([]);
      return;
    }

    setClienteModalLoading(true);
    try {
      const soloNums = normalizeRutNumberOnly(term);
      const q = soloNums ? soloNums : term;

      const url = `${backendURL}/clientes?query=${encodeURIComponent(q)}`;
      const res = await authFetch(url, {
        token: auth?.access,
        refreshToken: auth?.refresh,
        backendURL,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("❌ Error backend buscar clientes:", res.status, txt);
        toast.error("Error al buscar clientes");
        setClienteModalResultados([]);
        return;
      }

      let data = await res.json();
      if (!Array.isArray(data)) data = [];
      setClienteModalResultados(data);
    } catch (e) {
      console.error("❌ Error al buscar clientes (modal):", e);
      toast.error("Error al buscar clientes");
      setClienteModalResultados([]);
    } finally {
      setClienteModalLoading(false);
    }
  };

  const seleccionarClienteDesdeModal = (cli) => {
    setClienteTerm(`${cli.rut} – ${cli.razon_social}`);
    setClienteModalOpen(false);
    setClienteModalTerm("");
    setClienteModalResultados([]);
  };

  // --------- ELIMINAR ORDEN / CANCELAR RETIRO ---------
  const handleEliminarOrden = async () => {
    // Caso: modo retiro (borrador) -> limpiar
    if (modo === "RETIRO" && !otId) {
      const ok = window.confirm("¿Eliminar (cancelar) esta orden de retiro y volver al modo normal?");
      if (!ok) return;
      resetFormulario();
      // opcional: limpiar querystring si vienes con ?tipo=RETIRO
      navigate(location.pathname, { replace: true });
      toast.info("Borrador de retiro eliminado.");
      return;
    }

    // Caso: no hay OT seleccionada
    if (!otId) {
      toast.info("No hay una orden cargada para eliminar.");
      return;
    }

    // Bloqueo por documentos
    if (otTieneDocs) {
      toast.error("No se puede eliminar: esta OT tiene documentos asociados (guía y/o factura).");
      return;
    }

    const ok = window.confirm(
      `¿Eliminar la OT #${otId}? (Solo se permite si no tiene documentos asociados)`
    );
    if (!ok) return;

    setSaving(true);
    try {
      const res = await authFetch(`${backendURL}/ordenes/${otId}`, {
        method: "DELETE",
        token: auth?.access,
        refreshToken: auth?.refresh,
        backendURL,
      });

      if (!(res.status === 204 || res.ok)) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Error ${res.status} al eliminar OT`);
      }

      toast.success("Orden eliminada correctamente.");
      resetFormulario();
      navigate(location.pathname, { replace: true });
    } catch (e) {
      console.error(e);
      toast.error(e.message || "No se pudo eliminar la orden.");
    } finally {
      setSaving(false);
    }
  };

  // --------- GUARDAR OT ---------
  const handleGuardar = async () => {
    const metaClienteEfectivo =
      tipo === "RETI"
        ? `${CLIENTE_EMPRESA.rut} – ${CLIENTE_EMPRESA.razon}`
        : clienteTerm;

    const metaDireccionEfectiva =
      tipo === "RETI" ? CLIENTE_EMPRESA.direccion : direccion;

    if (!metaClienteEfectivo.trim()) {
      toast.warn("Debes indicar un cliente (RUT o nombre).");
      return;
    }
    if (!items.some((it) => it.serie.trim())) {
      toast.warn("Debes indicar al menos una máquina (serie).");
      return;
    }

    // Para RETIRO debe venir arriendoId
    if (tipo === "RETI" && !arriendoId) {
      toast.error(
        "Falta el arriendo asociado para el retiro. Vuelve a entrar desde Estado de arriendo (botón Retiro)."
      );
      return;
    }

    const numeroActual = otNumero;

    setSaving(true);
    try {
      const esRetiro = tipo === "RETI";

      const payload = {
        tipo, // "ALTA" | "SERV" | "TRAS" | "RETI"
        observaciones,
        meta_cliente: metaClienteEfectivo,
        meta_obra: obra,
        meta_direccion: metaDireccionEfectiva,
        meta_contactos: esRetiro ? "" : contactos,
        meta_orden_compra: ordenCompra,
        meta_fecha_emision: fechaEmision || null,
        lineas: items.map((it) => {
          if (esRetiro) {
            return {
              serie: it.serie,
              unidad: "Dia",
              cantidadPeriodo: 1,
              desde: null,
              hasta: null,
              valor: "0",
              flete: "0",
              tipoFlete: "solo_traslado",
            };
          }
          return {
            serie: it.serie,
            unidad: it.unidad,
            cantidadPeriodo: it.cantidadPeriodo,
            desde: it.desde,
            hasta: it.hasta,
            valor: it.valor,
            flete: it.flete,
            tipoFlete: it.tipoFlete,
          };
        }),
      };

      if (arriendoId) payload.arriendo_id = arriendoId;

      const res = await authFetch(`${backendURL}/ordenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        token: auth?.access,
        refreshToken: auth?.refresh,
        backendURL,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Error ${res.status} al crear la OT`);
      }

      const otCreada = await res.json().catch(() => null);
      if (otCreada && otCreada.id) {
        // dejamos la OT lista para poder eliminarla si aún no tiene docs
        setOtId(otCreada.id);
        setOtTieneDocs(Boolean(otCreada.guia) || Boolean(otCreada.factura));
        setModo("EDITAR");
      } else {
        setOtId(null);
        setOtTieneDocs(false);
      }

      if (tipo === "RETI") {
        toast.success(
          numeroActual
            ? `OT de Retiro N°${numeroActual} ha sido creada`
            : "OT de Retiro ha sido creada."
        );
      } else {
        toast.success(
          numeroActual
            ? `Orden de trabajo N°${numeroActual} ha sido creada`
            : "Orden de trabajo ha sido creada."
        );
      }

      // Si era retiro desde borrador, limpiamos el querystring
      if (modo === "RETIRO") {
        navigate(location.pathname, { replace: true });
      }

      // (opcional) NO reseteamos automáticamente si quieres poder eliminarla ahí mismo.
      // Si tú prefieres el comportamiento anterior (reset inmediato), dime y lo dejamos como antes.
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Error al crear la orden de trabajo");
    } finally {
      setSaving(false);
    }
  };

  // ====================
  // RENDER
  // ====================
  const smallSuggestionStyle = {
    width: "100%",
    textAlign: "left",
    padding: "6px 10px",
    fontSize: "0.85rem",
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
  };

  const deleteDisabled =
    saving ||
    (modo === "NUEVA" && !otId) ||
    (otId && otTieneDocs); // si tiene docs, no se puede

  const deleteLabel =
    modo === "RETIRO" && !otId ? "Eliminar orden" : "Eliminar orden";

  return (
    <>
      <div className="ot-layout">
        {/* COLUMNA PRINCIPAL */}
        <div className="ot-main">
          {/* Datos generales + Observaciones */}
          <div className="admin-card">
            <div className="fieldset">
              <div className="legend">
                {modo === "RETIRO"
                  ? "Crear orden de trabajo – RETIRO"
                  : "Crear orden de trabajo"}
              </div>

              {/* N° OT */}
              <div className="form-row">
                <div className="label">N° OT</div>
                <div className="control">
                  <input
                    className="input"
                    value={otNumero}
                    onChange={(e) => setOtNumero(e.target.value)}
                    placeholder="Número sugerido de orden de trabajo"
                  />
                  <div className="help-text">
                    Se asigna automáticamente un número correlativo, pero puedes
                    ajustarlo manualmente si lo necesitas.
                  </div>

                  {otId && (
                    <div className="help-text" style={{ marginTop: 6 }}>
                      OT cargada: <strong>#{otId}</strong>{" "}
                      {otTieneDocs ? "· con documentos asociados" : "· sin documentos"}
                    </div>
                  )}
                </div>
              </div>

              {/* Tipo OT */}
              <div className="form-row">
                <div className="label">Tipo</div>
                <div className="control">
                  <select
                    className="select"
                    value={tipo}
                    disabled={modo === "RETIRO"} // bloqueado si viene desde botón Retiro
                    onChange={(e) => handleChangeTipo(e.target.value)}
                  >
                    {TIPO_OT.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <div className="help-text">
                    Arriendo, Venta, Traslado o Retiro (Axxxx / Vxxxx / Txxxx / Rxxxx se define en backend).
                  </div>
                </div>
              </div>

              {/* Fecha de emisión */}
              <div className="form-row">
                <div className="label">Fecha de emisión (guía)</div>
                <div className="control">
                  <input
                    type="date"
                    className="input input--date"
                    value={fechaEmision}
                    onChange={(e) => setFechaEmision(e.target.value)}
                  />
                  <div className="help-text">
                    Fecha que se utilizará como referencia para la guía de despacho (especialmente para despachos y retiros).
                  </div>
                </div>
              </div>

              {/* Cliente */}
              <div className="form-row">
                <div className="label">Cliente</div>
                <div className="control" style={{ width: "100%" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      width: "100%",
                      maxWidth: "100%",
                    }}
                  >
                    <div style={{ position: "relative", minWidth: 0 }}>
                      <input
                        className="input"
                        style={{ width: "100%" }}
                        placeholder="RUT (xx.xxx.xxx-x) o nombre"
                        value={clienteTerm}
                        onChange={handleClienteInputChange}
                        disabled={tipo === "RETI"}
                      />

                      {clienteSugerencias.length > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            marginTop: 2,
                            background: "var(--bg-elevated, rgba(15,23,42,0.98))",
                            border: "1px solid var(--border-subtle, rgba(148,163,184,0.6))",
                            borderRadius: 4,
                            maxHeight: 220,
                            overflowY: "auto",
                            zIndex: 30,
                          }}
                        >
                          {clienteSugerencias.map((cli) => (
                            <button
                              key={cli.id}
                              type="button"
                              style={smallSuggestionStyle}
                              onClick={() => handleSelectClienteSugerido(cli)}
                            >
                              <div>
                                <strong>{cli.rut}</strong> – {cli.razon_social}
                              </div>
                            </button>
                          ))}
                          {clienteBuscando && (
                            <div
                              style={{
                                padding: "4px 10px",
                                fontSize: "0.8rem",
                                color: "var(--muted)",
                              }}
                            >
                              Buscando...
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={abrirModalCliente}
                      style={{ minWidth: "7rem", alignSelf: "stretch" }}
                      disabled={tipo === "RETI"}
                    >
                      Buscar
                    </button>
                  </div>

                  {tipo === "RETI" && (
                    <div className="help-text" style={{ marginTop: 6 }}>
                      En <strong>RETIRO</strong> el cliente es fijo:{" "}
                      <strong>{CLIENTE_EMPRESA.rut}</strong> –{" "}
                      <strong>{CLIENTE_EMPRESA.razon}</strong>.
                    </div>
                  )}
                </div>
              </div>

              {/* Orden de compra */}
              <div className="form-row">
                <div className="label">Orden de compra</div>
                <div className="control">
                  <input
                    className="input"
                    value={ordenCompra}
                    maxLength={30}
                    onChange={(e) => setOrdenCompra(e.target.value)}
                    placeholder="OC del cliente (opcional)"
                  />
                  <div className="help-text">
                    Puede contener letras y números (hasta 30 caracteres).
                  </div>
                </div>
              </div>

              {/* Obra */}
              <div className="form-row">
                <div className="label">Obra</div>
                <div className="control">
                  <input
                    className="input"
                    placeholder="Nombre de la obra (origen del retiro)"
                    value={obra}
                    onChange={(e) => setObra(e.target.value)}
                  />
                  {tipo === "RETI" && (
                    <div className="help-text">
                      Origen del retiro (desde donde se mueve la máquina).
                    </div>
                  )}
                </div>
              </div>

              {/* Dirección */}
              <div className="form-row">
                <div className="label">Dirección</div>
                <div className="control">
                  <input
                    className="input"
                    placeholder="Dirección de entrega / retiro"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    disabled={tipo === "RETI"}
                  />
                  {tipo === "RETI" ? (
                    <div className="help-text">
                      Destino fijo del retiro: <strong>{CLIENTE_EMPRESA.direccion}</strong>.
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Contactos */}
              {tipo !== "RETI" && (
                <div className="form-row">
                  <div className="label">Contactos</div>
                  <div className="control">
                    <textarea
                      className="textarea"
                      rows={2}
                      placeholder="Nombres y celulares de contactos en obra"
                      value={contactos}
                      onChange={(e) => setContactos(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Observaciones */}
              <div className="form-row">
                <div className="label">Observaciones</div>
                <div className="control">
                  <textarea
                    className="textarea"
                    rows={3}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* MÁQUINAS */}
          {items.map((it, idx) => (
            <div key={it.id} className="admin-card ot-item-card">
              <div className="fieldset">
                <div className="legend">Máquina #{idx + 1}</div>

                {/* Serie + Buscar */}
                <div className="form-row ot-series-row">
                  <div className="label">Serie máquina</div>
                  <div className="control">
                    <div className="ot-series-control">
                      <input
                        className="input input--serie"
                        maxLength={16}
                        value={it.serie}
                        onChange={(e) =>
                          handleChangeItem(it.id, "serie", e.target.value)
                        }
                        onBlur={() => buscarMaquinaPorSerie(it.id)}
                        placeholder="Serie"
                      />
                      <button
                        type="button"
                        className="btn btn-primary ot-btn-buscar-serie"
                        onClick={() => abrirModalParaLinea(it.id)}
                      >
                        Buscar
                      </button>
                    </div>

                    {it.maquinaInfo ? (
                      <div className="help-text">
                        {it.maquinaInfo.marca} {it.maquinaInfo.modelo || ""}{" "}
                        {it.maquinaInfo.altura ? `– ${it.maquinaInfo.altura} m` : ""}
                      </div>
                    ) : (
                      <div className="help-text">
                        Puedes ingresar la serie o usar el buscador para ver las máquinas disponibles.
                      </div>
                    )}
                  </div>
                </div>

                {/* En RETIRO: ocultamos periodo/fechas/valores */}
                {tipo === "RETI" ? (
                  <div className="form-row">
                    <div className="label">Movimiento</div>
                    <div className="control">
                      <div className="help-text">
                        Retiro interno: desde la obra hacia{" "}
                        <strong>{CLIENTE_EMPRESA.direccion}</strong>. (Solo se requiere la serie de la máquina).
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Periodo */}
                    <div className="form-row">
                      <div className="label">Periodo</div>
                      <div className="control">
                        <div className="ot-periodo-row">
                          <select
                            className="select"
                            value={it.unidad}
                            onChange={(e) =>
                              handleChangeItem(it.id, "unidad", e.target.value)
                            }
                          >
                            {UNIDADES.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.label}
                              </option>
                            ))}
                          </select>

                          {it.unidad !== "Especial" && (
                            <input
                              className="input ot-cantidad-input"
                              type="number"
                              min={1}
                              value={it.cantidadPeriodo}
                              onChange={(e) =>
                                handleChangeItem(it.id, "cantidadPeriodo", e.target.value)
                              }
                              placeholder="Cantidad"
                            />
                          )}
                        </div>

                        <div className="help-text">
                          Ej.: 6 días, 1 semana, 2 semanas, 1 mes (30 días corridos). En "Arriendo especial" ajustas fechas manualmente.
                        </div>
                      </div>
                    </div>

                    {/* Fechas */}
                    <div className="form-row">
                      <div className="label">Fechas</div>
                      <div className="control ot-fechas-row">
                        <div className="date-wrapper">
                          <input
                            type="date"
                            className="input input--date"
                            value={it.desde}
                            onChange={(e) =>
                              handleChangeItem(it.id, "desde", e.target.value)
                            }
                          />
                        </div>
                        <span className="ot-fechas-sep">→</span>
                        <div className="date-wrapper">
                          <input
                            type="date"
                            className="input input--date"
                            value={it.hasta}
                            onChange={(e) =>
                              handleChangeItem(it.id, "hasta", e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Valor neto */}
                    <div className="form-row">
                      <div className="label">Valor neto</div>
                      <div className="control">
                        <input
                          className="input ot-valor-input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.valor}
                          onChange={(e) =>
                            handleChangeItem(it.id, "valor", e.target.value)
                          }
                          placeholder="0"
                        />
                        <div className="help-text">
                          Monto neto del equipo para este periodo.
                        </div>
                      </div>
                    </div>

                    {/* Flete */}
                    <div className="form-row">
                      <div className="label">Flete</div>
                      <div className="control">
                        <select
                          className="select"
                          value={it.tipoFlete}
                          onChange={(e) =>
                            handleChangeItem(it.id, "tipoFlete", e.target.value)
                          }
                        >
                          {TIPO_FLETE.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input ot-valor-input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.flete}
                          onChange={(e) =>
                            handleChangeItem(it.id, "flete", e.target.value)
                          }
                          placeholder="0"
                        />
                        <div className="help-text">
                          Valor neto del flete (entrega/retiro o solo traslado).
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Acciones línea */}
                <div className="ot-item-actions">
                  <button
                    type="button"
                    className="btn btn-ghost ot-btn-eliminar"
                    onClick={() => removeLinea(it.id)}
                    disabled={items.length === 1}
                  >
                    Eliminar máquina
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Añadir otra máquina */}
          <div className="admin-card">
            <div className="fieldset">
              <div className="ot-add-row">
                <button
                  type="button"
                  className="btn btn-primary ot-btn-add"
                  onClick={addLinea}
                >
                  + Añadir máquina
                </button>
              </div>
            </div>
          </div>

          {/* Botonera principal (crear + eliminar abajo derecha) */}
          <div className="admin-card">
            <div
              className="actions-bar"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 140 }} />

              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={handleGuardar}
              >
                {modo === "RETIRO" ? "CREAR OT DE RETIRO" : "CREAR ORDEN DE TRABAJO"}
              </button>

              <div style={{ minWidth: 140, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleEliminarOrden}
                  disabled={deleteDisabled}
                  title={
                    otId && otTieneDocs
                      ? "No se puede eliminar porque tiene documentos asociados"
                      : ""
                  }
                  style={{ marginLeft: "auto" }}
                >
                  {deleteLabel}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: RESUMEN */}
        <aside className="ot-summary">
          <div className="admin-card ot-summary-card">
            <div className="fieldset">
              {tipo === "RETI" ? (
                <>
                  <div className="legend">Resumen</div>
                  <div className="help-text">
                    Retiro interno (movimiento). No se registran valores de arriendo ni flete.
                  </div>
                </>
              ) : (
                <>
                  <div className="legend">Resumen venta</div>

                  {items.map((it, idx) => {
                    const econ = resumenPorLinea(it);
                    return (
                      <div key={it.id} className="ot-summary-item">
                        <div className="ot-summary-title">
                          Máquina #{idx + 1}{" "}
                          {it.maquinaInfo
                            ? `– ${it.maquinaInfo.marca} ${it.maquinaInfo.modelo || ""}`
                            : it.serie
                            ? `– Serie ${it.serie}`
                            : ""}
                        </div>
                        <div className="ot-summary-line">
                          <span>Neto</span>
                          <span>${econ.neto.toLocaleString("es-CL")}</span>
                        </div>
                        <div className="ot-summary-line">
                          <span>IVA 19%</span>
                          <span>${econ.iva.toLocaleString("es-CL")}</span>
                        </div>
                        <div className="ot-summary-line ot-summary-total-line">
                          <span>Total</span>
                          <span>${econ.total.toLocaleString("es-CL")}</span>
                        </div>
                      </div>
                    );
                  })}

                  <hr className="ot-summary-sep" />

                  <div className="legend" style={{ marginTop: ".3rem" }}>
                    Venta total
                  </div>
                  <div className="ot-summary-line">
                    <span>Neto</span>
                    <span>${resumenGlobal.neto.toLocaleString("es-CL")}</span>
                  </div>
                  <div className="ot-summary-line">
                    <span>IVA 19%</span>
                    <span>${resumenGlobal.iva.toLocaleString("es-CL")}</span>
                  </div>
                  <div className="ot-summary-line ot-summary-total-line">
                    <span>Total</span>
                    <span>${resumenGlobal.total.toLocaleString("es-CL")}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* MODAL DE MÁQUINAS DISPONIBLES */}
      {modalOpen && (
        <div className="ot-modal-backdrop" onClick={cerrarModal}>
          <div className="ot-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ot-modal-header">
              <div className="ot-modal-title">Seleccionar máquina disponible</div>
            </div>

            <div className="ot-modal-columns">
              {/* Elevadores */}
              <div>
                <div className="ot-modal-column-title">Elevadores</div>
                <div className="ot-machine-list">
                  {listasPorCategoria.elevadores.length === 0 && (
                    <div className="ot-machine-empty">Sin elevadores.</div>
                  )}
                  {listasPorCategoria.elevadores.map((m) => {
                    const selected = maquinaSeleccionadaId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={
                          "ot-machine-item" +
                          (selected ? " ot-machine-item--selected" : "")
                        }
                        onClick={() => setMaquinaSeleccionadaId(m.id)}
                      >
                        <div className="ot-machine-title">
                          {m.marca} {m.modelo || ""}
                        </div>
                        <div className="ot-machine-meta">
                          Serie: {m.serie || "—"}
                          {m.altura ? ` · Altura: ${m.altura} m` : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Camiones */}
              <div>
                <div className="ot-modal-column-title">Camiones</div>
                <div className="ot-machine-list">
                  {listasPorCategoria.camiones.length === 0 && (
                    <div className="ot-machine-empty">Sin camiones.</div>
                  )}
                  {listasPorCategoria.camiones.map((m) => {
                    const selected = maquinaSeleccionadaId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={
                          "ot-machine-item" +
                          (selected ? " ot-machine-item--selected" : "")
                        }
                        onClick={() => setMaquinaSeleccionadaId(m.id)}
                      >
                        <div className="ot-machine-title">
                          {m.marca} {m.modelo || ""}
                        </div>
                        <div className="ot-machine-meta">
                          Serie: {m.serie || "—"}
                          {m.tonelaje ? ` · Tonelaje: ${m.tonelaje} t` : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Otras */}
              <div>
                <div className="ot-modal-column-title">Otras máquinas</div>
                <div className="ot-machine-list">
                  {listasPorCategoria.otras.length === 0 && (
                    <div className="ot-machine-empty">Sin otras máquinas.</div>
                  )}
                  {listasPorCategoria.otras.map((m) => {
                    const selected = maquinaSeleccionadaId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={
                          "ot-machine-item" +
                          (selected ? " ot-machine-item--selected" : "")
                        }
                        onClick={() => setMaquinaSeleccionadaId(m.id)}
                      >
                        <div className="ot-machine-title">
                          {m.marca} {m.modelo || ""}
                        </div>
                        <div className="ot-machine-meta">Serie: {m.serie || "—"}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="ot-modal-footer">
              <button type="button" className="btn btn-ghost" onClick={cerrarModal}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmarSeleccionMaquina}
              >
                Seleccionar máquina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE BÚSQUEDA DE CLIENTES */}
      {clienteModalOpen && (
        <div className="ot-modal-backdrop" onClick={cerrarModalCliente}>
          <div className="ot-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ot-modal-header">
              <div className="ot-modal-title">Buscar cliente</div>
            </div>

            <div className="fieldset" style={{ marginTop: 8 }}>
              <div className="form-row">
                <div className="label">Término</div>
                <div className="control" style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    placeholder="RUT (xx.xxx.xxx-x) o nombre"
                    value={clienteModalTerm}
                    onChange={(e) => setClienteModalTerm(formatRutOnType(e.target.value))}
                    onKeyDown={(e) => e.key === "Enter" && buscarClienteEnModal()}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={buscarClienteEnModal}
                    disabled={clienteModalLoading}
                  >
                    {clienteModalLoading ? "Buscando..." : "Buscar"}
                  </button>
                </div>
              </div>

              <div className="form-row">
                <div className="label">Resultados</div>
                <div className="control">
                  {clienteModalResultados.length === 0 ? (
                    <div style={{ padding: "0.5rem 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                      Sin resultados todavía.
                    </div>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>RUT</th>
                          <th>Razón Social</th>
                          <th>Dirección</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clienteModalResultados.map((cli) => (
                          <tr key={cli.id}>
                            <td>{cli.rut}</td>
                            <td>{cli.razon_social}</td>
                            <td>{cli.direccion || "—"}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => seleccionarClienteDesdeModal(cli)}
                              >
                                Seleccionar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={cerrarModalCliente}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



















