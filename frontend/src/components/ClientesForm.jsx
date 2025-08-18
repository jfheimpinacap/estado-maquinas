// src/components/ClientesForm.jsx
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
    const { razon_social, rut, direccion, telefono, forma_pago } = nuevoCliente
    if (!razon_social || !rut || !direccion || !telefono || !forma_pago) {
      toast.error('Por favor complete todos los campos.')
      return
    }

    try {
      const res = await fetch(`${backendURL}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoCliente),
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

  const baseInput =
    'w-full px-4 py-3 border border-gray-300 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-400'
  const inputBg = { backgroundColor: 'rgb(224, 251, 252)' }

  return (
    <section className="font-sans w-full max-w-[720px] mx-auto my-8 bg-white rounded-2xl shadow-lg p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Registrar Cliente
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Complete el siguiente formulario para agregar un cliente.
      </p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Razón social */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Razón Social
          </label>
          <input
            type="text"
            placeholder="Ej: Constructora ABC"
            value={nuevoCliente.razon_social}
            onChange={(e) =>
              setNuevoCliente({ ...nuevoCliente, razon_social: e.target.value })
            }
            className={baseInput}
            style={inputBg}
          />
        </div>

        {/* RUT */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            RUT
          </label>
          <input
            type="text"
            placeholder="12.345.678-9"
            value={nuevoCliente.rut}
            onChange={(e) =>
              setNuevoCliente({ ...nuevoCliente, rut: e.target.value })
            }
            className={baseInput}
            style={inputBg}
          />
        </div>

        {/* Teléfono */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Teléfono
          </label>
          <input
            type="tel"
            placeholder="Ej: 987654321"
            value={nuevoCliente.telefono}
            onChange={(e) => {
              const soloNumeros = e.target.value.replace(/\D/g, '')
              setNuevoCliente({ ...nuevoCliente, telefono: soloNumeros })
            }}
            pattern="[0-9]{8,15}"
            className={baseInput}
            style={inputBg}
          />
        </div>

        {/* Dirección */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dirección
          </label>
          <input
            type="text"
            placeholder="Calle y número"
            value={nuevoCliente.direccion}
            onChange={(e) =>
              setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })
            }
            className={baseInput}
            style={inputBg}
          />
        </div>

        {/* Forma de pago */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Forma de Pago
          </label>
          <select
            value={nuevoCliente.forma_pago}
            onChange={(e) =>
              setNuevoCliente({ ...nuevoCliente, forma_pago: e.target.value })
            }
            className={baseInput}
            style={inputBg}
          >
            <option value="">Seleccione...</option>
            <option value="Pago contado">Pago contado</option>
            <option value="Pago a 15 días">Pago a 15 días</option>
            <option value="Pago a 30 días">Pago a 30 días</option>
          </select>
        </div>

        {/* Botón */}
        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center px-6 py-3 font-semibold text-white shadow-md transition rounded-md hover:opacity-90 hover:scale-[1.02]"
              style={{ backgroundColor: 'rgb(238,108,77)' }}
            >
              Crear Cliente
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}

export default ClientesForm









