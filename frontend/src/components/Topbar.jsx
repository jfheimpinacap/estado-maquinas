// src/components/Topbar.jsx
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function Topbar({ onToggleSidebar }) {
  const { auth, logout } = useAuth();
  const username = auth?.user?.username || "usuario";

  // Persistencia de tema
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    const isLight = saved === "light";
    document.documentElement.classList.toggle("theme-light", isLight);
    document.documentElement.classList.toggle("theme-dark", !isLight);
  }, []);

  const toggleTheme = () => {
    const isLight = document.documentElement.classList.contains("theme-light");
    const next = isLight ? "dark" : "light";
    document.documentElement.classList.toggle("theme-light", next === "light");
    document.documentElement.classList.toggle("theme-dark", next !== "light");
    localStorage.setItem("theme", next);
  };

  return (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          className="topbar__iconbtn"
          aria-label="Abrir menú"
          onClick={onToggleSidebar}
        >
          ☰
        </button>
        <div className="topbar__brand">App web máquinas</div>
      </div>

      <div className="topbar__links">
        {auth?.user && (
          <>
            <span>Bienvenid@, <strong>{username}</strong>.</span>
            <button className="btn-link" onClick={logout}>Cerrar sesión</button>
            <button className="topbar__iconbtn" title="Tema" onClick={toggleTheme}>◐</button>
          </>
        )}
      </div>
    </div>
  );
}







