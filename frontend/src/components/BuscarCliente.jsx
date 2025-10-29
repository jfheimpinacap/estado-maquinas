// src/components/BuscarCliente.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";

export default function BuscarCliente({ setView, setSelectedCliente }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const { auth, backendURL } = useAuth();

  useEffect(() => {
    const q = localStorage.getItem("buscar:lastQuery") || "";
    const raw = localStorage.getItem("buscar:lastResults");
    if (raw) {
      setQuery(q);
      try { setResultados(JSON.parse(raw)); } catch {}
    }
  }, []);

  const handleBuscar = async () => {
    try {
      const url = `${backendURL}/clientes?query=${encodeURIComponent(query)}`;
      const res = await authFetch(url, { token: auth.access });
      if (!res.ok) throw new Error("Error al buscar clientes");
      const data = await res.json();
      setResultados(data);
      localStorage.setItem("buscar:lastQuery", query);
      localStorage.setItem("buscar:lastResults", JSON.stringify(data));
    } catch (error) {
      console.error("❌ Error en la búsqueda:", error);
      setResultados([]);
    }
  };

  const handleLimpiar = () => {
    setQuery("");
    setResultados([]);
    localStorage.removeItem("buscar:lastQuery");
    localStorage.removeItem("buscar:lastResults");
  };

  return (
    <>
      {/* Grid: izquierda (Parámetros + Resultados) / derecha (Filtro) */}
      <div className="main-grid">
        {/* Columna izquierda */}
        <div>
          {/* Parámetros */}
          <div className="admin-card" style={{ marginBottom: 14 }}>
            <div className="fieldset">
              <div className="legend">Parámetros</div>

              <div className="form-row">
                <div className="label">Término</div>
                <div className="control search-compact">
                  <input
                    className="input"
                    placeholder="Razón social o RUT"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                  />
                  <small className="help-text">Presiona Enter para buscar rápidamente.</small>
                </div>
              </div>

              <div className="form-row" style={{ gridTemplateColumns: "14rem 1fr" }}>
                <div className="label" />
                <div className="control" style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleBuscar}>Buscar</button>
                  <button className="btn btn-ghost" onClick={handleLimpiar}>Limpiar</button>
                </div>
              </div>
            </div>
          </div>

          {/* Resultados (mismo ancho que Parámetros) */}
          <div className="admin-card">
            <div className="fieldset">
              <div className="legend">Resultados</div>
              <table className="dja-table">
                <thead>
                  <tr>
                    <th>Razón Social</th>
                    <th>RUT</th>
                    <th>Dirección</th>
                    <th>Correo</th>
                    <th>Teléfono</th>
                    <th>Forma de Pago</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "14px", textAlign: "center", color: "var(--muted)" }}>
                        Ingresa un término de búsqueda o no hay resultados.
                      </td>
                    </tr>
                  ) : resultados.map((c) => (
                    <tr key={c.id}>
                      <td>{c.razon_social}</td>
                      <td>{c.rut}</td>
                      <td>{c.direccion || "—"}</td>
                      <td>{c.correo_electronico || "—"}</td>
                      <td>{c.telefono || "—"}</td>
                      <td>{c.forma_pago || "—"}</td>
                      <td>
                        <button
                          className="btn btn-primary"
                          onClick={() => { setSelectedCliente(c); setView("ver-cliente"); }}
                        >
                          Ver cliente
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Columna derecha: Filtro */}
        <aside className="admin-filter">
          <div className="admin-filter__title">FILTRO</div>
          <div style={{ padding: 8 }}>
            <details open>
              <summary>Mostrar recuentos</summary>
              <div className="mt-1 text-muted">—</div>
            </details>

            <details className="mt-2" open>
              <summary>Por forma de pago</summary>
              <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 1.8 }}>
                <li><button onClick={() => alert("Filtro: Todo")}>Todo</button></li>
                <li><button onClick={() => alert("Pago a 15 días")}>Pago a 15 días</button></li>
                <li><button onClick={() => alert("Pago a 30 días")}>Pago a 30 días</button></li>
                <li><button onClick={() => alert("Pago contado")}>Pago contado</button></li>
              </ul>
            </details>
          </div>
        </aside>
      </div>
    </>
  );
}

















