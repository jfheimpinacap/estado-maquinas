// src/components/MaquinariaForm.jsx
import { useState } from 'react'
import { toast } from 'react-toastify'

export default function MaquinariaForm() {
  const [nuevaMaquina, setNuevaMaquina] = useState({
    marca: '',
    modelo: '',
    serie: '',
    altura: ''
  })

  const backendURL = import.meta.env.VITE_BACKEND_URL

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${backendURL}/maquinarias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaMaquina)
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`✅ Maquinaria creada con ID ${data.id}`)
        setNuevaMaquina({ marca: '', modelo: '', serie: '', altura: '' })
      } else {
        toast.error('❌ Error al crear la máquina')
      }
    } catch (error) {
      console.error(error)
      toast.error('❌ Error de conexión al guardar máquina')
    }
  }

  return (
    <div>
      <h2 className="text-xl mb-4">Crear Nueva Maquinaria</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Marca"
          value={nuevaMaquina.marca}
          onChange={(e) =>
            setNuevaMaquina({ ...nuevaMaquina, marca: e.target.value })
          }
        /><br />
        <input
          type="text"
          placeholder="Modelo"
          value={nuevaMaquina.modelo}
          onChange={(e) =>
            setNuevaMaquina({ ...nuevaMaquina, modelo: e.target.value })
          }
        /><br />
        <input
          type="text"
          placeholder="Serie"
          value={nuevaMaquina.serie}
          onChange={(e) =>
            setNuevaMaquina({ ...nuevaMaquina, serie: e.target.value })
          }
        /><br />
        <input
          type="text"
          placeholder="Altura"
          value={nuevaMaquina.altura}
          onChange={(e) =>
            setNuevaMaquina({ ...nuevaMaquina, altura: e.target.value })
          }
        /><br />
        <button type="submit">Crear Maquinaria</button>
      </form>
    </div>
  )
}

