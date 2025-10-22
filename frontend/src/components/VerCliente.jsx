export default function VerCliente({ cliente, setView, setSelectedCliente }) {
  if (!cliente) {
    return (
      <AdminLayout
        setView={setView}
        title="Datos del cliente"
        breadcrumbs={<>Clientes / Ficha</>}
      >
        <div className="fieldset">
          <p className="help-text">No se ha seleccionado cliente.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      setView={setView}
      title="Datos del cliente"
      breadcrumbs={<>Clientes / Ficha</>}
      actions={
        <>
          <button
            className="btn btn-ghost"
            onClick={() => { setSelectedCliente(cliente); setView("editar-cliente"); }}
          >
            Editar
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setView("ver-movimientos")}
          >
            Ver movimientos
          </button>
        </>
      }
    >
      <div className="fieldset">
        <div className="legend">Identificación</div>

        <div className="form-row">
          <div className="label">Razón Social</div>
          <div className="control">{cliente.razon_social || "—"}</div>
        </div>

        <div className="form-row">
          <div className="label">RUT</div>
          <div className="control">{cliente.rut || "—"}</div>
        </div>
      </div>

      <div className="fieldset">
        <div className="legend">Contacto</div>

        <div className="form-row">
          <div className="label">Dirección</div>
          <div className="control">{cliente.direccion || "—"}</div>
        </div>

        <div className="form-row">
          <div className="label">Teléfono</div>
          <div className="control">{cliente.telefono || "—"}</div>
        </div>

        <div className="form-row">
          <div className="label">Correo electrónico</div>
          <div className="control">{cliente.correo_electronico || "—"}</div>
        </div>

        <div className="form-row">
          <div className="label">Forma de pago</div>
          <div className="control">{cliente.forma_pago || "—"}</div>
        </div>
      </div>
    </AdminLayout>
  );
}



