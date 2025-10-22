// frontend/src/pages/AdminLogin.jsx
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react"; // si no lo tienes, puedes dibujar un <svg/>

import { useAuth } from "../context/AuthContext";

export default function AdminLogin() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(username, password);
    } catch (err) {
      setError(
        (err?.message && err.message.replace(/^"|"$/g, "")) ||
        "Error de autenticación"
      );
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1 className="login-title">App web máquinas</h1>
        <p className="login-sub">Inicia sesión para continuar</p>

        {error ? <div className="login-error">{error}</div> : null}

        <form className="login-form" onSubmit={onSubmit}>
          {/* Usuario */}
          <div className="form-row" style={{ gridTemplateColumns: "8.5rem 1fr" }}>
            <label className="label">Usuario</label>
            <div className="control">
              <input
                className="input"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Contraseña con ojito dentro */}
          <div className="form-row" style={{ gridTemplateColumns: "8.5rem 1fr" }}>
            <label className="label">Contraseña</label>
            <div className="control">
              <div className="pwd-wrap">
                <input
                  className="input"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  aria-label={showPwd ? "Ocultar contraseña" : "Ver contraseña"}
                  className="pwd-toggle"
                  onClick={() => setShowPwd((s) => !s)}
                >
                  {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              <small className="help-text">8 a 10 caracteres</small>
            </div>
          </div>

          {/* Botones centrados */}
          <div className="actions-bar" style={{
            display: "flex",
            justifyContent: "center",
            gap: ".6rem",
            padding: ".6rem 0",
            border: "none",
            background: "transparent",
            margin: 0
          }}>
            <button type="submit" className="btn btn-primary">Iniciar sesión</button>
          </div>
        </form>

        <div className="login-links">
          <span className="muted">¿Olvidaste tu clave? </span>
          <button className="link-like" onClick={() => alert("Pronto…")}>
            Recuperar clave. Click aquí
          </button>
        </div>
      </div>
    </div>
  );
}






