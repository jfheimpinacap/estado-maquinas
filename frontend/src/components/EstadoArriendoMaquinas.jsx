// src/components/EstadoArriendoMaquinas.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

function formatearFecha(valor) {
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
}

export default function EstadoArriendoMaquinas({ setView }) {
  const { auth, backendURL } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null); // para modal "ver"

  const cargar = async () => {
    setLoading(true);
    try {
      const url =
        `${backendURL}/ordenes/estado-arriendos` +
        (q ? `?query=${encodeURIComponent(q)}` : "");

      const res = await authFetch(url, {
        method: "GET",
        backendURL,
        token: auth?.access,
        refreshToken: auth?.refresh,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Error al cargar estado de arriendos");
      }

      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Error al cargar estado de arriendos");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Iniciar flujo de RETIRO desde un arriendo vigente =====
  const iniciarRetiro = (r) => {
    try {
      const borrador = {
        modo: "RETIRO",
        // datos del arriendo
        arriendo_id: r.id,
        documento: r.documento || "",
        doc_tipo: r.doc_tipo || "",
        doc_numero: r.doc_numero || "",
        doc_fecha: r.doc_fecha || "",
        // máquina
        marca: r.marca || "",
        modelo: r.modelo || "",
        serie: r.serie || "",
        // periodo
        desde: r.desde || "",
        hasta: r.hasta || "",
        // cliente / obra
        cliente: r.cliente || "",
        rut_cliente: r.rut_cliente || "",
        obra: r.obra || "",
        // OT / OC
        ot_id: r.ot_id || null,
        ot_folio: r.ot_folio || "",
        orden_compra: r.orden_compra || "",
      };

      localStorage.setItem("ot_borrador_retiro", JSON.stringify(borrador));
    } catch (e) {
      console.error("Error al guardar borrador de retiro", e);
      toast.error("No se pudo preparar el borrador de retiro.");
      return;
    }

    // Navegación a CrearOT
    if (typeof setView === "function") {
      setView("crear-ot");
    } else {
      toast.info(
        "Borrador de retiro preparado. Conecta la navegación para ir a Crear OT."
      );
    }
  };

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Estado de arriendo de máquinas</h1>
        <div className="breadcrumbs">Estado de máquinas / Arriendos</div>
      </header>

      {/* Filtros */}
      <div className="admin-card" style={{ marginBottom: 14 }}>
        <div className="fieldset">
          <div className="legend">Filtros</div>

          <div className="form-row">
            <div className="label">Buscar</div>
            <div className="control" style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="Cliente, RUT, serie, marca, obra..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={cargar}
                disabled={loading}
              >
                {loading ? "Buscando..." : "Filtrar"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setQ("");
                  cargar();
                }}
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla principal */}
      <div className="admin-card">
        <div className="fieldset">
          <div className="legend">Arriendos vigentes</div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Marca / modelo</th>
                <th>Serie</th>
                <th>Desde</th>
                <th>Hasta</th>
                <th>Cliente</th>
                <th>RUT</th>
                <th>Obra</th>
                <th>OT</th>
                <th>OC</th>
                <th>Vendedor</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    style={{
                      padding: "1rem",
                      textAlign: "center",
                      color: "var(--muted)",
                    }}
                  >
                    {loading
                      ? "Cargando arriendos..."
                      : "No hay arriendos activos que coincidan con el filtro."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.documento || "—"}</td>
                    <td>
                      {r.marca || r.modelo
                        ? `${r.marca || ""} ${r.modelo || ""}`.trim()
                        : "—"}
                    </td>
                    <td>{r.serie || "—"}</td>
                    <td>{formatearFecha(r.desde)}</td>
                    <td>{formatearFecha(r.hasta)}</td>
                    <td>{r.cliente || "—"}</td>
                    <td>{r.rut_cliente || "—"}</td>
                    <td>{r.obra || "—"}</td>
                    <td>{r.ot_folio || "—"}</td>
                    <td>{r.orden_compra || "—"}</td>
                    <td>—{/* Vendedor: se agregará más adelante */}</td>
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
                          onClick={() => setSel(r)}
                        >
                          Ver
                        </button>
                        {/* Botón RETIRO: siempre es arriendo en esta vista */}
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => iniciarRetiro(r)}
                          title="Crear OT de retiro (guía no facturable a bodega)"
                        >
                          Retiro
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal VER detalle de documento/arriendo */}
      {sel && (
        <div
          className="ot-modal-backdrop"
          onClick={() => setSel(null)}
        >
          <div
            className="ot-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ot-modal-header">
              <div className="ot-modal-title">
                Detalle arriendo – {sel.documento || "sin documento"}
              </div>
            </div>

            <div className="fieldset" style={{ marginTop: 8 }}>
              <div className="form-row">
                <div className="label">Cliente</div>
                <div className="control">
                  {sel.cliente} ({sel.rut_cliente || "s/RUT"})
                </div>
              </div>
              <div className="form-row">
                <div className="label">Máquina</div>
                <div className="control">
                  {sel.marca || sel.modelo
                    ? `${sel.marca || ""} ${sel.modelo || ""}`.trim()
                    : "—"}{" "}
                  – Serie {sel.serie || "—"}
                </div>
              </div>
              <div className="form-row">
                <div className="label">Periodo</div>
                <div className="control">
                  {formatearFecha(sel.desde)} → {formatearFecha(sel.hasta)}
                </div>
              </div>
              <div className="form-row">
                <div className="label">Obra</div>
                <div className="control">{sel.obra || "—"}</div>
              </div>
              <div className="form-row">
                <div className="label">OT / OC</div>
                <div className="control">
                  OT: {sel.ot_folio || "—"} · OC: {sel.orden_compra || "—"}
                </div>
              </div>
            </div>

            <div className="ot-modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSel(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}




