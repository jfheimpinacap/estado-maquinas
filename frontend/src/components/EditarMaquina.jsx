// src/components/EditarMaquina.jsx
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./layout/AdminLayout";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

const CATEGORIA = [
  { value: "equipos_altura", label: "Elevadores" },
  { value: "camiones", label: "Camiones" },
  { value: "equipos_carga", label: "Otras máquinas" },
];

const ELEVADOR_TIPO = [
  { value: "tijera", label: "Tijera" },
  { value: "brazo", label: "Brazo articulado" },
];

const COMBUSTIBLE = [
  { value: "electrico", label: "Eléctrico" },
  { value: "diesel", label: "Diésel" },
];

const ESTADO = [
  { value: "Disponible", label: "Disponible" },
  { value: "Para venta", label: "Para venta" },
];

export default function EditarMaquina({ setView, selectedMaquina, setSelectedMaquina }) {
  const { auth, backendURL, logout } = useAuth();
  const [saving, setSaving] = useState(false);

  // campos
  const [categoria, setCategoria] = useState("equipos_altura");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [serie, setSerie] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [altura, setAltura] = useState("");
  const [elevadorTipo, setElevadorTipo] = useState("");
  const [combustible, setCombustible] = useState("");

  const [carga, setCarga] = useState("");

  const [estado, setEstado] = useState("Disponible");

  const esElevador = useMemo(() => categoria === "equipos_altura", [categoria]);
  const esCamion   = useMemo(() => categoria === "camiones", [categoria]);
  const esCarga    = useMemo(() => categoria === "equipos_carga", [categoria]);

  // Precarga con la máquina seleccionada
  useEffect(() => {
    const m = selectedMaquina;
    if (!m) return;

    setCategoria(m.categoria || "equipos_altura");
    setMarca(m.marca || "");
    setModelo(m.modelo || "");
    setSerie(m.serie || "");
    setDescripcion(m.descripcion || "");
    setAltura(m.altura ?? "");
    setElevadorTipo(m.tipo_altura || "");
    setCombustible(m.combustible || "");
    setCarga(m.carga ?? "");
    setEstado(m.estado || "Disponible");
  }, [selectedMaquina]);

  // payload PATCH
  const buildPayload = () => {
    const p = {
      marca: (marca || "").trim(),
      modelo: (modelo || "").trim() || null,
      serie: (serie || "").trim() || null,
      categoria,
      descripcion: (descripcion || "").trim() || null,
      estado,
    };

    if (esElevador) {
      p.altura = altura !== "" ? Number(altura) : null;
      p.tipo_altura = elevadorTipo || null;
      p.combustible = combustible || null;
      p.carga = null;
      p.tonelaje = null;
    } else if (esCamion) {
      // “Carga” en kg (numérico), sin tonelaje
      p.carga = carga !== "" ? Number(carga) : null;
      p.altura = null;
      p.tipo_altura = null;
      p.combustible = null;
      p.tonelaje = null;
    } else if (esCarga) {
      p.carga = carga !== "" ? Number(carga) : null;
      p.altura = null;
      p.tipo_altura = null;
      p.combustible = null;
      p.tonelaje = null;
    } else {
      // safe default para “otras/otro”
      p.carga = carga !== "" ? Number(carga) : null;
      p.altura = null;
      p.tipo_altura = null;
      p.combustible = null;
      p.tonelaje = null;
    }

    return p;
  };

  const onGuardar = async () => {
    if (!selectedMaquina?.id) {
      toast.error("No hay máquina seleccionada.");
      return;
    }
    if (!marca.trim()) {
      toast.warn("La marca es obligatoria");
      return;
    }
    setSaving(true);
    try {
      const url = `${backendURL}/maquinarias/${selectedMaquina.id}`;
      const res = await authFetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        token: auth?.access,
        body: JSON.stringify(buildPayload()),
      });

      if (res.status === 401) {
        toast.error("Sesión expirada. Vuelve a ingresar.");
        logout?.();
        return;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Error ${res.status} guardando cambios`);
      }

      const updated = await res.json();
      setSelectedMaquina?.(updated);
      toast.success("Cambios guardados");
      setView?.("maquinarias-list");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Error al guardar la máquina");
    } finally {
      setSaving(false);
    }
  };

  const onVolver = () => setView?.("maquinarias-list");

  const Acciones = (
    <>
      <button className="btn btn-primary" disabled={saving} onClick={onGuardar}>
        Guardar
      </button>
      <button className="btn btn-ghost" onClick={onVolver}>
        Volver
      </button>
    </>
  );

  return (
    <AdminLayout
      title="Buscar máquina"
      breadcrumbs={<>Maquinaria / Editar</>}
      actions={Acciones}
      setView={setView}
    >
      <div className="admin-card">
        <div className="fieldset">
          <div className="legend">Editar máquina</div>

          <div className="form-row">
            <div className="label">Categoría</div>
            <div className="control">
              <select className="select" value={categoria} onChange={e => setCategoria(e.target.value)}>
                {CATEGORIA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="help-text">El formulario cambia según la categoría.</div>
            </div>
          </div>

          <div className="form-row">
            <div className="label">Marca</div>
            <div className="control">
              <input className="input" value={marca} onChange={e=>setMarca(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Modelo</div>
            <div className="control">
              <input className="input" value={modelo} onChange={e=>setModelo(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Serie</div>
            <div className="control">
              <input className="input" value={serie} onChange={e=>setSerie(e.target.value)} />
            </div>
          </div>

          {/* Elevadores */}
          {esElevador && (
            <>
              <div className="form-row">
                <div className="label">Altura (m)</div>
                <div className="control">
                  <input className="input" type="number" step="0.01" value={altura} onChange={e=>setAltura(e.target.value)} />
                </div>
              </div>

              <div className="form-row">
                <div className="label">Mecanismo</div>
                <div className="control">
                  <select className="select" value={elevadorTipo} onChange={e=>setElevadorTipo(e.target.value)}>
                    {ELEVADOR_TIPO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="label">Combustible</div>
                <div className="control">
                  <select className="select" value={combustible} onChange={e=>setCombustible(e.target.value)}>
                    {COMBUSTIBLE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Camiones / Otras */}
          {(esCamion || esCarga || categoria === "equipos_carga") && (
            <>
              <div className="form-row">
                <div className="label">Carga (kg)</div>
                <div className="control">
                  <input className="input" type="number" step="1" value={carga} onChange={e=>setCarga(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="form-row">
            <div className="label">Descripción</div>
            <div className="control">
              <textarea className="textarea" rows={3} value={descripcion} onChange={e=>setDescripcion(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Estado</div>
            <div className="control">
              <select className="select" value={estado} onChange={e=>setEstado(e.target.value)}>
                {ESTADO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Botones al final */}
        <div className="actions-bar">
          <button className="btn btn-primary" disabled={saving} onClick={onGuardar}>Guardar</button>
          <button className="btn btn-ghost" onClick={onVolver}>Volver</button>
        </div>
      </div>
    </AdminLayout>
  );
}

