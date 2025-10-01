import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Usamos sessionStorage para que al CERRAR el navegador se borre la sesión
const STORAGE_KEY = "auth_session_v1";

export default function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      // estructura esperada: { user, access, refresh }
      return raw ? JSON.parse(raw) : { user: null, access: null, refresh: null };
    } catch {
      return { user: null, access: null, refresh: null };
    }
  });

  // Persistir SOLO en sessionStorage (no sobrevive a cerrar el navegador)
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  }, [auth]);

  const backendURL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

  const login = async (username, password) => {
    const res = await fetch(`${backendURL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || "Credenciales inválidas");
    }
    const data = await res.json();
    // data = { access, refresh, user: {...} }
    setAuth({ user: data.user, access: data.access, refresh: data.refresh });
    return data;
  };

  const register = async (username, password) => {
    const res = await fetch(`${backendURL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      let detail = "No se pudo crear el usuario";
      try { const e = await res.json(); detail = e.detail || detail; } catch { /* ignore */ }
      throw new Error(detail);
    }
    return await res.json();
  };

  const logout = () => {
    setAuth({ user: null, access: null, refresh: null });
    // Borrado explícito (por si hubiera race al cerrar pestaña)
    sessionStorage.removeItem(STORAGE_KEY);
  };

  // Si quieres cortar sesión al cerrar/recargar la pestaña:
  useEffect(() => {
    const handler = () => {
      // No es estrictamente necesario porque sessionStorage se borra al cerrar,
      // pero así te aseguras que no queda nada en una recarga.
      sessionStorage.removeItem(STORAGE_KEY);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const value = useMemo(
    () => ({
      auth,
      login,
      register,
      logout,
      backendURL,
      isAuthenticated: !!auth?.access,
      isAdmin: !!auth?.user?.is_staff || !!auth?.user?.is_superuser,
    }),
    [auth, backendURL]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

