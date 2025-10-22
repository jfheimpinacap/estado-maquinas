import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";

export default function EditarCliente({ selectedCliente, setSelectedCliente, setView }) {
  const { auth, backendURL } = useAuth();

  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (selectedCliente) {
      setSelected(selectedCliente);
      setDraft({ ...selectedCliente });
      setResultados([]);
    } else {
      setSelected(null);
      setDraft(null);
      setResultados([]);
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [selectedCliente?.id]);

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
      toast.success("Cambios guardados");
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar cambios");
    }
  };

  const actions = selected ? (
    <>
      <button className="btn btn-ghost" onClick={() => setView("ver-cliente")}>← Atrás</button>
      <button
        className="btn btn-ghost"
        onClick={() => {
          setSelected(null);
          setSelectedCliente?.(null);
          setQuery("");
          setResultados([]);
          setView("editar-cliente");
          setTimeout(() => searchInputRef.current?.focus(), 50);
        }}
      >
        Editar otro
      </button>
    </>
  ) : (
    <>
      <button className="btn btn-primary" onClick={buscar}>Buscar</button>
    </>
  );

  return (
    <AdminLayout
      setView={setView}
      title={selected ? "Editar cliente" : "Buscar cliente para editar"}
      breadcrumbs={<>Clientes / {selected ? "Editar" : "Buscar"}</>}
      actions={actions}
    >
      {!selected ? (
        <>
          <div className="fieldset">
            <div className="legend">Parámetros</div>
            <div className="form-row">
              <div className="label">Término</div>
              <div className="control">
                <input
                  ref={searchInputRef}
                  className="input"
                  placeholder="Razón Social o RUT"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscar()}
                />
              </div>
            </div>
          </div>

          <div className="fieldset">
            <div className="legend">Resultados</div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Razón Social</th>
                  <th>RUT</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {resultados.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: "1rem", textAlign: "center", color: "var(--muted)" }}>
                      Busca un cliente para editar.
                    </td>
                  </tr>
                ) : resultados.map((c) => (
                  <tr key={c.id}>
                    <td>{c.razon_social}</td>
                    <td>{c.rut}</td>
                    <td>
                      <button className="btn btn-primary" onClick={() => elegirCliente(c)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="fieldset">
            <div className="legend">Datos principales</div>

            <div className="form-row">
              <div className="label">Razón social</div>
              <div className="control">
                <input
                  className="input"
                  value={draft?.razon_social ?? ""}
                  onChange={(e) => setDraft(d => ({ ...d, razon_social: e.target.value }))}
                  onBlur={() => saveField("razon_social")}
                />
                <div className="help-text">Se guarda automáticamente al salir del campo.</div>
              </div>
            </div>

            <div className="form-row">
              <div className="label">RUT</div>
              <div className="control">
                <input
                  className="input"
                  value={draft?.rut ?? ""}
                  onChange={(e) => setDraft(d => ({ ...d, rut: e.target.value }))}
                  onBlur={() => saveField("rut")}
                />
              </div>
            </div>
          </div>

          <div className="fieldset">
            <div className="legend">Contacto y facturación</div>

            <div className="form-row">
              <div className="label">Dirección</div>
              <div className="control">
                <input
                  className="input"
                  value={draft?.direccion ?? ""}
                  onChange={(e) => setDraft(d => ({ ...d, direccion: e.target.value }))}
                  onBlur={() => saveField("direccion")}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="label">Teléfono</div>
              <div className="control">
                <input
                  className="input"
                  value={draft?.telefono ?? ""}
                  onChange={(e) => setDraft(d => ({ ...d, telefono: e.target.value }))}
                  onBlur={() => saveField("telefono")}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="label">Correo electrónico</div>
              <div className="control">
                <input
                  className="input"
                  type="email"
                  value={draft?.correo_electronico ?? ""}
                  onChange={(e) => setDraft(d => ({ ...d, correo_electronico: e.target.value }))}
                  onBlur={() => saveField("correo_electronico")}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="label">Forma de pago</div>
              <div className="control">
                <select
                  className="select"
                  value={draft?.forma_pago ?? ""}
                  onChange={(e) => setDraft(d => ({ ...d, forma_pago: e.target.value }))}
                  onBlur={() => saveField("forma_pago")}
                >
                  <option value="">—</option>
                  <option value="Pago a 15 días">Pago a 15 días</option>
                  <option value="Pago a 30 días">Pago a 30 días</option>
                  <option value="Pago contado">Pago contado</option>
                </select>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}






