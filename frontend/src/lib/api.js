export function authHeaders(token) {
  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

export async function authFetch(url, { token, method = "GET", json, extraHeaders } = {}) {
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
  return res;
}
