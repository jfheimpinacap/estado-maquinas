// src/App.jsx
import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Sidebar from "./components/Sidebar";
import MaquinariaForm from "./components/MaquinariaForm";
import BuscarMaquina from "./components/BuscarMaquina";
import HistorialMaquina from "./components/HistorialMaquina";
import ClientesForm from "./components/ClientesForm";
import ClientesList from "./components/ClientesList";
import BuscarCliente from "./components/BuscarCliente";
import VerCliente from "./components/VerCliente";
import EditarCliente from "./components/EditarCliente";
import UsersAdmin from "./components/users/UsersAdmin";

import { useAuth } from "./context/AuthContext";
import LoginPage from "./components/auth/LoginPage";
import RegisterPage from "./components/auth/RegisterPage";

import "./App.css";

function AppShell({ view, setView, selectedCliente, setSelectedCliente, selectedMaquina, setSelectedMaquina }) {
  return (
    <>
      <Sidebar setView={setView} />
      <main className="flex-1 p-8 bg-white min-h-screen text-black">
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

        {view === "control-usuarios" && <UsersAdmin />}
      </main>
    </>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedMaquina, setSelectedMaquina] = useState(null);

  // Tu AuthContext actual parece exponer { auth } con auth.user:
  const { auth } = useAuth(); // => auth?.user

  return (
    <div id="root">
      <Routes>
        {!auth?.user ? (
          <>
            {/* Rutas públicas (no autenticado) */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            {/* Rutas privadas (autenticado) */}
            <Route
              path="/"
              element={
                <AppShell
                  view={view}
                  setView={setView}
                  selectedCliente={selectedCliente}
                  setSelectedCliente={setSelectedCliente}
                  selectedMaquina={selectedMaquina}
                  setSelectedMaquina={setSelectedMaquina}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>

      <ToastContainer />
    </div>
  );
}








