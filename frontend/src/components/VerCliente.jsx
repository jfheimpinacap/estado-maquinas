// src/components/VerCliente.jsx
export default function VerCliente({ cliente, setView }) {
  if (!cliente) return <p>No se ha seleccionado cliente.</p>;

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

      <div className="flex gap-3 mt-4">
        <button
          className="btn-form btn-mini"
          onClick={() => setView("editar-cliente")}
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

