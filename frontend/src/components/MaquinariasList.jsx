import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";

export default function MaquinariasList({ setView }) {
  const [maquinarias, setMaquinarias] = useState([]);
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("");      // '', 'equipos_altura', 'camiones', 'equipos_carga'
  const [combustible, setCombustible] = useState("");  // '', 'electrico', 'diesel'
  const [orden, setOrden] = useState("recientes");     // 'recientes' | 'marca' | 'modelo'

  const { auth, backendURL } = useAuth();

  const load = async () => {
    try {
      const res = await authFetch(`${backendURL}/maquinarias`, { token: auth?.access });
      const data = res.ok ? await res.json() : [];
      setMaquinarias(Array.isArray(data) ? data : []);
    } catch {
      setMaquinarias([]);
    }
  };

  useEffect(() => { load(); }, [backendURL, auth?.access]);

  const filtradas = useMemo(() => {
    let arr = [...maquinarias];

    if (categoria) arr = arr.filter(m => (m.categoria || "") === categoria);
    if (combustible) arr = arr.filter(m => (m.combustible || "") === combustible);

    if (q.trim()) {
      const term = q.toLowerCase();
      arr = arr.filter(m =>
        [m.marca, m.modelo, m.serie, m.descripcion]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(term))
      );
    }

    if (orden === "marca") {
      arr.sort((a, b) => String(a.marca || "").localeCompare(String(b.marca || "")));
    } else if (orden === "modelo") {
      arr.sort((a, b) => String(a.modelo || "").localeCompare(String(b.modelo || "")));
    } else {
      arr.sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0)); // recientes
    }

    return arr;
  }, [maquinarias, q, categoria, combustible, orden]);

  const fmt = (n) =>
    typeof n === "number"
      ? n.toLocaleString("es-CL", { maximumFractionDigits: 2 })
      : n;

  const actions = (
    <>
      <button className="btn btn-ghost" onClick={load}>Refrescar</button>
      <button className="btn btn-primary" onClick={() => setView?.("crearMaquinaria")}>
        Añadir maquinaria
      </button>
    </>
  );

  return (
    <AdminLayout
      setView={setView}
      title="Maquinarias"
      breadcrumbs={<>Maquinaria / Lista</>}
      actions={actions}
    >
      {/* Filtros */}
      <div className="fieldset">
        <div className="legend">Filtros</div>

        <div className="form-row">
          <div className="label">Búsqueda</div>
          <div className="control">
            <input
              className="input"
              placeholder="Marca / Modelo / Serie / Descripción"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="help-text">Filtra por texto libre.</div>
          </div>
        </div>

        <div className="form-row">
          <div className="label">Categoría</div>
          <div className="control">
            <select
              className="select"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="equipos_altura">Equipos para trabajo en altura</option>
              <option value="camiones">Camiones</option>
              <option value="equipos_carga">Equipos para carga</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="label">Combustible</div>
          <div className="control">
            <select
              className="select"
              value={combustible}
              onChange={(e) => setCombustible(e.target.value)}
            >
              <option value="">Cualquiera</option>
              <option value="electrico">Eléctrico</option>
              <option value="diesel">Diésel</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="label">Orden</div>
          <div className="control">
            <select
              className="select"
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
            >
              <option value="recientes">Recientes</option>
              <option value="marca">Marca (A-Z)</option>
              <option value="modelo">Modelo (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="fieldset">
        <div className="legend">Resultados</div>
        {filtradas.length === 0 ? (
          <div style={{ padding: "1rem", color: "var(--muted)" }}>
            No hay maquinarias para mostrar.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Datos</th>
                <th>Descripción</th>
                <th>Categoría / ID</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((m) => {
                const cat = m.categoria || "";
                let datos = null;

                if (cat === "equipos_altura") {
                  datos = (
                    <>
                      {m.altura != null && <span>Altura: {fmt(m.altura)} m</span>}
                      {m.combustible ? <> · <span>Combustible: {m.combustible}</span></> : null}
                      {m.serie ? <> · <span>Serie: {m.serie}</span></> : null}
                    </>
                  );
                } else if (cat === "camiones") {
                  datos = (
                    <>
                      {m.anio ? <span>Año: {m.anio}</span> : null}
                      {m.tonelaje ? <> · <span>Tonelaje: {fmt(m.tonelaje)} t</span></> : null}
                      {m.estado ? <> · <span>Estado: {m.estado}</span></> : null}
                    </>
                  );
                } else if (cat === "equipos_carga") {
                  datos = (
                    <>
                      {m.carga ? <span>Carga: {fmt(m.carga)} t</span> : null}
                      {m.estado ? <> · <span>Estado: {m.estado}</span></> : null}
                    </>
                  );
                } else {
                  // Compat: datos antiguos sin categoría
                  datos = (
                    <>
                      {m.serie ? <span>Serie: {m.serie}</span> : null}
                      {m.altura ? <> · <span>Altura: {fmt(m.altura)} m</span></> : null}
                      {m.estado ? <> · <span>Estado: {m.estado}</span></> : null}
                    </>
                  );
                }

                return (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                      {m.marca} {m.modelo ? `- ${m.modelo}` : ""}
                    </td>
                    <td>{datos}</td>
                    <td>{m.descripcion || "—"}</td>
                    <td className="text-sm opacity-70">
                      {cat || "—"} {m.id ? `· ID ${m.id}` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}


