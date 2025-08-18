// src/components/ClientesList.jsx
import { useEffect, useState } from 'react'

function ClientesList() {
  const [clientes, setClientes] = useState([])

  const backendURL = import.meta.env.VITE_BACKEND_URL

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const res = await fetch(`${backendURL}/clientes`)
        if (res.ok) {
          const data = await res.json()
          setClientes(data)
        } else {
          console.error('Error al cargar clientes')
        }
      } catch (error) {
        console.error(error)
      }
    }

    fetchClientes()
  }, [])

  return (
    <div>
      <h2 className="text-xl mb-4">Clientes Registrados</h2>
      <ul>
        {clientes.map((c) => (
          <li key={c.id}>
            {c.razon_social} - {c.rut} - {c.direccion} - {c.telefono} -{' '}
            {c.forma_pago}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ClientesList
