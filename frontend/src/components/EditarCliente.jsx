import { useState, useMemo } from 'react'
import { toast } from 'react-toastify'

const PAGO_OPCIONES = ['Pago a 15 días', 'Pago a 30 días', 'Pago contado']

export default function EditarCliente() {
  // BUSCADOR
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])
  const [cargando, setCargando] = useState(false)

  // FORMULARIO/EDICIÓN
  const [clienteSel, setClienteSel] = useState(null)
  const [form, setForm] = useState({
    razon_social: '',
    rut: '',
    direccion: '',
    telefono: '',
    forma_pago: '',
  })
  // qué campos están habilitados para editar
  const [editando, setEditando] = useState({
    razon_social: false,
    rut: false,
    direccion: false,
    telefono: false,
    forma_pago: false,
  })

  const backendURL = useMemo(
    () => import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000',
    []
  )

  // ---------- Buscar ----------
  const handleBuscar = async () => {
    setCargando(true)
    try {
      const url = `${backendURL}/clientes?query=${encodeURIComponent(query)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Error al buscar clientes')
      const data = await res.json()
      setResultados(data)
      if (data.length === 0) toast.info('Sin resultados')
    } catch (e) {
      console.error(e)
      toast.error('No se pudo buscar clientes')
    } finally {
      setCargando(false)
    }
  }

  const handleLimpiar = () => {
    setQuery('')
    setResultados([])
    setClienteSel(null)
  }

  const seleccionarCliente = (c) => {
    setClienteSel(c)
    setForm({
      razon_social: c.razon_social || '',
      rut: c.rut || '',
      direccion: c.direccion || '',
      telefono: c.telefono || '',
      forma_pago: c.forma_pago || '',
    })
    setEditando({
      razon_social: false,
      rut: false,
      direccion: false,
      telefono: false,
      forma_pago: false,
    })
  }

  // ---------- Validación simple ----------
  const validarCampo = (name, value) => {
    switch (name) {
      case 'razon_social':
        return value.trim().length >= 2
      case 'rut':
        return value.trim().length >= 6 // validación básica
      case 'telefono':
        return /^[0-9]{8,15}$/.test(value.replace(/\D/g, ''))
      case 'forma_pago':
        return PAGO_OPCIONES.includes(value)
      case 'direccion':
        return true
      default:
        return true
    }
  }

  // ---------- Guardar por campo ----------
  const guardarCampo = async (name) => {
    if (!clienteSel) return
    const valor = form[name]

    if (!validarCampo(name, valor)) {
      toast.error('Dato no válido para el campo seleccionado')
      return
    }

    try {
      const res = await fetch(`${backendURL}/clientes/${clienteSel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [name]: valor }),
      })
      if (!res.ok) throw new Error('PATCH falló')

      const actualizado = await res.json()
      // refleja cambios
      setClienteSel(actualizado)
      setForm((prev) => ({ ...prev, [name]: actualizado[name] || '' }))
      setEditando((prev) => ({ ...prev, [name]: false }))
      toast.success('Campo actualizado')
    } catch (e) {
      console.error(e)
      toast.error('No se pudo guardar el cambio')
    }
  }

  const cancelarCampo = (name) => {
    // vuelve al valor del cliente seleccionado
    if (!clienteSel) return
    setForm((prev) => ({ ...prev, [name]: clienteSel[name] || '' }))
    setEditando((prev) => ({ ...prev, [name]: false }))
  }

  // ---------- Render helpers ----------
  const CampoTexto = ({ name, label, type = 'text', placeholder = '' }) => (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <label className="block mb-1 text-sm font-medium text-gray-700">{label}</label>
        <input
          type={type}
          value={form[name]}
          placeholder={placeholder}
          className="form-input w-full"
          disabled={!editando[name]}
          onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))}
          style={{ background: 'rgb(224, 251, 252)', color: '#000' }}
        />
      </div>

      {!editando[name] ? (
        <button
          type="button"
          className="btn-inline btn-inline--gray"
          onClick={() => setEditando((p) => ({ ...p, [name]: true }))}
        >
          Editar
        </button>
      ) : (
        <div className="flex items-center gap-2 pt-6">
          <button type="button" className="btn-inline" onClick={() => guardarCampo(name)}>
            Guardar
          </button>
          <button type="button" className="btn-inline btn-inline--gray" onClick={() => cancelarCampo(name)}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  )

  const CampoSelect = ({ name, label, opciones }) => (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <label className="block mb-1 text-sm font-medium text-gray-700">{label}</label>
        <select
          value={form[name]}
          className="form-input w-full"
          disabled={!editando[name]}
          onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))}
          style={{ background: 'rgb(224, 251, 252)', color: '#000' }}
        >
          <option value="">Seleccione Forma de Pago</option>
          {opciones.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>

      {!editando[name] ? (
        <button
          type="button"
          className="btn-inline btn-inline--gray"
          onClick={() => setEditando((p) => ({ ...p, [name]: true }))}
        >
          Editar
        </button>
      ) : (
        <div className="flex items-center gap-2 pt-6">
          <button type="button" className="btn-inline" onClick={() => guardarCampo(name)}>
            Guardar
          </button>
          <button type="button" className="btn-inline btn-inline--gray" onClick={() => cancelarCampo(name)}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Buscador angosto */}
      <section className="form-section">
        <h1>Editar Cliente</h1>

        <div className="flex items-center gap-4 mb-6">
          <input
            type="text"
            placeholder="Buscar por Razón Social o RUT"
            className="form-input w-96"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            style={{ background: 'rgb(224, 251, 252)', color: '#000' }}
          />
          <button type="button" onClick={handleBuscar} className="btn-inline">
            {cargando ? 'Buscando…' : 'Buscar'}
          </button>
          <button type="button" onClick={handleLimpiar} className="btn-inline btn-inline--gray">
            Limpiar
          </button>
        </div>

        {/* Resultados básicos para seleccionar */}
        {resultados.length > 0 && (
          <div className="panel-section" style={{ marginLeft: 0, marginTop: '1rem' }}>
            <div className="table-wrap">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th>Razón Social</th>
                    <th>RUT</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((c) => (
                    <tr key={c.id}>
                      <td>{c.razon_social}</td>
                      <td>{c.rut}</td>
                      <td>
                        <button className="btn-sm-orange" onClick={() => seleccionarCliente(c)}>
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Formulario bloqueado + edición por campo */}
      {clienteSel && (
        <section className="form-section" style={{ marginTop: 0 }}>
          <h2>Datos del Cliente</h2>

          <div className="space-y-5">
            <CampoTexto name="razon_social" label="Razón Social" />
            <CampoTexto name="rut" label="RUT" />
            <CampoTexto name="direccion" label="Dirección" />
            <CampoTexto name="telefono" label="Teléfono" />
            <CampoSelect name="forma_pago" label="Forma de Pago" opciones={PAGO_OPCIONES} />
          </div>
        </section>
      )}
    </div>
  )
}
