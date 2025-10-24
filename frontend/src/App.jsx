// src/App.jsx
import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Topbar from "./components/Topbar";
import Sidebar from "./components/Sidebar";

import MaquinariaForm from "./components/MaquinariaForm";
import BuscarMaquina from "./components/BuscarMaquina";
import HistorialMaquina from "./components/HistorialMaquina";
import ClientesForm from "./components/ClientesForm";
import ClientesList from "./components/ClientesList";
import BuscarCliente from "./components/BuscarCliente";
import VerCliente from "./components/VerCliente";
import EditarCliente from "./components/EditarCliente";
import BuscarDocumentos from "./components/BuscarDocumentos";
import EstadoOrdenes from "./components/EstadoOrdenes";
import InformesClientes from "./components/InformesClientes";
import ConsultaMaquinarias from "./components/ConsultaMaquinarias";
import ConsultaDocumentos from "./components/ConsultaDocumentos";
import InformesDocumentos from "./components/InformesDocumentos";
import CrearOT from "./components/CrearOT";
import EstadoArriendoMaquinas from "./components/EstadoArriendoMaquinas";


import { useAuth } from "./context/AuthContext";
import AdminLogin from "./pages/AdminLogin";

import "./styles/admin-theme.css";
import "./App.css";

function AdminShell({
  view, setView,
  selectedCliente, setSelectedCliente,
  selectedMaquina, setSelectedMaquina
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("sidebar-open", sidebarOpen);
    return () => document.documentElement.classList.remove("sidebar-open");
  }, [sidebarOpen]);

  const closeSidebarIfOpen = () => { if (sidebarOpen) setSidebarOpen(false); };

  return (
    <div className="admin-root">
      <Topbar onToggleSidebar={() => setSidebarOpen(s => !s)} />

      <div className="admin-body" onClick={closeSidebarIfOpen}>
        {/* ¡no envuelvas Sidebar con otro <aside>! */}
        <Sidebar setView={setView} />

        <main className="admin-main" onClick={e => e.stopPropagation()}>
          {/* encabezado opcional */}
          {view === "buscar-cliente" && (
            <header className="page-header">
              <h1 className="page-title">Buscar cliente</h1>
              <div className="breadcrumbs">Clientes / Buscar</div>
            </header>
          )}

          {/* Vistas */}
          {view === "crearMaquinaria" && <MaquinariaForm />}
          {view === "buscarMaquina" && (
            <BuscarMaquina setView={setView} setSelectedMaquina={setSelectedMaquina} />
          )}
          {view === "historial-maquina" && (
            <HistorialMaquina selectedMaquina={selectedMaquina} setView={setView} />
          )}
          {view === "crear-cliente" && <ClientesForm />}
          {view === "listar-clientes" && <ClientesList />}
          {view === "buscar-cliente" && (
            <BuscarCliente setSelectedCliente={setSelectedCliente} setView={setView} />
          )}
          {view === "editar-cliente" && (
            <EditarCliente
              selectedCliente={selectedCliente}
              setSelectedCliente={setSelectedCliente}
              setView={setView}
            />
          )}
          {view === "ver-cliente" && selectedCliente && (
            <VerCliente
              cliente={selectedCliente}
              setView={setView}
              setSelectedCliente={setSelectedCliente}
            />
          )}
          {view === "buscar-documentos" && <BuscarDocumentos setView={setView} />}
          {view === "estado-ordenes" && <EstadoOrdenes setView={setView} />}
          {view === "informes-clientes" && <InformesClientes />}
          {view === "consulta-maquinarias" && <ConsultaMaquinarias />}
          {view === "consulta-documentos" && <ConsultaDocumentos />} 
          {view === "informes-documentos" && <InformesDocumentos />}
          {view === "crear-ot" && <CrearOT />}
          {view === "estado-arriendo-maquinas" && <EstadoArriendoMaquinas />}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("buscar-cliente");
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedMaquina, setSelectedMaquina] = useState(null);
  const { auth } = useAuth();

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={auth?.user ? <Navigate to="/" replace /> : <AdminLogin />}
        />
        <Route
          path="/"
          element={
            auth?.user ? (
              <AdminShell
                view={view}
                setView={setView}
                selectedCliente={selectedCliente}
                setSelectedCliente={setSelectedCliente}
                selectedMaquina={selectedMaquina}
                setSelectedMaquina={setSelectedMaquina}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="*"
          element={auth?.user ? <Navigate to="/" replace /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </>
  );
}



















