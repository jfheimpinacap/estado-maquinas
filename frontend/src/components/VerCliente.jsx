// src/components/VerCliente.jsx
export default function VerCliente({ cliente, setView, setSelectedCliente }) {
  if (!cliente) return (
    <section className="form-section form-section--compact">
      <h1>Datos del Cliente</h1>
      <p className="text-gray-600 text-sm">No se ha seleccionado cliente.</p>
    </section>
  );

  return (
    <section className="form-section form-section--compact">
      <h1>Datos del Cliente</h1>

      <div className="space-y-2">
        <div><strong>Razón Social:</strong> {cliente.razon_social || "—"}</div>
        <div><strong>RUT:</strong> {cliente.rut || "—"}</div>
        <div><strong>Dirección:</strong> {cliente.direccion || "—"}</div>
        <div><strong>Teléfono:</strong> {cliente.telefono || "—"}</div>
        <div><strong>Forma de Pago:</strong> {cliente.forma_pago || "—"}</div>
      </div>

      <div className="form-actions" style={{ gap: ".5rem", marginTop: "1rem" }}>
        <button
          className="btn-sm-orange"
          onClick={() => {
            setSelectedCliente(cliente);     // deja seleccionado global
            setView('editar-cliente');       // navega directo al formulario de edición
          }}
        >
          Editar datos
        </button>

        <button
          className="btn-form btn-mini btn-form--gray"
          onClick={() => setView("ver-movimientos")}
        >
          Ver movimientos
        </button>
      </div>
    </section>
  );
}


