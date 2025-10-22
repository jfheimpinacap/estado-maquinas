import { useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { authFetch } from '../lib/api'

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

export default function MaquinariaForm({ setView }) {
  const [categoria, setCategoria] = useState(null)
  const [formAltura, setFormAltura] = useState(initialAltura)
  const [formCamion, setFormCamion] = useState(initialCamion)
  const [formCarga,  setFormCarga]  = useState(initialCarga)

  const { auth, backendURL } = useAuth()
  const token = auth?.access

  const limpiarActual = () => {
    if (categoria === CATEGORIAS.ALTURA) setFormAltura(initialAltura)
    if (categoria === CATEGORIAS.CAMIONES) setFormCamion(initialCamion)
    if (categoria === CATEGORIAS.CARGA) setFormCarga(initialCarga)
  }

  const buildPayload = () => {
    if (categoria === CATEGORIAS.ALTURA) {
      const { marca, modelo, serie, altura, descripcion } = formAltura
      return {
        categoria,
        marca: marca?.trim(),
        modelo: modelo?.trim(),
        serie: serie?.trim(),
        altura: altura ? Number(altura) : null,
        descripcion: (descripcion || '').trim() || null,
      }
    }
    if (categoria === CATEGORIAS.CAMIONES) {
      const { marca, modelo, anio, tonelaje, descripcion } = formCamion
      return {
        categoria,
        marca: marca?.trim(),
        modelo: modelo?.trim(),
        serie: null,
        anio: anio ? Number(anio) : null,
        tonelaje: tonelaje ? Number(tonelaje) : null,
        descripcion: (descripcion || '').trim() || null,
      }
    }
    const { marca, modelo, carga, descripcion } = formCarga
    return {
      categoria,
      marca: marca?.trim(),
      modelo: modelo?.trim(),
      serie: null,
      carga: carga ? Number(carga) : null,
      descripcion: (descripcion || '').trim() || null,
    }
  }

  const validar = () => {
    if (!token) return 'No estás autenticado.'
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
      const res = await authFetch(`${backendURL}/maquinarias`, {
        method: 'POST',
        token,
        json: payload,
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.success(`✅ Maquinaria creada${data?.id ? ` (ID ${data.id})` : ''}`)
        limpiarActual()
      } else if (res.status === 401) {
        toast.error('❌ No autorizado. Inicia sesión nuevamente.')
      } else {
        const text = await res.text().catch(() => '')
        toast.error(`❌ Error al crear la maquinaria${text ? `: ${text}` : ''}`)
      }
    } catch (err) {
      console.error(err)
      toast.error('❌ Error de conexión al guardar maquinaria')
    }
  }

  const actions = (
    <>
      <button className="btn btn-primary" type="submit" form="maq-create-form">Guardar</button>
      <button className="btn btn-ghost" onClick={() => setView?.('buscarMaquina')}>Cancelar</button>
    </>
  )

  return (
    <AdminLayout
      setView={setView}
      title="Añadir maquinaria"
      breadcrumbs={<>Maquinaria / Añadir</>}
      actions={actions}
    >
      <form id="maq-create-form" onSubmit={handleSubmit}>
        <div className="fieldset">
          <div className="legend">Categoría</div>
          <div className="form-row">
            <div className="label">Tipo</div>
            <div className="control" style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost"
                onClick={() => setCategoria(CATEGORIAS.ALTURA)}
                style={{ borderColor: categoria===CATEGORIAS.ALTURA ? 'var(--accent)' : 'var(--card-border)' }}>
                Trabajo en altura
              </button>
              <button type="button" className="btn btn-ghost"
                onClick={() => setCategoria(CATEGORIAS.CAMIONES)}
                style={{ borderColor: categoria===CATEGORIAS.CAMIONES ? 'var(--accent)' : 'var(--card-border)' }}>
                Camiones
              </button>
              <button type="button" className="btn btn-ghost"
                onClick={() => setCategoria(CATEGORIAS.CARGA)}
                style={{ borderColor: categoria===CATEGORIAS.CARGA ? 'var(--accent)' : 'var(--card-border)' }}>
                Equipos de carga
              </button>
              <div className="help-text">Selecciona la categoría antes de ingresar datos.</div>
            </div>
          </div>
        </div>

        {categoria === CATEGORIAS.ALTURA && (
          <div className="fieldset">
            <div className="legend">Datos de equipo en altura</div>

            <div className="form-row">
              <div className="label">Marca *</div>
              <div className="control">
                <input className="input" value={formAltura.marca}
                  onChange={(e)=>setFormAltura({...formAltura, marca: e.target.value})} required />
              </div>
            </div>

            <div className="form-row">
              <div className="label">Modelo *</div>
              <div className="control">
                <input className="input" value={formAltura.modelo}
                  onChange={(e)=>setFormAltura({...formAltura, modelo: e.target.value})}
                  pattern={modeloSeriePattern} title="Solo letras, números, guion y espacios" required />
              </div>
            </div>

            <div className="form-row">
              <div className="label">Serie *</div>
              <div className="control">
                <input className="input" value={formAltura.serie}
                  onChange={(e)=>setFormAltura({...formAltura, serie: e.target.value})}
                  pattern={modeloSeriePattern} title="Solo letras, números, guion y espacios" required />
            </div>
            </div>

            <div className="form-row">
              <div className="label">Altura (m) *</div>
              <div className="control">
                <input className="input" type="number" step="0.01" min="0" value={formAltura.altura}
                  onChange={(e)=>setFormAltura({...formAltura, altura: e.target.value})} required />
                <div className="help-text">Usa punto como separador decimal (ej: 10.50).</div>
              </div>
            </div>

            <div className="form-row">
              <div className="label">Descripción</div>
              <div className="control">
                <textarea className="textarea" value={formAltura.descripcion}
                  onChange={(e)=>setFormAltura({...formAltura, descripcion: e.target.value.slice(0, maxLenDesc)})}
                  maxLength={maxLenDesc} />
              </div>
            </div>
          </div>
        )}

        {categoria === CATEGORIAS.CAMIONES && (
          <div className="fieldset">
            <div className="legend">Datos de camión</div>

            <div className="form-row">
              <div className="label">Marca *</div>
              <div className="control">
                <input className="input" value={formCamion.marca}
                  onChange={(e)=>setFormCamion({...formCamion, marca: e.target.value})} required />
              </div>
            </div>

            <div className="form-row">
              <div className="label">Modelo *</div>
              <div className="control">
                <input className="input" value={formCamion.modelo}
                  onChange={(e)=>setFormCamion({...formCamion, modelo: e.target.value})}
                  pattern={modeloSeriePattern} title="Solo letras, números, guion y espacios" required />
              </div>
            </div>

            <div className="form-row">
              <div className="label">Año *</div>
              <div className="control">
                <input className="input" type="number" value={formCamion.anio}
                  min="1980" max={new Date().getFullYear() + 1}
                  onChange={(e)=>setFormCamion({...formCamion, anio: e.target.value})} required />
              </div>
            </div>

            <div className="form-row">
              <div className="label">Tonelaje *</div>
              <div className="control">
                <input className="input" type="number" step="0.01" min="0" value={formCamion.tonelaje}
                  onChange={(e)=>setFormCamion({...formCamion, tonelaje: e.target.value})} required />
              </div>
            </div>

            <div className="form-row">
              <div className="label">Descripción</div>
              <div className="control">
                <textarea className="textarea" value={formCamion.descripcion}
                  onChange={(e)=>setFormCamion({...formCamion, descripcion: e.target.value.slice(0, maxLenDesc)})}
                  maxLength={maxLenDesc} />
              </div>
            </div>
          </div>
        )}

        {categoria === CATEGORIAS.CARGA && (
          <div className="fieldset">
            <div className="legend">Datos de equipo de carga</div>

            <div className="form-row">
              <div className="label">Marca *</div>
              <div className="control">
                <input className="input" value={formCarga.marca}
                  onChange={(e)=>setFormCarga({...formCarga, marca: e.target.value})} required />
              </div>
            </div>

            <div className="form-row">
              <div className="label">Modelo *</div>
              <div className="control">
                <input className="input" value={formCarga.modelo}
                  onChange={(e)=>setFormCarga({...formCarga, modelo: e.target.value})}
                  pattern={modeloSeriePattern} title="Solo letras, números, guion y espacios" required />
              </div>
            </div>

            <div className="form-row">
              <div className="label">Carga (máx.) *</div>
              <div className="control">
                <input className="input" type="number" step="0.01" min="0" value={formCarga.carga}
                  onChange={(e)=>setFormCarga({...formCarga, carga: e.target.value})} required />
              </div>
            </div>

            <div className="form-row">
              <div className="label">Descripción</div>
              <div className="control">
                <textarea className="textarea" value={formCarga.descripcion}
                  onChange={(e)=>setFormCarga({...formCarga, descripcion: e.target.value.slice(0, maxLenDesc)})}
                  maxLength={maxLenDesc} />
              </div>
            </div>
          </div>
        )}
      </form>
    </AdminLayout>
  )
}





