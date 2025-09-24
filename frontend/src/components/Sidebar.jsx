import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const C = {
  fondoColumna: 'rgb(41, 50, 65)',
  botonPrincipal: 'rgb(238, 108, 77)',
  submenu: 'rgb(61, 90, 128)',
  hover: 'rgb(152, 193, 217)',
}

export default function Sidebar({ setView }) {
  const [openMenu, setOpenMenu] = useState(null)
  const { auth, logout } = useAuth() || { auth: null, logout: () => {} }
  const isAdmin = !!(auth?.user?.is_staff || auth?.user?.is_superuser || auth?.is_staff)

  const toggleMenu = (menu) => setOpenMenu(openMenu === menu ? null : menu)

  const mainButtonClass =
    'w-full flex justify-between items-center text-left py-3 px-4 rounded-none shadow transition'
  const submenuButtonClass =
    'w-full text-left py-2 px-5 rounded-none transition'

  return (
    <aside
      className="min-h-screen p-5 flex flex-col w-80"
      // Forzamos color blanco a todo el árbol del sidebar (evita que el body lo sobrescriba)
      style={{ backgroundColor: C.fondoColumna, color: '#fff' }}
    >
      <h1 className="text-lg font-semibold mb-4 tracking-wide" style={{ color: '#fff' }}>
        Panel de Control
      </h1>

      {/* CLIENTES */}
      <div className="mb-2">
        <button
          onClick={() => toggleMenu('clientes')}
          className={mainButtonClass}
          style={{ backgroundColor: C.botonPrincipal, color: '#fff' }}
        >
          <span>Clientes</span>
          {openMenu === 'clientes'
            ? <ChevronUp size={18} color="#fff" />
            : <ChevronDown size={18} color="#fff" />}
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
                ['editar-cliente', 'Editar Cliente'],
              ].map(([view, label]) => (
                <button
                  key={label}
                  onClick={() => setView(view)}
                  className={submenuButtonClass}
                  style={{ backgroundColor: C.submenu, color: '#fff' }}
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
          style={{ backgroundColor: C.botonPrincipal, color: '#fff' }}
        >
          <span>Maquinarias</span>
          {openMenu === 'maquinarias'
            ? <ChevronUp size={18} color="#fff" />
            : <ChevronDown size={18} color="#fff" />}
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
                ['crearMaquinaria', 'Crear maquinaria'],
                ['buscarMaquina', 'Buscar máquina'],
                ['editarMaquinarias', 'Editar máquinas'],
                ['borrarMaquinarias', 'Borrar'],
              ].map(([view, label]) => (
                <button
                  key={label}
                  onClick={() => (view ? setView(view) : alert('Próximamente'))}
                  className={submenuButtonClass}
                  style={{ backgroundColor: C.submenu, color: '#fff' }}
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
          style={{ backgroundColor: C.botonPrincipal, color: '#fff' }}
        >
          <span>Documentos</span>
          {openMenu === 'documentos'
            ? <ChevronUp size={18} color="#fff" />
            : <ChevronDown size={18} color="#fff" />}
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
                  style={{ backgroundColor: C.submenu, color: '#fff' }}
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
          style={{ backgroundColor: C.botonPrincipal, color: '#fff' }}
        >
          <span>Estado</span>
          {openMenu === 'estado'
            ? <ChevronUp size={18} color="#fff" />
            : <ChevronDown size={18} color="#fff" />}
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
                style={{ backgroundColor: C.submenu, color: '#fff' }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = C.hover)}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = C.submenu)}
              >
                Ver Estado
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ZONA INFERIOR: Cerrar sesión + Control de Usuarios */}
      <div className="mt-auto pt-6 sidebar-bottom">
        {/* Cerrar sesión (gris) */}
        <button
          onClick={() => {
            logout()        // limpia el token
            setView('home') // vuelve a vista base; el overlay se mostrará por no estar autenticado
          }}
          className="btn-form btn-form--sm btn-form--gray w-full"
          style={{ display: 'block' }}
        >
          Cerrar sesión
        </button>

        {/* Control de usuarios (solo admin) */}
        {isAdmin && (
          <button
            onClick={() => setView('control-usuarios')}
            className="btn-form btn-form--sm w-full"
            >
            Control de Usuarios
          </button>
        )}
      </div>
    </aside>
  )
}























