import { useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";

function formatRutLive(value) {
  let v = (value || "").replace(/[^\dkK]/g, "").toUpperCase();
  const cuerpo = v.slice(0, -1);
  const dv = v.slice(-1);
  const rev = cuerpo.split("").reverse().join("");
  const revWithDots = rev.replace(/(\d{3})(?=\d)/g, "$1.");
  const cuerpoFormateado = revWithDots.split("").reverse().join("");
  return dv ? `${cuerpoFormateado}-${dv}` : cuerpoFormateado;
}

export default function ClientesForm({ setView }) {
  const [nuevoCliente, setNuevoCliente] = useState({
    razon_social: "",
    rut: "",
    direccion: "",
    telefono: "",
    correo_electronico: "",
    forma_pago: "",
  });

  const { auth, backendURL } = useAuth();

  const handleRutChange = (e) => {
    const formateado = formatRutLive(e.target.value);
    setNuevoCliente((prev) => ({ ...prev, rut: formateado }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${backendURL}/clientes`, {
        method: "POST",
        token: auth?.access,
        json: { ...nuevoCliente },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Error");
      }
      const data = await res.json();
      toast.success(`✅ Cliente creado con ID ${data.id}`);
      setNuevoCliente({
        razon_social: "",
        rut: "",
        direccion: "",
        telefono: "",
        correo_electronico: "",
        forma_pago: "",
      });
    } catch (err) {
      toast.error("❌ Error al crear el cliente");
      console.error(err);
    }
  };

  const actions = (
    <>
      <button className="btn btn-primary" type="submit" form="cliente-create-form">
        Guardar
      </button>
      <button className="btn btn-ghost" onClick={() => setView?.("listar-clientes")}>
        Cancelar
      </button>
    </>
  );

  return (
    <AdminLayout
      setView={setView}
      title="Añadir cliente"
      breadcrumbs={
        <>
          <a href="#" onClick={(e)=>{ e.preventDefault(); setView?.("listar-clientes"); }}>Clientes</a> / Añadir
        </>
      }
      actions={actions}
    >
      <form id="cliente-create-form" onSubmit={handleSubmit}>
        <div className="fieldset">
          <div className="legend">Datos principales</div>

          <div className="form-row">
            <div className="label">Razón social</div>
            <div className="control">
              <input
                className="input"
                value={nuevoCliente.razon_social}
                onChange={(e)=>setNuevoCliente(s=>({...s, razon_social: e.target.value}))}
                required
              />
              <div className="help-text">Nombre legal del cliente.</div>
            </div>
          </div>

          <div className="form-row">
            <div className="label">RUT</div>
            <div className="control">
              <input
                className="input"
                placeholder="xx.xxx.xxx-x"
                maxLength={12}
                value={nuevoCliente.rut}
                onChange={handleRutChange}
                required
              />
              <div className="help-text">Incluye dígito verificador.</div>
            </div>
          </div>
        </div>

        <div className="fieldset">
          <div className="legend">Contacto y facturación</div>

          <div className="form-row">
            <div className="label">Dirección</div>
            <div className="control">
              <input
                className="input"
                value={nuevoCliente.direccion}
                onChange={(e)=>setNuevoCliente(s=>({...s, direccion: e.target.value}))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Teléfono</div>
            <div className="control">
              <input
                className="input"
                inputMode="tel"
                value={nuevoCliente.telefono}
                onChange={(e)=>setNuevoCliente(s=>({...s, telefono: e.target.value}))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Correo electrónico</div>
            <div className="control">
              <input
                className="input"
                type="email"
                value={nuevoCliente.correo_electronico}
                onChange={(e)=>setNuevoCliente(s=>({...s, correo_electronico: e.target.value}))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Forma de pago</div>
            <div className="control">
              <select
                className="select"
                value={nuevoCliente.forma_pago}
                onChange={(e)=>setNuevoCliente(s=>({...s, forma_pago: e.target.value}))}
              >
                <option value="">—</option>
                <option value="Pago a 15 días">Pago a 15 días</option>
                <option value="Pago a 30 días">Pago a 30 días</option>
                <option value="Pago contado">Pago contado</option>
              </select>
            </div>
          </div>
        </div>
      </form>
    </AdminLayout>
  );
}
















