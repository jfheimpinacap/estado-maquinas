// frontend/src/pages/EstadoArriendoMaquinas.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
  const { backendURL, authFetch } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("arriendo"); // "arriendo" | "bodega"
  const [rowsArriendo, setRowsArriendo] = useState([]);
  const [rowsBodega, setRowsBodega] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null); // fila seleccionada para el modal

  const cellStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 180,
  };

  async function cargarDatos(targetTab = "arriendo") {
    setLoading(true);
    try {
      const base =
        targetTab === "bodega"
          ? `${backendURL}/ordenes/estado-bodega`
          : `${backendURL}/ordenes/estado-arriendos`;

      const res = await authFetch(base);
      if (!res.ok) {
        console.error("Error al cargar estado:", res.status);
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data)) return;

      if (targetTab === "bodega") {
        setRowsBodega(data);
      } else {
        setRowsArriendo(data);
      }
    } catch (err) {
      console.error("Error de red en estado de arriendos:", err);
    } finally {
      setLoading(false);
    }
  }

  // Carga inicial: arriendos
  useEffect(() => {
    cargarDatos("arriendo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentRows = tab === "bodega" ? rowsBodega : rowsArriendo;

  const handleChangeTab = (nuevo) => {
    setTab(nuevo);
    // Si esa pestaña no tiene datos aún, los cargamos
    if (nuevo === "bodega" && rowsBodega.length === 0) {
      cargarDatos("bodega");
    }
    if (nuevo === "arriendo" && rowsArriendo.length === 0) {
      cargarDatos("arriendo");
    }
  };

  const handleRetiroClick = (row) => {
    // Guardamos un borrador para CrearOT.jsx
    const borrador = {
      arriendo_id: row.id, // id del arriendo
      serie: row.serie || "",
      obra: row.obra || "",
      orden_compra: row.orden_compra || "",
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

    navigate("/ordenes/nueva");
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
              background:
                tab === "arriendo" ? "rgba(201,66,23,0.9)" : "transparent",
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
              background:
                tab === "bodega" ? "rgba(201,66,23,0.9)" : "transparent",
              color: tab === "bodega" ? "#fff" : "inherit",
            }}
          >
            Bodega
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="admin-card">
        {loading && (
          <div className="admin-card-header">
            <span className="badge">Cargando...</span>
          </div>
        )}

        <div className="admin-table-wrapper">
          <table className="admin-table">
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
                <th style={{ textAlign: "center" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {currentRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={15} style={{ textAlign: "center", padding: 12 }}>
                    No hay registros para mostrar.
                  </td>
                </tr>
              )}

              {currentRows.map((row) => (
                <tr key={`${tab}-${row.id}`}>
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
                  <td style={cellStyle}>
                    {formatearFecha(row.factura_fecha)}
                  </td>
                  <td style={cellStyle}>{row.orden_compra || ""}</td>
                  <td style={cellStyle}>{row.vendedor || ""}</td>
                  <td style={{ padding: "4px 8px" }}>
                    {tab === "arriendo" ? (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          justifyContent: "center",
                          alignItems: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => setSel(row)}
                          style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          className="btn btn-warning btn-xs"
                          onClick={() => handleRetiroClick(row)}
                          style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                        >
                          Retiro
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => setSel(row)}
                        style={{
                          padding: "2px 8px",
                          fontSize: "0.75rem",
                          display: "block",
                          margin: "0 auto",
                        }}
                      >
                        Ver
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL VER DETALLE */}
      {sel && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Detalle del movimiento / arriendo</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSel(null)}
              >
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
                      {sel.documento || "—"}{" "}
                      {sel.doc_fecha && `· ${formatearFecha(sel.doc_fecha)}`}
                    </div>
                  </div>
                  <div>
                    <strong>Factura asociada</strong>
                    <div>
                      {sel.factura
                        ? `${sel.factura} · ${formatearFecha(
                            sel.factura_fecha
                          )}`
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
                  <strong>Marca / modelo:</strong>{" "}
                  {sel.marca} {sel.modelo}
                </div>
                <div>
                  <strong>Serie:</strong> {sel.serie || "—"}
                </div>
                <div>
                  <strong>Altura:</strong>{" "}
                  {sel.altura != null ? `${sel.altura} m` : "—"}
                </div>
              </section>

              <section className="modal-section">
                <h3>Arriendo</h3>
                <div>
                  <strong>Obra:</strong> {sel.obra || "—"}
                </div>
                <div>
                  <strong>Periodo:</strong>{" "}
                  {formatearFecha(sel.desde)} {" → "}{" "}
                  {formatearFecha(sel.hasta)}
                </div>
              </section>

              <section className="modal-section">
                <h3>Orden de trabajo</h3>
                <div>
                  <strong>OT:</strong> {sel.ot_folio || "—"}{" "}
                  {sel.ot_tipo && `(${sel.ot_tipo})`}
                </div>
                <div>
                  <strong>O/C Cliente:</strong>{" "}
                  {sel.orden_compra || "—"}
                </div>
                <div>
                  <strong>Vendedor:</strong> {sel.vendedor || "—"}
                </div>
              </section>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSel(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}







