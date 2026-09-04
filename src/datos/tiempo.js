/**
 * Tiempo — fuente única.
 *
 * Todo el sistema trabaja en HORA LOCAL. Usar `toISOString()` directo guarda en
 * UTC, y con el huso argentino (UTC−3) eso fecha las cargas de la tarde y la
 * noche un día adelantado: un seguimiento cargado a las 21:30 del lunes queda
 * asentado como martes, y aparece mal en el feed del inicio, en la última
 * actualización del proyecto y en la serie de avance.
 */

/** Desplaza una fecha a un instante cuyo UTC coincide con la hora local. */
function aLocal(fecha) {
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000);
}

/** Fecha de hoy en `AAAA-MM-DD`, hora local. */
export function hoyISO() {
  return aLocal(new Date()).toISOString().slice(0, 10);
}

/**
 * Marca de tiempo completa en hora local, para `creado_en`.
 *
 * Sin el sufijo `Z` a propósito: la cadena representa hora local, y dejarlo
 * haría que `Date.parse` la interpretara como UTC y la volviera a desplazar
 * —«hace 3 horas» para algo recién cargado—. Sin sufijo, el estándar la parsea
 * como local, que es lo que es.
 */
export function ahoraISO() {
  return aLocal(new Date()).toISOString().replace('Z', '');
}

/**
 * Suma días a una fecha ISO y devuelve otra fecha ISO.
 *
 * Se construye en UTC a propósito. Con `new Date('2026-09-01')` el motor
 * interpreta la cadena como medianoche UTC, pero `getDate()` la lee en la zona
 * local: en Argentina (UTC-3) eso devuelve el día ANTERIOR, y la fecha sale
 * corrida por uno. Es el error clásico de sumar días sobre fechas sin hora.
 */
export function sumarDias(fechaISO, dias) {
  if (!fechaISO) return '';
  const [a, m, d] = String(fechaISO).slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return '';
  const t = Date.UTC(a, m - 1, d) + dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
