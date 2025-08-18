import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'

const C = {
  fondoColumna: 'rgb(41, 50, 65)',
  botonPrincipal: 'rgb(238, 108, 77)',
  submenu: 'rgb(61, 90, 128)',
  hover: 'rgb(152, 193, 217)',
}

export default function Sidebar({ setView }) {
  const [openMenu, setOpenMenu] = useState(null)
  const toggleMenu = (menu) => setOpenMenu(openMenu === menu ? null : menu)

  const mainButtonClass =
    'w-full flex justify-between items-center text-left py-3 px-4 text-white rounded-none shadow transition'
  const submenuButtonClass =
    'w-full text-left py-2 px-5 text-white rounded-none transition'

  return (
    <aside
      className="min-h-screen p-5 flex flex-col w-72"
      style={{ backgroundColor: C.fondoColumna }}
    >
      <h1 className="text-base font-semibold mb-4 tracking-wide text-white">
        Panel de Control
      </h1>

      {/* CLIENTES */}
      <div className="mb-2">
        <button
          onClick={() => toggleMenu('clientes')}
          className={mainButtonClass}
          style={{ backgroundColor: C.botonPrincipal }}
        >
          <span>Clientes</span>
          {openMenu === 'clientes' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        <AnimatePresence>
          {openMenu === 'clientes' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-col mt-2 overflow-hidden rounded-none"
              style={{ backgroundColor: C.submenu }}
            >
              {[
                ['crear-cliente', 'Crear Cliente'],
                ['buscar-cliente', 'Buscar Cliente'],
                ['listar-clientes', 'Listar Clientes'],
                [null, 'Editar Cliente'],
              ].map(([view, label]) => (
                <button
                  key={label}
                  onClick={() => (view ? setView(view) : alert('Próximamente'))}
                  className={submenuButtonClass}
                  style={{ backgroundColor: C.submenu }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = C.hover)}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = C.submenu)}
                >
                  {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* MAQUINARIAS */}
      <div className="mb-2">
        <button
          onClick={() => toggleMenu('maquinarias')}
          className={mainButtonClass}
          style={{ backgroundColor: C.botonPrincipal }}
        >
          <span>Maquinarias</span>
          {openMenu === 'maquinarias' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        <AnimatePresence>
          {openMenu === 'maquinarias' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-col mt-2 overflow-hidden"
              style={{ backgroundColor: C.submenu }}
            >
              {[
                ['crearMaquinaria', 'Crear'],
                ['listaMaquinarias', 'Listar'],
                [null, 'Editar'],
                [null, 'Borrar'],
              ].map(([view, label]) => (
                <button
                  key={label}
                  onClick={() => (view ? setView(view) : alert('Próximamente'))}
                  className={submenuButtonClass}
                  style={{ backgroundColor: C.submenu }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = C.hover)}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = C.submenu)}
                >
                  {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DOCUMENTOS */}
      <div className="mb-2">
        <button
          onClick={() => toggleMenu('documentos')}
          className={mainButtonClass}
          style={{ backgroundColor: C.botonPrincipal }}
        >
          <span>Documentos</span>
          {openMenu === 'documentos' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        <AnimatePresence>
          {openMenu === 'documentos' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-col mt-2 overflow-hidden"
              style={{ backgroundColor: C.submenu }}
            >
              {['Guías', 'Facturas'].map((label) => (
                <button
                  key={label}
                  onClick={() => alert(label)}
                  className={submenuButtonClass}
                  style={{ backgroundColor: C.submenu }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = C.hover)}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = C.submenu)}
                >
                  {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ESTADO */}
      <div className="mb-2">
        <button
          onClick={() => toggleMenu('estado')}
          className={mainButtonClass}
          style={{ backgroundColor: C.botonPrincipal }}
        >
          <span>Estado</span>
          {openMenu === 'estado' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        <AnimatePresence>
          {openMenu === 'estado' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-col mt-2 overflow-hidden"
              style={{ backgroundColor: C.submenu }}
            >
              <button
                onClick={() => alert('Vista Estado')}
                className={submenuButtonClass}
                style={{ backgroundColor: C.submenu }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = C.hover)}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = C.submenu)}
              >
                Ver Estado
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}


















