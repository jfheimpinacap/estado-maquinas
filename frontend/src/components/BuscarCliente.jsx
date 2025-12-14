// src/components/BuscarCliente.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { rutFormat, isRutLike } from "../lib/rut";

export default function BuscarCliente({ setView, setSelectedCliente }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);

  // paginación
  const [pageSize, setPageSize] = useState(10); // 10 / 25 / 50
  const [page, setPage] = useState(1);

  const { auth, backendURL } = useAuth();

  // --- Restaurar última búsqueda simple (sin paginación) ---
  useEffect(() => {
    const q = localStorage.getItem("buscar:lastQuery") || "";
    const raw = localStorage.getItem("buscar:lastResults");
    if (raw) {
      // si parece RUT, lo mostramos formateado
      const display = isRutLike(q) ? rutFormat(q) : q;
      setQuery(display);
      try {
        const parsed = JSON.parse(raw);
        setResultados(Array.isArray(parsed) ? parsed : []);
      } catch {
        // ignore
      }
    }
  }, []);

  // --- Paginación derivada ---
  const totalRegistros = resultados.length;
  const totalPages = Math.max(1, Math.ceil(totalRegistros / pageSize));

  useEffect(() => {
    setPage(1);
  }, [pageSize, totalRegistros]);

  const paginaResultados = useMemo(() => {
    if (totalRegistros === 0) return [];
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * pageSize;
    return resultados.slice(start, start + pageSize);
  }, [resultados, page, pageSize, totalPages, totalRegistros]);

  const rangoInicio = totalRegistros === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangoFin =
    totalRegistros === 0 ? 0 : Math.min(totalRegistros, page * pageSize);

  // --- Acciones ---

  const handleBuscar = async () => {
    try {
      const term = query.trim();
      const url = `${backendURL}/clientes?query=${encodeURIComponent(term)}`;
      const res = await authFetch(url, { token: auth.access });
      if (!res.ok) throw new Error("Error al buscar clientes");
      const data = await res.json();
      setResultados(Array.isArray(data) ? data : []);
      localStorage.setItem("buscar:lastQuery", term);
      localStorage.setItem("buscar:lastResults", JSON.stringify(data));
      setPage(1);
    } catch (error) {
      console.error("❌ Error en la búsqueda:", error);
      setResultados([]);
    }
  };

  const handleLimpiar = () => {
    setQuery("");
    setResultados([]);
    setPage(1);
    localStorage.removeItem("buscar:lastQuery");
    localStorage.removeItem("buscar:lastResults");
  };

  const handleListarTodo = async () => {
    try {
      const url = `${backendURL}/clientes`; // sin query → todos
      const res = await authFetch(url, { token: auth.access });
      if (!res.ok) throw new Error("Error al listar todos los clientes");
      const data = await res.json();
      setResultados(Array.isArray(data) ? data : []);
      localStorage.setItem("buscar:lastQuery", "");
      localStorage.setItem("buscar:lastResults", JSON.stringify(data));
      setQuery("");
      setPage(1);
    } catch (error) {
      console.error("❌ Error al listar todos:", error);
      setResultados([]);
    }
  };

  const smallBtn = {
    padding: "0.25rem 0.55rem",
    fontSize: "0.8rem",
  };

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Buscar cliente</h1>
      </header>

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
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (isRutLike(raw)) {
                        setQuery(rutFormat(raw));
                      } else {
                        setQuery(raw);
                      }
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                  />
                  <small className="help-text">
                    Escribe un nombre o un RUT. Si escribes un RUT, se
                    formateará como xx.xxx.xxx-x y la búsqueda lo entenderá
                    igual.
                  </small>
                </div>
              </div>

              <div
                className="form-row"
                style={{ gridTemplateColumns: "14rem 1fr" }}
              >
                <div className="label" />
                <div
                  className="control"
                  style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                >
                  <button className="btn btn-primary" onClick={handleBuscar}>
                    Buscar
                  </button>
                  <button className="btn btn-ghost" onClick={handleLimpiar}>
                    Limpiar
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={smallBtn}
                    onClick={handleListarTodo}
                  >
                    Listar todo
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Resultados */}
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
                  {paginaResultados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          padding: "14px",
                          textAlign: "center",
                          color: "var(--muted)",
                        }}
                      >
                        Ingresa un término de búsqueda, usa “Listar todo” o no
                        hay resultados.
                      </td>
                    </tr>
                  ) : (
                    paginaResultados.map((c) => (
                      <tr key={c.id}>
                        <td>{c.razon_social}</td>
                        <td>{c.rut ? rutFormat(c.rut) : "—"}</td>
                        <td>{c.direccion || "—"}</td>
                        <td>{c.correo_electronico || "—"}</td>
                        <td>{c.telefono || "—"}</td>
                        <td>{c.forma_pago || "—"}</td>
                        <td>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              setSelectedCliente(c);
                              setView("ver-cliente");
                            }}
                          >
                            Ver cliente
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {totalRegistros > 0 && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.85rem",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    Mostrando{" "}
                    <strong>
                      {rangoInicio}-{rangoFin}
                    </strong>{" "}
                    de <strong>{totalRegistros}</strong> clientes
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span>Por página:</span>
                    <select
                      className="select"
                      style={{ width: 80, padding: "0.2rem 0.4rem" }}
                      value={pageSize}
                      onChange={(e) =>
                        setPageSize(parseInt(e.target.value, 10) || 10)
                      }
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>

                    <button
                      className="btn btn-ghost"
                      style={smallBtn}
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      ◀ Anterior
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={smallBtn}
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      Siguiente ▶
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Columna derecha: Filtro (placeholder por ahora) */}
        <aside className="admin-filter">
          <div className="admin-filter__title">FILTRO</div>
          <div style={{ padding: 8 }}>
            <details open>
              <summary>Mostrar recuentos</summary>
              <div className="mt-1 text-muted">
                Clientes encontrados: {totalRegistros}
              </div>
            </details>

            <details className="mt-2" open>
              <summary>Por forma de pago</summary>
              <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 1.8 }}>
                <li>
                  <button onClick={() => alert("Filtro: Todo")}>Todo</button>
                </li>
                <li>
                  <button onClick={() => alert("Pago a 15 días")}>
                    Pago a 15 días
                  </button>
                </li>
                <li>
                  <button onClick={() => alert("Pago a 30 días")}>
                    Pago a 30 días
                  </button>
                </li>
                <li>
                  <button onClick={() => alert("Pago contado")}>
                    Pago contado
                  </button>
                </li>
              </ul>
            </details>
          </div>
        </aside>
      </div>
    </>
  );
}






















