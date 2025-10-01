import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { authFetch } from "../../lib/api";
import "../../styles/FormStyles.css";

export default function UsersAdmin({ setView, setSelectedUser }) {
  const { auth, backendURL } = useAuth();
  const isAdmin = !!auth?.user?.is_staff;
  const isSuper = !!auth?.user?.is_superuser;
  const token = auth?.access;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "" });

  const [errorMsg, setErrorMsg] = useState("");

  const fetchUsers = async () => {
    setErrorMsg("");
    if (!isAdmin || !token) { setLoading(false); return; }
    try {
      setLoading(true);
      const res = await authFetch(`${backendURL}/users`, { token });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`No autorizado o error al listar (${res.status}) ${txt}`);
      }
      const data = await res.json();
      setRows(data);
    } catch (e) {
      console.error(e);
      setErrorMsg("No se pudo cargar la lista de usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [token, isAdmin]);

  const deleteUser = async (id, username) => {
    if (!isAdmin || !token) return;
    if (!confirm(`¿Eliminar usuario "${username}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await authFetch(`${backendURL}/users/${id}`, {
        method: "DELETE",
        token,
      });
      if (res.status !== 204) {
        const txt = await res.text().catch(()=> "");
        throw new Error(txt || "No se pudo eliminar");
      }
      await fetchUsers();
    } catch (e) {
      console.error(e);
      alert("Error al eliminar usuario");
    }
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.password) {
      alert("Usuario y contraseña requeridos");
      return;
    }
    try {
      const res = await authFetch(`${backendURL}/auth/register`, {
        method: "POST",
        json: { username: newUser.username, password: newUser.password },
      });
      const text = await res.text().catch(() => "");
      if (!res.ok) throw new Error(text || "No se pudo crear el usuario");
      setNewUser({ username: "", password: "" });
      setShowCreate(false);
      await fetchUsers();
    } catch (e) {
      console.error(e);
      try {
        const msg = JSON.parse(e.message);
        alert(msg.detail || "Error al crear usuario");
      } catch {
        alert(e.message || "Error al crear usuario");
      }
    }
  };

  if (!isAdmin) {
    return (
      <div className="panel-section">
        <h2 style={{ fontWeight: 700 }}>Control de Usuarios</h2>
        <p>No tienes permisos para ver esta sección.</p>
      </div>
    );
  }

  return (
    <div className="panel-section">
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ fontWeight: 700 }}>Control de Usuarios</h2>
        <div className="actions-inline">
          <button className="btn-inline" onClick={() => fetchUsers()}>Refrescar</button>
          <button className="btn-inline" onClick={() => setShowCreate(s => !s)}>
            {showCreate ? "Cancelar" : "Crear usuario"}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="stack-sm" style={{ marginBottom: 16 }}>
          <input
            className="form-input"
            placeholder="Usuario"
            value={newUser.username}
            onChange={(e)=>setNewUser(u=>({...u, username: e.target.value}))}
          />
          <input
            className="form-input"
            type="password"
            placeholder="Contraseña"
            value={newUser.password}
            onChange={(e)=>setNewUser(u=>({...u, password: e.target.value}))}
          />
          <div>
            <button className="btn-form btn-mini" onClick={createUser}>Crear</button>
            <button className="btn-form btn-mini btn-form--gray" onClick={()=>setShowCreate(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {errorMsg && <p style={{ color: "crimson", marginBottom: 8 }}>{errorMsg}</p>}

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
                <th style={{width: 300}}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.is_staff ? "Sí" : "No"}</td>
                  <td>{u.is_superuser ? "Sí" : "No"}</td>
                  <td>
                    <div className="actions-inline">
                      <button
                        className="btn-sm-orange"
                        onClick={() => { setSelectedUser(u); setView("editar-usuario"); }}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-inline btn-inline--gray"  // <- gris
                        onClick={() => deleteUser(u.id, u.username)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* (Switch CSS no necesario ya que ahora editamos en otra pantalla) */}
        </div>
      )}
    </div>
  );
}





