// frontend/src/pages/EstadoArriendoMaquinas.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";

function formatearFecha(fecha) {
  if (!fecha) return "—";
  try {
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return String(fecha);
    return d.toLocaleDateString("es-CL");
  } catch {
    return String(fecha);
  }
}

export default function EstadoArriendoMaquinas() {
  const { backendURL, auth } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("arriendo"); // "arriendo" | "bodega"
  const [rowsArriendo, setRowsArriendo] = useState([]);
  const [rowsBodega, setRowsBodega] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null);
  const [hoverKey, setHoverKey] = useState(null);

  // ⚙️ Ajusta esta ruta si tu CrearOT vive en otro path
  const CREAR_OT_PATH = "/ordenes/nueva";

  const cellStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 180,
  };

  const tableBaseStyle = {
    border: 0,
    borderRadius: 0,
    boxShadow: "none",
    borderCollapse: "separate",
    borderSpacing: 0,
  };

  async function cargarDatos(targetTab = "arriendo") {
    setLoading(true);
    try {
      const base =
        targetTab === "bodega"
          ? `${backendURL}/ordenes/estado-bodega`
          : `${backendURL}/ordenes/estado-arriendos`;

      const res = await authFetch(base, {
        method: "GET",
        backendURL,
        token: auth?.access,
        refreshToken: auth?.refresh,
      });

      if (!res.ok) {
        console.error("Error al cargar estado:", res.status);
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data)) return;

      if (targetTab === "bodega") setRowsBodega(data);
      else setRowsArriendo(data);
    } catch (err) {
      console.error("Error de red en estado de arriendos:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos("arriendo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentRows = tab === "bodega" ? rowsBodega : rowsArriendo;

  const handleChangeTab = (nuevo) => {
    setTab(nuevo);
    if (nuevo === "bodega" && rowsBodega.length === 0) cargarDatos("bodega");
    if (nuevo === "arriendo" && rowsArriendo.length === 0) cargarDatos("arriendo");
  };

  const handleRetiroClick = (e, row) => {
    e.preventDefault();
    e.stopPropagation();

    const borrador = {
      arriendo_id: row.id, // en /estado-arriendos el id es del arriendo
      serie: row.serie || "",
      obra: row.obra || "",
      orden_compra: row.orden_compra || row.oc || "",
      doc_fecha: row.doc_fecha || null,
      desde: row.desde || null,
      hasta: row.hasta || null,
      cliente: row.cliente || "",
      rut_cliente: row.rut_cliente || "",
    };

    try {
      localStorage.setItem("ot_borrador_retiro", JSON.stringify(borrador));
    } catch (err) {
      console.warn("No se pudo guardar ot_borrador_retiro:", err);
    }

    // ✅ Señal explícita para que CrearOT abra en modo Retiro
    navigate(`${CREAR_OT_PATH}?tipo=RETIRO`);
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Estado de arriendo de máquinas</h1>
        <p className="admin-subtitle">
          Visualización de arriendos activos y máquinas en bodega.
        </p>
      </div>

      {/* Tabs Arriendo / Bodega */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "inline-flex",
            borderRadius: 999,
            border: "1px solid rgba(255, 255, 255, 0.12)",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => handleChangeTab("arriendo")}
            style={{
              padding: "6px 16px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              background: tab === "arriendo" ? "rgba(201,66,23,0.9)" : "transparent",
              color: tab === "arriendo" ? "#fff" : "inherit",
            }}
          >
            En arriendo
          </button>
          <button
            type="button"
            onClick={() => handleChangeTab("bodega")}
            style={{
              padding: "6px 16px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              background: tab === "bodega" ? "rgba(201,66,23,0.9)" : "transparent",
              color: tab === "bodega" ? "#fff" : "inherit",
            }}
          >
            Bodega
          </button>
        </div>
      </div>

      {/* ✅ UNA sola tabla + última columna sticky (Acción) */}
      <div className="admin-card" style={{ overflow: "hidden" }}>
        {loading && (
          <div className="admin-card-header">
            <span className="badge">Cargando...</span>
          </div>
        )}

        <div className="ea-scroll">
          <table
            className="admin-table ea-table"
            style={{
              ...tableBaseStyle,
              width: "100%",
              minWidth: 2200, // mantiene tu tabla ancha
            }}
          >
            <thead>
              <tr>
                <th>Marca / Modelo</th>
                <th>Altura</th>
                <th>Serie</th>
                <th>Cliente</th>
                <th>Obra</th>
                <th>Desde</th>
                <th>Hasta</th>
                <th>Orden</th>
                <th>Documento</th>
                <th>Fecha doc.</th>
                <th>Factura</th>
                <th>Fecha fact.</th>
                <th>O/C Cliente</th>
                <th>Vendedor</th>
                <th className="ea-sticky-col" style={{ textAlign: "center" }}>
                  Acción
                </th>
              </tr>
            </thead>

            <tbody>
              {currentRows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={15} style={{ textAlign: "center", padding: 12 }}>
                    No hay registros para mostrar.
                  </td>
                </tr>
              ) : (
                currentRows.map((row) => {
                  const key = `${tab}-${row.id}`;
                  const isHover = hoverKey === key;
                  const hoverStyle = isHover ? { background: "rgba(255,255,255,.03)" } : undefined;

                  return (
                    <tr
                      key={key}
                      onMouseEnter={() => setHoverKey(key)}
                      onMouseLeave={() => setHoverKey(null)}
                      style={hoverStyle}
                    >
                      <td style={cellStyle}>
                        {row.marca} {row.modelo}
                      </td>
                      <td style={cellStyle}>
                        {row.altura != null ? Number(row.altura).toFixed(2) : "—"}
                      </td>
                      <td style={cellStyle}>{row.serie}</td>
                      <td style={cellStyle}>{row.cliente}</td>
                      <td style={cellStyle}>{row.obra}</td>
                      <td style={cellStyle}>{formatearFecha(row.desde)}</td>
                      <td style={cellStyle}>{formatearFecha(row.hasta)}</td>
                      <td style={cellStyle}>{row.ot_folio || "—"}</td>
                      <td style={cellStyle}>{row.documento || "—"}</td>
                      <td style={cellStyle}>{formatearFecha(row.doc_fecha)}</td>
                      <td style={cellStyle}>{row.factura || ""}</td>
                      <td style={cellStyle}>{formatearFecha(row.factura_fecha)}</td>
                      <td style={cellStyle}>{row.orden_compra || ""}</td>
                      <td style={cellStyle}>{row.vendedor || ""}</td>

                      {/* ✅ Sticky cell (le aplicamos hover también) */}
                      <td className="ea-sticky-col" style={hoverStyle}>
                        <div className="ea-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSel(row);
                            }}
                            style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                          >
                            Ver
                          </button>

                          {tab === "arriendo" && (
                            <button
                              type="button"
                              className="btn btn-warning btn-xs"
                              onClick={(e) => handleRetiroClick(e, row)}
                              style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                            >
                              Retiro
                            </button>
                          )}
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

      {/* MODAL VER DETALLE */}
      {sel && (
        <div className="modal-backdrop" onClick={() => setSel(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0 }}>Detalle del movimiento / arriendo</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSel(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <section className="modal-section">
                <h3>Documento</h3>
                <div className="modal-grid">
                  <div>
                    <strong>Documento (movimiento)</strong>
                    <div>
                      {sel.documento || "—"} {sel.doc_fecha && `· ${formatearFecha(sel.doc_fecha)}`}
                    </div>
                  </div>
                  <div>
                    <strong>Factura asociada</strong>
                    <div>
                      {sel.factura
                        ? `${sel.factura} · ${formatearFecha(sel.factura_fecha)}`
                        : "Sin factura asociada"}
                    </div>
                  </div>
                </div>
              </section>

              <section className="modal-section">
                <h3>Cliente</h3>
                <div>
                  <strong>Razón social:</strong> {sel.cliente || "—"}
                </div>
                <div>
                  <strong>RUT:</strong> {sel.rut_cliente || "—"}
                </div>
              </section>

              <section className="modal-section">
                <h3>Maquinaria</h3>
                <div>
                  <strong>Marca / modelo:</strong> {sel.marca} {sel.modelo}
                </div>
                <div>
                  <strong>Serie:</strong> {sel.serie || "—"}
                </div>
                <div>
                  <strong>Altura:</strong> {sel.altura != null ? `${sel.altura} m` : "—"}
                </div>
              </section>

              <section className="modal-section">
                <h3>Arriendo</h3>
                <div>
                  <strong>Obra:</strong> {sel.obra || "—"}
                </div>
                <div>
                  <strong>Periodo:</strong> {formatearFecha(sel.desde)} {" → "} {formatearFecha(sel.hasta)}
                </div>
              </section>

              <section className="modal-section">
                <h3>Orden de trabajo</h3>
                <div>
                  <strong>OT:</strong> {sel.ot_folio || "—"} {sel.ot_tipo && `(${sel.ot_tipo})`}
                </div>
                <div>
                  <strong>O/C Cliente:</strong> {sel.orden_compra || "—"}
                </div>
                <div>
                  <strong>Vendedor:</strong> {sel.vendedor || "—"}
                </div>
              </section>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setSel(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}















