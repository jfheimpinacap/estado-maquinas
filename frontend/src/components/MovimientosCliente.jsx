export default function MovimientosCliente({ cliente, setView }) {
  return (
    <AdminLayout
      setView={setView}
      title="Movimientos del cliente"
      breadcrumbs={<>Clientes / Movimientos</>}
      actions={
        <button className="btn btn-ghost" onClick={() => setView?.("ver-cliente")}>← Volver a ficha</button>
      }
    >
      {!cliente ? (
        <div className="fieldset">
          <p className="help-text">
            Selecciona un cliente desde “Buscar cliente” para ver sus movimientos.
          </p>
        </div>
      ) : (
        <>
          <div className="fieldset">
            <div className="legend">Cliente</div>
            <div className="form-row">
              <div className="label">Razón Social</div>
              <div className="control">{cliente.razon_social} <span className="help-text">RUT: {cliente.rut}</span></div>
            </div>
          </div>

          <div className="fieldset">
            <div className="legend">Comprobantes</div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Número</th>
                  <th>Fecha emisión</th>
                  <th>Monto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} style={{ padding: "1rem", textAlign: "center", color: "var(--muted)" }}>
                    (Pronto) Aquí listaremos Facturas, Guías, NC, ND con filtros y
                    estilo “planilla”.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

