// src/components/HistorialMaquina.jsx
import { useEffect, useState, useMemo } from "react"
import { useAuth } from "../context/AuthContext"
import { authFetch } from "../lib/api"

export default function HistorialMaquina({ selectedMaquina, setView }) {
  const { auth, backendURL } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const m = selectedMaquina

  useEffect(() => {
    const fetchHist = async () => {
      if (!m?.id) { setLoading(false); return }
      try {
        const url = `${backendURL}/maquinarias/${m.id}/historial`
        const res = await authFetch(url, { token: auth.access })
        const data = res.ok ? await res.json() : []
        setItems(Array.isArray(data) ? data : [])
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    fetchHist()
  }, [backendURL, auth?.access, m?.id])

  const ordenados = useMemo(() => {
    // más reciente primero por fecha_inicio
    return [...items].sort((a, b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio))
  }, [items])

  if (!m) {
    return (
      <section className="form-section form-section--compact">
        <h2>Historial de la máquina</h2>
        <p>No hay máquina seleccionada.</p>
        <div className="form-actions">
          <button className="btn-form btn-form--sm" onClick={() => setView("buscarMaquina")}>
            Volver a búsqueda
          </button>
        </div>
      </section>
    )
  }

  const titulo = `${m.marca || ''} ${m.modelo || ''}`.trim()
  const subt = m.serie ? `Serie: ${m.serie}` : ''

  return (
    <div className="space-y-4">
      <section className="form-section form-section--compact">
        <h1>Historial de la máquina</h1>
        <div style={{ fontWeight: 700 }}>{titulo || 'Máquina'}</div>
        <div style={{ opacity: .7 }}>{subt}</div>
        <div className="actions-inline" style={{ marginTop: '.5rem' }}>
          <button className="btn-inline btn-inline--gray" onClick={() => setView("buscarMaquina")}>
            Volver a búsqueda
          </button>
        </div>
      </section>

      <section className="panel-section panel-section--compact">
        <div className="table-wrap">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Fecha inicio</th>
                <th>Fecha término</th>
                <th>Obra</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-4 text-center text-gray-500">Cargando…</td></tr>
              ) : ordenados.length === 0 ? (
                <tr><td colSpan={4} className="py-4 text-center text-gray-500">Sin historial.</td></tr>
              ) : (
                ordenados.map((h, i) => (
                  <tr key={i}>
                    <td>{h.documento || "—"}</td>
                    <td>{h.fecha_inicio ? new Date(h.fecha_inicio).toLocaleDateString('es-CL') : "—"}</td>
                    <td>{h.fecha_termino ? new Date(h.fecha_termino).toLocaleDateString('es-CL') : "—"}</td>
                    <td>{h.obra || "—"}</td>
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
