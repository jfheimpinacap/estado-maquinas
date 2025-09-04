import { useState } from 'react'

export default function BuscarCliente({ setView, setSelectedCliente }) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])

  const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  const handleBuscar = async () => {
    try {
      const url = `${backendURL}/clientes?query=${encodeURIComponent(query)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Error al buscar clientes')
      const data = await res.json()
      setResultados(data)
    } catch (err) {
      console.error('❌ Error en la búsqueda:', err)
      setResultados([])
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
    <div className="space-y-6">
      {/* Tarjeta angosta de búsqueda */}
      <section className="form-section">
        <h1>Buscar Cliente</h1>

        <div className="flex items-center gap-4 mb-6">
  <input
    type="text"
    placeholder="Buscar por Razón Social o RUT"
    className="form-input w-96"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    onKeyDown={handleKeyDown}
    style={{ background: 'rgb(224, 251, 252)', color: '#000' }}
  />

  <button type="button" onClick={handleBuscar} className="btn-inline">
    Buscar
  </button>

  <button type="button" onClick={handleLimpiar} className="btn-inline btn-inline--gray">
    Limpiar
  </button>
</div>

      </section>

      {/* Tarjeta ancha de resultados */}
      <section className="panel-section">
        <div className="table-wrap">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Razón Social</th>
                <th>RUT</th>
                <th>Dirección</th>
                <th>Teléfono</th>
                <th>Forma de Pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {resultados.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-gray-500" colSpan={6}>
                    Ingresa un término de búsqueda o no hay resultados.
                  </td>
                </tr>
              ) : (
                resultados.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.razon_social}</td>
                    <td>{cliente.rut}</td>
                    <td>{cliente.direccion || '—'}</td>
                    <td>{cliente.telefono || '—'}</td>
                    <td>{cliente.forma_pago || '—'}</td>
                    <td>
                      <button
                        className="btn-sm-orange"
                        onClick={() => {
                          setSelectedCliente(cliente)
                          setView('ver-cliente')
                        }}
                      >
                        Ver Cliente
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}










