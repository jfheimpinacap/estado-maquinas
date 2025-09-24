import { useEffect, useMemo, useState } from 'react'

export default function MaquinariasList() {
  const [maquinarias, setMaquinarias] = useState([])
  const [q, setQ] = useState('')
  const [categoria, setCategoria] = useState('')      // '', 'equipos_altura', 'camiones', 'equipos_carga'
  const [combustible, setCombustible] = useState('')  // '', 'electrico', 'diesel'
  const [orden, setOrden] = useState('recientes')     // 'recientes' | 'marca' | 'modelo'

  const backendURL = import.meta.env.VITE_BACKEND_URL

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${backendURL}/maquinarias`)
        const data = await res.json()
        setMaquinarias(Array.isArray(data) ? data : [])
      } catch {
        setMaquinarias([])
      }
    }
    fetchData()
  }, [backendURL])

  const filtradas = useMemo(() => {
    let arr = [...maquinarias]

    if (categoria) {
      arr = arr.filter(m => (m.categoria || '') === categoria)
    }

    if (combustible) {
      arr = arr.filter(m => (m.combustible || '') === combustible)
    }

    if (q.trim()) {
      const term = q.toLowerCase()
      arr = arr.filter(m =>
        [m.marca, m.modelo, m.serie, m.descripcion]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(term))
      )
    }

    if (orden === 'marca') {
      arr.sort((a, b) => String(a.marca || '').localeCompare(String(b.marca || '')))
    } else if (orden === 'modelo') {
      arr.sort((a, b) => String(a.modelo || '').localeCompare(String(b.modelo || '')))
    } else {
      // recientes: si hay created_at/updated_at úsalo; si no, por id desc.
      arr.sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))
    }

    return arr
  }, [maquinarias, q, categoria, combustible, orden])

  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('es-CL', { maximumFractionDigits: 2 }) : n)

  return (
    <div>
      <h2 className="text-xl mb-4">Lista de Maquinarias</h2>

      {/* Filtros */}
      <div className="grid gap-2 md:grid-cols-4 mb-4">
        <input
          type="text"
          placeholder="Buscar por marca/modelo/serie/desc"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          <option value="equipos_altura">Equipos para trabajo en altura</option>
          <option value="camiones">Camiones</option>
          <option value="equipos_carga">Equipos para carga</option>
        </select>
        <select value={combustible} onChange={(e) => setCombustible(e.target.value)}>
          <option value="">Cualquier combustible</option>
          <option value="electrico">Eléctrico</option>
          <option value="diesel">Diésel</option>
        </select>
        <select value={orden} onChange={(e) => setOrden(e.target.value)}>
          <option value="recientes">Ordenar: recientes</option>
          <option value="marca">Ordenar: marca (A-Z)</option>
          <option value="modelo">Ordenar: modelo (A-Z)</option>
        </select>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <p>No hay maquinarias para mostrar.</p>
      ) : (
        <ul className="space-y-2">
          {filtradas.map((m) => {
            const cat = m.categoria || ''
            return (
              <li key={m.id} className="border rounded p-3">
                <div className="font-semibold">
                  {m.marca} {m.modelo ? `- ${m.modelo}` : ''}
                </div>
                <div className="text-sm opacity-80">
                  {cat === 'equipos_altura' && (
                    <>
                      <span>Altura: {fmt(m.altura)} m</span>
                      {m.combustible ? <> · <span>Combustible: {m.combustible}</span></> : null}
                      {m.serie ? <> · <span>Serie: {m.serie}</span></> : null}
                    </>
                  )}
                  {cat === 'camiones' && (
                    <>
                      {m.anio ? <span>Año: {m.anio}</span> : null}
                      {m.tonelaje ? <> · <span>Tonelaje: {fmt(m.tonelaje)} t</span></> : null}
                    </>
                  )}
                  {cat === 'equipos_carga' && (
                    <>
                      {m.carga ? <span>Carga: {fmt(m.carga)} t</span> : null}
                    </>
                  )}
                  {!cat && (
                    <>
                      {/* Compat: datos antiguos */}
                      {m.serie ? <span>Serie: {m.serie}</span> : null}
                      {m.altura ? <> · <span>Altura: {fmt(m.altura)} m</span></> : null}
                    </>
                  )}
                  {m.estado ? <> · <span>Estado: {m.estado}</span></> : null}
                </div>
                {m.descripcion ? <p className="mt-1 text-sm">{m.descripcion}</p> : null}
                <div className="text-xs mt-1 opacity-60">
                  Categoría: {cat || '—'} {m.id ? `· ID ${m.id}` : ''}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

