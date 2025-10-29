// src/components/MaquinariaForm.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

const ESTADOS = [
  { value: "Disponible", label: "Disponible" },
  { value: "Para venta", label: "Para venta" },
];

export default function MaquinariaForm({ setView, selectedMaquina, setSelectedMaquina }) {
  const editMode = !!selectedMaquina?.id; // si venimos a editar
  const { auth, backendURL } = useAuth();

  const [tipo, setTipo] = useState("elevadores"); // elevadores | camion | otro
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [serie, setSerie] = useState("");
  const [altura, setAltura] = useState("");   // elevadores
  const [carga, setCarga] = useState("");     // camión / otro
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState("Disponible");

  // Al editar, precarga
  useEffect(() => {
    if (!editMode) return;
    const m = selectedMaquina || {};
    // Deducción de tipo por categoria
    const cat = m.categoria || "";
    if (cat === "equipos_altura") setTipo("elevadores");
    else if (cat === "camiones") setTipo("camion");
    else setTipo("otro");

    setMarca(m.marca || "");
    setModelo(m.modelo || "");
    setSerie(m.serie || "");
    setAltura(m.altura ?? "");
    setCarga(m.carga ?? m.tonelaje ?? ""); // compat
    setDescripcion(m.descripcion || "");
    setEstado(m.estado || "Disponible");
  }, [editMode, selectedMaquina]);

  const categoria = useMemo(() => {
    if (tipo === "elevadores") return "equipos_altura";
    if (tipo === "camion") return "camiones";
    return "equipos_carga"; // usa la que tengas para "otro"
  }, [tipo]);

  const validar = () => {
    if (tipo === "elevadores") {
      if (!marca || !modelo || !serie || !altura) {
        toast.error("Faltan campos obligatorios para Elevadores (marca, modelo, serie, altura).");
        return false;
      }
    }
    if (tipo === "camion") {
      if (!marca || !modelo || !serie || !carga) {
        toast.error("Faltan campos obligatorios para Camión (marca, modelo, serie, carga).");
        return false;
      }
    }
    // tipo "otro": todo opcional
    return true;
  };

  const buildPayload = () => {
    const payload = {
      categoria,
      marca: (marca || "").trim(),
      modelo: (modelo || "").trim(),
      serie: (serie || "").trim(),
      descripcion: (descripcion || "").trim() || null,
      estado: estado || "Disponible",
    };
    if (tipo === "elevadores") {
      payload.altura = altura ? Number(altura) : null;
      payload.carga = null;
      payload.tonelaje = null;
      payload.combustible = payload.combustible ?? null;
    } else if (tipo === "camion") {
      payload.carga = carga ? Number(carga) : null;   // puedes usar tonelaje si tu modelo lo llama así
      payload.altura = null;
    } else {
      // otro: todo opcional
      payload.altura = altura ? Number(altura) : null;
      payload.carga = carga ? Number(carga) : null;
    }
    return payload;
  };

  const save = async (opts = { stayEditing: false, addAnother: false }) => {
    if (!validar()) return;
    const payload = buildPayload();

    try {
      const url = editMode
        ? `${backendURL}/maquinarias/${selectedMaquina.id}`
        : `${backendURL}/maquinarias`;
      const method = editMode ? "PUT" : "POST";

      const res = await authFetch(url, { token: auth?.access, method, json: payload });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "No se pudo guardar la maquinaria");
      }
      const data = await res.json().catch(() => null);
      toast.success(editMode ? "Maquinaria actualizada." : "Maquinaria creada.");

      if (opts.addAnother) {
        // limpiar para crear otra
        setMarca(""); setModelo(""); setSerie(""); setAltura(""); setCarga("");
        setDescripcion(""); setEstado("Disponible");
        if (!editMode) setTipo("elevadores");
        return;
      }

      if (opts.stayEditing) {
        // quedarse editando
        if (data?.id) setSelectedMaquina?.(data);
        return;
      }

      // volver a la lista
      setView?.("maquinarias-list");
    } catch (e) {
      console.error(e);
      alert(e.message || "Error al guardar la maquinaria");
    }
  };

  return (
    <>
      <div className="admin-card">
        <div className="fieldset">
          <div className="legend">{editMode ? "Editar maquinaria" : "Añadir maquinaria"}</div>

          {/* Tipo */}
          <div className="form-row">
            <div className="label">Tipo</div>
            <div className="control">
              <select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="elevadores">Elevadores</option>
                <option value="camion">Camión</option>
                <option value="otro">Otro</option>
              </select>
              <div className="help-text">Ajusta los campos visibles según el tipo.</div>
            </div>
          </div>

          {/* Marca */}
          <div className="form-row">
            <div className="label">Marca</div>
            <div className="control">
              <input className="input" value={marca} onChange={(e)=>setMarca(e.target.value)} />
            </div>
          </div>

          {/* Modelo */}
          <div className="form-row">
            <div className="label">Modelo</div>
            <div className="control">
              <input className="input" value={modelo} onChange={(e)=>setModelo(e.target.value)} />
            </div>
          </div>

          {/* Serie */}
          <div className="form-row">
            <div className="label">Serie</div>
            <div className="control">
              <input className="input" value={serie} onChange={(e)=>setSerie(e.target.value)} />
            </div>
          </div>

          {/* Altura (solo elevadores y opcional en “otro”) */}
          {(tipo === "elevadores" || tipo === "otro") && (
            <div className="form-row">
              <div className="label">Altura (m)</div>
              <div className="control">
                <input className="input" type="number" step="0.01" value={altura} onChange={(e)=>setAltura(e.target.value)} />
                {tipo === "elevadores" ? (
                  <div className="help-text">Obligatorio en elevadores.</div>
                ) : <div className="help-text">Opcional.</div>}
              </div>
            </div>
          )}

          {/* Carga (t) (obligatorio en camión; opcional en “otro”) */}
          {(tipo === "camion" || tipo === "otro") && (
            <div className="form-row">
              <div className="label">Carga (t)</div>
              <div className="control">
                <input className="input" type="number" step="0.01" value={carga} onChange={(e)=>setCarga(e.target.value)} />
                {tipo === "camion" ? (
                  <div className="help-text">Obligatorio en camión.</div>
                ) : <div className="help-text">Opcional.</div>}
              </div>
            </div>
          )}

          {/* Descripción (opcional) */}
          <div className="form-row">
            <div className="label">Descripción</div>
            <div className="control">
              <textarea className="textarea" rows={3} value={descripcion} onChange={(e)=>setDescripcion(e.target.value)} />
            </div>
          </div>

          {/* Estado */}
          <div className="form-row">
            <div className="label">Estado</div>
            <div className="control">
              <select className="select" value={estado} onChange={(e)=>setEstado(e.target.value)}>
                {ESTADOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Acciones al estilo Django (izquierda) */}
        <div className="actions-bar">
          <button className="btn btn-primary" onClick={() => save({ stayEditing: false, addAnother: false })}>
            GUARDAR
          </button>
          <button className="btn btn-ghost" onClick={() => save({ addAnother: true })}>
            Guardar y añadir otro
          </button>
          <button className="btn btn-ghost" onClick={() => save({ stayEditing: true })}>
            Guardar y continuar editando
          </button>
        </div>
      </div>
    </>
  );
}


















