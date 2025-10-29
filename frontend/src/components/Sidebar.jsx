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
      {onAdd && <button className="dja-row__add" onClick={onAdd}>+ Añadir</button>}
    </div>
  );
}

export default function Sidebar({ setView }) {
  const { auth, backendURL } = useAuth();
  const isSuper = !!auth?.user?.is_superuser;

  const openDjangoAdmin = () => {
    const base = (backendURL || "").replace(/\/+$/, "");
    window.open(`${base}/admin/`, "_blank", "noopener");
  };

  return (
    <aside className="dja-sidebar">
      {/* CLIENTES */}
      <Section title="CLIENTES">
        <Row
          label="Clientes"
          onClick={() => setView("buscar-cliente")}
          onAdd={() => setView("crear-cliente")}
        />
        <Row label="Informes" onClick={() => setView("informes-clientes")} />
      </Section>

      {/* MAQUINARIA */}
      <Section title="MAQUINARIA">
        <Row
          label="Maquinarias"
          onClick={() => setView("maquinarias-list")}
          onAdd={() => setView("crearMaquinaria")}
        />
        <Row
          label="Consulta maquinarias"
          onClick={() => setView("consulta-maquinarias")}
        />
      </Section>

      {/* DOCUMENTOS */}
      <Section title="DOCUMENTOS">
        <Row
          label="Consulta de Documentos"
          onClick={() => setView("consulta-documentos")}
        />
        <Row label="Informes" onClick={() => setView("informes-documentos")} />
      </Section>

      {/* ESTADO DE MÁQUINAS */}
      <Section title="ESTADO DE MÁQUINAS">
        <Row label="Crear OT" onClick={() => setView("crear-ot")} />
        <Row
          label="Estado arriendo máquinas"
          onClick={() => setView("estado-arriendo-maquinas")}
        />
        <Row label="Estado de ordenes" onClick={() => setView("estado-ordenes")} />
      </Section>

      {/* ADMINISTRACIÓN → solo superadmin */}
      {isSuper && (
        <Section title="ADMINISTRACIÓN">
          <Row label="Panel de control" onClick={openDjangoAdmin} />
        </Section>
      )}
    </aside>
  );
}






























