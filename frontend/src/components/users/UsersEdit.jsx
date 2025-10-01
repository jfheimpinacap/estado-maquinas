import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { authFetch } from "../../lib/api";

export default function UsersEdit({ selectedUser, setSelectedUser, setView }) {
  const { auth, backendURL } = useAuth();
  const token = auth?.access;
  const isSuper = !!auth?.user?.is_superuser;

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    is_staff: false,
    is_superuser: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedUser) {
      setView("control-usuarios");
      return;
    }
    // precarga
    setForm({
      username: selectedUser.username || "",
      email: selectedUser.email || "",
      password: "",
      is_staff: !!selectedUser.is_staff,
      is_superuser: !!selectedUser.is_superuser,
    });
    setLoading(false);
  }, [selectedUser, setView]);

  const save = async () => {
    if (!token || !selectedUser) return;
    const payload = {
      username: form.username,
      email: form.email || null,
    };
    if (form.password) payload.password = form.password;
    // Permisos:
    payload.is_staff = !!form.is_staff;
    if (isSuper) {
      payload.is_superuser = !!form.is_superuser;
    }

    try {
      const res = await authFetch(`${backendURL}/users/${selectedUser.id}`, {
        method: "PATCH",
        token,
        json: payload,
      });
      const text = await res.text().catch(() => "");
      if (!res.ok) throw new Error(text || "No se pudo actualizar");
      const updated = JSON.parse(text);
      setSelectedUser(updated);
      alert("Usuario actualizado.");
      setView("control-usuarios");
    } catch (e) {
      console.error(e);
      alert("Error al actualizar usuario.");
    }
  };

  if (loading) return <p>Cargando...</p>;

  return (
    <section className="form-section form-section--compact">
      <h1>Editar Usuario</h1>

      <div className="stack-md" style={{ maxWidth: 420 }}>
        <input
          className="form-input"
          placeholder="Usuario"
          value={form.username}
          onChange={(e)=>setForm(f=>({...f, username: e.target.value}))}
        />

        <input
          className="form-input"
          type="email"
          placeholder="Correo electrónico"
          value={form.email}
          onChange={(e)=>setForm(f=>({...f, email: e.target.value}))}
        />

        <input
          className="form-input"
          type="password"
          placeholder="Nueva contraseña (opcional)"
          value={form.password}
          onChange={(e)=>setForm(f=>({...f, password: e.target.value}))}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={!!form.is_staff}
            onChange={(e)=>setForm(f=>({...f, is_staff: e.target.checked}))}
          />
          <span>Admin (is_staff)</span>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, opacity: isSuper ? 1 : 0.6 }}>
          <input
            type="checkbox"
            checked={!!form.is_superuser}
            onChange={(e)=>setForm(f=>({...f, is_superuser: e.target.checked}))}
            disabled={!isSuper}
            title={!isSuper ? "Solo un superusuario puede cambiar esto" : undefined}
          />
          <span>Superuser (is_superuser)</span>
        </label>
      </div>

      <div className="form-actions" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn-form" onClick={save}>Guardar cambios</button>
        <button
          className="btn-form btn-form--gray"
          onClick={() => setView("control-usuarios")}
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}
