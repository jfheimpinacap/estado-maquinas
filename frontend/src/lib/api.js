// frontend/src/lib/api.js

/**
 * authFetch:
 *   - Envía el access token en Authorization.
 *   - Si el backend responde 401 por token expirado, intenta refrescar con el
 *     refresh token en /auth/refresh.
 *   - Si el refresh funciona, reintenta UNA VEZ la petición original.
 *   - Si el refresh falla, limpia el auth del localStorage y recarga la página
 *     para forzar login de nuevo.
 *
 * Uso típico desde un componente:
 *   const { auth, backendURL } = useAuth();
 *   const res = await authFetch(`${backendURL}/ordenes`, {
 *     method: "GET",
 *     backendURL,
 *     token: auth?.access,
 *     refreshToken: auth?.refresh,
 *   });
 */

export async function authFetch(url, options = {}) {
  const {
    token,         // access token actual (puede estar vencido)
    refreshToken,  // refresh token JWT
    backendURL,    // ej: "http://127.0.0.1:8000"
    headers,
    ...rest
  } = options;

  // Hace la petición con el access token dado
  async function doRequest(accessToken) {
    const finalHeaders = {
      ...(headers || {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
    const res = await fetch(url, {
      ...rest,
      headers: finalHeaders,
    });
    return res;
  }

  // 1) Primer intento normal
  let res = await doRequest(token);

  // 2) Si NO es 401 o no tenemos refreshToken/backendURL, devolvemos tal cual
  if (res.status !== 401 || !refreshToken || !backendURL) {
    return res;
  }

  // 3) Intentamos refrescar el token
  try {
    const refreshRes = await fetch(`${backendURL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!refreshRes.ok) {
      // El refresh también falló: sesión realmente vencida → limpiar y recargar
      console.warn("Refresh token inválido o vencido, cerrando sesión.");
      try {
        localStorage.removeItem("auth");
      } catch (e) {
        console.error("Error limpiando auth de localStorage:", e);
      }
      // Forzamos recarga para que el usuario vuelva al login
      window.location.reload();
      return res; // devolvemos la respuesta original por si acaso
    }

    const data = await refreshRes.json();
    const newAccess = data.access;

    if (newAccess) {
      // Guardamos el nuevo access en localStorage para futuras peticiones
      try {
        const raw = localStorage.getItem("auth");
        if (raw) {
          const current = JSON.parse(raw);
          current.access = newAccess;
          localStorage.setItem("auth", JSON.stringify(current));
        }
      } catch (e) {
        console.error("Error actualizando auth en localStorage:", e);
      }

      // 4) Reintentamos UNA vez la petición original con el nuevo access
      res = await doRequest(newAccess);
    }
  } catch (e) {
    console.error("Error al refrescar token:", e);
    // En caso de error en el fetch de refresh dejamos la respuesta original
  }

  return res;
}


