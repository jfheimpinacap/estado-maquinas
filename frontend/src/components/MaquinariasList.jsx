// src/components/MaquinariasList.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

const CATEGORIA = [
  { value: "equipos_altura", label: "Elevadores" },
  { value: "camiones", label: "Camiones" },
  { value: "equipos_carga", label: "Otras máquinas" },
];

const SUBTIPO_ELEV = [
  { value: "", label: "Cualquiera" },
  { value: "tijera", label: "Tijera" },
  { value: "brazo", label: "Brazo articulado" },
];

const COMBUSTIBLE = [
  { value: "", label: "Cualquiera" },
  { value: "electrico", label: "Eléctrico" },
  { value: "diesel", label: "Diésel" },
];

export default function MaquinariasList({ setView, setSelectedMaquina }) {
  const { auth, backendURL, logout } = useAuth();

  const [maqs, setMaqs] = useState([]);
  const [loading, setLoading] = useState(false);

  // filtros en memoria (sin localStorage)
  const [cat, setCat] = useState("");          // tipo de máquina (obligatorio)
  const [subtipo, setSubtipo] = useState("");  // solo para elevadores
  const [combustible, setCombust] = useState("");

  // búsqueda por serie
  const [serieQ, setSerieQ] = useState("");
  const [overrideResults, setOverrideResults] = useState(null);

  const safeAuth = auth?.access;

  const load = async () => {
    if (!safeAuth) return;
    setLoading(true);
    try {
      const res = await authFetch(`${backendURL}/maquinarias`, { token: safeAuth });
      if (res.status === 401) {
        toast.error("Sesión expirada. Vuelve a ingresar.");
        logout?.();
        return;
      }
      const data = res.ok ? await res.json() : [];
      setMaqs(Array.isArray(data) ? data : []);
      setOverrideResults(null);
    } catch (e) {
      console.error(e);
      setMaqs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendURL, safeAuth]);

  // base = datos originales o resultado de búsqueda por serie
  const base = useMemo(
    () => (overrideResults ? overrideResults : maqs),
    [overrideResults, maqs]
  );

  // aplicar filtros según tipo seleccionado
  const filtradas = useMemo(() => {
    if (!cat) return []; // hasta que no elija tipo de máquina, no mostramos nada
    let arr = [...base];

    // categoría obligatoria
    arr = arr.filter((m) => (m.categoria || "") === cat);

    // solo elevadores tienen subtipo
    if (cat === "equipos_altura" && subtipo) {
      arr = arr.filter((m) => (m.tipo_altura || "") === subtipo);
    }

    // combustible común a todos
    if (combustible) {
      arr = arr.filter((m) => (m.combustible || "") === combustible);
    }

    return arr;
  }, [base, cat, subtipo, combustible]);

  const elevadores = filtradas.filter((m) => (m.categoria || "") === "equipos_altura");
  const camiones = filtradas.filter((m) => (m.categoria || "") === "camiones");
  const otras = filtradas.filter((m) => {
    const c = m.categoria || "";
    return c !== "equipos_altura" && c !== "camiones";
  });

  const onVer = (m) => {
    setSelectedMaquina?.(m);
    setView?.("editar-maquina");
  };

  const onFicha = (m) => {
    setSelectedMaquina?.(m);
    setView?.("ver-maquina");
  };

  // --- búsqueda por serie ---
  const handleBuscarSerie = async () => {
    if (!cat) {
      toast.info("Primero selecciona el tipo de máquina.");
      return;
    }

    const q = (serieQ || "").trim();
    if (!q) {
      // sin serie: solo aplicamos filtros en memoria (ya reactivos)
      setOverrideResults(null);
      return;
    }
    if (!safeAuth) {
      toast.error("Sesión no válida.");
      logout?.();
      return;
    }

    try {
      const url = `${backendURL}/maquinarias?query=${encodeURIComponent(q)}`;
      const res = await authFetch(url, { token: safeAuth });
      if (res.status === 401) {
        toast.error("Sesión expirada. Vuelve a ingresar.");
        logout?.();
        return;
      }
      if (!res.ok) {
        toast.error("Error al buscar la serie.");
        return;
      }
      let data = await res.json();
      if (!Array.isArray(data)) data = [];

      // refuerzo de serie exacta si no hay espacios
      if (data.length > 1 && !q.includes(" ")) {
        const exact = data.filter(
          (m) => String(m.serie || "").toLowerCase() === q.toLowerCase()
        );
        if (exact.length >= 1) data = exact;
      }

      // filtramos también por categoría seleccionada
      data = data.filter((m) => (m.categoria || "") === cat);

      if (data.length === 0) {
        toast.info("No existe una máquina con esa serie en la categoría seleccionada.");
        setOverrideResults([]);
        return;
      }

      setOverrideResults(data);
      toast.info(`Se encontraron ${data.length} máquina(s) para esa serie.`);
    } catch (e) {
      console.error(e);
      toast.error("Error al buscar la serie.");
    }
  };

  const handleLimpiar = () => {
    setCat("");
    setSubtipo("");
    setCombust("");
    setSerieQ("");
    setOverrideResults(null);
  };

  const handleListarTodo = async () => {
    if (!cat) {
      toast.info("Selecciona primero un tipo de máquina para listar.");
      return;
    }
    setSerieQ("");
    setOverrideResults(null);
    await load(); // refrescamos por si se crearon nuevas máquinas
    toast.info("Mostrando todas las máquinas de la categoría seleccionada.");
  };

  // --- UI de filtros ---
  const Filtros = (
    <div className="admin-card" style={{ marginBottom: 12 }}>
      <div className="fieldset">
        <div className="legend">Filtros</div>

        {/* 1) Tipo de máquina */}
        <div className="form-row">
          <div className="label">Tipo de máquina</div>
          <div className="control">
            <select
              className="select"
              value={cat}
              onChange={(e) => {
                setCat(e.target.value);
                setSubtipo("");
                setCombust("");
                setOverrideResults(null);
              }}
            >
              <option value="">Seleccione tipo…</option>
              {CATEGORIA.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="help-text">
              Obligatorio. Luego podrás filtrar por características y serie.
            </div>
          </div>
        </div>

        {/* 2) Filtros específicos por tipo */}
        {cat === "equipos_altura" && (
          <div className="form-row">
            <div className="label">Subtipo (elevadores)</div>
            <div className="control">
              <select
                className="select"
                value={subtipo}
                onChange={(e) => {
                  setSubtipo(e.target.value);
                  setOverrideResults(null);
                }}
                disabled={!cat}
              >
                {SUBTIPO_ELEV.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {cat && (
          <div className="form-row">
            <div className="label">Combustible</div>
            <div className="control">
              <select
                className="select"
                value={combustible}
                onChange={(e) => {
                  setCombust(e.target.value);
                  setOverrideResults(null);
                }}
                disabled={!cat}
              >
                {COMBUSTIBLE.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 3) Serie (siempre disponible pero ligada a la categoría) */}
        <div className="form-row" style={{ gridTemplateColumns: "12rem 1fr" }}>
          <div className="label">Serie</div>
          <div className="control" style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              placeholder="Serie exacta o parcial"
              value={serieQ}
              onChange={(e) => setSerieQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBuscarSerie()}
              disabled={!cat}
            />
          </div>
        </div>

        {/* 4) Botones finales */}
        <div className="form-row" style={{ gridTemplateColumns: "14rem 1fr" }}>
          <div className="label" />
          <div
            className="control"
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <button
              className="btn btn-primary"
              onClick={handleBuscarSerie}
              disabled={!cat}
            >
              Buscar
            </button>
            <button className="btn btn-ghost" onClick={handleLimpiar}>
              Limpiar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleListarTodo}
              disabled={!cat || loading}
            >
              {loading ? "Listando…" : "Listar todo"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setView?.("crearMaquinaria")}
              style={{ marginLeft: "auto" }}
            >
              Añadir maquinaria
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const TablaElev = () => (
    <div className="fieldset">
      <div className="legend">Elevadores</div>
      {!cat ? (
        <div style={{ padding: "1rem", color: "var(--muted)" }}>
          Selecciona un tipo de máquina para ver resultados.
        </div>
      ) : elevadores.length === 0 ? (
        <div style={{ padding: "1rem", color: "var(--muted)" }}>
          No hay elevadores con los filtros actuales.
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Serie</th>
              <th>Tipo</th>
              <th>Combustible</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {elevadores.map((m) => (
              <tr key={m.id}>
                <td>{m.marca || "—"}</td>
                <td>{m.modelo || "—"}</td>
                <td>{m.serie || "—"}</td>
                <td>{m.tipo_altura || "—"}</td>
                <td>{m.combustible || "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-ghost" onClick={() => onVer(m)}>
                    Ver máquina
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => onFicha(m)}
                    style={{ marginLeft: 6 }}
                  >
                    Ficha técnica
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const TablaCam = () => (
    <div className="fieldset">
      <div className="legend">Camiones</div>
      {!cat ? (
        <div style={{ padding: "1rem", color: "var(--muted)" }}>
          Selecciona un tipo de máquina para ver resultados.
        </div>
      ) : camiones.length === 0 ? (
        <div style={{ padding: "1rem", color: "var(--muted)" }}>
          No hay camiones con los filtros actuales.
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Serie</th>
              <th>Carga (kg)</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {camiones.map((m) => (
              <tr key={m.id}>
                <td>{m.marca || "—"}</td>
                <td>{m.modelo || "—"}</td>
                <td>{m.serie || "—"}</td>
                <td>{m.carga ?? "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-ghost" onClick={() => onVer(m)}>
                    Ver máquina
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => onFicha(m)}
                    style={{ marginLeft: 6 }}
                  >
                    Ficha técnica
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const TablaOtras = () => (
    <div className="fieldset">
      <div className="legend">Otras máquinas</div>
      {!cat ? (
        <div style={{ padding: "1rem", color: "var(--muted)" }}>
          Selecciona un tipo de máquina para ver resultados.
        </div>
      ) : otras.length === 0 ? (
        <div style={{ padding: "1rem", color: "var(--muted)" }}>
          No hay otras máquinas con los filtros actuales.
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Serie</th>
              <th>Combustible</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {otras.map((m) => (
              <tr key={m.id}>
                <td>{m.marca || "—"}</td>
                <td>{m.modelo || "—"}</td>
                <td>{m.serie || "—"}</td>
                <td>{m.combustible || "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-ghost" onClick={() => onVer(m)}>
                    Ver máquina
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => onFicha(m)}
                    style={{ marginLeft: 6 }}
                  >
                    Ficha técnica
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <>
      {Filtros}
      <div className="admin-card">
        <div className="fieldset">
          <div className="legend">Resultados</div>
          <TablaElev />
          <div style={{ height: 12 }} />
          <TablaCam />
          <div style={{ height: 12 }} />
          <TablaOtras />
        </div>
      </div>
    </>
  );
}










