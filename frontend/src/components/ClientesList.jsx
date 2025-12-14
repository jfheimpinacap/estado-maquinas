// src/components/ClientesList.jsx
import AdminLayout from "./layout/AdminLayout";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { rutFormat } from "../lib/rut";

export default function ClientesList({ setView, setSelectedCliente }) {
  const [clientes, setClientes] = useState([]);
  const { auth, backendURL } = useAuth();

  const load = async () => {
    try {
      const res = await authFetch(`${backendURL}/clientes`, {
        token: auth?.access,
      });
      if (!res.ok) throw new Error("Error al cargar clientes");
      setClientes(await res.json());
    } catch (e) {
      console.error(e);
      setClientes([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const actions = (
    <>
      <button
        className="btn btn-primary"
        onClick={() => setView?.("crear-cliente")}
      >
        Añadir
      </button>
      <button className="btn btn-ghost" onClick={load}>
        Refrescar
      </button>
    </>
  );

  return (
    <AdminLayout
      setView={setView}
      title="Clientes"
      breadcrumbs={<>Clientes / Lista</>}
      actions={actions}
    >
      <div className="fieldset">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Razón Social</th>
              <th>RUT</th>
              <th>Dirección</th>
              <th>Correo</th>
              <th>Teléfono</th>
              <th>Forma de Pago</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: "1rem",
                    textAlign: "center",
                    color: "var(--muted)",
                  }}
                >
                  No hay clientes aún.
                </td>
              </tr>
            ) : (
              clientes.map((c) => (
                <tr key={c.id}>
                  <td>{c.razon_social}</td>
                  <td>{c.rut ? rutFormat(c.rut) : "—"}</td>
                  <td>{c.direccion || "—"}</td>
                  <td>{c.correo_electronico || "—"}</td>
                  <td>{c.telefono || "—"}</td>
                  <td>{c.forma_pago || "—"}</td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setSelectedCliente?.(c);
                        setView?.("ver-cliente");
                      }}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

// OJO: si en tu proyecto VerCliente está en otro archivo, déjalo separado.
// Aquí solo muestro cómo formatear el RUT en la ficha:

export function VerCliente({ cliente, setView, setSelectedCliente }) {
  if (!cliente) {
    return (
      <AdminLayout
        setView={setView}
        title="Datos del cliente"
        breadcrumbs={<>Clientes / Ficha</>}
      >
        <div className="fieldset">
          <p className="help-text">No se ha seleccionado cliente.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      setView={setView}
      title="Datos del cliente"
      breadcrumbs={<>Clientes / Ficha</>}
      actions={
        <>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setSelectedCliente(cliente);
              setView("editar-cliente");
            }}
          >
            Editar
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setView("ver-movimientos")}
          >
            Ver movimientos
          </button>
        </>
      }
    >
      <div className="fieldset">
        <div className="legend">Identificación</div>

        <div className="form-row">
          <div className="label">Razón Social</div>
          <div className="control">{cliente.razon_social || "—"}</div>
        </div>

        <div className="form-row">
          <div className="label">RUT</div>
          <div className="control">
            {cliente.rut ? rutFormat(cliente.rut) : "—"}
          </div>
        </div>
      </div>

      <div className="fieldset">
        <div className="legend">Contacto</div>

        <div className="form-row">
          <div className="label">Dirección</div>
          <div className="control">{cliente.direccion || "—"}</div>
        </div>

        <div className="form-row">
          <div className="label">Teléfono</div>
          <div className="control">{cliente.telefono || "—"}</div>
        </div>

        <div className="form-row">
          <div className="label">Correo electrónico</div>
          <div className="control">{cliente.correo_electronico || "—"}</div>
        </div>

        <div className="form-row">
          <div className="label">Forma de pago</div>
          <div className="control">{cliente.forma_pago || "—"}</div>
        </div>
      </div>
    </AdminLayout>
  );
}


