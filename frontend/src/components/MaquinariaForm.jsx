// src/components/MaquinariaForm.jsx
import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

const CATEGORIA = [
  { value: "equipos_altura", label: "Elevadores" },
  { value: "camiones", label: "Camiones" },
  { value: "equipos_carga", label: "Equipos de carga" },
  { value: "otro", label: "Otro" },
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

export default function MaquinariaForm({ setView }) {
  const { auth, backendURL } = useAuth();
  const [saving, setSaving] = useState(false);

  const [categoria, setCategoria] = useState("equipos_altura");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [serie, setSerie] = useState("");
  const [descripcion, setDescripcion] = useState("");

  // elevadores
  const [altura, setAltura] = useState("");
  const [tipoAltura, setTipoAltura] = useState("tijera");
  const [combustible, setCombustible] = useState("electrico");

  // camiones / carga / otro
  const [carga, setCarga] = useState("");
  const [tonelaje, setTonelaje] = useState("");

  const [estado, setEstado] = useState("Disponible");

  const esElevador = useMemo(() => categoria === "equipos_altura", [categoria]);
  const esCamion   = useMemo(() => categoria === "camiones", [categoria]);
  const esCarga    = useMemo(() => categoria === "equipos_carga", [categoria]);

  const payload = () => {
    const p = {
      marca: marca.trim(),
      modelo: modelo.trim() || null,
      serie:  serie.trim()  || null,
      categoria,
      descripcion: descripcion.trim() || null,
      estado,
    };

    if (esElevador) {
      p.altura = altura ? Number(altura) : null;
      p.tipo_altura = tipoAltura || null;     // ← clave correcta
      p.combustible = combustible || null;    // ← clave correcta
      p.carga = null;
      p.tonelaje = null;
      // no usamos año aquí
    } else if (esCamion) {
      p.altura = null;
      p.tipo_altura = null;
      p.combustible = null;
      p.carga = carga ? Number(carga) : null;
      // si sólo llega "carga", el backend ya puede mapear a tonelaje; aquí permitimos ambos:
      p.tonelaje = tonelaje ? Number(tonelaje) : null;
    } else if (esCarga) {
      p.altura = null;
      p.tipo_altura = null;
      p.combustible = null;
      p.carga = carga ? Number(carga) : null;
      p.tonelaje = tonelaje ? Number(tonelaje) : null;
    } else {
      // "otro": todo opcional
      p.altura = null;
      p.tipo_altura = null;
      p.combustible = null;
      p.carga = carga ? Number(carga) : null;
      p.tonelaje = tonelaje ? Number(tonelaje) : null;
    }
    return p;
  };

  const create = async () => {
    const url = `${backendURL}/maquinarias`;
    const res = await authFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      token: auth?.access,
      body: JSON.stringify(payload()),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `Error ${res.status} creando maquinaria`);
    }
    return res.json();
  };

  const resetForm = () => {
    setCategoria("equipos_altura");
    setMarca(""); setModelo(""); setSerie(""); setDescripcion("");
    setAltura(""); setTipoAltura("tijera"); setCombustible("electrico");
    setCarga(""); setTonelaje("");
    setEstado("Disponible");
  };

  const onGuardar = async (addOtro = false) => {
    if (!marca.trim()) {
      toast.warn("La marca es obligatoria");
      return;
    }
    setSaving(true);
    try {
      await create();
      if (addOtro) {
        resetForm(); // evita choque por serie repetida en la siguiente alta
        toast.success("Maquinaria creada. Puedes añadir otra.");
      } else {
        toast.success("Maquinaria creada");
        setView?.("maquinarias-list");
      }
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Error al crear maquinaria");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="admin-card">
        <div className="fieldset">
          <div className="legend">Añadir maquinaria</div>

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
              <div className="help-text">Si se repite, la base lo rechazará.</div>
            </div>
          </div>

          {/* Elevadores: altura + combos (mecanismo / combustible) */}
          {esElevador && (
            <>
              <div className="form-row">
                <div className="label">Altura (m)</div>
                <div className="control">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={altura}
                    onChange={e=>setAltura(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="label">Mecanismo</div>
                <div className="control">
                  <select className="select" value={tipoAltura} onChange={e=>setTipoAltura(e.target.value)}>
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

          {/* Camiones / Carga / Otro: métricas de peso (opcionales) */}
          {(esCamion || esCarga || categoria === "otro") && (
            <>
              <div className="form-row">
                <div className="label">Carga (t)</div>
                <div className="control">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={carga}
                    onChange={e=>setCarga(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="label">Tonelaje (t)</div>
                <div className="control">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={tonelaje}
                    onChange={e=>setTonelaje(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-row">
            <div className="label">Descripción</div>
            <div className="control">
              <textarea
                className="textarea"
                rows={3}
                value={descripcion}
                onChange={e=>setDescripcion(e.target.value)}
              />
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

        {/* Botonera al FINAL (como Django) */}
        <div className="actions-bar">
          <button className="btn btn-primary" disabled={saving} onClick={()=>onGuardar(false)}>
            GUARDAR
          </button>
          <button className="btn btn-ghost" disabled={saving} onClick={()=>onGuardar(true)}>
            Guardar y añadir otro
          </button>
        </div>
      </div>
    </>
  );
}









