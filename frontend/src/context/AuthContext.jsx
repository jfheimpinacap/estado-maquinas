import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const STORAGE_KEY = "auth_v1";

export default function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { user: null, access: null, refresh: null };
    } catch {
      return { user: null, access: null, refresh: null };
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  }, [auth]);

  const backendURL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const login = async (username, password) => {
    const res = await fetch(`${backendURL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("Credenciales inválidas");
    const data = await res.json();
    setAuth({ user: data.user, access: data.access, refresh: data.refresh });
  };

  const register = async (username, password) => {
    const res = await fetch(`${backendURL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.detail || "No se pudo crear el usuario");
    }
    return await res.json();
  };

  const logout = () => setAuth({ user: null, access: null, refresh: null });

  const value = useMemo(() => ({ auth, login, register, logout, backendURL }), [auth, backendURL]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
