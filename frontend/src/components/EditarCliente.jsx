// src/components/EditarCliente.jsx
import { useRef, useState } from "react";
import { toast } from "react-toastify";

const backendURL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default function EditarCliente() {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [selected, setSelected] = useState(null);

  // borrador editable sin tocar el seleccionado hasta guardar
  const [draft, setDraft] = useState(null);

  // control de edición por campo
  const [editMode, setEditMode] = useState({
    razon_social: false,
    rut: false,
    direccion: false,
    telefono: false,
    forma_pago: false,
  });

  // refs
  const refs = useRef({});
  const formRef = useRef(null);

  const buscar = async () => {
    try {
      const url = `${backendURL}/clientes?query=${encodeURIComponent(
        query.trim()
      )}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al buscar");
      const data = await res.json();
      setResultados(data);
    } catch (e) {
      console.error(e);
      setResultados([]);
    }
  };

  const limpiar = () => {
    setQuery("");
    setResultados([]);
  };

  const cargarCliente = (cli) => {
    setSelected(cli);
    setDraft({ ...cli });
    setEditMode({
      razon_social: false,
      rut: false,
      direccion: false,
      telefono: false,
      forma_pago: false,
    });
    // desplazar el foco visual al formulario de la derecha
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const enableField = (name) => {
    setEditMode((m) => ({ ...m, [name]: true }));
    setTimeout(() => refs.current[name]?.focus(), 0);
  };

  const cancelField = (name) => {
    setDraft((d) => ({ ...d, [name]: selected?.[name] ?? "" }));
    setEditMode((m) => ({ ...m, [name]: false }));
  };

  const saveField = async (name) => {
    if (!selected) return;
    try {
      const res = await fetch(`${backendURL}/clientes/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [name]: draft[name] }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar");
      const updated = await res.json();
      setSelected(updated);
      setDraft((d) => ({ ...d, [name]: updated[name] }));
      setEditMode((m) => ({ ...m, [name]: false }));
      toast.success("Cambios guardados");
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar cambios");
    }
  };

  const FieldRow = ({ name, placeholder, type = "text", as = "input" }) => (
    <div className="field-row">
      {as === "select" ? (
        <select
          ref={(el) => (refs.current[name] = el)}
          className="form-input flex-1"
          value={draft?.[name] ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
          disabled={!editMode[name]}
        >
          <option value="">Seleccione Forma de Pago</option>
          <option value="Pago a 15 días">Pago a 15 días</option>
          <option value="Pago a 30 días">Pago a 30 días</option>
          <option value="Pago contado">Pago contado</option>
        </select>
      ) : (
        <input
          ref={(el) => (refs.current[name] = el)}
          type={type}
          className="form-input flex-1"
          placeholder={placeholder}
          value={draft?.[name] ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
          readOnly={!editMode[name]}
        />
      )}

      <div className="actions-inline">
        {!editMode[name] ? (
          <button
            type="button"
            className="btn-form btn-mini btn-form--gray"
            onClick={() => enableField(name)}
          >
            Editar
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-form btn-mini"
              onClick={() => saveField(name)}
            >
              Guardar
            </button>
            <button
              type="button"
              className="btn-form btn-mini btn-form--gray"
              onClick={() => cancelField(name)}
            >
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Columna izquierda: buscador (cuadro independiente) */}
      <section className="form-section form-section--compact">
        <h1>Editar Cliente</h1>

        <div className="flex items-center gap-2 mb-4">
          <input
            className="form-input w-64"
            placeholder="Buscar por Razón Social o RUT"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            style={{ background: "rgb(224, 251, 252)", color: "#000" }}
          />
          <button type="button" className="btn-form btn-mini" onClick={buscar}>
            Buscar
          </button>
          <button
            type="button"
            className="btn-form btn-mini btn-form--gray"
            onClick={limpiar}
          >
            Limpiar
          </button>
        </div>
      </section>

      {/* Columna derecha: formulario (independiente) */}
      <section ref={formRef} className="form-section form-section--compact">
        <h1>Datos del Cliente</h1>

        {!selected ? (
          <p className="text-gray-600 text-sm">
            Busca un cliente y selecciónalo para editar.
          </p>
        ) : (
          <div className="space-y-3">
            <FieldRow name="razon_social" placeholder="Razón Social" />
            <FieldRow name="rut" placeholder="RUT" />
            <FieldRow name="direccion" placeholder="Dirección" />
            <FieldRow name="telefono" placeholder="Teléfono" />
            <FieldRow name="forma_pago" as="select" />
          </div>
        )}
      </section>

      {/* Fila inferior: tabla de resultados a lo ancho (como en BuscarCliente) */}
      <section className="panel-section panel-section--full lg:col-span-2">
        <div className="table-wrap">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Razón Social</th>
                <th>RUT</th>
                <th>Dirección</th>
                <th>Teléfono</th>
                <th>Forma de Pago</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {resultados.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-gray-500" colSpan={6}>
                    Ingresa un término de búsqueda o no hay resultados.
                  </td>
                </tr>
              ) : (
                resultados.map((c) => (
                  <tr key={c.id}>
                    <td>{c.razon_social}</td>
                    <td>{c.rut}</td>
                    <td>{c.direccion || "—"}</td>
                    <td>{c.telefono || "—"}</td>
                    <td>{c.forma_pago || "—"}</td>
                    <td>
                      <button
                        className="btn-sm-orange btn-sm-orange--short"
                        onClick={() => cargarCliente(c)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}



