// src/components/EstadoOrdenes.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

const MAP_TIPO_LABEL = {
  A: "Arriendo",
  V: "Venta",
  T: "Traslado",
};

const PREFIX_TIPO = {
  A: "A",
  V: "V",
  T: "T",
};

export default function EstadoOrdenes({ setView }) {
  const { auth, backendURL } = useAuth();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(false);

  const [fTipo, setFTipo] = useState("");     // filtro por tipo (A / V / T)
  const [fEstado, setFEstado] = useState(""); // filtro por estado_display

  // ===== Cargar órdenes desde backend =====
  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${backendURL}/ordenes`, {
        token: auth?.access,
      });
      if (!res.ok) throw new Error("Error al cargar órdenes de trabajo");
      const data = await res.json();
      setOrdenes(Array.isArray(data) ? data : []);
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

  // ===== estados disponibles para el filtro =====
  const estadosDisponibles = useMemo(() => {
    const set = new Set(
      ordenes
        .map((o) => o.estado_display || o.estado)
        .filter(Boolean)
    );
    return Array.from(set);
  }, [ordenes]);

  // ===== Helpers de visualización =====
  const folioOT = (o) => {
    const pref = PREFIX_TIPO[o.tipo] || "OT";
    const idNum = Number(o.id || 0);
    const suf = idNum > 0 ? String(idNum).padStart(4, "0") : "----";
    return `${pref}${suf}`;
  };

  const labelTipo = (o) => {
    return o.tipo_display || MAP_TIPO_LABEL[o.tipo] || o.tipo || "—";
  };

  const labelEstado = (o) => {
    // Regla: si es Venta y no trae estado legible, mostramos "Pendiente de facturar"
    const base = o.estado_display || o.estado;
    if (o.tipo === "V" && !base) return "Pendiente de facturar";
    return base || "—";
  };

  // ===== Vista: solo OT activas (sin fecha_cierre) + filtros =====
  const filtradas = useMemo(() => {
    return ordenes.filter((o) => {
      // solo OT "actuales/activas": sin fecha_cierre
      if (o.fecha_cierre) return false;

      if (fTipo && o.tipo !== fTipo) return false;

      const est = o.estado_display || o.estado || "";
      if (fEstado && est !== fEstado) return false;

      return true;
    });
  }, [ordenes, fTipo, fEstado]);

  // ===== Acciones / botones =====

  // PATCH genérico (por si luego quieres persistir cambios en estado / es_facturable)
  const patchOrden = async (id, payload) => {
    const res = await authFetch(`${backendURL}/ordenes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      token: auth?.access,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let msg = `Error ${res.status} al actualizar la orden`;
      try {
        const data = await res.json();
        if (data && typeof data === "object") {
          const parts = [];
          for (const [k, v] of Object.entries(data)) {
            parts.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
          }
          if (parts.length) msg = parts.join(" | ");
        }
      } catch {
        // ignorar error al parsear
      }
      throw new Error(msg);
    }
    return res.json();
  };

  const emitirGuia = async (ot) => {
    // sólo aplica a Arriendo o Traslado
    if (ot.tipo !== "A" && ot.tipo !== "T") return;

    const esFacturable = window.confirm(
      "¿Este movimiento es facturable?\n\nSi aceptas, la OT quedará 'Pendiente de facturar'."
    );

    try {
      // Aquí más adelante se deberá:
      // 1) Crear la Guía (Gxxxx) en el backend.
      // 2) Marcar la OT como asociada a esa guía.
      // 3) Cambiar el estado a 'pendiente de facturar' si corresponde.

      // Como primer paso, dejamos un PATCH de ejemplo sobre es_facturable
      if (esFacturable) {
        await patchOrden(ot.id, {
          es_facturable: true,
          // Ajusta el valor de 'estado' según tus choices reales:
          // p.ej. 'pendiente' ↔ "Pendiente de facturar"
          estado: "pendiente",
        });

        // Actualizamos el estado local para que se vea el cambio sin recargar
        setOrdenes((prev) =>
          prev.map((o) =>
            o.id === ot.id
              ? { ...o, es_facturable: true, estado: "pendiente", estado_display: "Pendiente de facturar" }
              : o
          )
        );

        toast.success("Guía emitida (placeholder) y OT marcada como pendiente de facturar.");
      } else {
        await patchOrden(ot.id, {
          es_facturable: false,
        });
        setOrdenes((prev) =>
          prev.map((o) =>
            o.id === ot.id ? { ...o, es_facturable: false } : o
          )
        );
        toast.info("Guía emitida como NO facturable (placeholder).");
      }
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Error al procesar la guía.");
    }
  };

  const emitirFactura = (ot) => {
    // Más adelante: redirigir a un módulo "Emitir documentos"
    // donde se confirme la guía asociada, etc.
    console.log("Emitir factura para OT:", ot);
    toast.info("La pantalla de emisión de factura se implementará más adelante.");
    // Ej futuro:
    // setSelectedOT(ot);
    // setView("emitir-documento");
  };

  const emitirOtroDoc = (ot) => {
    console.log("Emitir otro documento para OT:", ot);
    toast.info("Módulo 'Emitir otros documentos' se implementará más adelante.");
  };

  const verDetalles = (ot) => {
    console.log("Ver detalles OT:", ot);
    toast.info("Vista de detalles de la OT se implementará más adelante.");
    // Ej futuro:
    // setSelectedOT(ot);
    // setView("ver-ot");
  };

  // ===== Render =====
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Órdenes de trabajo activas</h1>
        <div className="breadcrumbs">Estado de máquinas / Órdenes de trabajo</div>
      </div>

      {/* Filtros superiores */}
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
                <option value="">Todos</option>
                <option value="A">Arriendo</option>
                <option value="V">Venta</option>
                <option value="T">Traslado</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="label">Estado</div>
            <div className="control">
              <select
                className="select"
                value={fEstado}
                onChange={(e) => setFEstado(e.target.value)}
                style={{ maxWidth: 260 }}
              >
                <option value="">Todos</option>
                {estadosDisponibles.map((est) => (
                  <option key={est} value={est}>
                    {est}
                  </option>
                ))}
              </select>
              <div className="help-text">
                Por ejemplo: pendiente de facturar, facturado, etc.
              </div>
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
                onClick={() => {
                  setFTipo("");
                  setFEstado("");
                }}
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
                <th>Orden de Trabajo</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
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
                  const esArriendoOTraslado = o.tipo === "A" || o.tipo === "T";
                  const esVenta = o.tipo === "V";

                  return (
                    <tr key={o.id}>
                      <td>{folioOT(o)}</td>
                      <td>{labelTipo(o)}</td>
                      <td>{o.cliente_razon || "—"}</td>
                      <td>{labelEstado(o)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {esArriendoOTraslado && (
                            <button
                              className="btn btn-primary"
                              type="button"
                              onClick={() => emitirGuia(o)}
                            >
                              Emitir guía
                            </button>
                          )}

                          {esVenta && (
                            <button
                              className="btn btn-primary"
                              type="button"
                              onClick={() => emitirFactura(o)}
                            >
                              Emitir factura
                            </button>
                          )}

                          {/* Botón genérico para otros documentos */}
                          <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => emitirOtroDoc(o)}
                          >
                            Emitir otro documento
                          </button>

                          {/* Siempre disponible */}
                          <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => verDetalles(o)}
                          >
                            Ver detalles
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


