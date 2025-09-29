import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/FormStyles.css";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const doLogin = async (e) => {
    e.preventDefault();
    setErr(""); setOk("");
    if (!usuario || !password) return setErr("Completa usuario y contraseña.");
    try {
      await login(usuario, password);
      setOk("Ingreso correcto");
      navigate("/");
    } catch (e) {
      setErr(e?.message || "Error de login");
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card form-section">
        <h1 className="text-center">Bienvenido al sistema</h1>
        {err && <div style={{ color: "#b91c1c", marginBottom: ".5rem" }}>{err}</div>}
        {ok &&  <div style={{ color: "#15803d", marginBottom: ".5rem" }}>{ok}</div>}
        <form onSubmit={doLogin} className="stack-sm" noValidate>
          <input className="form-input" placeholder="Usuario" value={usuario} onChange={(e)=>setUsuario(e.target.value)} autoFocus />
          <input className="form-input" type="password" placeholder="Contraseña" value={password} onChange={(e)=>setPassword(e.target.value)} />
          <div className="auth-actions">
            <button className="btn-inline" type="submit">Iniciar sesión</button>
            <Link to="/register" className="btn-inline btn-inline--gray" role="button">Crear usuario</Link>
          </div>
        </form>
        <p className="auth-help">
          Recuperar clave.{" "}
          <button className="link-inline" type="button" onClick={()=>alert("Abrir modal de recuperación por correo")}>
            Click aquí
          </button>
        </p>
      </div>
    </main>
  );
}

