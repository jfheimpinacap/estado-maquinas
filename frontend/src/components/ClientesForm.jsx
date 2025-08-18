import { useState } from 'react'
import { toast } from 'react-toastify'

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

  const inputStyle = { backgroundColor: 'rgb(224, 251, 252)', color: '#000' }
  const fieldClass = 'px-4 py-3 border border-gray-300 rounded w-full'

  return (
    <div className="bg-white p-8 rounded-xl shadow max-w-xl mx-auto">
      <h2 className="text-xl font-semibold mb-6 text-gray-800">Registrar Nuevo Cliente</h2>

      <form onSubmit={handleSubmit} className="flex flex-col space-y-4 max-w-md">
        <input
          type="text"
          placeholder="Razón Social"
          value={nuevoCliente.razon_social}
          onChange={(e) => setNuevoCliente({ ...nuevoCliente, razon_social: e.target.value })}
          className={fieldClass}
          style={inputStyle}
        />

        <input
          type="text"
          placeholder="RUT"
          value={nuevoCliente.rut}
          onChange={(e) => setNuevoCliente({ ...nuevoCliente, rut: e.target.value })}
          className={fieldClass}
          style={inputStyle}
        />

        <input
          type="text"
          placeholder="Dirección"
          value={nuevoCliente.direccion}
          onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })}
          className={fieldClass}
          style={inputStyle}
        />

        <input
          type="text"
          placeholder="Teléfono"
          value={nuevoCliente.telefono}
          onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
          className={fieldClass}
          style={inputStyle}
        />

        <select
          value={nuevoCliente.forma_pago}
          onChange={(e) => setNuevoCliente({ ...nuevoCliente, forma_pago: e.target.value })}
          className={fieldClass}
          style={inputStyle}
        >
          <option value="">Seleccione Forma de Pago</option>
          <option value="Pago a 15 días">Pago a 15 días</option>
          <option value="Pago a 30 días">Pago a 30 días</option>
          <option value="Pago contado">Pago contado</option>
        </select>

        <div className="pt-2">
          <button
            type="submit"
            className="bg-orange-600 text-white px-5 py-3 rounded-md hover:bg-orange-700 transition shadow"
          >
            Crear Cliente
          </button>
        </div>
      </form>
    </div>
  )
}

export default ClientesForm






