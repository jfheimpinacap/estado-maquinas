import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";

const TIPOS = [
  { value: "", label: "Todos" },
  { value: "FACT", label: "Factura" },
  { value: "GD",   label: "Guía de despacho" },
  { value: "NC",   label: "Nota de crédito" },
  { value: "ND",   label: "Nota de débito" },
];

export default function BuscarDocumento({ setView }) {
  const { auth, backendURL } = useAuth();
  const [tipo, setTipo] = useState("");
  const [numero, setNumero] = useState("");
  const [cliente, setCliente] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const buscar = async () => {
    const params = new URLSearchParams();
    if (tipo) params.set("tipo", tipo);
    if (numero) params.set("numero", numero);
    if (cliente) params.set("cliente", cliente);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);

    setLoading(true);
    try {
      const res = await authFetch(`${backendURL}/documentos?${params.toString()}`, { token: auth?.access });
      const data = res.ok ? await res.json() : [];
      setRows(Array.isArray(data) ? data : data?.results || []);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const limpiar = () => {
    setTipo(""); setNumero(""); setCliente(""); setDesde(""); setHasta(""); setRows([]);
  };

  const actions = (
    <>
      <button className="btn btn-primary" onClick={buscar}>Buscar</button>
      <button className="btn btn-ghost" onClick={limpiar}>Limpiar</button>
    </>
  );

  return (
    <AdminLayout
      setView={setView}
      title="Buscar documentos"
      breadcrumbs={<>Documentos / Buscar</>}
      actions={actions}
    >
      <div className="fieldset">
        <div className="legend">Filtros</div>

        <div className="form-row">
          <div className="label">Tipo</div>
          <div className="control">
            <select className="select" value={tipo} onChange={(e)=>setTipo(e.target.value)}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="label">Número</div>
          <div className="control">
            <input className="input" value={numero} onChange={(e)=>setNumero(e.target.value)} placeholder="Ej: 12345"/>
          </div>
        </div>

        <div className="form-row">
          <div className="label">Cliente</div>
          <div className="control">
            <input className="input" value={cliente} onChange={(e)=>setCliente(e.target.value)} placeholder="Razón social o RUT"/>
          </div>
        </div>

        <div className="form-row">
          <div className="label">Rango fechas</div>
          <div className="control" style={{ display: "flex", gap: ".5rem" }}>
            <input className="input" type="date" value={desde} onChange={(e)=>setDesde(e.target.value)} />
            <input className="input" type="date" value={hasta} onChange={(e)=>setHasta(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="fieldset">
        <div className="legend">Resultados</div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Número</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Monto</th>
              <th>Asociaciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: "1rem", textAlign: "center", color: "var(--muted)" }}>Cargando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "1rem", textAlign: "center", color: "var(--muted)" }}>Sin resultados.</td></tr>
            ) : rows.map((d) => {
              const monto = d.monto_total ?? d.monto_neto ?? 0;
              const asociaciones = [];

              // Regla 1: FACT -> puede tener GD asociada (relacionado_con=GD) o ser PROL sin GD
              if (d.tipo === "FACT" && d.relacionado_con?.tipo === "GD") {
                asociaciones.push(`GD ${d.relacionado_con.numero}`);
              } else if (d.tipo === "FACT" && !d.relacionado_con) {
                asociaciones.push("Prolongación (sin GD)");
              }

              // Regla 2: FACT -> puede tener varias NC (están en relaciones_inversas)
              if (d.tipo === "FACT") {
                const ncs = (d.relaciones_inversas || []).filter(x => x.tipo === "NC");
                if (ncs.length) asociaciones.push(`NC: ${ncs.map(n => n.numero).join(", ")}`);
              }

              // Regla 3: NC -> puede tener varias ND asociadas (inversas de la NC)
              if (d.tipo === "NC") {
                const nds = (d.relaciones_inversas || []).filter(x => x.tipo === "ND");
                if (nds.length) asociaciones.push(`ND: ${nds.map(n => n.numero).join(", ")}`);
              }

              // Regla 4: GD (despacho vs retiro)
              if (d.tipo === "GD") {
                asociaciones.push(d.es_retiro ? "Guía de retiro (no facturable)" : "Guía de despacho (facturable)");
              }

              return (
                <tr key={d.id}>
                  <td>{d.tipo_display}</td>
                  <td>{d.numero}</td>
                  <td>{d.fecha_emision}</td>
                  <td>{d.cliente_razon || "—"}</td>
                  <td>{Number(monto).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}</td>
                  <td>{asociaciones.length ? asociaciones.join(" · ") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
