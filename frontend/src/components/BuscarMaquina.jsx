// src/components/BuscarMaquina.jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

export default function BuscarMaquina({ setView, setSelectedMaquina }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const { auth, backendURL } = useAuth();

  const handleBuscar = async () => {
    const q = query.trim();
    if (!q) {
      setResultados([]);
      return;
    }

    try {
      const url = `${backendURL}/maquinarias?query=${encodeURIComponent(q)}`;
      const res = await authFetch(url, { token: auth.access });
      if (!res.ok) throw new Error("Error al buscar maquinarias");
      let data = await res.json();
      if (!Array.isArray(data)) data = [];

      // Refuerzo de serie exacta si no hay espacios en el término
      if (data.length > 0 && !q.includes(" ")) {
        const exact = data.filter(m => String(m.serie || "").toLowerCase() === q.toLowerCase());
        if (exact.length > 0) data = exact;
      }

      setResultados(data);
      if (data.length === 0) toast.info("No se encontró ninguna máquina con ese término.");
    } catch (error) {
      console.error("❌ Error en la búsqueda:", error);
      toast.error("Error al buscar maquinarias");
      setResultados([]);
    }
  };

  const handleLimpiar = () => {
    setQuery("");
    setResultados([]);
  };

  const actions = (
    <>
      <button className="btn btn-primary" onClick={handleBuscar}>Buscar</button>
      <button className="btn btn-ghost" onClick={handleLimpiar}>Limpiar</button>
    </>
  );

  const getUbicacion = (m) => m.obra || "Bodega";

  return (
    <AdminLayout
      setView={setView}
      title="Buscar máquina"
      breadcrumbs={<>Maquinaria / Buscar</>}
      actions={actions}
    >
      <div className="fieldset">
        <div className="legend">Parámetros</div>
        <div className="form-row">
          <div className="label">Término</div>
          <div className="control">
            <input
              className="input"
              placeholder="Marca, Modelo o Serie (serie exacta)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
            />
            <div className="help-text">Presiona Enter para buscar rápidamente.</div>
          </div>
        </div>
      </div>

      <div className="fieldset">
        <div className="legend">Resultados</div>

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
            {resultados.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "1rem", textAlign: "center", color: "var(--muted)" }}>
                  Ingresa un término de búsqueda o no hay resultados.
                </td>
              </tr>
            ) : resultados.map((m) => (
              <tr key={m.id}>
                <td>{m.marca || "—"}</td>
                <td>{m.modelo || "—"}</td>
                <td>{m.serie || "—"}</td>
                <td>{m.descripcion || "—"}</td>
                <td>{getUbicacion(m)}</td>
                <td>
                  <button
                    className="btn btn-primary"
                    onClick={() => { setSelectedMaquina?.(m); setView("historial-maquina"); }}
                  >
                    Ver máquina
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
