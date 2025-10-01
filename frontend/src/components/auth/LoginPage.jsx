// frontend/src/components/auth/LoginPage.jsx
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await login(username, password);
    } catch (err) {
      setMsg(err.message || "Error de autenticación");
    }
  };

  return (
    <section className="form-section">
      <h1>Ingresar</h1>
      <form onSubmit={onSubmit} className="stack-md">
        <input
          className="form-input w-72"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
        />
        <input
          className="form-input w-72"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {msg && <p style={{ color: "crimson" }}>{msg}</p>}
        <button className="btn-form" type="submit">Iniciar sesión</button>
      </form>

      <div style={{ marginTop: 12 }}>
        <a href="/recover" className="link">¿Olvidaste tu contraseña?</a>
      </div>
    </section>
  );
}



