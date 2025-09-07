import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import "../../styles/FormStyles.css";

export default function LoginOverlay() {
  const { login, register } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [rU, setRU] = useState("");
  const [rP1, setRP1] = useState("");
  const [rP2, setRP2] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const doLogin = async (e) => {
    e.preventDefault();
    setErr(""); setOk("");
    try {
      await login(u, p);
      setU(""); setP("");
    } catch (e) {
      setErr(e.message || "Error de login");
    }
  };

  const doRegister = async (e) => {
    e.preventDefault();
    setErr(""); setOk("");
    if (!rU || !rP1 || !rP2) return setErr("Completa todos los campos");
    if (rP1 !== rP2) return setErr("Las contraseñas no coinciden");
    try {
      await register(rU, rP1);
      setOk("Usuario creado. Ahora inicia sesión.");
      setRU(""); setRP1(""); setRP2("");
      setShowSignup(false);
    } catch (e) {
      setErr(e.message || "No se pudo crear el usuario");
    }
  };

  return (
<div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
  <div className="form-section form-section--modal">
    <h1 className="mb-2 text-center">Bienvenido al sistema</h1>

    {err && <div style={{ color: "#b91c1c", marginBottom: ".5rem" }}>{err}</div>}
    {ok && <div style={{ color: "#15803d", marginBottom: ".5rem" }}>{ok}</div>}

    {/* ← usa stack-sm para separar campos */}
    <form onSubmit={doLogin} className="stack-sm">
      <input className="form-input" placeholder="Usuario" value={u} onChange={(e) => setU(e.target.value)} />
      <input className="form-input" type="password" placeholder="Contraseña" value={p} onChange={(e) => setP(e.target.value)} />

      {/* botones centrados y separados del campo contraseña */}
      <div className="auth-actions">
        <button className="btn-inline" type="submit">Ingresar</button>
        <button className="btn-inline btn-inline--gray" type="button" onClick={() => setShowSignup(true)}>
          Crear usuario
        </button>
      </div>
    </form>
  </div>

  {showSignup && (
    <div className="fixed inset-0 z-60 grid place-items-center bg-black/50">
      <div className="form-section form-section--modal" style={{ maxWidth: 420 }}>
        <h2 className="mb-2 text-center">Crear usuario</h2>
        <form onSubmit={doRegister} className="stack-sm">
          <input className="form-input" placeholder="Usuario" value={rU} onChange={(e) => setRU(e.target.value)} />
          <input className="form-input" type="password" placeholder="Contraseña" value={rP1} onChange={(e) => setRP1(e.target.value)} />
          <input className="form-input" type="password" placeholder="Confirmar contraseña" value={rP2} onChange={(e) => setRP2(e.target.value)} />

          <div className="auth-actions">
            <button className="btn-inline" type="submit">Crear</button>
            <button className="btn-inline btn-inline--gray" type="button" onClick={() => setShowSignup(false)}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )}
</div>
);
}

