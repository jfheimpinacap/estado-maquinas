// src/components/ClientesForm.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";

const PAGO_OPCIONES = [
  { value: "", label: "—" },
  { value: "Contado", label: "Pago contado" },
  { value: "15 días", label: "Pago a 15 días" },
  { value: "30 días", label: "Pago a 30 días" },
];

export default function ClientesForm({ initialData = null, onSaved, setView }) {
  const { auth, backendURL } = useAuth();

  // Si viene initialData => modo edición
  const isEdit = !!initialData?.id;

  const [form, setForm] = useState({
    razon_social: "",
    rut: "",
    direccion: "",
    telefono: "",
    correo_electronico: "",
    forma_pago: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // “permiso especial” transitorio: solo superadmin puede cambiar forma de pago
  const canChangePago = !!auth?.user?.is_superuser;

  useEffect(() => {
    if (initialData) {
      setForm({
        razon_social: initialData.razon_social || "",
        rut: initialData.rut || "",
        direccion: initialData.direccion || "",
        telefono: initialData.telefono || "",
        correo_electronico: initialData.correo_electronico || "",
        forma_pago: initialData.forma_pago || "",
      });
    }
  }, [initialData]);

  const setVal = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const endpoint = useMemo(() => {
    const base = `${backendURL}/clientes`;
    return isEdit ? `${base}/${initialData.id}` : base;
  }, [isEdit, backendURL, initialData]);

  const method = isEdit ? "PUT" : "POST";

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await authFetch(endpoint, {
        token: auth.access,
        method,
        json: form,
      });
      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try { const j = await res.json(); msg = j.detail || JSON.stringify(j); } catch {}
        throw new Error(msg);
      }
      const data = await res.json().catch(() => ({}));
      return data;
    } finally {
      setSaving(false);
    }
  };

  // Botones
  const onGuardar = async () => {
    const saved = await save();
    // volver al listado/búsqueda
    setView?.("buscar-cliente");
    onSaved?.(saved);
  };

  const onGuardarYAgregarOtro = async () => {
    await save();
    // limpiar formulario para agregar otro
    setForm({
      razon_social: "",
      rut: "",
      direccion: "",
      telefono: "",
      correo_electronico: "",
      forma_pago: "",
    });
  };

  const onGuardarYSeguirEditando = async () => {
    const saved = await save();
    // quedarse en pantalla con datos guardados (mantener modo edición si aplica)
    if (saved?.id) {
      setForm((f) => ({ ...f })); // fuerza rerender
    }
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{isEdit ? "Editar cliente" : "Añadir cliente"}</h1>
        <div className="breadcrumbs">Clientes / {isEdit ? "Editar" : "Añadir"}</div>
      </div>

      <div className="admin-card">
        <div className="fieldset">
          <div className="legend">Información del cliente</div>

          {/* Razon Social */}
          <div className="form-row">
            <div className="label">Razón social:</div>
            <div className="control">
              <input
                className="input"
                value={form.razon_social}
                onChange={(e) => setVal("razon_social", e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* RUT */}
          <div className="form-row">
            <div className="label">Rut:</div>
            <div className="control">
              <input
                className="input"
                value={form.rut}
                onChange={(e) => setVal("rut", e.target.value)}
              />
            </div>
          </div>

          {/* Dirección */}
          <div className="form-row">
            <div className="label">Dirección:</div>
            <div className="control">
              <input
                className="input"
                value={form.direccion}
                onChange={(e) => setVal("direccion", e.target.value)}
              />
            </div>
          </div>

          {/* Teléfono */}
          <div className="form-row">
            <div className="label">Teléfono:</div>
            <div className="control">
              <input
                className="input"
                value={form.telefono}
                onChange={(e) => setVal("telefono", e.target.value)}
              />
            </div>
          </div>

          {/* Correo */}
          <div className="form-row">
            <div className="label">Correo electrónico:</div>
            <div className="control">
              <input
                className="input"
                type="email"
                value={form.correo_electronico}
                onChange={(e) => setVal("correo_electronico", e.target.value)}
              />
            </div>
          </div>

          {/* Forma de Pago (bloqueable) */}
          <div className="form-row">
            <div className="label">Forma de pago:</div>
            <div className="control">
              <select
                className="select"
                value={form.forma_pago}
                onChange={(e) => setVal("forma_pago", e.target.value)}
                disabled={!canChangePago}
                title={!canChangePago ? "Requiere permiso especial" : undefined}
              >
                {PAGO_OPCIONES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {!canChangePago && (
                <small className="help-text">
                  No tienes permiso para modificar la forma de pago.
                </small>
              )}
            </div>
          </div>
        </div>

        {/* Barra de acciones a la izquierda, sin “Cancelar” */}
        <div className="actions-bar">
          <button className="btn btn-primary" onClick={onGuardar} disabled={saving}>
            {saving ? "Guardando…" : "GUARDAR"}
          </button>
          <button className="btn btn-ghost" onClick={onGuardarYAgregarOtro} disabled={saving}>
            Guardar y añadir otro
          </button>
          <button className="btn btn-ghost" onClick={onGuardarYSeguirEditando} disabled={saving}>
            Guardar y continuar editando
          </button>
        </div>

        {error && (
          <div className="fieldset">
            <div className="legend">Error</div>
            <div className="muted">{error}</div>
          </div>
        )}
      </div>
    </>
  );
}


















