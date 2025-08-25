export default function VerCliente({ cliente, setView }) {
  if (!cliente) return <p>No se ha seleccionado cliente.</p>

  return (
    <section className="max-w-3xl mx-auto bg-white p-10 rounded-xl shadow-lg mt-8">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Datos del Cliente</h1>

      <div className="mb-4">
        <p><strong>Nombre:</strong> {cliente.razon_social}</p>
        <p><strong>RUT:</strong> {cliente.rut}</p>
        {/* Agrega más campos según tu modelo */}
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => alert('Abrir formulario para editar')}
          className="bg-[#f1842d] text-white px-4 py-2 rounded hover:bg-[#e6761c] transition"
        >
          Editar Datos
        </button>

        <button
          onClick={() => alert('Ver movimientos del cliente')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Ver Movimientos
        </button>
      </div>
    </section>
  )
}
