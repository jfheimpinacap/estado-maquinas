// frontend/src/components/admin/DjangoAdminLink.jsx
import { useAuth } from "../../context/AuthContext";
import { joinURL } from "../../lib/url";

export default function DjangoAdminLink() {
  const { auth, backendURL } = useAuth();
  const isSuper = !!auth?.user?.is_superuser;
  const adminURL = joinURL(backendURL, "/admin/");

  if (!isSuper) {
    return (
      <section className="panel-section">
        <h2 style={{ fontWeight: 700 }}>Control de Usuarios</h2>
        <p>Solo un superadministrador puede acceder al Administrador de Django.</p>
      </section>
    );
  }

  return (
    <section className="panel-section">
      <h2 style={{ fontWeight: 700 }}>Control de Usuarios</h2>
      <p>Usaremos el <strong>Django Admin</strong> para gestionar usuarios y datos.</p>
      <div className="actions-inline" style={{ marginTop: 8 }}>
        <a className="btn-inline" href={adminURL} target="_blank" rel="noopener noreferrer">
          Abrir Django Admin
        </a>
      </div>
      <small style={{ display: "block", marginTop: 8 }}>
        * Se abrirá en una pestaña nueva. Puede requerir iniciar sesión del admin.
      </small>
    </section>
  );
}
