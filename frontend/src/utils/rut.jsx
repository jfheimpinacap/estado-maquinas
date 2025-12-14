// src/lib/rut.jsx
// Utilidades de RUT compartidas por formularios y búsquedas

// deja solo dígitos y K/k
export function rutClean(value = "") {
  return (value || "").replace(/[^0-9kK]/g, "").toUpperCase();
}

// formatea a xx.xxx.xxx-x
export function rutFormat(value = "") {
  const clean = rutClean(value);
  if (!clean) return "";

  if (clean.length <= 1) return clean;

  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);

  const rev = cuerpo.split("").reverse();
  let conPuntos = "";
  for (let i = 0; i < rev.length; i++) {
    if (i > 0 && i % 3 === 0) conPuntos = "." + conPuntos;
    conPuntos = rev[i] + conPuntos;
  }

  return `${conPuntos}-${dv}`;
}

// calcula dígito verificador y compara
export function rutIsValid(value = "") {
  const clean = rutClean(value);
  if (clean.length < 2) return false;

  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  const dvEsperado =
    resto === 11 ? "0" : resto === 10 ? "K" : String(resto);

  return dv === dvEsperado;
}

// para mandar al backend: xxxxxxxx-x (sin puntos)
export function rutNormalizeBackend(value = "") {
  const clean = rutClean(value);
  if (clean.length < 2) return clean;
  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${cuerpo}-${dv}`;
}

// ¿parece que el usuario está escribiendo un RUT?
export function isRutLike(value = "") {
  const v = (value || "").trim();
  if (!v) return false;
  return /^[0-9.\-kK]+$/.test(v);
}

