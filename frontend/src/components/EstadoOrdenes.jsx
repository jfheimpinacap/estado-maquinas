// src/components/EstadoOrdenes.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

const PREFIX_TIPO = {
  A: "A",
  V: "V",
  T: "T",
};

const formatoMonedaCLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const mostrarMonto = (valor) => {
  if (valor === null || valor === undefined) return "—";
  const num = Number(valor);
  if (Number.isNaN(num)) return String(valor);
  return formatoMonedaCLP.format(num);
};

// Helpers -----------------------------

const extraerRutDeTexto = (txt) => {
  if (!txt) return "";
  const m = String(txt).match(/\d{1,3}(?:\.\d{3}){2}-[\dkK]/);
  return m ? m[0] : "";
};

const formatearFecha = (valor) => {
  if (!valor) return "—";
  try {
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return String(valor);
  }
};

const obtenerFechaCreacion = (o) => {
  const raw =
    o.fecha_creacion ||
    o.fecha ||
    o.created_at ||
    o.created ||
    o.fecha_orden ||
    null;
  return formatearFecha(raw);
};

const obtenerCliente = (o) =>
  o.cliente_razon_social ||
  o.cliente_nombre ||
  o.cliente_razon ||
  o.meta_cliente ||
  "—";

const obtenerRutCliente = (o) => {
  return (
    o.cliente_rut ||
    o.rut_cliente ||
    o.rut ||
    extraerRutDeTexto(o.cliente_razon_social) ||
    extraerRutDeTexto(o.cliente_nombre) ||
    extraerRutDeTexto(o.cliente_razon) ||
    extraerRutDeTexto(o.meta_cliente) ||
    "—"
  );
};

const obtenerDireccion = (o) =>
  o.direccion || o.meta_direccion || o.obra_nombre || o.meta_obra || "—";

const obtenerLineas = (o) => {
  if (Array.isArray(o.detalle_lineas)) return o.detalle_lineas;
  if (Array.isArray(o.lineas)) return o.lineas;
  if (Array.isArray(o.detalles)) return o.detalles;
  return [];
};

const obtenerSeries = (o) => {
  // 1) backend puede mandar arreglo de series ya resuelto
  if (Array.isArray(o.series) && o.series.length > 0) {
    return o.series
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0);
  }
  if (Array.isArray(o.series_maquinas) && o.series_maquinas.length > 0) {
    return o.series_maquinas
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0);
  }

  // 2) reconstruir desde detalle_lineas / lineas
  const lineas = obtenerLineas(o);
  const set = new Set();
  for (const l of lineas) {
    if (!l) continue;
    const s = (l.serie || l.serie_maquina || "").toString().trim();
    if (s) set.add(s);
  }

  // 3) último recurso: serie principal
  if (set.size === 0 && o.serie) {
    set.add(String(o.serie).trim());
  }

  return Array.from(set);
};

const obtenerOrdenCompra = (o) =>
  o.meta_orden_compra || o.orden_compra || o.oc || "—";

const obtenerContactos = (o) =>
  o.contactos || o.meta_contactos || "";

const obtenerMontoNeto = (o) => {
  if (o.monto_neto !== undefined && o.monto_neto !== null) {
    return o.monto_neto;
  }
  if (o.total_neto !== undefined && o.total_neto !== null) {
    return o.total_neto;
  }
  return null;
};

const obtenerMontoIva = (o) => {
  if (o.monto_iva !== undefined && o.monto_iva !== null) {
    return o.monto_iva;
  }
  return null;
};

const obtenerMontoTotal = (o) => {
  if (o.monto_total !== undefined && o.monto_total !== null) {
    return o.monto_total;
  }
  if (o.total !== undefined && o.total !== null) {
    return o.total;
  }
  return null;
};

const folioOT = (o) => {
  const pref =
    o.tipo_comercial && PREFIX_TIPO[o.tipo_comercial]
      ? PREFIX_TIPO[o.tipo_comercial]
      : PREFIX_TIPO[o.tipo] || "OT";
  const idNum = Number(o.id || 0);
  const suf = idNum > 0 ? String(idNum).padStart(4, "0") : "----";
  return `${pref}${suf}`;
};

const esArriendo = (o) =>
  o.tipo === "ALTA" || o.tipo_comercial === "A";

const esVenta = (o) =>
  o.tipo === "SERV" || o.tipo_comercial === "V";

const esTraslado = (o) =>
  o.tipo === "TRAS" || o.tipo_comercial === "T";

export default function EstadoOrdenes({ setView }) {
  const { auth, backendURL } = useAuth();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(false);

  // filtro simple de tipo A/V/T
  const [fTipo, setFTipo] = useState(""); // "" = ver todo

  // pestañas: "sin-doc" | "pend-fact"
  const [tab, setTab] = useState("sin-doc");

  // modal VER OT
  const [otVer, setOtVer] = useState(null);

  // modal EMITIR
  const [otEmitir, setOtEmitir] = useState(null);

  // ===== Cargar órdenes desde backend =====
  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${backendURL}/ordenes`, {
        method: "GET",           // o POST/DELETE según corresponda
        backendURL,              // <<< importante para saber dónde refrescar
        token: auth?.access,     // access
        refreshToken: auth?.refresh, // refresh  
      });
      if (!res.ok) throw new Error("Error al cargar órdenes de trabajo");
      const data = await res.json();

      let arr = [];
      if (Array.isArray(data)) {
        arr = data;
      } else if (Array.isArray(data.results)) {
        arr = data.results;
      }

      setOrdenes(arr);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Error al cargar órdenes de trabajo");
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [backendURL, auth?.access]);

  // ===== Separación por estado de documentación / facturación =====

  // Órdenes sin guía ni factura
  const ordenesSinDocumento = useMemo(
    () =>
      ordenes.filter((o) => {
        if (o.fecha_cierre) return false;
        if (fTipo && o.tipo_comercial && o.tipo_comercial !== fTipo) {
          return false;
        }
        if (fTipo && !o.tipo_comercial && o.tipo !== fTipo) {
          return false;
        }
        return !o.guia && !o.factura;
      }),
    [ordenes, fTipo]
  );

  // Órdenes con facturación pendiente:
  // es_facturable=true y sin FACT asociada
  const ordenesFactPend = useMemo(
    () =>
      ordenes.filter((o) => {
        if (o.fecha_cierre) return false;
        if (fTipo && o.tipo_comercial && o.tipo_comercial !== fTipo) {
          return false;
        }
        if (fTipo && !o.tipo_comercial && o.tipo !== fTipo) {
          return false;
        }
        return !!o.es_facturable && !o.factura;
      }),
    [ordenes, fTipo]
  );

  const listaActual =
    tab === "sin-doc" ? ordenesSinDocumento : ordenesFactPend;

  // ===== Acciones UI =====

  const verOrden = (ot) => {
    setOtVer(ot);
  };

  const cerrarModalVer = () => {
    setOtVer(null);
  };

  const abrirModalEmitir = (ot) => {
    setOtEmitir(ot);
  };

  const cerrarModalEmitir = () => {
    setOtEmitir(null);
  };

  // Llamada a backend para emitir documento(s)
  const emitirOrdenBackend = async (ot, accion) => {
    const folio = folioOT(ot);

    try {
      const res = await authFetch(
        `${backendURL}/ordenes/${ot.id}/emitir`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          token: auth?.access,
          body: JSON.stringify({ accion }),
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          txt || `Error ${res.status} al emitir documento`
        );
      }

      // Es más seguro recargar la lista completa que asumir
      // la estructura de la respuesta de backend.
      await load();

      if (accion === "facturar" || accion === "emitir_factura") {
        toast.success(`Factura emitida para la orden ${folio}`);
      } else {
        toast.success(
          `Guía de despacho emitida para la orden ${folio}`
        );
      }
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Error al emitir documento");
    }
  };

  const emitirDesdeModal = async (accion) => {
    if (!otEmitir) return;
    const ot = otEmitir;
    const folio = folioOT(ot);

    // pestaña en la que estamos
    const enPendFact = tab === "pend-fact";

    try {
      if (enPendFact) {
        // Aquí siempre es emitir FACTURA de lo pendiente
        if (accion === "cancelar") {
          cerrarModalEmitir();
          return;
        }
        await emitirOrdenBackend(ot, "facturar");
        cerrarModalEmitir();
        return;
      }

      // Tab "sin-doc"
      if (esArriendo(ot)) {
        if (accion === "no_facturable") {
          await emitirOrdenBackend(ot, "guia_no_facturable");
        } else if (accion === "facturable") {
          toast.info(
            "Por ahora se emitirá una guía NO facturable. El flujo de guía facturable se configurará más adelante."
          );
          await emitirOrdenBackend(ot, "guia_no_facturable");
        }
        cerrarModalEmitir();
        return;
      }

      if (esTraslado(ot)) {
        if (accion === "no_facturable") {
          await emitirOrdenBackend(ot, "guia_no_facturable");
        } else if (accion === "facturable") {
          toast.info(
            "Por ahora se emitirá una guía NO facturable. El flujo de guía facturable se configurará más adelante."
          );
          await emitirOrdenBackend(ot, "guia_no_facturable");
        }
        cerrarModalEmitir();
        return;
      }

      if (esVenta(ot)) {
        if (accion === "cancelar") {
          cerrarModalEmitir();
          return;
        }
        // Ventas: FACT directa
        await emitirOrdenBackend(ot, "facturar");
        cerrarModalEmitir();
        return;
      }

      // fallback
      toast.warn(
        `No se reconoce el tipo de OT ${folio} para emitir documento.`
      );
      cerrarModalEmitir();
    } catch {
      // errores ya tratados en emitirOrdenBackend
    }
  };

  const editarOrden = (ot) => {
    if (!ot) return;
    // Guardamos la OT completa para que CrearOT pueda reconstruir el formulario
    try {
      localStorage.setItem("ot_en_edicion", JSON.stringify(ot));
    } catch (e) {
      console.error("No se pudo guardar OT para edición", e);
    }

    if (typeof setView === "function") {
      setView("crear-ot");
    }
    setOtVer(null);
  };

  // Datos precalculados para el modal VER OT
  const seriesOTVer = otVer ? obtenerSeries(otVer) : [];
  const lineasOTVer = otVer ? obtenerLineas(otVer) : [];
  const fechaCreacionOTVer = otVer ? obtenerFechaCreacion(otVer) : "—";
  const contactosOTVer = otVer ? obtenerContactos(otVer) : "";
  const montoNetoOTVer = otVer ? obtenerMontoNeto(otVer) : null;
  const montoIvaOTVer = otVer ? obtenerMontoIva(otVer) : null;
  const montoTotalOTVer = otVer ? obtenerMontoTotal(otVer) : null;

  // ===== Render =====
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Órdenes de trabajo activas</h1>
        <div className="breadcrumbs">
          Estado de máquinas / Órdenes de trabajo
        </div>
      </div>

      {/* Tabs + filtros */}
      <div className="admin-card" style={{ marginBottom: 14 }}>
        <div className="fieldset">
          <div className="legend">Vista</div>

          {/* Pestañas */}
          <div
            className="tabs-row"
            style={{ display: "flex", gap: 8, marginBottom: 8 }}
          >
            <button
              type="button"
              className={
                "btn btn-ghost" +
                (tab === "sin-doc" ? " btn-ghost-active" : "")
              }
              onClick={() => setTab("sin-doc")}
            >
              OT sin documento ({ordenesSinDocumento.length})
            </button>
            <button
              type="button"
              className={
                "btn btn-ghost" +
                (tab === "pend-fact" ? " btn-ghost-active" : "")
              }
              onClick={() => setTab("pend-fact")}
            >
              Con facturación pendiente ({ordenesFactPend.length})
            </button>
          </div>

          {/* Filtros simples */}
          <div className="form-row">
            <div className="label">Tipo</div>
            <div className="control">
              <select
                className="select"
                value={fTipo}
                onChange={(e) => setFTipo(e.target.value)}
                style={{ maxWidth: 260 }}
              >
                <option value="">Ver todo</option>
                <option value="A">Arriendo</option>
                <option value="V">Venta</option>
                <option value="T">Traslado</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="label" />
            <div
              className="control"
              style={{ display: "flex", gap: 8 }}
            >
              <button
                className="btn btn-primary"
                type="button"
                onClick={load}
                disabled={loading}
              >
                {loading ? "Actualizando..." : "Refrescar"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setFTipo("")}
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de órdenes según pestaña */}
      <div className="admin-card">
        <div className="fieldset">
          <div className="legend">
            {tab === "sin-doc"
              ? "Órdenes sin documento asociado"
              : "Órdenes con facturación pendiente"}
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>OT</th>
                <th>Fecha creación</th>
                <th>Cliente</th>
                <th>RUT cliente</th>
                <th>Dirección / obra</th>
                <th>Máquinas (serie)</th>
                <th>OC</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listaActual.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: "1rem",
                      textAlign: "center",
                      color: "var(--muted)",
                    }}
                  >
                    {loading
                      ? "Cargando órdenes..."
                      : "No hay órdenes que coincidan con los filtros."}
                  </td>
                </tr>
              ) : (
                listaActual.map((o) => {
                  const folio = folioOT(o);
                  const fecha = obtenerFechaCreacion(o);
                  const cliente = obtenerCliente(o);
                  const rut = obtenerRutCliente(o);
                  const direccion = obtenerDireccion(o);
                  const series = obtenerSeries(o);
                  const oc = obtenerOrdenCompra(o);

                  const puedeEditar =
                    tab === "sin-doc"; // en "Con facturación pendiente" NO se edita

                  return (
                    <tr key={o.id}>
                      <td>{folio}</td>
                      <td>{fecha}</td>
                      <td>{cliente}</td>
                      <td>{rut}</td>
                      <td>{direccion}</td>
                      <td>
                        {series.length === 0
                          ? "—"
                          : series.map((s, idx) => (
                              <div key={idx}>{s}</div>
                            ))}
                      </td>
                      <td>{oc}</td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => verOrden(o)}
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => abrirModalEmitir(o)}
                          >
                            Emitir
                          </button>
                          {/* Aquí podrías agregar botón Eliminar si corresponde */}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL VER OT */}
      {otVer && (
        <div
          className="ot-modal-backdrop"
          onClick={cerrarModalVer}
        >
          <div
            className="ot-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ot-modal-header">
              <div className="ot-modal-title">
                Detalle OT {folioOT(otVer)}
              </div>
            </div>

            <div className="fieldset" style={{ marginTop: 8 }}>
              <div className="form-row">
                <div className="label">Tipo</div>
                <div className="control">
                  {esArriendo(otVer)
                    ? "Arriendo"
                    : esVenta(otVer)
                    ? "Venta"
                    : esTraslado(otVer)
                    ? "Traslado"
                    : otVer.tipo || "—"}
                </div>
              </div>

              <div className="form-row">
                <div className="label">Fecha creación</div>
                <div className="control">
                  {fechaCreacionOTVer}
                </div>
              </div>

              <div className="form-row">
                <div className="label">Cliente</div>
                <div className="control">
                  {obtenerCliente(otVer)}
                </div>
              </div>

              <div className="form-row">
                <div className="label">RUT cliente</div>
                <div className="control">
                  {obtenerRutCliente(otVer)}
                </div>
              </div>

              <div className="form-row">
                <div className="label">Obra / dirección</div>
                <div className="control">
                  {obtenerDireccion(otVer)}
                </div>
              </div>

              <div className="form-row">
                <div className="label">Contacto(s)</div>
                <div className="control">
                  {contactosOTVer && contactosOTVer.trim().length > 0
                    ? contactosOTVer
                    : "—"}
                </div>
              </div>

              <div className="form-row">
                <div className="label">Orden de compra</div>
                <div className="control">
                  {obtenerOrdenCompra(otVer)}
                </div>
              </div>

              <div className="form-row">
                <div className="label">Máquinas (serie)</div>
                <div className="control">
                  {seriesOTVer.length === 0
                    ? "—"
                    : seriesOTVer.join(", ")}
                </div>
              </div>

              <div className="form-row">
                <div className="label">Detalle líneas</div>
                <div className="control">
                  {lineasOTVer.length === 0 ? (
                    <div>—</div>
                  ) : (
                    <table
                      className="admin-table"
                      style={{ marginTop: 4 }}
                    >
                      <thead>
                        <tr>
                          <th>Serie</th>
                          <th>Unidad</th>
                          <th>Cant.</th>
                          <th>Desde</th>
                          <th>Hasta</th>
                          <th>Valor</th>
                          <th>Flete</th>
                          <th>Neto</th>
                          <th>IVA</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineasOTVer.map((l, idx) => (
                          <tr key={idx}>
                            <td>{l.serie || "—"}</td>
                            <td>{l.unidad || "—"}</td>
                            <td>{l.cantidadPeriodo || l.cantidad || "—"}</td>
                            <td>{formatearFecha(l.desde)}</td>
                            <td>{formatearFecha(l.hasta)}</td>
                            <td>{mostrarMonto(l.valor)}</td>
                            <td>{mostrarMonto(l.flete)}</td>
                            <td>{mostrarMonto(l.neto)}</td>
                            <td>{mostrarMonto(l.iva)}</td>
                            <td>{mostrarMonto(l.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="label">Totales</div>
                <div className="control">
                  <div>
                    Monto neto: {mostrarMonto(montoNetoOTVer)}
                  </div>
                  <div>IVA: {mostrarMonto(montoIvaOTVer)}</div>
                  <div>
                    <strong>
                      Total: {mostrarMonto(montoTotalOTVer)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="label">Observaciones</div>
                <div className="control">
                  {otVer.observaciones || "—"}
                </div>
              </div>
            </div>

            <div
              className="ot-modal-footer"
              style={{ justifyContent: "flex-end", gap: 8 }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => editarOrden(otVer)}
                disabled={tab === "pend-fact"}
                title={
                  tab === "pend-fact"
                    ? "No se puede editar una OT con facturación pendiente"
                    : undefined
                }
              >
                Editar OT
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={cerrarModalVer}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EMITIR DOCUMENTO */}
      {otEmitir && (
        <div
          className="ot-modal-backdrop"
          onClick={cerrarModalEmitir}
        >
          <div
            className="ot-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ot-modal-header">
              <div className="ot-modal-title">
                Emitir documento – OT {folioOT(otEmitir)}
              </div>
            </div>

            <div className="fieldset" style={{ marginTop: 8 }}>
              {tab === "pend-fact" ? (
                <>
                  <p style={{ marginBottom: 8 }}>
                    Orden de trabajo con guía de despacho N°xxxx.
                  </p>
                  <p>
                    Al confirmar se emitirá <strong>Factura N°xxxx</strong>.
                  </p>
                </>
              ) : esArriendo(otEmitir) ? (
                <>
                  <p style={{ marginBottom: 8 }}>
                    Esta orden corresponde a un{" "}
                    <strong>arriendo</strong>.
                  </p>
                  <p>
                    Se emitirá una{" "}
                    <strong>Guía de despacho (Gxxxx)</strong> para la
                    salida de la máquina de bodega.
                  </p>
                  <p style={{ marginTop: 8 }}>
                    ¿Cómo quieres registrar este movimiento?
                  </p>
                </>
              ) : esTraslado(otEmitir) ? (
                <>
                  <p style={{ marginBottom: 8 }}>
                    Esta orden corresponde a un{" "}
                    <strong>traslado de maquinaria</strong>.
                  </p>
                  <p>
                    Se emitirá una{" "}
                    <strong>Guía de despacho</strong> asociada al
                    movimiento (retiro y/o traslado entre obras).
                  </p>
                  <p style={{ marginTop: 8 }}>
                    Indica si el traslado será facturable (flete) o sólo
                    comprobante de retiro / entrega.
                  </p>
                </>
              ) : esVenta(otEmitir) ? (
                <>
                  <p style={{ marginBottom: 8 }}>
                    Esta orden corresponde a una{" "}
                    <strong>venta de maquinaria</strong>.
                  </p>
                  <p>
                    Al confirmar se emitirá directamente la{" "}
                    <strong>Factura electrónica</strong> asociada a esta
                    OT.
                  </p>
                </>
              ) : (
                <p>
                  No se reconoce el tipo de orden. Se intentará emitir
                  una guía de despacho estándar.
                </p>
              )}
            </div>

            <div
              className="ot-modal-footer"
              style={{ justifyContent: "flex-end", gap: 8 }}
            >
              {tab === "pend-fact" ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => emitirDesdeModal("cancelar")}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => emitirDesdeModal("facturable")}
                  >
                    Emitir FACTURA
                  </button>
                </>
              ) : esVenta(otEmitir) ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => emitirDesdeModal("cancelar")}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => emitirDesdeModal("facturable")}
                  >
                    Emitir FACTURA
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => emitirDesdeModal("cancelar")}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => emitirDesdeModal("no_facturable")}
                  >
                    Guía NO facturable
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => emitirDesdeModal("facturable")}
                  >
                    Guía facturable
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}







