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

export default function EstadoOrdenes({ setView }) {
  const { auth, backendURL } = useAuth();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(false);

  // único filtro: Tipo (Arriendo / Venta / Traslado / Ver todo)
  const [fTipo, setFTipo] = useState(""); // A / V / T / ""

  // ===== Cargar órdenes desde backend =====
  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${backendURL}/ordenes`, {
        token: auth?.access,
      });
      if (!res.ok) throw new Error("Error al cargar órdenes de trabajo");
      const data = await res.json();

      // Soportar tanto lista directa como paginada { results: [...] }
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

  // ===== Helpers =====
  const folioOT = (o) => {
    const pref = PREFIX_TIPO[o.tipo] || "OT";
    const idNum = Number(o.id || 0);
    const suf = idNum > 0 ? String(idNum).padStart(4, "0") : "----";
    return `${pref}${suf}`;
  };

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

  const obtenerCliente = (o) => o.cliente_razon || o.meta_cliente || "—";

  const obtenerRutCliente = (o) => {
    return (
      o.cliente_rut ||
      o.rut_cliente ||
      extraerRutDeTexto(o.cliente_razon) ||
      extraerRutDeTexto(o.meta_cliente) ||
      "—"
    );
  };

  const obtenerDireccion = (o) =>
    o.direccion || o.meta_direccion || o.meta_obra || "—";

  const obtenerSeries = (o) => {
    let lineas = [];
    if (Array.isArray(o.lineas)) lineas = o.lineas;
    else if (Array.isArray(o.detalles)) lineas = o.detalles;

    return lineas
      .map((l) => l.serie)
      .filter((s) => s && String(s).trim().length > 0);
  };

  // ===== Vista: solo OT activas (sin fecha_cierre) + filtro de tipo =====
  const filtradas = useMemo(() => {
    return ordenes.filter((o) => {
      // Solo OT "activas": sin fecha_cierre
      if (o.fecha_cierre) return false;

      if (fTipo && o.tipo !== fTipo) return false;

      return true;
    });
  }, [ordenes, fTipo]);

  // ===== Acciones =====
  const verOrden = (ot) => {
    console.log("Ver OT", ot);
    toast.info("La vista detallada de la OT se implementará más adelante.");
    // Futuro:
    // setSelectedOT(ot);
    // setView("ver-ot");
  };

  const emitirOrden = (ot) => {
    console.log("Emitir OT", ot);
    toast.info("El módulo de emisión de documentos se implementará más adelante.");
  };

  const eliminarOrden = async (ot) => {
    const folio = folioOT(ot);
    const ok = window.confirm(
      `¿Seguro que deseas eliminar la orden de trabajo ${folio}?\n\nEsta acción no se puede deshacer.`
    );
    if (!ok) return;

    try {
      const res = await authFetch(`${backendURL}/ordenes/${ot.id}`, {
        method: "DELETE",
        token: auth?.access,
      });

      if (!res.ok && res.status !== 204) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Error ${res.status} al eliminar la orden`);
      }

      setOrdenes((prev) => prev.filter((o) => o.id !== ot.id));
      toast.success(`Orden de trabajo ${folio} eliminada`);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Error al eliminar la orden de trabajo");
    }
  };

  // ===== Render =====
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Órdenes de trabajo activas</h1>
        <div className="breadcrumbs">
          Estado de máquinas / Órdenes de trabajo
        </div>
      </div>

      {/* Filtro superior (solo tipo) */}
      <div className="admin-card" style={{ marginBottom: 14 }}>
        <div className="fieldset">
          <div className="legend">Filtros</div>

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
            <div className="control" style={{ display: "flex", gap: 8 }}>
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

      {/* Tabla de órdenes activas */}
      <div className="admin-card">
        <div className="fieldset">
          <div className="legend">Órdenes de trabajo actuales</div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>OT</th>
                <th>Fecha creación</th>
                <th>Cliente</th>
                <th>RUT cliente</th>
                <th>Dirección</th>
                <th>Máquinas (serie)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: "1rem",
                      textAlign: "center",
                      color: "var(--muted)",
                    }}
                  >
                    {loading
                      ? "Cargando órdenes..."
                      : "No hay órdenes activas que coincidan con los filtros."}
                  </td>
                </tr>
              ) : (
                filtradas.map((o) => {
                  const folio = folioOT(o);
                  const fecha = obtenerFechaCreacion(o);
                  const cliente = obtenerCliente(o);
                  const rut = obtenerRutCliente(o);
                  const direccion = obtenerDireccion(o);
                  const series = obtenerSeries(o);

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
                          : series.map((s, idx) => <div key={idx}>{s}</div>)}
                      </td>
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
                            onClick={() => emitirOrden(o)}
                          >
                            Emitir
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => eliminarOrden(o)}
                          >
                            Eliminar
                          </button>
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
    </>
  );
}




