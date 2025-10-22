import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";

export default function EstadoOrdenes({ setView }) {
  const { auth, backendURL } = useAuth();
  const [rows, setRows] = useState([]);
  const [soloPend, setSoloPend] = useState(true);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const url = `${backendURL}/ordenes?solo_pendientes=${soloPend ? "true" : "false"}`;
      const res = await authFetch(url, { token: auth?.access });
      const data = res.ok ? await res.json() : [];
      setRows(Array.isArray(data) ? data : data?.results || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [soloPend]);

  const actions = (
    <>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" checked={soloPend} onChange={(e)=>setSoloPend(e.target.checked)} />
        <span>Solo pendientes</span>
      </label>
      <button className="btn btn-ghost" onClick={load}>Refrescar</button>
    </>
  );

  return (
    <AdminLayout
      setView={setView}
      title="Estado de arriendos y servicios"
      breadcrumbs={<>Arriendos / Estado</>}
      actions={actions}
    >
      <div className="fieldset">
        <div className="legend">Resumen</div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>OT</th>
              <th>Tipo</th>
              <th>Cliente</th>
              <th>Maquinaria</th>
              <th>Estado</th>
              <th>Facturable</th>
              <th>Factura</th>
              <th>Guía</th>
              <th>Creada</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: "1rem", textAlign: "center", color: "var(--muted)" }}>Cargando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: "1rem", textAlign: "center", color: "var(--muted)" }}>Sin datos.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td>{r.tipo_display}</td>
                <td>{r.cliente_razon}</td>
                <td>{r.maquinaria_label || "—"}</td>
                <td>{r.estado_display}</td>
                <td>{r.es_facturable ? "Sí" : "No"}</td>
                <td>{r.factura ? `${r.factura.tipo_display} ${r.factura.numero}` : "—"}</td>
                <td>{r.guia ? `${r.guia.tipo_display} ${r.guia.numero}` : "—"}</td>
                <td>{new Date(r.fecha_creacion).toLocaleString("es-CL")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
