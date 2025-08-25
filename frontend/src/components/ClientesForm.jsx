import { useState } from 'react'
import { toast } from 'react-toastify'
import '../styles/FormStyles.css'  // añadiremos un css propio

function ClientesForm() {
  const [nuevoCliente, setNuevoCliente] = useState({
    razon_social: '',
    rut: '',
    direccion: '',
    telefono: '',
    forma_pago: ''
  })

  const backendURL = import.meta.env.VITE_BACKEND_URL

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${backendURL}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoCliente)
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`✅ Cliente creado con ID ${data.id}`)
        setNuevoCliente({
          razon_social: '',
          rut: '',
          direccion: '',
          telefono: '',
          forma_pago: ''
        })
      } else {
        toast.error('❌ Error al crear el cliente')
      }
    } catch (error) {
      console.error(error)
      toast.error('❌ Error de conexión al guardar cliente')
    }
  }

  return (
    <section className="form-section">
      <h1>Registrar Nuevo Cliente</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label>Razón Social:</label>
          <input
            type="text"
            value={nuevoCliente.razon_social}
            onChange={(e) => setNuevoCliente({ ...nuevoCliente, razon_social: e.target.value })}
            className="form-input"
          />
        </div>
        <div className="mb-3">
          <label>RUT:</label>
          <input
            type="text"
            value={nuevoCliente.rut}
            onChange={(e) => setNuevoCliente({ ...nuevoCliente, rut: e.target.value })}
            className="form-input"
          />
        </div>
        <div className="mb-3">
          <label>Dirección:</label>
          <input
            type="text"
            value={nuevoCliente.direccion}
            onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })}
            className="form-input"
          />
        </div>
        <div className="mb-3">
          <label>Teléfono:</label>
          <input
            type="text"
            value={nuevoCliente.telefono}
            onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
            className="form-input"
          />
        </div>
        <div className="mb-3">
          <label>Forma de Pago:</label>
          <select
            value={nuevoCliente.forma_pago}
            onChange={(e) => setNuevoCliente({ ...nuevoCliente, forma_pago: e.target.value })}
            className="form-input"
          >
            <option value="">Seleccione Forma de Pago</option>
            <option value="Pago a 15 días">Pago a 15 días</option>
            <option value="Pago a 30 días">Pago a 30 días</option>
            <option value="Pago contado">Pago contado</option>
          </select>
        </div>
        <div className="text-center">
          <button type="submit" className="btn-form">
            Crear Cliente
          </button>
        </div>
      </form>
    </section>
  )
}

export default ClientesForm










