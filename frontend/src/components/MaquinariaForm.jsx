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
  const [cargaKg, setCargaKg] = useState("");

  const [estado, setEstado] = useState("Disponible");

  const esElevador = useMemo(() => categoria === "equipos_altura", [categoria]);
  const esCamion   = useMemo(() => categoria === "camiones", [categoria]);
  const esCarga    = useMemo(() => categoria === "equipos_carga", [categoria]);

  const sanitize = (s) => (typeof s === "string" ? s.trim() : s);

  const payload = () => {
    const _marca = sanitize(marca);
    const p = {
      // marca SIEMPRE obligatoria
      marca: _marca || undefined,
      modelo: sanitize(modelo) || null,
      serie:  sanitize(serie)  || null,
      categoria,
      descripcion: sanitize(descripcion) || null,
      estado,
      // por defecto anulamos campos que no apliquen
      altura: null,
      tipo_altura: null,
      combustible: null,
      carga: null,
      tonelaje: null,
    };

    if (esElevador) {
      p.altura = altura ? Number(altura) : null;
      p.tipo_altura = tipoAltura || null;
      p.combustible = combustible || null;
    } else if (esCamion) {
      // CARGA en KG
      p.carga = cargaKg ? Number(cargaKg) : null;
      // altura/tipo/combustible no aplican para camión
    } else if (esCarga) {
      p.carga = cargaKg ? Number(cargaKg) : null;
    } else {
      // "otro": todo opcional (dejamos carga si se ingresó)
      p.carga = cargaKg ? Number(cargaKg) : null;
    }
    return p;
  };

  const create = async () => {
    const url = `${backendURL}/maquinarias`;
    const body = JSON.stringify(payload());
    const res = await authFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      token: auth?.access,
      body,
    });
    if (!res.ok) {
      // intenta leer JSON de error del DRF
      let msg = `Error ${res.status} creando maquinaria`;
      try {
        const data = await res.json();
        msg = JSON.stringify(data);
      } catch {
        try {
          msg = await res.text();
        } catch {}
      }
      throw new Error(msg);
    }
    return res.json();
  };

  const resetForm = () => {
    setCategoria("equipos_altura");
    setMarca(""); setModelo(""); setSerie(""); setDescripcion("");
    setAltura(""); setTipoAltura("tijera"); setCombustible("electrico");
    setCargaKg("");
    setEstado("Disponible");
  };

  const onGuardar = async (addOtro = false) => {
    if (!sanitize(marca)) {
      toast.warn("La marca es obligatoria");
      return;
    }
    setSaving(true);
    try {
      await create();
      if (addOtro) {
        resetForm();
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

          {/* Elevadores: altura + combos */}
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

          {/* Camiones / Carga / Otro */}
          {(esCamion || esCarga || categoria === "otro") && (
            <div className="form-row">
              <div className="label">Carga (kg)</div>
              <div className="control">
                <input className="input" type="number" step="1" value={cargaKg} onChange={e=>setCargaKg(e.target.value)} />
                <div className="help-text">Ingresa la capacidad en kilogramos.</div>
              </div>
            </div>
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










