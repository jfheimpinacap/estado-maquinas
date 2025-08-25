import { useState } from 'react'

const C = {
  barraEntrada: 'rgb(224, 251, 252)',     // fondo input
  btn: 'rgb(238, 108, 77)',               // botón naranja
  headerTabla: 'rgb(238, 108, 77)',       // cabecera tabla
}

export default function BuscarCliente({ setView, setSelectedCliente }) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])

const backendURL = import.meta.env.VITE_BACKEND_URL

const handleBuscar = async () => {
  try {
    const response = await fetch(
      `${backendURL}/clientes?query=${encodeURIComponent(query)}`
    );
    if (!response.ok) throw new Error('Error al buscar clientes')
    const data = await response.json();
    setResultados(data);
  } catch (error) {
    console.error('❌ Error en la búsqueda:', error)
  }
}

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleBuscar()
    }
  }

  const handleLimpiar = () => {
    setQuery('')
    setResultados([])
  }

  return (
    <section className="max-w-5xl mx-auto p-10 rounded-xl shadow-lg mt-8 bg-white">
      <h1 className="text-2xl font-semibold mb-4 text-gray-800">Buscar Cliente</h1>

      {/* Bloque buscador más angosto */}
      <div className="flex gap-2 mb-5 w-[520px] max-w-full">
        <input
          type="text"
          placeholder="Buscar por nombre o RUT"
          className="border px-4 h-10 rounded-none flex-1"
          style={{ backgroundColor: C.barraEntrada, color: '#000' }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={handleBuscar}
          className="text-white px-3 h-10 text-sm rounded-none hover:opacity-90 transition"
          style={{ backgroundColor: C.btn }}
        >
          Buscar
        </button>
        <button
          onClick={handleLimpiar}
          className="text-white px-3 h-10 text-sm rounded-none hover:opacity-90 transition"
          style={{ backgroundColor: '#888' }}
        >
          Limpiar
        </button>
      </div>

      {/* Tabla */}
      <table className="w-full border text-left">
        <thead style={{ backgroundColor: C.headerTabla }}>
          <tr className="text-white text-center">
            <th className="p-2">Nombre</th>
            <th className="p-2">RUT</th>
            <th className="p-2">Dirección</th>
            <th className="p-2">Teléfono</th>
            <th className="p-2">Forma de Pago</th>
            <th className="p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((cliente) => (
            <tr key={cliente.id} className="border-b text-black text-center">
              <td className="p-2">{cliente.razon_social}</td>
              <td className="p-2">{cliente.rut}</td>
              <td className="p-2">{cliente.direccion}</td>
              <td className="p-2">{cliente.telefono}</td>
              <td className="p-2">{cliente.forma_pago}</td>
              <td className="p-2">
                <button
                  onClick={() => {
                    setSelectedCliente(cliente)
                    setView('ver-cliente')
                  }}
                  className="text-white px-3 py-1 text-xs rounded-none hover:opacity-90 transition"
                  style={{ backgroundColor: C.btn }}
                >
                  Ver Cliente
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}










