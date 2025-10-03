// src/components/BuscarMaquina.jsx
import { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { authFetch } from "../lib/api"
import { toast } from "react-toastify"

export default function BuscarMaquina({ setView, setSelectedMaquina }) {
  const [query, setQuery] = useState("")
  const [resultados, setResultados] = useState([])
  const { auth, backendURL } = useAuth()

  const handleBuscar = async () => {
    const q = query.trim()
    if (!q) {
      setResultados([])
      return
    }

    try {
      // Backend: admite ?query= (marca/modelo contains) y prioriza serie exacta
      const url = `${backendURL}/maquinarias?query=${encodeURIComponent(q)}`
      const res = await authFetch(url, { token: auth.access })
      if (!res.ok) throw new Error("Error al buscar maquinarias")
      let data = await res.json()
      if (!Array.isArray(data)) data = []

      // Refuerzo en front para serie exacta si el término no tiene espacios
      if (data.length > 0 && !q.includes(" ")) {
        const exactSerie = data.filter(m => String(m.serie || "").toLowerCase() === q.toLowerCase())
        if (exactSerie.length > 0) data = exactSerie
      }

      setResultados(data)
      if (data.length === 0) toast.info("No se encontró ninguna máquina con ese término.")
    } catch (error) {
      console.error("❌ Error en la búsqueda:", error)
      toast.error("Error al buscar maquinarias")
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
  }

  const getUbicacion = (m) => {
    // El serializer ya entrega `obra` con nombre o "Bodega"
    return m.obra || "Bodega"
  }

  return (
    <div className="space-y-4">
      {/* Buscador compacto */}
      <section className="form-section form-section--compact">
        <h1>Buscar Máquina</h1>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            placeholder="Buscar por Marca, Modelo o Serie (serie exacta)"
            className="form-input w-72"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ background: "rgb(224, 251, 252)", color: "#000" }}
          />
          <button type="button" onClick={handleBuscar} className="btn-inline">Buscar</button>
          <button type="button" onClick={handleLimpiar} className="btn-inline btn-inline--gray">Limpiar</button>
        </div>
      </section>

      {/* Resultados */}
      <section className="panel-section panel-section--compact">
        <div className="table-wrap">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Serie</th>
                <th>Descripción</th>
                <th>Ubicación máquina</th>
                <th>Acción</th>
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
                resultados.map((m) => (
                  <tr key={m.id}>
                    <td>{m.marca || "—"}</td>
                    <td>{m.modelo || "—"}</td>
                    <td>{m.serie || "—"}</td>
                    <td>{m.descripcion || "—"}</td>
                    <td>{getUbicacion(m)}</td>
                    <td>
                      <button
                        className="btn-sm-orange btn-sm-orange--short"
                        onClick={() => {
                          setSelectedMaquina?.(m)
                          setView("historial-maquina")
                        }}
                      >
                        Ver máquina
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
