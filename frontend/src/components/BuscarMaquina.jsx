// src/components/BuscarMaquina.jsx
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

/** Hook de paginación local para una lista */
function usePaged(items, defaultPageSize = 10) {
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(1);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [total, pageSize]);

  const current = useMemo(() => {
    if (total === 0) return [];
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize, total, totalPages]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = total === 0 ? 0 : Math.min(total, page * pageSize);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
    current,
    from,
    to,
  };
}

/** Tabla reutilizable por categoría con paginación */
function TablaMaquinasCategoria({ titulo, items, paged, onVerMaquina }) {
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
    current,
    from,
    to,
  } = paged;

  const smallBtn = {
    padding: "0.25rem 0.55rem",
    fontSize: "0.8rem",
  };

  if (total === 0) {
    return (
      <div className="fieldset">
        <div className="legend">{titulo}</div>
        <div
          style={{
            padding: "0.6rem 0.4rem",
            fontSize: "0.85rem",
            color: "var(--muted)",
          }}
        >
          No hay máquinas en esta categoría para el criterio actual.
        </div>
      </div>
    );
  }

  return (
    <div className="fieldset">
      <div className="legend">{titulo}</div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Marca</th>
            <th>Modelo</th>
            <th>Serie</th>
            <th>Descripción</th>
            <th>Ubicación</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {current.map((m) => (
            <tr key={m.id}>
              <td>{m.marca || "—"}</td>
              <td>{m.modelo || "—"}</td>
              <td>{m.serie || "—"}</td>
              <td>{m.descripcion || "—"}</td>
              <td>{m.obra || "Bodega"}</td>
              <td>
                <button
                  className="btn btn-primary"
                  onClick={() => onVerMaquina(m)}
                >
                  Ver máquina
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Paginación propia de esta categoría */}
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
            {from}-{to}
          </strong>{" "}
          de <strong>{total}</strong> máquinas
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
            onChange={(e) => setPageSize(parseInt(e.target.value, 10) || 10)}
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
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Siguiente ▶
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BuscarMaquina({ setView, setSelectedMaquina }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all"); // all | elev | cam | otras
  const { auth, backendURL } = useAuth();

  const getCategoria = (m) => m.categoria || "otro";

  // Agrupación por categoría (siempre sobre "resultados")
  const elevadores = useMemo(
    () => resultados.filter((m) => getCategoria(m) === "equipos_altura"),
    [resultados]
  );
  const camiones = useMemo(
    () => resultados.filter((m) => getCategoria(m) === "camiones"),
    [resultados]
  );
  const otras = useMemo(
    () =>
      resultados.filter((m) => {
        const c = getCategoria(m);
        return c !== "equipos_altura" && c !== "camiones";
      }),
    [resultados]
  );

  // Paginación por categoría
  const pagElev = usePaged(
    activeFilter === "all" || activeFilter === "elev" ? elevadores : []
  );
  const pagCam = usePaged(
    activeFilter === "all" || activeFilter === "cam" ? camiones : []
  );
  const pagOtras = usePaged(
    activeFilter === "all" || activeFilter === "otras" ? otras : []
  );

  const handleVerMaquina = (m) => {
    setSelectedMaquina?.(m);
    setView("historial-maquina");
  };

  // Búsqueda por término
  const handleBuscar = async () => {
    const q = query.trim();
    if (!q) {
      setResultados([]);
      setActiveFilter("all");
      return;
    }
    try {
      const url = `${backendURL}/maquinarias?query=${encodeURIComponent(q)}`;
      const res = await authFetch(url, { token: auth.access });
      if (!res.ok) throw new Error("Error al buscar maquinarias");
      let data = await res.json();
      if (!Array.isArray(data)) data = [];

      // Refuerzo de serie exacta si no hay espacios
      if (data.length > 0 && !q.includes(" ")) {
        const exact = data.filter(
          (m) => String(m.serie || "").toLowerCase() === q.toLowerCase()
        );
        if (exact.length > 0) data = exact;
      }

      setResultados(data);
      setActiveFilter("all");
      if (data.length === 0) {
        toast.info("No se encontró ninguna máquina con ese término.");
      }
    } catch (error) {
      console.error("❌ Error en la búsqueda:", error);
      toast.error("Error al buscar maquinarias");
      setResultados([]);
      setActiveFilter("all");
    }
  };

  const handleLimpiar = () => {
    setQuery("");
    setResultados([]);
    setActiveFilter("all");
  };

  // Cargar todo y filtrar por categoría en frontend
  const cargarTodo = async () => {
    try {
      const url = `${backendURL}/maquinarias`;
      const res = await authFetch(url, { token: auth.access });
      if (!res.ok) throw new Error("Error al listar maquinarias");
      let data = await res.json();
      if (!Array.isArray(data)) data = [];
      setResultados(data);
    } catch (error) {
      console.error("❌ Error al listar maquinarias:", error);
      toast.error("Error al listar maquinarias");
      setResultados([]);
    }
  };

  const handleListarElevadores = async () => {
    setQuery("");
    await cargarTodo();
    setActiveFilter("elev");
  };

  const handleListarCamiones = async () => {
    setQuery("");
    await cargarTodo();
    setActiveFilter("cam");
  };

  const handleListarOtras = async () => {
    setQuery("");
    await cargarTodo();
    setActiveFilter("otras");
  };

  const labelModo =
    activeFilter === "all"
      ? "Todos (según búsqueda)"
      : activeFilter === "elev"
      ? "Sólo elevadores"
      : activeFilter === "cam"
      ? "Sólo camiones"
      : "Sólo otras máquinas";

  const smallBtn = {
    padding: "0.25rem 0.55rem",
    fontSize: "0.8rem",
  };

  return (
    <>
      {/* Título unificado, sin breadcrumbs */}
      <header className="page-header">
        <h1 className="page-title">Buscar maquinaria</h1>
      </header>

      <div className="main-grid">
        {/* Columna izquierda: parámetros + resultados */}
        <div>
          <div className="admin-card" style={{ marginBottom: 14 }}>
            <div className="fieldset">
              <div className="legend">Filtros</div>

              <div className="form-row">
                <div className="label">Tipo de máquina</div>
                <div className="control">
                  <select
                    className="select"
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value)}
                  >
                    <option value="all">Seleccione tipo...</option>
                    <option value="elev">Elevadores</option>
                    <option value="cam">Camiones</option>
                    <option value="otras">Otras máquinas</option>
                  </select>
                  <small className="help-text">
                    Obligatorio. Luego podrás filtrar por características y
                    serie.
                  </small>
                </div>
              </div>

              <div className="form-row">
                <div className="label">Serie</div>
                <div className="control">
                  <input
                    className="input"
                    placeholder="Serie exacta o parcial"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                  />
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
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={handleBuscar}
                  >
                    Buscar
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={handleLimpiar}
                  >
                    Limpiar
                  </button>

                  <button
                    className="btn btn-ghost"
                    type="button"
                    style={smallBtn}
                    onClick={handleListarElevadores}
                  >
                    Listar elevadores
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    style={smallBtn}
                    onClick={handleListarCamiones}
                  >
                    Listar camiones
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    style={smallBtn}
                    onClick={handleListarOtras}
                  >
                    Listar otras
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Resultados por categoría */}
          <div className="admin-card">
            <TablaMaquinasCategoria
              titulo="Elevadores"
              items={
                activeFilter === "all" || activeFilter === "elev"
                  ? elevadores
                  : []
              }
              paged={pagElev}
              onVerMaquina={handleVerMaquina}
            />
            <TablaMaquinasCategoria
              titulo="Camiones"
              items={
                activeFilter === "all" || activeFilter === "cam"
                  ? camiones
                  : []
              }
              paged={pagCam}
              onVerMaquina={handleVerMaquina}
            />
            <TablaMaquinasCategoria
              titulo="Otras máquinas"
              items={
                activeFilter === "all" || activeFilter === "otras"
                  ? otras
                  : []
              }
              paged={pagOtras}
              onVerMaquina={handleVerMaquina}
            />
          </div>
        </div>

        {/* Columna derecha: resumen */}
        <aside className="admin-filter">
          <div className="admin-filter__title">RESUMEN</div>
          <div style={{ padding: 8 }}>
            <details open>
              <summary>Modo actual</summary>
              <div style={{ marginTop: 6, fontSize: "0.9rem" }}>
                <strong>{labelModo}</strong>
              </div>
            </details>

            <details style={{ marginTop: 8 }} open>
              <summary>Totales por categoría</summary>
              <ul
                style={{
                  marginTop: 6,
                  paddingLeft: 16,
                  lineHeight: 1.8,
                }}
              >
                <li>Elevadores: {elevadores.length}</li>
                <li>Camiones: {camiones.length}</li>
                <li>Otras máquinas: {otras.length}</li>
                <li style={{ marginTop: 6 }}>
                  <strong>Total en resultados: {resultados.length}</strong>
                </li>
              </ul>
            </details>
          </div>
        </aside>
      </div>
    </>
  );
}





