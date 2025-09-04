// src/components/EditarCliente.jsx
import { useEffect, useRef, useState, memo } from "react";
import { toast } from "react-toastify";

const backendURL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/** Campo reutilizable con foco automático cuando se habilita la edición */
const FieldRow = memo(function FieldRow({
  label,
  name,
  type = "text",
  as = "input", // 'input' | 'select'
  value,
  onChange,
  canEdit,
  onEnable,
  onSave,
  onCancel,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (canEdit && ref.current) {
      // foco al habilitar edición
      ref.current.focus();
      // mueve el cursor al final
      const el = ref.current;
      if (el.setSelectionRange && typeof value === "string") {
        const len = value.length;
        el.setSelectionRange(len, len);
      }
    }
  }, [canEdit, value]);

  return (
    <div className="field-row">
      {as === "select" ? (
        <select
          ref={ref}
          className="form-input flex-1"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={!canEdit}
        >
          <option value="">Seleccione Forma de Pago</option>
          <option value="Pago a 15 días">Pago a 15 días</option>
          <option value="Pago a 30 días">Pago a 30 días</option>
          <option value="Pago contado">Pago contado</option>
        </select>
      ) : (
        <input
          ref={ref}
          type={type}
          className="form-input flex-1"
          placeholder={label}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={!canEdit}
        />
      )}

      <div className="actions-inline">
        {!canEdit ? (
          <button type="button" className="btn-inline btn-inline--gray" onClick={onEnable}>
            Editar
          </button>
        ) : (
          <>
            <button type="button" className="btn-inline" onClick={onSave}>
              Guardar
            </button>
            <button type="button" className="btn-inline btn-inline--gray" onClick={onCancel}>
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
});

export default function EditarCliente() {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [selected, setSelected] = useState(null);

  // borrador editable independiente del seleccionado
  const [draft, setDraft] = useState(null);

  // control de edición por campo
  const [editMode, setEditMode] = useState({
    razon_social: false,
    rut: false,
    direccion: false,
    telefono: false,
    forma_pago: false,
  });

  const buscar = async () => {
    try {
      const url = `${backendURL}/clientes?query=${encodeURIComponent(query.trim())}`;
      const res = await fetch(url);
      const data = await res.json();
      setResultados(data);
    } catch {
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
  };

  const enableField = (name) => {
    setEditMode((m) => ({ ...m, [name]: true }));
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
    } catch {
      toast.error("Error al guardar cambios");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Columna izquierda: buscador compacto */}
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
          <button type="button" className="btn-inline" onClick={buscar}>
            Buscar
          </button>
          <button type="button" className="btn-inline btn-inline--gray" onClick={limpiar}>
            Limpiar
          </button>
        </div>

        <div className="panel-section panel-section--compact">
          {resultados.length === 0 ? (
            <p className="text-gray-600 text-sm">Sin resultados.</p>
          ) : (
            <ul className="divide-y">
              {resultados.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{c.razon_social}</div>
                    <div className="text-xs text-gray-500">{c.rut}</div>
                  </div>
                  <button className="btn-inline" onClick={() => cargarCliente(c)}>
                    Editar →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Columna derecha: formulario compacto */}
      <section className="form-section form-section--compact">
        <h1>Datos del Cliente</h1>

        {!selected ? (
          <p className="text-gray-600 text-sm">Busca un cliente y selecciónalo para editar.</p>
        ) : (
          <div className="space-y-3">
            <FieldRow
              label="Razón Social"
              name="razon_social"
              value={draft?.razon_social}
              onChange={(v) => setDraft((d) => ({ ...d, razon_social: v }))}
              canEdit={editMode.razon_social}
              onEnable={() => enableField("razon_social")}
              onSave={() => saveField("razon_social")}
              onCancel={() => cancelField("razon_social")}
            />
            <FieldRow
              label="RUT"
              name="rut"
              value={draft?.rut}
              onChange={(v) => setDraft((d) => ({ ...d, rut: v }))}
              canEdit={editMode.rut}
              onEnable={() => enableField("rut")}
              onSave={() => saveField("rut")}
              onCancel={() => cancelField("rut")}
            />
            <FieldRow
              label="Dirección"
              name="direccion"
              value={draft?.direccion}
              onChange={(v) => setDraft((d) => ({ ...d, direccion: v }))}
              canEdit={editMode.direccion}
              onEnable={() => enableField("direccion")}
              onSave={() => saveField("direccion")}
              onCancel={() => cancelField("direccion")}
            />
            <FieldRow
              label="Teléfono"
              name="telefono"
              value={draft?.telefono}
              onChange={(v) => setDraft((d) => ({ ...d, telefono: v }))}
              canEdit={editMode.telefono}
              onEnable={() => enableField("telefono")}
              onSave={() => saveField("telefono")}
              onCancel={() => cancelField("telefono")}
            />
            <FieldRow
              label="Forma de Pago"
              name="forma_pago"
              as="select"
              value={draft?.forma_pago}
              onChange={(v) => setDraft((d) => ({ ...d, forma_pago: v }))}
              canEdit={editMode.forma_pago}
              onEnable={() => enableField("forma_pago")}
              onSave={() => saveField("forma_pago")}
              onCancel={() => cancelField("forma_pago")}
            />
          </div>
        )}
      </section>
    </div>
  );
}


