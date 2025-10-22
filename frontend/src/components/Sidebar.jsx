// src/components/Sidebar.jsx
import { useAuth } from "../context/AuthContext";

function Section({ title, children }) {
  return (
    <div className="dja-section">
      <div className="dja-section__title">{title}</div>
      <div className="dja-section__body">{children}</div>
    </div>
  );
}

function Row({ label, onClick, onAdd }) {
  return (
    <div className="dja-row">
      <button className="dja-row__label" onClick={onClick}>{label}</button>
      {onAdd && (
        <button className="dja-row__add" onClick={onAdd}>+ Añadir</button>
      )}
    </div>
  );
}

export default function Sidebar({ setView }) {
  const { auth, backendURL } = useAuth();
  const isSuper = !!auth?.user?.is_superuser;

  const openAdmin = () => {
    const base = (backendURL || "").replace(/\/+$/,"");
    window.open(`${base}/admin/`, "_blank", "noopener");
  };

  return (
    <aside className="dja-sidebar">
      <Section title="CLIENTES">
        <Row label="Clientes" onClick={() => setView("buscar-cliente")} onAdd={() => setView("crear-cliente")} />
        <Row label="Obras" onClick={() => alert("Pronto: Obras")} onAdd={() => alert("Pronto: Crear obra")} />
      </Section>

      <Section title="MAQUINARIA">
        <Row label="Maquinarias" onClick={() => setView("buscarMaquina")} onAdd={() => setView("crearMaquinaria")} />
        <Row label="Arriendos" onClick={() => alert("Pronto: Arriendos")} onAdd={() => alert("Pronto: Nuevo arriendo")} />
      </Section>

      <Section title="DOCUMENTOS">
        <Row label="Documentos" onClick={() => setView("buscar-documentos")} />
      </Section>

      <Section title="ESTADO">
        <Row label="Estado de órdenes" onClick={() => setView("estado-ordenes")} />
      </Section>

      {isSuper && (
        <Section title="ADMINISTRACIÓN">
          <Row label="Usuarios" onClick={openAdmin} />
          <Row label="Grupos" onClick={openAdmin} />
          <Row label="User security" onClick={openAdmin} />
        </Section>
      )}
    </aside>
  );
}




























