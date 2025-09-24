import { useState } from 'react'
import { toast } from 'react-toastify'

const CATEGORIAS = {
  ALTURA: 'equipos_altura',
  CAMIONES: 'camiones',
  CARGA: 'equipos_carga',
}

const initialAltura = { marca: '', modelo: '', serie: '', altura: '', descripcion: '' }
const initialCamion = { marca: '', modelo: '', anio: '', tonelaje: '', descripcion: '' }
const initialCarga  = { marca: '', modelo: '', carga: '', descripcion: '' }

const modeloSeriePattern = '^[A-Za-z0-9\\-\\s]{1,50}$'
const maxLenDesc = 280
const twoDecimalsOk = (v) => /^(\d+)(\.\d{1,2})?$/.test(String(v ?? ''))

export default function MaquinariaForm() {
  const [categoria, setCategoria] = useState(null)
  const [formAltura, setFormAltura] = useState(initialAltura)
  const [formCamion, setFormCamion] = useState(initialCamion)
  const [formCarga,  setFormCarga]  = useState(initialCarga)

  const backendURL = import.meta.env.VITE_BACKEND_URL

  const limpiarActual = () => {
    if (categoria === CATEGORIAS.ALTURA) setFormAltura(initialAltura)
    if (categoria === CATEGORIAS.CAMIONES) setFormCamion(initialCamion)
    if (categoria === CATEGORIAS.CARGA) setFormCarga(initialCarga)
  }

  const buildPayload = () => {
    if (categoria === CATEGORIAS.ALTURA) {
      const { marca, modelo, serie, altura, descripcion } = formAltura
      return { categoria, marca, modelo, serie, altura: altura ? Number(altura) : null, descripcion }
    }
    if (categoria === CATEGORIAS.CAMIONES) {
      const { marca, modelo, anio, tonelaje, descripcion } = formCamion
      return { categoria, marca, modelo, anio: anio ? Number(anio) : null, tonelaje: tonelaje ? Number(tonelaje) : null, descripcion }
    }
    const { marca, modelo, carga, descripcion } = formCarga
    return { categoria, marca, modelo, carga: carga ? Number(carga) : null, descripcion }
  }

  const validar = () => {
    if (!categoria) return 'Selecciona una categoría.'
    if (categoria === CATEGORIAS.ALTURA) {
      const { marca, modelo, serie, altura } = formAltura
      if (!marca || !modelo || !serie || !altura) return 'Completa todos los campos obligatorios.'
      if (!twoDecimalsOk(altura)) return 'Altura debe estar en metros con hasta 2 decimales.'
      return null
    }
    if (categoria === CATEGORIAS.CAMIONES) {
      const { marca, modelo, anio, tonelaje } = formCamion
      const currentYear = new Date().getFullYear()
      if (!marca || !modelo || !anio || !tonelaje) return 'Completa todos los campos obligatorios.'
      if (Number(anio) < 1980 || Number(anio) > currentYear + 1) return `Año debe estar entre 1980 y ${currentYear + 1}.`
      if (!twoDecimalsOk(tonelaje)) return 'Tonelaje debe tener hasta 2 decimales.'
      return null
    }
    if (categoria === CATEGORIAS.CARGA) {
      const { marca, modelo, carga } = formCarga
      if (!marca || !modelo || !carga) return 'Completa todos los campos obligatorios.'
      if (!twoDecimalsOk(carga)) return 'Carga debe tener hasta 2 decimales.'
      return null
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const msg = validar()
    if (msg) return toast.warn(`⚠️ ${msg}`)
    const payload = buildPayload()

    try {
      const res = await fetch(`${backendURL}/maquinarias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.success(`✅ Maquinaria creada${data?.id ? ` (ID ${data.id})` : ''}`)
        limpiarActual()
      } else {
        const text = await res.text().catch(() => '')
        toast.error(`❌ Error al crear la maquinaria${text ? `: ${text}` : ''}`)
      }
    } catch (err) {
      console.error(err)
      toast.error('❌ Error de conexión al guardar maquinaria')
    }
  }

  const CatBtn = ({ id, className = '', children }) => {
    const active = categoria === id
    return (
      <button
        type="button"
        className={`cat-btn ${active ? 'cat-btn--active' : ''} ${className}`}
        onClick={() => setCategoria(id)}
      >
        {children}
      </button>
    )
  }

  return (
    <section className="form-section form-section--compact2">
      <h2>Crear maquinaria</h2>

      <div className="category-grid">
        <CatBtn id={CATEGORIAS.ALTURA} className="cat-two-lines">
          <span>Equipos para trabajo</span>
          <span>en altura</span>
        </CatBtn>
        <CatBtn id={CATEGORIAS.CAMIONES}>Camiones</CatBtn>
        <CatBtn id={CATEGORIAS.CARGA}>Equipos de carga</CatBtn>
      </div>

      {categoria && (
        <form onSubmit={handleSubmit} className="stack-sm">
          {categoria === CATEGORIAS.ALTURA && (
            <>
              <input className="form-input form-input--sm" type="text" placeholder="Marca *"
                value={formAltura.marca} onChange={(e) => setFormAltura({ ...formAltura, marca: e.target.value })} required />
              <input className="form-input form-input--sm" type="text" placeholder="Modelo *"
                value={formAltura.modelo} onChange={(e) => setFormAltura({ ...formAltura, modelo: e.target.value })}
                pattern={modeloSeriePattern} title="Solo letras, números, guion y espacios" required />
              <input className="form-input form-input--sm" type="text" placeholder="Serie *"
                value={formAltura.serie} onChange={(e) => setFormAltura({ ...formAltura, serie: e.target.value })}
                pattern={modeloSeriePattern} title="Solo letras, números, guion y espacios" required />
              <input className="form-input form-input--sm" type="number" placeholder="Altura en metros (ej: 10.50) *"
                value={formAltura.altura} onChange={(e) => setFormAltura({ ...formAltura, altura: e.target.value })}
                step="0.01" min="0" required />
              <textarea className="form-input form-textarea"
                placeholder={`Descripción (máx. ${maxLenDesc} caracteres)`}
                value={formAltura.descripcion}
                onChange={(e) => setFormAltura({ ...formAltura, descripcion: e.target.value.slice(0, maxLenDesc) })}
                maxLength={maxLenDesc} />
            </>
          )}

          {categoria === CATEGORIAS.CAMIONES && (
            <>
              <input className="form-input form-input--sm" type="text" placeholder="Marca *"
                value={formCamion.marca} onChange={(e) => setFormCamion({ ...formCamion, marca: e.target.value })} required />
              <input className="form-input form-input--sm" type="text" placeholder="Modelo *"
                value={formCamion.modelo} onChange={(e) => setFormCamion({ ...formCamion, modelo: e.target.value })}
                pattern={modeloSeriePattern} title="Solo letras, números, guion y espacios" required />
              <input className="form-input form-input--sm" type="number" placeholder="Año *"
                value={formCamion.anio} onChange={(e) => setFormCamion({ ...formCamion, anio: e.target.value })}
                min="1980" max={new Date().getFullYear() + 1} required />
              <input className="form-input form-input--sm" type="number" placeholder="Tonelaje (peso máx. de carga) *"
                value={formCamion.tonelaje} onChange={(e) => setFormCamion({ ...formCamion, tonelaje: e.target.value })}
                step="0.01" min="0" required />
              <textarea className="form-input form-textarea"
                placeholder={`Descripción (máx. ${maxLenDesc} caracteres)`}
                value={formCamion.descripcion}
                onChange={(e) => setFormCamion({ ...formCamion, descripcion: e.target.value.slice(0, maxLenDesc) })}
                maxLength={maxLenDesc} />
            </>
          )}

          {categoria === CATEGORIAS.CARGA && (
            <>
              <input className="form-input form-input--sm" type="text" placeholder="Marca *"
                value={formCarga.marca} onChange={(e) => setFormCarga({ ...formCarga, marca: e.target.value })} required />
              <input className="form-input form-input--sm" type="text" placeholder="Modelo *"
                value={formCarga.modelo} onChange={(e) => setFormCarga({ ...formCarga, modelo: e.target.value })}
                pattern={modeloSeriePattern} title="Solo letras, números, guion y espacios" required />
              <input className="form-input form-input--sm" type="number" placeholder="Carga (peso máx. de carga) *"
                value={formCarga.carga} onChange={(e) => setFormCarga({ ...formCarga, carga: e.target.value })}
                step="0.01" min="0" required />
              <textarea className="form-input form-textarea"
                placeholder={`Descripción (máx. ${maxLenDesc} caracteres)`}
                value={formCarga.descripcion}
                onChange={(e) => setFormCarga({ ...formCarga, descripcion: e.target.value.slice(0, maxLenDesc) })}
                maxLength={maxLenDesc} />
            </>
          )}

          <div className="form-actions-center">
            <button type="submit" className="btn-cat">Crear maquina</button>
          </div>
        </form>
      )}
    </section>
  )
}




