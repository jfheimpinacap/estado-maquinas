// src/App.jsx
import { useState } from 'react'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Sidebar from './components/Sidebar'
import MaquinariaForm from './components/MaquinariaForm'
import BuscarMaquina from "./components/BuscarMaquina"
import HistorialMaquina from "./components/HistorialMaquina"
import ClientesForm from './components/ClientesForm'
import ClientesList from './components/ClientesList'
import BuscarCliente from './components/BuscarCliente'
import VerCliente from './components/VerCliente'
import EditarCliente from './components/EditarCliente'
import UsersAdmin from './components/users/UsersAdmin'
import { useAuth } from './context/AuthContext'
import LoginOverlay from './components/auth/LoginOverlay'
import './App.css'

function App() {
  const [view, setView] = useState('home')
  const [selectedCliente, setSelectedCliente] = useState(null)
  const [selectedMaquina, setSelectedMaquina] = useState(null)
  const { auth } = useAuth()

  return (
    <div id="root">
      {/* Overlay de login si no hay usuario */}
      {!auth.user && <LoginOverlay />}

      <Sidebar setView={setView} />

      <main className="flex-1 p-8 bg-white min-h-screen text-black">
        {view === 'crearMaquinaria' && <MaquinariaForm />}
        {view === 'buscarMaquina' && (
        <BuscarMaquina setView={setView} setSelectedMaquina={setSelectedMaquina} />
        )}
        {view === 'historial-maquina' && (
        <HistorialMaquina selectedMaquina={selectedMaquina} setView={setView} />
        )}
        {view === 'crear-cliente' && <ClientesForm />}
        {view === 'listar-clientes' && <ClientesList />}
        {view === 'buscar-cliente' && (
          <BuscarCliente 
          setSelectedCliente={setSelectedCliente} 
          setView={setView} 
          />
        )}
        {view === 'editar-cliente' && (
          <EditarCliente
          selectedCliente={selectedCliente}
          setSelectedCliente={setSelectedCliente}
          setView={setView}
          />
        )}
        {view === 'ver-cliente' && selectedCliente && (
          <VerCliente 
          cliente={selectedCliente} 
          setView={setView} 
          setSelectedCliente={setSelectedCliente}
          />
        )}
        {view === 'control-usuarios' && <UsersAdmin />}
      </main>

      <ToastContainer />
    </div>
  )
}

export default App







