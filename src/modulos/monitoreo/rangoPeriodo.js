/**
 * Período del módulo de monitoreo — parte pura.
 *
 * Antes las tres pestañas arrancaban sin período —dos campos de fecha vacíos—,
 * y «vacío» significaba todo el histórico. Con dos años cargados eso abría la
 * hoja de una secretaría con casi trescientos temas de veinticuatro meses, que
 * no es una hoja de trabajo sino un archivo: lo del mes pasado quedaba mezclado
 * con lo de 2024, y la comparación contra el período anterior no existía porque
 * no había período.
 *
 * Ahora el módulo abre en los últimos seis meses —los mismos que dibuja la
 * mini-serie de cada tarjeta— y el histórico completo sigue estando a un clic.
 *
 * La opción viaja en la URL como `periodo`, no como un par de fechas: si el
 * valor por defecto fuera una fecha concreta, «vaciar el filtro» lo borraría de
 * la dirección y el defecto volvería a aplicarse solo, dejando el histórico
 * completo imposible de pedir.
 */
import { sumarDias } from '../../datos/selectores.js';

/** Días de cada opción. `null` es «sin recorte». */
const DIAS = { '': 183, '12m': 365, todo: null, personalizado: null };

export const OPCIONES_PERIODO = Object.freeze([
  { valor: '', titulo: 'Últimos 6 meses' },
  { valor: '12m', titulo: 'Últimos 12 meses' },
  { valor: 'todo', titulo: 'Todo el histórico' },
  { valor: 'personalizado', titulo: 'Personalizado' },
]);

/** Traduce la opción elegida al par de fechas que consumen los selectores. */
export function resolverPeriodo(filtros = {}, hoy) {
  const opcion = filtros.periodo ?? '';
  if (opcion === 'todo') return { desde: '', hasta: '' };
  if (opcion === 'personalizado') return { desde: filtros.desde || '', hasta: filtros.hasta || '' };
  return { desde: sumarDias(hoy, -(DIAS[opcion] ?? DIAS[''])), hasta: '' };
}
