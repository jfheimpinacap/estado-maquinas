// src/components/EditarMaquina.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

export default function EditarMaquina({ setView, selectedMaquina, setSelectedMaquina }) {
  const { auth, backendURL } = useAuth();
  const [form, setForm] = useState({
    marca: "", modelo: "", serie: "", descripcion: "",
    categoria: "", combustible: "", altura: "", tonelaje: "", carga: "", clase: "", anio: ""
  });

  useEffect(() => {
    if (selectedMaquina) {
      setForm({
        marca: selectedMaquina.marca || "",
        modelo: selectedMaquina.modelo || "",
        serie: selectedMaquina.serie || "",
        descripcion: selectedMaquina.descripcion || "",
        categoria: selectedMaquina.categoria || "",
        combustible: selectedMaquina.combustible || "",
        altura: selectedMaquina.altura ?? "",
        tonelaje: selectedMaquina.tonelaje ?? "",
        carga: selectedMaquina.carga ?? "",
        clase: selectedMaquina.clase || selectedMaquina.tipo || "",
        anio: selectedMaquina.anio ?? "",
      });
    }
  }, [selectedMaquina]);

  const onChange = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const save = async () => {
    if (!selectedMaquina?.id) return;
    try {
      const res = await authFetch(`${backendURL}/maquinarias/${selectedMaquina.id}`, {
        token: auth?.access,
        method: "PUT",
        json: form,
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      const saved = await res.json();
      setSelectedMaquina?.(saved);
      toast.success("Guardado");
      return saved;
    } catch (e) {
      toast.error("Error al guardar");
      return null;
    }
  };

  const guardar = async () => {
    const ok = await save();
    if (ok) setView?.("maquinarias-list");
  };
  const guardarYAgregar = async () => {
    const ok = await save();
    if (ok) setView?.("crearMaquinaria");
  };
  const guardarYContinuar = async () => {
    await save();
  };

  return (
    <AdminLayout
      setView={setView}
      title="Editar máquina"
      breadcrumbs={<>Maquinaria / Editar</>}
      actions={
        <div className="actions-bar">
          <button className="btn btn-primary" onClick={guardar}>GUARDAR</button>
          <button className="btn btn-ghost" onClick={guardarYAgregar}>Guardar y añadir otro</button>
          <button className="btn btn-ghost" onClick={guardarYContinuar}>Guardar y continuar editando</button>
        </div>
      }
    >
      <div className="admin-card">
        <div className="fieldset">
          <div className="legend">Identificación</div>

          <div className="form-row">
            <div className="label">Marca</div>
            <div className="control"><input className="input" value={form.marca} onChange={e => onChange("marca", e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="label">Modelo</div>
            <div className="control"><input className="input" value={form.modelo} onChange={e => onChange("modelo", e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="label">Serie</div>
            <div className="control"><input className="input" value={form.serie} onChange={e => onChange("serie", e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="label">Año</div>
            <div className="control"><input className="input" value={form.anio} onChange={e => onChange("anio", e.target.value)} /></div>
          </div>
        </div>

        <div className="fieldset">
          <div className="legend">Especificaciones</div>

          <div className="form-row">
            <div className="label">Categoría</div>
            <div className="control">
              <select className="select" value={form.categoria} onChange={e => onChange("categoria", e.target.value)}>
                <option value="">—</option>
                <option value="equipos_altura">Elevador (trabajo en altura)</option>
                <option value="camiones">Camión</option>
                <option value="equipos_carga">Equipo de carga / otros</option>
              </select>
            </div>
          </div>

          {/* Elevadores */}
          {form.categoria === "equipos_altura" && (
            <>
              <div className="form-row">
                <div className="label">Altura</div>
                <div className="control"><input className="input" value={form.altura} onChange={e => onChange("altura", e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="label">Combustible</div>
                <div className="control">
                  <select className="select" value={form.combustible} onChange={e => onChange("combustible", e.target.value)}>
                    <option value="">—</option>
                    <option value="electrico">Eléctrico</option>
                    <option value="diesel">Diésel</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Camiones */}
          {form.categoria === "camiones" && (
            <div className="form-row">
              <div className="label">Tonelaje</div>
              <div className="control"><input className="input" value={form.tonelaje} onChange={e => onChange("tonelaje", e.target.value)} /></div>
            </div>
          )}

          {/* Equipos de carga / otros */}
          {form.categoria === "equipos_carga" && (
            <>
              <div className="form-row">
                <div className="label">Carga</div>
                <div className="control"><input className="input" value={form.carga} onChange={e => onChange("carga", e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="label">Clase</div>
                <div className="control"><input className="input" value={form.clase} onChange={e => onChange("clase", e.target.value)} /></div>
              </div>
            </>
          )}

          <div className="form-row">
            <div className="label">Descripción</div>
            <div className="control"><textarea className="textarea" rows={3} value={form.descripcion} onChange={e => onChange("descripcion", e.target.value)} /></div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
