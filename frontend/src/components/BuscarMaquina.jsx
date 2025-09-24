// src/components/BuscarMaquina.jsx
import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { authFetch } from "../lib/api"
import { toast } from "react-toastify"

export default function BuscarMaquina({ setView, setSelectedMaquina }) {
  const [query, setQuery] = useState("")
  const [resultados, setResultados] = useState([])
  const { auth, backendURL } = useAuth()

  // Restaurar último listado
  useEffect(() => {
    const q = localStorage.getItem("buscarmaq:lastQuery") || ""
    const raw = localStorage.getItem("buscarmaq:lastResults")
    if (raw) {
      setQuery(q)
      try { setResultados(JSON.parse(raw)) } catch {}
    }
  }, [])

  const handleBuscar = async () => {
    const q = query.trim()
    if (!q) {
      setResultados([])
      localStorage.removeItem("buscarmaq:lastQuery")
      localStorage.removeItem("buscarmaq:lastResults")
      return
    }

    try {
      // Backend: admite ?query= para marca/modelo contains
      // y si el usuario escribe una serie, el backend debe preferir match exacto de serie
      const url = `${backendURL}/maquinarias?query=${encodeURIComponent(q)}`
      const res = await authFetch(url, { token: auth.access })
      if (!res.ok) throw new Error("Error al buscar maquinarias")
      let data = await res.json()
      if (!Array.isArray(data)) data = []

      // Si el usuario probablemente buscó una serie (sin espacios) aplicamos exact en el front como refuerzo
      if (data.length > 0 && !q.includes(" ")) {
        const exactSerie = data.filter(m => String(m.serie || "").toLowerCase() === q.toLowerCase())
        if (exactSerie.length > 0) data = exactSerie
      }

      setResultados(data)
      localStorage.setItem("buscarmaq:lastQuery", q)
      localStorage.setItem("buscarmaq:lastResults", JSON.stringify(data))

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
    localStorage.removeItem("buscarmaq:lastQuery")
    localStorage.removeItem("buscarmaq:lastResults")
  }

  const getObra = (m) => {
    if (m.obra) return m.obra
    if (m.ubicacion) return m.ubicacion
    if (m.arrendada || m.en_obra) return m.obra_actual || "Obra"
    return "Bodega"
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
                <th>Combustible</th>
                <th>Obra</th>
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
                    <td>{m.combustible ? (m.combustible === 'diesel' ? 'Diésel' : 'Eléctrico') : "—"}</td>
                    <td>{getObra(m)}</td>
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
