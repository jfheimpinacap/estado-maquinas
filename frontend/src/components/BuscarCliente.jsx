// src/components/BuscarCliente.jsx
import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { authFetch } from "../lib/api"

export default function BuscarCliente({ setView, setSelectedCliente }) {
  const [query, setQuery] = useState("")
  const [resultados, setResultados] = useState([])
  const { auth, backendURL } = useAuth()

  // Restaura último listado al volver desde EditarCliente (localStorage)
  useEffect(() => {
    const q = localStorage.getItem("buscar:lastQuery") || ""
    const raw = localStorage.getItem("buscar:lastResults")
    if (raw) {
      setQuery(q)
      try { setResultados(JSON.parse(raw)) } catch {}
    }
  }, [])

  const handleBuscar = async () => {
    try {
      const url = `${backendURL}/clientes?query=${encodeURIComponent(query)}`
      const res = await authFetch(url, { token: auth.access })
      if (!res.ok) throw new Error("Error al buscar clientes")
      const data = await res.json()
      setResultados(data)
      // guarda para poder “volver al listado”
      localStorage.setItem("buscar:lastQuery", query)
      localStorage.setItem("buscar:lastResults", JSON.stringify(data))
    } catch (error) {
      console.error("❌ Error en la búsqueda:", error)
      setResultados([])
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleBuscar()
    }
  }

  const handleLimpiar = () => {
    setQuery("")
    setResultados([])
    localStorage.removeItem("buscar:lastQuery")
    localStorage.removeItem("buscar:lastResults")
  }

  return (
    <div className="space-y-4">
      {/* Tarjeta angosta de búsqueda */}
      <section className="form-section form-section--compact">
        <h1>Buscar Cliente</h1>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            placeholder="Buscar por Razón Social o RUT"
            className="form-input w-64"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ background: "rgb(224, 251, 252)", color: "#000" }}
          />
          <button type="button" onClick={handleBuscar} className="btn-inline">Buscar</button>
          <button type="button" onClick={handleLimpiar} className="btn-inline btn-inline--gray">Limpiar</button>
        </div>
      </section>

      {/* Tarjeta ancha de resultados */}
      <section className="panel-section panel-section--compact">
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
                    <td>{cliente.direccion || "—"}</td>
                    <td>{cliente.telefono || "—"}</td>
                    <td>{cliente.forma_pago || "—"}</td>
                    <td>
                      <button
                        className="btn-sm-orange btn-sm-orange--short"
                        onClick={() => {
                          // muestra ficha “Datos del Cliente”; desde ahí se pulsa “Editar datos”
                          setSelectedCliente(cliente)
                          setView("ver-cliente")
                        }}
                      >
                        Ver cliente
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












