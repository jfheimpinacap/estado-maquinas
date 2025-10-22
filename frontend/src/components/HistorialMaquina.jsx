// src/components/HistorialMaquina.jsx
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";

export default function HistorialMaquina({ selectedMaquina, setView }) {
  const { auth, backendURL } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const m = selectedMaquina;

  useEffect(() => {
    const fetchHist = async () => {
      if (!m?.id) { setLoading(false); return; }
      try {
        const url = `${backendURL}/maquinarias/${m.id}/historial`;
        const res = await authFetch(url, { token: auth.access });
        const data = res.ok ? await res.json() : [];
        setItems(Array.isArray(data) ? data : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchHist();
  }, [backendURL, auth?.access, m?.id]);

  const ordenados = useMemo(() => {
    return [...items].sort((a, b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio));
  }, [items]);

  if (!m) {
    return (
      <AdminLayout
        setView={setView}
        title="Historial de la máquina"
        breadcrumbs={<>Maquinaria / Historial</>}
        actions={<button className="btn btn-ghost" onClick={() => setView("buscarMaquina")}>← Volver a búsqueda</button>}
      >
        <div className="fieldset">
          <p>No hay máquina seleccionada.</p>
        </div>
      </AdminLayout>
    );
  }

  const titulo = `${m.marca || ""} ${m.modelo || ""}`.trim();
  const subt = m.serie ? `Serie: ${m.serie}` : "";

  return (
    <AdminLayout
      setView={setView}
      title="Historial de la máquina"
      breadcrumbs={<>Maquinaria / Historial</>}
      actions={<button className="btn btn-ghost" onClick={() => setView("buscarMaquina")}>← Volver a búsqueda</button>}
    >
      <div className="fieldset">
        <div className="legend">Ficha</div>
        <div className="form-row">
          <div className="label">Equipo</div>
          <div className="control">
            <div style={{ fontWeight: 700 }}>{titulo || "Máquina"}</div>
            <div className="help-text">{subt || "—"}</div>
          </div>
        </div>
      </div>

      <div className="fieldset">
        <div className="legend">Historial</div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Fecha inicio</th>
              <th>Fecha término</th>
              <th>Obra</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: "1rem", textAlign: "center", color: "var(--muted)" }}>Cargando…</td></tr>
            ) : ordenados.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "1rem", textAlign: "center", color: "var(--muted)" }}>Sin historial.</td></tr>
            ) : (
              ordenados.map((h, i) => (
                <tr key={i}>
                  <td>{h.documento || "—"}</td>
                  <td>{h.fecha_inicio ? new Date(h.fecha_inicio).toLocaleDateString("es-CL") : "—"}</td>
                  <td>{h.fecha_termino ? new Date(h.fecha_termino).toLocaleDateString("es-CL") : "—"}</td>
                  <td>{h.obra || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

