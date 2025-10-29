// src/lib/api.js
export function authHeaders(token) {
  // NUNCA envíes "Bearer null" ni "Bearer undefined"
  if (!token || typeof token !== "string" || token.length < 10) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function authFetch(
  url,
  { token, method = "GET", json, extraHeaders, onUnauthorized } = {}
) {
  const headers = {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...authHeaders(token),
    ...(extraHeaders || {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: json ? JSON.stringify(json) : undefined,
  });

  // Si el backend respondió 401, avisamos arriba
  if (res.status === 401) {
    try {
      // intenta leer mensaje del backend (opcional)
      const data = await res.clone().json().catch(async () => (await res.text()) || "");
      const msg =
        (data && (data.detail || data.error || data.message)) ||
        "Sesión expirada o token inválido.";
      if (typeof onUnauthorized === "function") onUnauthorized(msg);
    } catch {}
  }
  return res;
}

