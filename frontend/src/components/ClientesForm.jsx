// src/components/ClientesForm.jsx
import { useState } from "react"
import { toast } from "react-toastify"
import { useAuth } from "../context/AuthContext"
import { authFetch } from "../lib/api"

function ClientesForm() {
  const [nuevoCliente, setNuevoCliente] = useState({
    razon_social: "",
    rut: "",
    direccion: "",
    telefono: "",
    forma_pago: "",
  })

  const { auth, backendURL } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await authFetch(`${backendURL}/clientes`, {
        method: "POST",
        token: auth.access,
        json: nuevoCliente,
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(`✅ Cliente creado con ID ${data.id}`)
      setNuevoCliente({
        razon_social: "",
        rut: "",
        direccion: "",
        telefono: "",
        forma_pago: "",
      })
    } catch {
      toast.error("❌ Error al crear el cliente")
    }
  }

  return (
    <section className="form-section form-section--compact">
      <h1>Crear Cliente</h1>

      <form onSubmit={handleSubmit}>
        {/* separa los campos verticalmente */}
        <div className="stack-md">
          <input
            className="form-input w-72"
            placeholder="Razón Social"
            value={nuevoCliente.razon_social}
            onChange={(e) =>
              setNuevoCliente({ ...nuevoCliente, razon_social: e.target.value })
            }
          />
          <input
            className="form-input w-72"
            placeholder="RUT"
            value={nuevoCliente.rut}
            onChange={(e) => setNuevoCliente({ ...nuevoCliente, rut: e.target.value })}
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
            value={nuevoCliente.telefono}
            onChange={(e) =>
              setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })
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

        {/* centra el botón */}
        <div className="form-actions">
          <button type="submit" className="btn-form">Crear Cliente</button>
        </div>
      </form>
    </section>
  )
}

export default ClientesForm













