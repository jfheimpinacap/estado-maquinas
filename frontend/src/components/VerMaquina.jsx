import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";

export default function VerMaquina({ setView, selectedMaquina, setSelectedMaquina }) {
  const { auth, backendURL } = useAuth();
  const [data, setData] = useState(selectedMaquina || null);
  const [loading, setLoading] = useState(false);

  const id = selectedMaquina?.id;

  // Cargar/actualizar desde backend por si entramos solo con un ID básico
  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await authFetch(`${backendURL}/maquinarias/${id}`, { token: auth?.access });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setSelectedMaquina?.(json);
      }
    } catch (_) {
      /* noop */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id, backendURL, auth?.access]);

  const catLabel = useMemo(() => {
    const c = (data?.categoria || "").toLowerCase();
    if (c === "equipos_altura") return "Elevador";
    if (c === "camiones") return "Camión";
    if (c === "equipos_carga") return "Equipo de carga";
    return data?.categoria || "—";
  }, [data]);

  const obraActual = data?.obra || data?.obra_actual || "Bodega";
  const imagenURL  = data?.imagen_url || data?.imagen || null;
  const fichaURL   = data?.ficha_tecnica_url || data?.ficha || null;

  const actions = (
    <div className="actions-bar">
      <button className="btn btn-primary" onClick={() => setView?.("editar-maquina")}>GUARDAR</button>
      <button className="btn btn-ghost" onClick={() => setView?.("crearMaquinaria")}>Guardar y añadir otro</button>
      <button className="btn btn-ghost" onClick={() => setView?.("ver-maquina")}>Guardar y continuar editando</button>
      <button className="btn btn-ghost" onClick={() => setView?.("maquinarias-list")}>Volver a la lista</button>
    </div>
  );

  if (!selectedMaquina?.id) {
    return (
      <AdminLayout
        setView={setView}
        title="Detalles de máquina"
        breadcrumbs={<>Maquinaria / Ver</>}
        actions={<button className="btn btn-ghost" onClick={() => setView?.("maquinarias-list")}>Volver a la lista</button>}
      >
        <div className="admin-card">
          <div className="fieldset">
            <div className="legend">Sin selección</div>
            <div style={{ padding: "0.6rem", color: "var(--muted)" }}>
              No hay una máquina seleccionada. Vuelve a la lista y elige “Ver máquina”.
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      setView={setView}
      title="Detalles de máquina"
      breadcrumbs={<>Maquinaria / Ver</>}
      actions={actions}
    >
      {/* Resumen compacto al estilo Django */}
      <div className="admin-card" style={{ marginBottom: 12 }}>
        <div className="fieldset">
          <div className="legend">Resumen</div>
          <div className="form-row">
            <div className="label">Equipo</div>
            <div className="control">
              <div>{data?.marca || "—"} {data?.modelo ? `- ${data?.modelo}` : ""}</div>
              <div className="help-text">ID: {data?.id ?? "—"} · Categoría: {catLabel}</div>
            </div>
          </div>
          <div className="form-row">
            <div className="label">Serie</div>
            <div className="control">{data?.serie || "—"}</div>
          </div>
          <div className="form-row">
            <div className="label">Ubicación actual</div>
            <div className="control">{obraActual}</div>
          </div>
          {loading && <div style={{ color: "var(--muted)" }}>Actualizando datos…</div>}
        </div>
      </div>

      {/* Identificación */}
      <div className="admin-card">
        <div className="fieldset">
          <div className="legend">Identificación</div>
          <div className="form-row">
            <div className="label">Marca</div>
            <div className="control"><input className="input" defaultValue={data?.marca || ""} readOnly /></div>
          </div>
          <div className="form-row">
            <div className="label">Modelo</div>
            <div className="control"><input className="input" defaultValue={data?.modelo || ""} readOnly /></div>
          </div>
          <div className="form-row">
            <div className="label">Serie</div>
            <div className="control"><input className="input" defaultValue={data?.serie || ""} readOnly /></div>
          </div>
          <div className="form-row">
            <div className="label">Año</div>
            <div className="control"><input className="input" defaultValue={data?.anio || ""} readOnly /></div>
          </div>
        </div>

        {/* Especificaciones */}
        <div className="fieldset">
          <div className="legend">Especificaciones</div>
          <div className="form-row">
            <div className="label">Categoría</div>
            <div className="control"><input className="input" defaultValue={catLabel} readOnly /></div>
          </div>

          {/* Elevadores */}
          {String(data?.categoria || "").toLowerCase() === "equipos_altura" && (
            <>
              <div className="form-row">
                <div className="label">Altura trabajo</div>
                <div className="control"><input className="input" defaultValue={data?.altura ?? ""} readOnly /></div>
              </div>
              <div className="form-row">
                <div className="label">Subtipo</div>
                <div className="control"><input className="input" defaultValue={data?.subtipo || data?.tipo_elevador || ""} readOnly /></div>
              </div>
              <div className="form-row">
                <div className="label">Combustible</div>
                <div className="control"><input className="input" defaultValue={data?.combustible || ""} readOnly /></div>
              </div>
            </>
          )}

          {/* Camiones */}
          {String(data?.categoria || "").toLowerCase() === "camiones" && (
            <>
              <div className="form-row">
                <div className="label">Tonelaje</div>
                <div className="control"><input className="input" defaultValue={data?.tonelaje ?? ""} readOnly /></div>
              </div>
            </>
          )}

          {/* Otros / Equipos de carga */}
          {String(data?.categoria || "").toLowerCase() === "equipos_carga" && (
            <>
              <div className="form-row">
                <div className="label">Carga</div>
                <div className="control"><input className="input" defaultValue={data?.carga ?? ""} readOnly /></div>
              </div>
              <div className="form-row">
                <div className="label">Clase</div>
                <div className="control"><input className="input" defaultValue={data?.clase || data?.tipo || ""} readOnly /></div>
              </div>
            </>
          )}

          <div className="form-row">
            <div className="label">Descripción</div>
            <div className="control">
              <textarea className="textarea" rows={3} defaultValue={data?.descripcion || ""} readOnly />
            </div>
          </div>
        </div>

        {/* Estado */}
        <div className="fieldset">
          <div className="legend">Estado</div>
          <div className="form-row">
            <div className="label">Estado</div>
            <div className="control"><input className="input" defaultValue={data?.estado || "—"} readOnly /></div>
          </div>
          <div className="form-row">
            <div className="label">Obra actual</div>
            <div className="control"><input className="input" defaultValue={obraActual} readOnly /></div>
          </div>
        </div>

        {/* Documentos / Multimedia */}
        <div className="fieldset">
          <div className="legend">Documentos / Multimedia</div>

          <div className="form-row">
            <div className="label">Ficha técnica</div>
            <div className="control" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {fichaURL ? (
                <a className="btn btn-ghost" href={fichaURL} target="_blank" rel="noreferrer">Ver ficha</a>
              ) : (
                <span className="help-text">No hay ficha cargada.</span>
              )}
              <button className="btn btn-ghost" onClick={() => alert("Subir ficha técnica: próximamente")}>
                Subir ficha
              </button>
            </div>
          </div>

          <div className="form-row">
            <div className="label">Imagen</div>
            <div className="control" style={{ display: "grid", gap: 8 }}>
              {imagenURL ? (
                <img src={imagenURL} alt="Maquinaria" style={{ maxWidth: "560px", height: "auto", borderRadius: "8px", border: "1px solid var(--card-border)" }} />
              ) : (
                <span className="help-text">Sin imagen.</span>
              )}
              <button className="btn btn-ghost" onClick={() => alert("Subir imagen: próximamente")}>
                Subir imagen
              </button>
            </div>
          </div>
        </div>

        {/* Acciones secundarias (historial, etc.) */}
        <div className="fieldset">
          <div className="legend">Acciones</div>
          <div className="form-row" style={{ gridTemplateColumns: "12rem 1fr" }}>
            <div className="label">Historial</div>
            <div className="control">
              <button className="btn btn-ghost" onClick={() => setView?.("historial-maquina")}>
                Ver historial de arriendos / documentos
              </button>
            </div>
          </div>
        </div>

        {/* Barra de acciones a la izquierda, estilo Django */}
        {actions}
      </div>
    </AdminLayout>
  );
}
