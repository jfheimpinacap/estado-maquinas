import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/FormStyles.css";

const MIN_PASS = 8;
const MAX_PASS = 10;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setOk("");
    if (!usuario || !email || !p1 || !p2) return setErr("Completa todos los campos.");
    if (p1.length < MIN_PASS || p1.length > MAX_PASS) return setErr(`La contraseña debe tener entre ${MIN_PASS} y ${MAX_PASS} caracteres.`);
    if (p1 !== p2) return setErr("Las contraseñas no coinciden.");

    try {
      await register(usuario, email, p1);
      setOk("Usuario creado. Ahora puedes iniciar sesión.");
      setTimeout(()=>navigate("/login"), 800);
    } catch (e) {
      setErr(e?.message || "No se pudo crear el usuario");
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card form-section">
        <h1 className="text-center">Crear usuario</h1>
        {err && <div style={{ color: "#b91c1c", marginBottom: ".5rem" }}>{err}</div>}
        {ok &&  <div style={{ color: "#15803d", marginBottom: ".5rem" }}>{ok}</div>}
        <form onSubmit={onSubmit} className="stack-sm" noValidate>
          <input className="form-input" placeholder="Usuario" value={usuario} onChange={(e)=>setUsuario(e.target.value)} />
          <input className="form-input" type="email" placeholder="Correo electrónico" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <input className="form-input" type="password" placeholder={`Contraseña (min ${MIN_PASS}, max ${MAX_PASS})`} value={p1} onChange={(e)=>setP1(e.target.value)} minLength={MIN_PASS} maxLength={MAX_PASS} />
          <input className="form-input" type="password" placeholder="Repetir contraseña" value={p2} onChange={(e)=>setP2(e.target.value)} minLength={MIN_PASS} maxLength={MAX_PASS} />
          <div className="auth-actions">
            <button className="btn-inline" type="submit">Crear usuario</button>
            <Link to="/login" className="btn-inline btn-inline--gray" role="button">Volver a iniciar sesión</Link>
          </div>
        </form>
      </div>
    </main>
  );
}


