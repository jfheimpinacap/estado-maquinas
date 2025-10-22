// src/components/ClientesForm.jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";

export default function ClientesForm({ onSaved, setView }) {
  const { auth, backendURL } = useAuth();
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

  const change = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const save = async (stay=false) => {
    setSaving(true); setError("");
    try {
      const res = await authFetch(`${backendURL}/clientes`, {
        token: auth.access,
        method: "POST",
        json: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onSaved?.(data);
      if (stay) {
        // limpiar y quedarse
        setForm({ razon_social:"", rut:"", direccion:"", telefono:"", correo_electronico:"", forma_pago:"" });
      } else {
        setView?.("buscar-cliente");
      }
    } catch (e) {
      setError(e?.message?.replace(/^"|"$/g,"") || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Añadir cliente</h1>
        <div className="breadcrumbs">Clientes / Añadir</div>
      </header>

      {/* Card principal como Django */}
      <div className="admin-card">
        <div className="fieldset">
          <div className="legend">Información del cliente</div>

          <div className="form-row">
            <div className="label">Razón social:</div>
            <div className="control">
              <input className="input" value={form.razon_social} onChange={change("razon_social")} />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Rut:</div>
            <div className="control">
              <input className="input" value={form.rut} onChange={change("rut")} />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Dirección:</div>
            <div className="control">
              <input className="input" value={form.direccion} onChange={change("direccion")} />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Teléfono:</div>
            <div className="control">
              <input className="input" value={form.telefono} onChange={change("telefono")} />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Correo electrónico:</div>
            <div className="control">
              <input className="input" type="email" value={form.correo_electronico} onChange={change("correo_electronico")} />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Forma de pago:</div>
            <div className="control">
              <select className="select" value={form.forma_pago} onChange={change("forma_pago")}>
                <option value="">---------</option>
                <option value="Pago a 15 días">Pago a 15 días</option>
                <option value="Pago a 30 días">Pago a 30 días</option>
                <option value="Pago contado">Pago contado</option>
              </select>
            </div>
          </div>

          {error ? (
            <div style="color:#ffb4b4; font-weight:700; margin-top:.4rem">{error}</div>
          ) : null}
        </div>
      </div>

      {/* Barra de acciones idéntica a Django (alineada a la derecha) */}
      <div className="admin-card" style={{ marginTop: 14 }}>
        <div className="fieldset" style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <button className="btn btn-ghost" onClick={()=>setView?.("buscar-cliente")}>Cancelar</button>
          <button className="btn btn-primary" disabled={saving} onClick={()=>save(false)}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={()=>save(true)}>
            {saving ? "Guardando…" : "Guardar y añadir otro"}
          </button>
        </div>
      </div>
    </>
  );
}

















