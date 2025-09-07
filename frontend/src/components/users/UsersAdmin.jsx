import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import "../../styles/FormStyles.css";

export default function UsersAdmin() {
  const { auth, backendURL } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: "", password: "" });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${backendURL}/users`, {
        headers: { Authorization: `Bearer ${auth.access}` },
      });
      if (!res.ok) throw new Error("No autorizado o error al listar");
      const data = await res.json();
      setRows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const startEdit = (u) => {
    setEditing(u.id);
    setForm({ username: u.username, password: "" });
  };

  const saveEdit = async (id) => {
    const payload = {};
    if (form.username && form.username !== rows.find(r => r.id === id)?.username) payload.username = form.username;
    if (form.password) payload.password = form.password;

    try {
      const res = await fetch(`${backendURL}/users/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.access}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("No se pudo actualizar");
      setEditing(null);
      await fetchUsers();
    } catch (e) {
      console.error(e);
      alert("Error al actualizar usuario");
    }
  };

  return (
    <div className="panel-section">
      <h2 className="mb-3" style={{ fontWeight: 700 }}>Control de Usuarios</h2>
      {loading ? (
        <p>Cargando...</p>
      ) : rows.length === 0 ? (
        <p>No hay usuarios.</p>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Admin</th>
                <th>Superuser</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id}>
                  <td>
                    {editing === u.id ? (
                      <input className="form-input" value={form.username}
                             onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))} />
                    ) : u.username}
                  </td>
                  <td>{u.is_staff ? "Sí" : "No"}</td>
                  <td>{u.is_superuser ? "Sí" : "No"}</td>
                  <td>
                    {editing === u.id ? (
                      <div className="actions-inline">
                        <input className="form-input" placeholder="Nueva contraseña (opcional)"
                               onChange={(e)=>setForm(f=>({...f, password: e.target.value}))} />
                        <button className="btn-inline" onClick={() => saveEdit(u.id)}>Guardar</button>
                        <button className="btn-inline btn-inline--gray" onClick={() => setEditing(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <button className="btn-sm-orange" onClick={() => startEdit(u)}>Editar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
