// src/components/MaquinariasList.jsx
import { useEffect, useState } from 'react'

export default function MaquinariasList() {
  const [maquinarias, setMaquinarias] = useState([])
  const backendURL = import.meta.env.VITE_BACKEND_URL

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(`${backendURL}/maquinarias`)
      const data = await res.json()
      setMaquinarias(data)
    }
    fetchData()
  }, [])

  return (
    <div>
      <h2 className="text-xl mb-4">Lista de Maquinarias</h2>
      <ul>
        {maquinarias.map((m) => (
          <li key={m.id}>
            {m.marca} - {m.modelo} - {m.serie} - {m.altura} ({m.estado})
          </li>
        ))}
      </ul>
    </div>
  )
}
