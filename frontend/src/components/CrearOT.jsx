// src/components/CrearOT.jsx
import { useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

// Tipo de OT en la BD: A (Arriendo), V (Venta), T (Traslado)
const TIPOS_OT = [
  { value: "A", label: "Arriendo" },
  { value: "V", label: "Venta" },
  { value: "T", label: "Traslado" },
];

const PERIODO_OPCIONES = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
];

const TIPO_FLETE = [
  { value: "sin_flete", label: "Sin flete" },
  { value: "entrega_retiro", label: "Entrega y retiro" },
  { value: "solo_traslado", label: "Solo traslado" },
];

// Helper para una línea vacía de maquinaria
const nuevaLinea = () => ({
  id: Math.random().toString(36).slice(2),
  serie: "",
  fecha_desde: "",
  fecha_hasta: "",
  periodo: "dia",
  valor_neto: "",
  flete_neto: "",
  tipo_flete: "sin_flete",
});

export default function CrearOT({ setView }) {
  const { auth, backendURL } = useAuth();

  const [saving, setSaving] = useState(false);

  // Datos generales de la OT
  const [tipo, setTipo] = useState("A"); // A/V/T
  const [clienteRutNombre, setClienteRutNombre] = useState(""); // por ahora texto libre
  const [clienteId, setClienteId] = useState(""); // cuando tengas búsqueda, aquí pondremos el ID
  const [obra, setObra] = useState("");
  const [direccion, setDireccion] = useState("");
  const [contactos, setContactos] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Líneas de maquinaria (pueden ser varias)
  const [lineas, setLineas] = useState([nuevaLinea()]);

  // ====== Cálculos económicos (Chile, IVA 19%) ======
  const resumen = useMemo(() => {
    let netoTotal = 0;

    for (const l of lineas) {
      const v = parseFloat(l.valor_neto || 0) || 0;
      const f = parseFloat(l.flete_neto || 0) || 0;
      netoTotal += v + f;
    }

    const iva = Math.round(netoTotal * 0.19);
    const total = netoTotal + iva;

    return {
      neto: netoTotal,
      iva,
      total,
    };
  }, [lineas]);

  // ====== handlers de líneas ======
  const actualizarLinea = (idLinea, campo, valor) => {
    setLineas((prev) =>
      prev.map((l) =>
        l.id === idLinea
          ? { ...l, [campo]: valor }
          : l
      )
    );
  };

  const agregarLinea = () => {
    setLineas((prev) => [...prev, nuevaLinea()]);
  };

  const eliminarLinea = (idLinea) => {
    setLineas((prev) =>
      prev.length === 1 ? prev : prev.filter((l) => l.id !== idLinea)
    );
  };

  // ====== payload para el backend ======
  const buildPayload = () => {
    // ❗ IMPORTANTE:
    // - clienteId debería ser el ID real del cliente (cuando conectemos búsqueda).
    // - por ahora lo dejamos opcional y mandamos el rut/nombre en "observaciones" si no tienes el ID aún.
    const detalle_lineas = lineas.map((l) => ({
      serie: (l.serie || "").trim(),
      fecha_desde: l.fecha_desde || null,
      fecha_hasta: l.fecha_hasta || null,
      periodo: l.periodo || null,                 // "dia" | "semana" | "mes"
      valor_neto: l.valor_neto ? Number(l.valor_neto) : 0,
      flete_neto: l.flete_neto ? Number(l.flete_neto) : 0,
      tipo_flete: l.tipo_flete || "sin_flete",    // "entrega_retiro" | "solo_traslado" | "sin_flete"
    }));

    // Por ahora, si no tenemos todavía un modelo de líneas en la BD,
    // se puede guardar este detalle en un JSONField y los totales en campos numéricos.
    const payload = {
      tipo, // "A", "V", "T"
      cliente: clienteId || null, // cuando tengas el ID real
      // Si quieres, puedes guardar el rut/nombre en observaciones mientras:
      observaciones: observaciones
        ? observaciones
        : clienteRutNombre
        ? `Cliente: ${clienteRutNombre}`
        : "",
      // Estos campos son opcionales; se implementan en tu modelo si aún no están:
      direccion: direccion || null,
      obra: obra || null,
      contactos: contactos || null,

      detalle_lineas,
      monto_neto: resumen.neto,
      monto_iva: resumen.iva,
      monto_total: resumen.total,
    };

    return payload;
  };

  const onGuardar = async () => {
    // Validaciones mínimas
    if (!tipo) {
      toast.warn("Debes elegir el tipo de OT.");
      return;
    }
    if (!clienteRutNombre.trim() && !clienteId) {
      toast.warn("Debes indicar el cliente (RUT o nombre).");
      return;
    }
    if (!lineas.some((l) => l.serie.trim())) {
      toast.warn("Debes ingresar al menos una máquina con serie.");
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      const res = await authFetch(`${backendURL}/ordenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        token: auth?.access,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = `Error ${res.status} al crear la OT`;
        try {
          const data = await res.json();
          if (data && typeof data === "object") {
            const parts = [];
            for (const [k, v] of Object.entries(data)) {
              parts.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
            }
            if (parts.length) msg = parts.join(" | ");
          }
        } catch {
          // ignorar fallo al parsear
        }
        throw new Error(msg);
      }

      const data = await res.json();
      toast.success(`OT creada correctamente (ID ${data.id || "?"})`);
      // Ir a la vista de estado de OT (o donde prefieras)
      setView?.("estado-ordenes");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Error al crear la OT");
    } finally {
      setSaving(false);
    }
  };

  const onCancelar = () => {
    setView?.("estado-ordenes");
  };

  // ====== Render ======
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Crear orden de trabajo</h1>
        <div className="breadcrumbs">Estado de máquinas / Crear OT</div>
      </div>

      {/* Datos generales */}
      <div className="admin-card" style={{ marginBottom: 14 }}>
        <div className="fieldset">
          <div className="legend">Datos generales</div>

          <div className="form-row">
            <div className="label">Tipo</div>
            <div className="control">
              <select
                className="select"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                style={{ maxWidth: 260 }}
              >
                {TIPOS_OT.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="help-text">
                Axxxx arriendo, Vxxxx venta, Txxxx traslado (lógica de folios se
                maneja en el backend).
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="label">Cliente</div>
            <div className="control">
              <input
                className="input"
                placeholder="RUT o razón social"
                value={clienteRutNombre}
                onChange={(e) => setClienteRutNombre(e.target.value)}
              />
              <div className="help-text">
                Más adelante aquí usaremos un buscador para vincular el ID real del cliente.
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="label">Obra</div>
            <div className="control">
              <input
                className="input"
                placeholder="Nombre de la obra (opcional)"
                value={obra}
                onChange={(e) => setObra(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Dirección</div>
            <div className="control">
              <input
                className="input"
                placeholder="Dirección de la obra o entrega"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Contactos</div>
            <div className="control">
              <textarea
                className="textarea"
                rows={2}
                placeholder="Nombres y teléfonos de contactos en obra"
                value={contactos}
                onChange={(e) => setContactos(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="label">Observaciones</div>
            <div className="control">
              <textarea
                className="textarea"
                rows={3}
                placeholder="Indicaciones adicionales del despacho / trabajo"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Líneas de maquinaria */}
      <div className="admin-card" style={{ marginBottom: 14 }}>
        <div className="fieldset">
          <div className="legend">Máquinas y periodos</div>

          {lineas.map((l, idx) => (
            <div
              key={l.id}
              style={{
                borderTop: idx === 0 ? "none" : "1px solid var(--card-border)",
                paddingTop: idx === 0 ? 0 : 10,
                marginTop: idx === 0 ? 0 : 10,
              }}
            >
              <div className="form-row">
                <div className="label">Serie máquina</div>
                <div className="control">
                  <input
                    className="input"
                    placeholder="Serie exacta"
                    value={l.serie}
                    onChange={(e) =>
                      actualizarLinea(l.id, "serie", e.target.value)
                    }
                  />
                  <div className="help-text">
                    Más adelante aquí podemos agregar un botón "Ver disponibilidad".
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="label">Periodo</div>
                <div className="control">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, maxWidth: 560 }}>
                    <div>
                      <label className="help-text">Desde</label>
                      <input
                        className="input"
                        type="date"
                        value={l.fecha_desde}
                        onChange={(e) =>
                          actualizarLinea(l.id, "fecha_desde", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="help-text">Hasta</label>
                      <input
                        className="input"
                        type="date"
                        value={l.fecha_hasta}
                        onChange={(e) =>
                          actualizarLinea(l.id, "fecha_hasta", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="help-text">Unidad</label>
                      <select
                        className="select"
                        value={l.periodo}
                        onChange={(e) =>
                          actualizarLinea(l.id, "periodo", e.target.value)
                        }
                      >
                        {PERIODO_OPCIONES.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="label">Valor neto</div>
                <div className="control">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    placeholder="Tarifa neta por el periodo indicado"
                    value={l.valor_neto}
                    onChange={(e) =>
                      actualizarLinea(l.id, "valor_neto", e.target.value)
                    }
                  />
                  <div className="help-text">Monto neto en pesos chilenos.</div>
                </div>
              </div>

              <div className="form-row">
                <div className="label">Flete</div>
                <div className="control">
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, maxWidth: 560 }}>
                    <div>
                      <select
                        className="select"
                        value={l.tipo_flete}
                        onChange={(e) =>
                          actualizarLinea(l.id, "tipo_flete", e.target.value)
                        }
                      >
                        {TIPO_FLETE.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <div className="help-text">
                        En traslados este campo suele ser el principal a facturar.
                      </div>
                    </div>
                    <div>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        placeholder="Monto neto flete"
                        value={l.flete_neto}
                        onChange={(e) =>
                          actualizarLinea(l.id, "flete_neto", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="label" />
                <div className="control">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => eliminarLinea(l.id)}
                    disabled={lineas.length === 1}
                  >
                    Eliminar máquina
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="form-row">
            <div className="label" />
            <div className="control">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={agregarLinea}
              >
                + Añadir otra máquina
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen económico Chile (neto / IVA / total) */}
      <div className="admin-card" style={{ marginBottom: 14 }}>
        <div className="fieldset">
          <div className="legend">Resumen económico (CLP)</div>
          <div className="form-row">
            <div className="label">Monto neto</div>
            <div className="control">
              <strong>
                {resumen.neto.toLocaleString("es-CL", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </strong>
            </div>
          </div>
          <div className="form-row">
            <div className="label">IVA (19%)</div>
            <div className="control">
              <strong>
                {resumen.iva.toLocaleString("es-CL", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </strong>
            </div>
          </div>
          <div className="form-row">
            <div className="label">Total</div>
            <div className="control">
              <strong>
                {resumen.total.toLocaleString("es-CL", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </strong>
            </div>
          </div>
        </div>

        {/* Botonera al final, como en Django */}
        <div className="actions-bar">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={onGuardar}
          >
            GUARDAR
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={saving}
            onClick={onCancelar}
          >
            Volver
          </button>
        </div>
      </div>
    </>
  );
}


