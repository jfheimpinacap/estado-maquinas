// src/components/CrearOT.jsx
import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { toast } from "react-toastify";

const TIPO_OT = [
  { value: "ALTA", label: "Arriendo" },
  { value: "SERV", label: "Venta" },
  { value: "TRAS", label: "Traslado" },
];

const UNIDADES = [
  { value: "Dia", label: "Día" },
  { value: "Semana", label: "Semana" },
  { value: "Mes", label: "Mes (30 días corridos)" },
  { value: "Especial", label: "Arriendo especial (manual)" },
];

const TIPO_FLETE = [
  { value: "entrega_retiro", label: "Entrega y retiro" },
  { value: "solo_traslado", label: "Solo traslado" },
];

function nuevaLinea() {
  return {
    id: `${Date.now()}-${Math.random()}`,
    serie: "",
    maquinaInfo: null, // {marca, modelo, altura}
    unidad: "Dia",
    cantidadPeriodo: 1,
    desde: "",
    hasta: "",
    valor: "",
    flete: "",
    tipoFlete: "entrega_retiro",
  };
}

// Cálculo fechas incluyendo el día inicial
function calcularHasta(desdeStr, unidad, cantidad) {
  if (!desdeStr || !cantidad || cantidad <= 0) return "";
  if (unidad === "Especial") return "";

  const [y, m, d] = desdeStr.split("-").map(Number);
  if (!y || !m || !d) return "";

  const base = new Date(y, m - 1, d);
  let diasAgregar = 0;

  if (unidad === "Dia") {
    diasAgregar = cantidad - 1;
  } else if (unidad === "Semana") {
    diasAgregar = cantidad * 7 - 1;
  } else if (unidad === "Mes") {
    diasAgregar = cantidad * 30 - 1;
  } else {
    return "";
  }

  base.setDate(base.getDate() + diasAgregar);

  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function CrearOT() {
  const { auth, backendURL } = useAuth();
  const [saving, setSaving] = useState(false);

  // Datos generales OT
  const [tipo, setTipo] = useState("ALTA");
  const [clienteTerm, setClienteTerm] = useState("");
  const [obra, setObra] = useState("");
  const [direccion, setDireccion] = useState("");
  const [contactos, setContactos] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Líneas de máquinas
  const [items, setItems] = useState([nuevaLinea()]);

  // --------- MODAL DE MÁQUINAS DISPONIBLES ---------
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLineaId, setModalLineaId] = useState(null);
  const [maquinasDisponibles, setMaquinasDisponibles] = useState([]);
  const [maquinaSeleccionadaId, setMaquinaSeleccionadaId] = useState(null);

  const usedSeries = useMemo(
    () => items.map((it) => (it.serie || "").trim()).filter(Boolean),
    [items]
  );

  // ❗ AHORA no filtramos por estado, solo evitamos repetir series usadas
  const listasPorCategoria = useMemo(() => {
    const base = Array.isArray(maquinasDisponibles) ? maquinasDisponibles : [];

    const filtradas = base.filter(
      (m) => !usedSeries.includes((m.serie || "").trim())
    );

    return {
      elevadores: filtradas.filter((m) => m.categoria === "equipos_altura"),
      camiones: filtradas.filter((m) => m.categoria === "camiones"),
      otras: filtradas.filter(
        (m) => m.categoria !== "equipos_altura" && m.categoria !== "camiones"
      ),
    };
  }, [maquinasDisponibles, usedSeries]);

  const abrirModalParaLinea = async (idLinea) => {
    setModalLineaId(idLinea);
    setMaquinaSeleccionadaId(null);
    setModalOpen(true); // abrimos el modal SIEMPRE

    try {
      const res = await authFetch(`${backendURL}/maquinarias`, {
        token: auth?.access,
      });
      if (!res.ok) throw new Error("Error al cargar maquinarias");
      const data = await res.json();
      setMaquinasDisponibles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar máquinas disponibles.");
      setMaquinasDisponibles([]);
    }
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setModalLineaId(null);
    setMaquinaSeleccionadaId(null);
  };

  const confirmarSeleccionMaquina = () => {
    if (!modalLineaId || !maquinaSeleccionadaId) {
      toast.info("Debes seleccionar una máquina.");
      return;
    }
    const m = maquinasDisponibles.find((x) => x.id === maquinaSeleccionadaId);
    if (!m) {
      toast.error("No se encontró la máquina seleccionada.");
      return;
    }

    setItems((prev) =>
      prev.map((it) =>
        it.id === modalLineaId
          ? {
              ...it,
              serie: m.serie || "",
              maquinaInfo: {
                marca: m.marca,
                modelo: m.modelo,
                altura: m.altura,
              },
            }
          : it
      )
    );
    cerrarModal();
  };

  // --------- HANDLERS LÍNEAS ---------

  const handleChangeItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };

        if (["unidad", "cantidadPeriodo", "desde"].includes(field)) {
          const unidadActual = field === "unidad" ? value : updated.unidad;
          if (unidadActual !== "Especial") {
            const cantidad =
              field === "cantidadPeriodo"
                ? Number(value) || 0
                : Number(updated.cantidadPeriodo) || 0;
            updated.hasta = calcularHasta(
              updated.desde,
              unidadActual,
              cantidad
            );
          }
        }

        return updated;
      })
    );
  };

  const addLinea = () => {
    setItems((prev) => [...prev, nuevaLinea()]);
  };

  const removeLinea = (id) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((it) => it.id !== id)));
  };

  // --------- BÚSQUEDA POR SERIE (validación manual) ---------

  const buscarMaquinaPorSerie = async (idLinea) => {
    const linea = items.find((it) => it.id === idLinea);
    if (!linea) return;
    const serie = (linea.serie || "").trim();
    if (!serie) return;

    try {
      const url = `${backendURL}/maquinarias?query=${encodeURIComponent(serie)}`;
      const res = await authFetch(url, { token: auth?.access });
      if (!res.ok) throw new Error("Error al buscar maquinarias");
      let data = await res.json();
      if (!Array.isArray(data)) data = [];

      const exact = data.find(
        (m) => String(m.serie || "").toLowerCase() === serie.toLowerCase()
      );

      if (!exact) {
        toast.warn("No se encontró ninguna máquina con esa serie.");
        setItems((prev) =>
          prev.map((it) =>
            it.id === idLinea ? { ...it, maquinaInfo: null } : it
          )
        );
        return;
      }

      setItems((prev) =>
        prev.map((it) =>
          it.id === idLinea
            ? {
                ...it,
                maquinaInfo: {
                  marca: exact.marca,
                  modelo: exact.modelo,
                  altura: exact.altura,
                },
              }
            : it
        )
      );
      toast.success("Máquina encontrada.");
    } catch (e) {
      console.error(e);
      toast.error("Error al validar la serie de la máquina.");
    }
  };

  // --------- RESÚMENES ---------

  const resumenPorLinea = (it) => {
    const valor = parseFloat(it.valor || "0") || 0;
    const flete = parseFloat(it.flete || "0") || 0;
    const neto = valor + flete;
    const iva = Math.round(neto * 0.19 * 100) / 100;
    const total = Math.round((neto + iva) * 100) / 100;
    return { neto, iva, total };
  };

  const resumenGlobal = useMemo(() => {
    return items.reduce(
      (acc, it) => {
        const { neto, iva, total } = resumenPorLinea(it);
        acc.neto += neto;
        acc.iva += iva;
        acc.total += total;
        return acc;
      },
      { neto: 0, iva: 0, total: 0 }
    );
  }, [items]);

  // --------- GUARDAR OT (placeholder backend) ---------

  const handleGuardar = async () => {
    if (!clienteTerm.trim()) {
      toast.warn("Debes indicar un cliente (RUT o nombre).");
      return;
    }
    if (!items.some((it) => it.serie.trim())) {
      toast.warn("Debes indicar al menos una máquina (serie).");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tipo,
        observaciones,
        meta_cliente: clienteTerm,
        meta_obra: obra,
        meta_direccion: direccion,
        meta_contactos: contactos,
        lineas: items.map((it) => ({
          serie: it.serie,
          unidad: it.unidad,
          cantidadPeriodo: it.cantidadPeriodo,
          desde: it.desde,
          hasta: it.hasta,
          valor: it.valor,
          flete: it.flete,
          tipoFlete: it.tipoFlete,
        })),
      };

      const res = await authFetch(`${backendURL}/ordenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        token: auth?.access,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Error ${res.status} al crear la OT`);
      }

      toast.success("Orden de trabajo creada correctamente.");
      setItems([nuevaLinea()]);
      setObservaciones("");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Error al crear la orden de trabajo");
    } finally {
      setSaving(false);
    }
  };

  // ====================
  // RENDER
  // ====================

  return (
    <>
      <div className="ot-layout">
        {/* COLUMNA PRINCIPAL */}
        <div className="ot-main">
          {/* Datos generales + Observaciones */}
          <div className="admin-card">
            <div className="fieldset">
              <div className="legend">Crear orden de trabajo</div>

              {/* Tipo OT */}
              <div className="form-row">
                <div className="label">Tipo</div>
                <div className="control">
                  <select
                    className="select"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                  >
                    {TIPO_OT.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <div className="help-text">
                    Arriendo, Venta o Traslado (Axxxx / Vxxxx / Txxxx se define en backend).
                  </div>
                </div>
              </div>

              {/* Cliente */}
              <div className="form-row">
                <div className="label">Cliente</div>
                <div className="control">
                  <input
                    className="input"
                    placeholder="Razón social o RUT"
                    value={clienteTerm}
                    onChange={(e) => setClienteTerm(e.target.value)}
                  />
                  <div className="help-text">
                    Si el cliente no existe, el sistema lo avisará al confirmar la OT.
                  </div>
                </div>
              </div>

              {/* Obra */}
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

              {/* Dirección */}
              <div className="form-row">
                <div className="label">Dirección</div>
                <div className="control">
                  <input
                    className="input"
                    placeholder="Dirección de entrega / retiro"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                  />
                </div>
              </div>

              {/* Contactos */}
              <div className="form-row">
                <div className="label">Contactos</div>
                <div className="control">
                  <textarea
                    className="textarea"
                    rows={2}
                    placeholder="Nombres y celulares de contactos en obra"
                    value={contactos}
                    onChange={(e) => setContactos(e.target.value)}
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div className="form-row">
                <div className="label">Observaciones</div>
                <div className="control">
                  <textarea
                    className="textarea"
                    rows={3}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* MÁQUINAS */}
          {items.map((it, idx) => (
            <div key={it.id} className="admin-card ot-item-card">
              <div className="fieldset">
                <div className="legend">Máquina #{idx + 1}</div>

                {/* Serie + Buscar (modal) */}
                <div className="form-row ot-series-row">
                  <div className="label">Serie máquina</div>
                  <div className="control">
                    <div className="ot-series-control">
                      <input
                        className="input input--serie"
                        maxLength={16}
                        value={it.serie}
                        onChange={(e) =>
                          handleChangeItem(it.id, "serie", e.target.value)
                        }
                        onBlur={() => buscarMaquinaPorSerie(it.id)}
                        placeholder="Serie"
                      />
                      <button
                        type="button"
                        className="btn btn-primary ot-btn-buscar-serie"
                        onClick={() => abrirModalParaLinea(it.id)}
                      >
                        Buscar
                      </button>
                    </div>
                    {it.maquinaInfo ? (
                      <div className="help-text">
                        {it.maquinaInfo.marca} {it.maquinaInfo.modelo || ""}{" "}
                        {it.maquinaInfo.altura
                          ? `– ${it.maquinaInfo.altura} m`
                          : ""}
                      </div>
                    ) : (
                      <div className="help-text">
                        Puedes ingresar la serie o usar el buscador para ver las máquinas disponibles.
                      </div>
                    )}
                  </div>
                </div>

                {/* Periodo (Unidad + Cantidad) */}
                <div className="form-row">
                  <div className="label">Periodo</div>
                  <div className="control">
                    <div className="ot-periodo-row">
                      <select
                        className="select"
                        value={it.unidad}
                        onChange={(e) =>
                          handleChangeItem(it.id, "unidad", e.target.value)
                        }
                      >
                        {UNIDADES.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                      {it.unidad !== "Especial" && (
                        <input
                          className="input ot-cantidad-input"
                          type="number"
                          min={1}
                          value={it.cantidadPeriodo}
                          onChange={(e) =>
                            handleChangeItem(
                              it.id,
                              "cantidadPeriodo",
                              e.target.value
                            )
                          }
                          placeholder="Cantidad"
                        />
                      )}
                    </div>
                    <div className="help-text">
                      Ej.: 6 días, 1 semana, 2 semanas, 1 mes (30 días corridos).
                      En &quot;Arriendo especial&quot; ajustas las fechas manualmente.
                    </div>
                  </div>
                </div>

                {/* Fechas desde / hasta */}
                <div className="form-row">
                  <div className="label">Fechas</div>
                  <div className="control ot-fechas-row">
                    <div className="date-wrapper">
                      <input
                        type="date"
                        className="input input--date"
                        value={it.desde}
                        onChange={(e) =>
                          handleChangeItem(it.id, "desde", e.target.value)
                        }
                      />
                    </div>
                    <span className="ot-fechas-sep">→</span>
                    <div className="date-wrapper">
                      <input
                        type="date"
                        className="input input--date"
                        value={it.hasta}
                        onChange={(e) =>
                          handleChangeItem(it.id, "hasta", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Valor neto (equipo) */}
                <div className="form-row">
                  <div className="label">Valor neto</div>
                  <div className="control">
                    <input
                      className="input ot-valor-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.valor}
                      onChange={(e) =>
                        handleChangeItem(it.id, "valor", e.target.value)
                      }
                      placeholder="0"
                    />
                    <div className="help-text">
                      Monto neto del equipo para este periodo.
                    </div>
                  </div>
                </div>

                {/* Flete */}
                <div className="form-row">
                  <div className="label">Flete</div>
                  <div className="control">
                    <select
                      className="select"
                      value={it.tipoFlete}
                      onChange={(e) =>
                        handleChangeItem(it.id, "tipoFlete", e.target.value)
                      }
                    >
                      {TIPO_FLETE.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input ot-valor-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.flete}
                      onChange={(e) =>
                        handleChangeItem(it.id, "flete", e.target.value)
                      }
                      placeholder="0"
                    />
                    <div className="help-text">
                      Valor neto del flete (entrega/retiro o solo traslado).
                    </div>
                  </div>
                </div>

                {/* Acciones línea */}
                <div className="ot-item-actions">
                  <button
                    type="button"
                    className="btn btn-ghost ot-btn-eliminar"
                    onClick={() => removeLinea(it.id)}
                    disabled={items.length === 1}
                  >
                    Eliminar máquina
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Añadir otra máquina */}
          <div className="admin-card">
            <div className="fieldset">
              <div className="ot-add-row">
                <button
                  type="button"
                  className="btn btn-primary ot-btn-add"
                  onClick={addLinea}
                >
                  + Añadir máquina
                </button>
              </div>
            </div>
          </div>

          {/* Botonera principal */}
          <div className="admin-card">
            <div className="actions-bar">
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={handleGuardar}
              >
                GUARDAR OT
              </button>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: RESUMEN VENTA */}
        <aside className="ot-summary">
          <div className="admin-card ot-summary-card">
            <div className="fieldset">
              <div className="legend">Resumen venta</div>

              {items.map((it, idx) => {
                const econ = resumenPorLinea(it);
                return (
                  <div key={it.id} className="ot-summary-item">
                    <div className="ot-summary-title">
                      Máquina #{idx + 1}{" "}
                      {it.maquinaInfo
                        ? `– ${it.maquinaInfo.marca} ${
                            it.maquinaInfo.modelo || ""
                          }`
                        : it.serie
                        ? `– Serie ${it.serie}`
                        : ""}
                    </div>
                    <div className="ot-summary-line">
                      <span>Neto</span>
                      <span>${econ.neto.toLocaleString("es-CL")}</span>
                    </div>
                    <div className="ot-summary-line">
                      <span>IVA 19%</span>
                      <span>${econ.iva.toLocaleString("es-CL")}</span>
                    </div>
                    <div className="ot-summary-line ot-summary-total-line">
                      <span>Total</span>
                      <span>${econ.total.toLocaleString("es-CL")}</span>
                    </div>
                  </div>
                );
              })}

              <hr className="ot-summary-sep" />

              <div className="legend" style={{ marginTop: ".3rem" }}>
                Venta total
              </div>
              <div className="ot-summary-line">
                <span>Neto</span>
                <span>${resumenGlobal.neto.toLocaleString("es-CL")}</span>
              </div>
              <div className="ot-summary-line">
                <span>IVA 19%</span>
                <span>${resumenGlobal.iva.toLocaleString("es-CL")}</span>
              </div>
              <div className="ot-summary-line ot-summary-total-line">
                <span>Total</span>
                <span>${resumenGlobal.total.toLocaleString("es-CL")}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* MODAL DE MÁQUINAS DISPONIBLES */}
      {modalOpen && (
        <div className="ot-modal-backdrop" onClick={cerrarModal}>
          <div className="ot-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ot-modal-header">
              <div className="ot-modal-title">Seleccionar máquina disponible</div>
            </div>

            <div className="ot-modal-columns">
              {/* Elevadores */}
              <div>
                <div className="ot-modal-column-title">Elevadores</div>
                <div className="ot-machine-list">
                  {listasPorCategoria.elevadores.length === 0 && (
                    <div className="ot-machine-empty">Sin elevadores.</div>
                  )}
                  {listasPorCategoria.elevadores.map((m) => {
                    const selected = maquinaSeleccionadaId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={
                          "ot-machine-item" +
                          (selected ? " ot-machine-item--selected" : "")
                        }
                        onClick={() => setMaquinaSeleccionadaId(m.id)}
                      >
                        <div className="ot-machine-title">
                          {m.marca} {m.modelo || ""}
                        </div>
                        <div className="ot-machine-meta">
                          Serie: {m.serie || "—"}
                          {m.altura
                            ? ` · Altura: ${m.altura} m`
                            : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Camiones */}
              <div>
                <div className="ot-modal-column-title">Camiones</div>
                <div className="ot-machine-list">
                  {listasPorCategoria.camiones.length === 0 && (
                    <div className="ot-machine-empty">Sin camiones.</div>
                  )}
                  {listasPorCategoria.camiones.map((m) => {
                    const selected = maquinaSeleccionadaId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={
                          "ot-machine-item" +
                          (selected ? " ot-machine-item--selected" : "")
                        }
                        onClick={() => setMaquinaSeleccionadaId(m.id)}
                      >
                        <div className="ot-machine-title">
                          {m.marca} {m.modelo || ""}
                        </div>
                        <div className="ot-machine-meta">
                          Serie: {m.serie || "—"}
                          {m.tonelaje
                            ? ` · Tonelaje: ${m.tonelaje} t`
                            : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Otras máquinas */}
              <div>
                <div className="ot-modal-column-title">Otras máquinas</div>
                <div className="ot-machine-list">
                  {listasPorCategoria.otras.length === 0 && (
                    <div className="ot-machine-empty">Sin otras máquinas.</div>
                  )}
                  {listasPorCategoria.otras.map((m) => {
                    const selected = maquinaSeleccionadaId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={
                          "ot-machine-item" +
                          (selected ? " ot-machine-item--selected" : "")
                        }
                        onClick={() => setMaquinaSeleccionadaId(m.id)}
                      >
                        <div className="ot-machine-title">
                          {m.marca} {m.modelo || ""}
                        </div>
                        <div className="ot-machine-meta">
                          Serie: {m.serie || "—"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="ot-modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cerrarModal}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmarSeleccionMaquina}
              >
                Seleccionar máquina
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}








