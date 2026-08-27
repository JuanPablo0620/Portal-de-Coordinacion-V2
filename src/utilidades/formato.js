/**
 * Formato de presentación. Español rioplatense: fechas DD/MM/AAAA y montos en
 * pesos argentinos con separador de miles.
 */

const MONEDA = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const DOLAR = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const NUMERO = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

/**
 * ISO → DD/MM/AAAA, armado a mano.
 * No se usa `toLocaleDateString`: interpreta el ISO como UTC y, con husos
 * negativos como el nuestro, muestra el día anterior.
 */
export function fecha(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  if (!a || !m || !d) return '—';
  return `${d}/${m}/${a}`;
}

export function fechaHora(iso) {
  if (!iso) return '—';
  const hora = String(iso).slice(11, 16);
  return hora ? `${fecha(iso)} ${hora}` : fecha(iso);
}

export function fechaLarga(iso) {
  if (!iso) return '—';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${Number(d)} de ${MESES[Number(m) - 1]} de ${a}`;
}

export function moneda(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return MONEDA.format(n);
}

/**
 * Montos del posicionamiento.
 *
 * Van en dólares y no en pesos a propósito: es la moneda en la que están
 * escritas las convocatorias, y convertirla a pesos obligaría a fijar un tipo
 * de cambio que quedaría viejo antes de que cierre la postulación.
 */
export function dolares(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return DOLAR.format(n);
}

export function numero(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return NUMERO.format(n);
}

export function porcentaje(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n)}%`;
}

/** Tiempo transcurrido en lenguaje natural, para el feed de actualizaciones. */
export function haceCuanto(iso) {
  if (!iso) return '';
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const minutos = Math.floor(ms / 60_000);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  return fecha(iso);
}

/** «vence en 3 días» / «vencido hace 7 días» */
export function textoVencimiento(dias) {
  if (dias === null || dias === undefined) return '';
  if (dias < 0) return `vencido hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`;
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  return `vence en ${dias} días`;
}

/** Nombre legible → sufijo de archivo exportado («Secretaría de Salud» → «secretaria-de-salud»). */
export function sufijoArchivo(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/** Nombre del mes con año, para encabezados de calendario. */
export function nombreMes(anio, mes) {
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${MESES[mes]} ${anio}`;
}
