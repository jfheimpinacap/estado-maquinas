import AdminLayout from "./layout/AdminLayout";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/api";
import { rutFormat } from "../utils/rut";

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
                  <td>{rutFormat(c.rut)}</td>
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



