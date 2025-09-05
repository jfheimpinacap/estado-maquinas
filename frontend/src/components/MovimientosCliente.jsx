// src/components/MovimientosCliente.jsx
export default function MovimientosCliente({ cliente }) {
  return (
    <section className="panel-section panel-section--compact">
      <h2 className="text-xl font-semibold mb-3">Movimientos del Cliente</h2>

      {!cliente ? (
        <p className="text-gray-600 text-sm">
          Selecciona un cliente desde “Buscar Cliente” para ver sus movimientos.
        </p>
      ) : (
        <>
          <div className="mb-3 text-sm">
            <strong>Cliente:</strong> {cliente.razon_social} &middot;{" "}
            <strong>RUT:</strong> {cliente.rut}
          </div>

          <div className="table-wrap">
            <table className="w-full text-left">
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
                  <td className="py-4 text-center text-gray-500" colSpan={5}>
                    (Pronto) Aquí listaremos Facturas, Guías, NC, ND con filtros y
                    estilo “planilla”.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
