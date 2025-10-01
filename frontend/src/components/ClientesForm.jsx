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

export default function ClientesForm() {
  const [nuevoCliente, setNuevoCliente] = useState({
    razon_social: "",
    rut: "",
    direccion: "",
    telefono: "",
    correo_electronico: "",   // <-- NUEVO
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
        json: {
          ...nuevoCliente,
        },
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
        correo_electronico: "", // <-- reset
        forma_pago: "",
      });
    } catch (err) {
      toast.error("❌ Error al crear el cliente");
      console.error(err);
    }
  };

  return (
    <section className="form-section form-section--compact">
      <h1>Crear Cliente</h1>

      <form onSubmit={handleSubmit}>
        <div className="stack-md">
          <input
            className="form-input w-72"
            placeholder="Razón Social"
            value={nuevoCliente.razon_social}
            onChange={(e) =>
              setNuevoCliente({ ...nuevoCliente, razon_social: e.target.value })
            }
            required
          />

          <input
            className="form-input w-72"
            placeholder="RUT (xx.xxx.xxx-x)"
            inputMode="text"
            maxLength={12}
            value={nuevoCliente.rut}
            onChange={handleRutChange}
            required
          />

          <input
            className="form-input w-72"
            placeholder="Dirección"
            value={nuevoCliente.direccion}
            onChange={(e) =>
              setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })
            }
          />

          <input
            className="form-input w-72"
            placeholder="Teléfono"
            inputMode="tel"
            value={nuevoCliente.telefono}
            onChange={(e) =>
              setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })
            }
          />

          <input
            className="form-input w-72"
            type="email"
            placeholder="Correo electrónico"
            value={nuevoCliente.correo_electronico}
            onChange={(e) =>
              setNuevoCliente({ ...nuevoCliente, correo_electronico: e.target.value })
            }
          />

          <select
            className="form-input w-72"
            value={nuevoCliente.forma_pago}
            onChange={(e) =>
              setNuevoCliente({ ...nuevoCliente, forma_pago: e.target.value })
            }
          >
            <option value="">Seleccione Forma de Pago</option>
            <option value="Pago a 15 días">Pago a 15 días</option>
            <option value="Pago a 30 días">Pago a 30 días</option>
            <option value="Pago contado">Pago contado</option>
          </select>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-form">Crear Cliente</button>
        </div>
      </form>
    </section>
  );
}















