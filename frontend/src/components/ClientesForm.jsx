// src/components/ClientesForm.jsx
import { useState } from "react";
import AdminLayout from "./layout/AdminLayout";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

const FORMA_PAGO_OPCIONES = [
  { value: "", label: "---------" },
  { value: "Pago contado", label: "Pago contado" },
  { value: "Pago a 15 días", label: "Pago a 15 días" },
  { value: "Pago a 30 días", label: "Pago a 30 días" },
];

/* =========================
   Helpers RUT (Chile)
   ========================= */

// deja solo dígitos y K/k
function rutClean(value) {
  return (value || "").replace(/[^0-9kK]/g, "").toUpperCase();
}

// formatea a xx.xxx.xxx-x
function rutFormat(value) {
  const clean = rutClean(value);
  if (!clean) return "";

  if (clean.length <= 1) return clean;

  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);

  const rev = cuerpo.split("").reverse();
  let conPuntos = "";
  for (let i = 0; i < rev.length; i++) {
    if (i > 0 && i % 3 === 0) conPuntos = "." + conPuntos;
    conPuntos = rev[i] + conPuntos;
  }

  return `${conPuntos}-${dv}`;
}

// calcula dígito verificador y compara
function rutIsValid(value) {
  const clean = rutClean(value);
  if (clean.length < 2) return false;

  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  const dvEsperado =
    resto === 11 ? "0" : resto === 10 ? "K" : String(resto);

  return dv === dvEsperado;
}

// para mandar al backend: xxxxxxxx-x (sin puntos)
function rutNormalizeBackend(value) {
  const clean = rutClean(value);
  if (clean.length < 2) return clean;
  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${cuerpo}-${dv}`;
}

export default function ClientesForm({ setView, setSelectedCliente }) {
  const { auth, backendURL } = useAuth();

  const [saving, setSaving] = useState(false);

  const [razonSocial, setRazonSocial] = useState("");
  const [rut, setRut] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [formaPago, setFormaPago] = useState("");

  const resetForm = () => {
    setRazonSocial("");
    setRut("");
    setDireccion("");
    setTelefono("");
    setCorreo("");
    setFormaPago("");
  };

  const buildPayload = () => ({
    razon_social: (razonSocial || "").trim(),
    rut: rutNormalizeBackend(rut),
    direccion: (direccion || "").trim() || null,
    telefono: (telefono || "").trim() || null,
    correo_electronico: (correo || "").trim() || null,
    forma_pago: (formaPago || "").trim() || null,
  });

  const crearCliente = async () => {
    const payload = buildPayload();
    const body = JSON.stringify(payload);
    console.log("payload cliente:", payload); // para depurar

    const res = await authFetch(`${backendURL}/clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      token: auth?.access,
      body,
    });

    if (!res.ok) {
      let msg = `Error ${res.status} al crear cliente`;
      try {
        const data = await res.json();
        console.log("error backend crear cliente:", data);
        // aplanado simple de mensajes del serializer
        if (typeof data === "object" && data !== null) {
          const parts = [];
          for (const [k, v] of Object.entries(data)) {
            parts.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
          }
          if (parts.length) msg = parts.join(" | ");
        }
      } catch {
        // ignorar parse error
      }
      throw new Error(msg);
    }

    return res.json();
  };

  const onGuardar = async (modo = "guardar") => {
    // validaciones mínimas
    if (!razonSocial.trim()) {
      toast.warn("La razón social es obligatoria");
      return;
    }
    if (!rut.trim()) {
      toast.warn("El RUT es obligatorio");
      return;
    }
    if (!rutIsValid(rut)) {
      toast.error("El RUT no es válido. Revisa el dígito verificador.");
      return;
    }

    setSaving(true);
    try {
      const clienteCreado = await crearCliente();
      toast.success("Cliente creado correctamente");

      if (modo === "nuevo") {
        // Guardar y añadir otro
        resetForm();
        return;
      }

      if (modo === "continuar" && setView && setSelectedCliente) {
        // Guardar y continuar editando
        setSelectedCliente(clienteCreado);
        setView("editar-cliente");
        return;
      }

      // Modo básico: solo guardar y volver a la lista/búsqueda
      if (setView) {
        setView("buscar-cliente");
      }
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Error al crear cliente");
    } finally {
      setSaving(false);
    }
  };

  // Botones inferiores (como Django admin)
  const accionesInferiores = (
    <div className="actions-bar">
      <button
        className="btn btn-primary"
        disabled={saving}
        onClick={() => onGuardar("guardar")}
      >
        GUARDAR
      </button>
      <button
        className="btn btn-ghost"
        disabled={saving}
        onClick={() => onGuardar("nuevo")}
      >
        Guardar y añadir otro
      </button>
      <button
        className="btn btn-ghost"
        disabled={saving || !setView || !setSelectedCliente}
        onClick={() => onGuardar("continuar")}
      >
        Guardar y continuar editando
      </button>
    </div>
  );

  const handleRutChange = (e) => {
    const raw = e.target.value;
    const formatted = rutFormat(raw);
    setRut(formatted);
  };

  return (
    <AdminLayout
      title="Añadir cliente"
      breadcrumbs={<>Clientes / Añadir</>}
      setView={setView}
    >
      <div className="admin-card">
        <div className="fieldset">
          <div className="legend">Añadir cliente</div>

          <div className="form-row">
            <div className="label">Razón social</div>
            <div className="control">
              <input
                className="input"
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="label">RUT</div>
            <div className="control">
              <input
                className="input"
                value={rut}
                onChange={handleRutChange}
                placeholder="xx.xxx.xxx-x"
              />
              <div className="help-text">
                Escribe el RUT y se ajustará al formato xx.xxx.xxx-x automáticamente.
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="label">Dirección</div>
            <div className="control">
              <input
                className="input"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Teléfono</div>
            <div className="control">
              <input
                className="input"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Correo electrónico</div>
            <div className="control">
              <input
                className="input"
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Forma de pago</div>
            <div className="control">
              <select
                className="select"
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value)}
              >
                {FORMA_PAGO_OPCIONES.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <div className="help-text">
                El cambio de forma de pago más adelante requerirá permiso especial.
              </div>
            </div>
          </div>
        </div>

        {accionesInferiores}
      </div>
    </AdminLayout>
  );
}





















