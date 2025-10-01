import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";

export default function EditarCliente({
  selectedCliente,
  setSelectedCliente,
  setView,
}) {
  const { auth, backendURL } = useAuth();

  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);

  const [editMode, setEditMode] = useState({
    razon_social: false,
    rut: false,
    direccion: false,
    telefono: false,
    correo_electronico: false,
    forma_pago: false,
  });

  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const searchInputRef = useRef(null);
  const refs = useRef({});

  // 👉 Inicializa vista según haya o no selectedCliente:
  // - Si viene un cliente (desde "Ver cliente" → "Editar datos"): abre formulario directamente.
  // - Si no viene: resetea y muestra buscador.
  useEffect(() => {
    if (selectedCliente) {
      // Modo edición directa
      setSelected(selectedCliente);
      setDraft({ ...selectedCliente });
      setResultados([]);
      setEditMode({
        razon_social: false,
        rut: false,
        direccion: false,
        telefono: false,
        correo_electronico: false,
        forma_pago: false,
      });
    } else {
      // Modo búsqueda
      setSelected(null);
      setDraft(null);
      setResultados([]);
      setEditMode({
        razon_social: false,
        rut: false,
        direccion: false,
        telefono: false,
        correo_electronico: false,
        forma_pago: false,
      });
      // foco al buscador
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCliente?.id]); // se re-evalúa si cambias de cliente

  const buscar = async () => {
    const q = query.trim();
    if (!q) return setResultados([]);
    try {
      const url = `${backendURL}/clientes?query=${encodeURIComponent(q)}`;
      const res = await authFetch(url, { token: auth.access });
      if (!res.ok) throw new Error("Error al buscar");
      const data = await res.json();
      setResultados(data);
    } catch (e) {
      console.error(e);
      setResultados([]);
    }
  };

  const elegirCliente = (cli) => {
    setSelected(cli);
    setSelectedCliente?.(cli);
    setDraft({ ...cli });
    setResultados([]);
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
      const payload = { [name]: draft[name] };
      const res = await authFetch(`${backendURL}/clientes/${selected.id}`, {
        method: "PATCH",
        token: auth.access,
        json: payload,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`No se pudo actualizar (HTTP ${res.status}) ${txt}`);
      }
      const updated = await res.json();
      setSelected(updated);
      setSelectedCliente?.(updated);
      setDraft((d) => ({ ...d, [name]: updated[name] }));
      setEditMode((m) => ({ ...m, [name]: false }));
      toast.success("Cambios guardados");
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar cambios");
    }
  };

  const FieldRow = ({ name, placeholder, type = "text", as = "input" }) => {
    const disabled = !editMode[name];

    return (
      <div className="field-row">
        {as === "select" ? (
          <select
            ref={(el) => (refs.current[name] = el)}
            className="form-input flex-1"
            value={draft?.[name] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
            disabled={disabled}
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
            disabled={disabled}
            autoFocus={editMode[name]}
            onKeyDown={(e) => e.stopPropagation()}
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
  };

  return (
    <div className="space-y-4">
      {/* Buscador (si no hay cliente seleccionado) */}
      {!selected && (
        <section className="form-section form-section--compact">
          <h1>Editar Cliente</h1>

          <div className="flex items-center gap-2 mb-3">
            <input
              ref={searchInputRef}
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
          </div>

          {resultados.length > 0 && (
            <ul className="divide-y">
              {resultados.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{c.razon_social}</div>
                    <div className="text-xs text-gray-500">{c.rut}</div>
                  </div>
                  <button
                    className="btn-sm-orange btn-sm-orange--short"
                    onClick={() => elegirCliente(c)}
                  >
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Formulario (si ya elegiste uno o vienes desde "Ver cliente") */}
      {selected && (
        <section className="form-section form-section--compact">
          <h1>Datos del Cliente</h1>

          <div className="stack-sm">
            <FieldRow name="razon_social" placeholder="Razón Social" />
            <FieldRow name="rut" placeholder="RUT" />
            <FieldRow name="direccion" placeholder="Dirección" />
            <FieldRow name="telefono" placeholder="Teléfono" />
            <FieldRow name="correo_electronico" placeholder="Correo electrónico" type="email" />
            <FieldRow name="forma_pago" as="select" />
          </div>

          <div className="form-actions" style={{ gap: ".5rem", marginTop: "1rem" }}>
            <button
              type="button"
              className="btn-form btn-form--sm btn-form--gray"
              onClick={() => setView("ver-cliente")}
            >
              ← Atrás
            </button>
            <button
              type="button"
              className="btn-form btn-form--sm btn-form--gray"
              onClick={() => {
                // Forzar nuevo ciclo de edición: volver al buscador
                setSelected(null);
                setSelectedCliente?.(null);
                setQuery("");
                setResultados([]);
                setView("editar-cliente");
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
            >
              Editar otro cliente
            </button>
          </div>
        </section>
      )}
    </div>
  );
}





