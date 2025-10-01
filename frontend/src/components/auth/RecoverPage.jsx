// frontend/src/components/auth/RecoverPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RecoverPage() {
  const { backendURL } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${backendURL}/auth/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const text = await res.text().catch(() => "");
      if (!res.ok) throw new Error(text || "Error");
      setMsg("Si el correo existe, se enviarán instrucciones.");
    } catch (err) {
      setMsg(err.message || "Error al iniciar recuperación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="form-section">
      <h1>Recuperar clave</h1>

      <form onSubmit={onSubmit} className="stack-md">
        <input
          className="form-input w-72"
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
        <div className="actions-inline" style={{ gap: 8 }}>
          <button className="btn-form" type="submit" disabled={loading}>
            {loading ? "Enviando..." : "Enviar"}
          </button>
          <button
            className="btn-form btn-form--gray"
            type="button"
            onClick={() => navigate("/login")}
          >
            Volver
          </button>
        </div>
      </form>

      {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
    </section>
  );
}
