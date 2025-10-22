// src/components/layout/AdminTopbar.jsx
import { useAuth } from "../../context/AuthContext";

export default function AdminTopbar() {
  const { auth, logout } = useAuth();
  const username = auth?.user?.username || "usuario";

  return (
    <header className="adm-topbar">
      <div className="adm-topbar__brand">App web máquinas</div>
      <nav className="adm-topbar__nav">
        <span className="muted">Bienvenid@, {username}.</span>
        <a href="/" className="adm-topbar__link">Ver el sitio</a>
        <a href="#" className="adm-topbar__link" onClick={(e)=>e.preventDefault()}>
          Cambiar contraseña
        </a>
        <button className="adm-topbar__link btn-link" onClick={logout}>Cerrar sesión</button>
        <button
          className="adm-topbar__icon"
          title="Tema"
          onClick={() => document.documentElement.classList.toggle("theme-dark")}
        >
          ☾
        </button>
      </nav>
    </header>
  );
}
