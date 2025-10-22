// frontend/src/components/layout/AdminLayout.jsx
import { useEffect, useMemo } from "react";
import Sidebar from "../Sidebar";
import { useAuth } from "../../context/AuthContext";

export default function AdminLayout({ title, breadcrumbs, actions, setView, children }) {
  const { auth, logout } = useAuth();

  // modo claro/oscuro persistente en <html>
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    document.documentElement.classList.toggle("theme-dark", saved === "dark");
  }, []);

  const toggleTheme = () => {
    const now = document.documentElement.classList.contains("theme-dark") ? "light" : "dark";
    document.documentElement.classList.toggle("theme-dark", now === "dark");
    localStorage.setItem("theme", now);
  };

  const userName = useMemo(() => auth?.user?.username || "usuario", [auth]);

  return (
    <>
      <header className="topbar">
        <div className="topbar__brand">App web máquinas</div>
        <nav className="topbar__links">
          <span>Bienvenid@, <strong>{userName}</strong>.</span>
          <a href="#" onClick={(e)=>e.preventDefault()}>Ver el sitio</a>
          <a href="#" onClick={(e)=>e.preventDefault()}>Cambiar contraseña</a>
          <button className="btn-link" onClick={logout}>Cerrar sesión</button>
          <button className="topbar__iconbtn" title="Modo claro/oscuro" onClick={toggleTheme}>◐</button>
        </nav>
      </header>

      <div className="app-shell">
        <aside className="dja-sidebar">
          <Sidebar setView={setView} />
        </aside>

        <main className="dja-main">
          <div className="page-header">
            {breadcrumbs ? <div className="breadcrumbs">{breadcrumbs}</div> : null}
            {title ? <h1 className="page-title">{title}</h1> : null}
          </div>

          {actions ? <div className="actions-bar">{actions}</div> : null}

          {children}
        </main>
      </div>
    </>
  );
}
