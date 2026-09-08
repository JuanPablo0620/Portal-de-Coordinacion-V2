/**
 * Período del módulo de Mapa — parte pura.
 *
 * Un mapa de cortes sin control de tiempo es un mapa inservible: a las dos
 * semanas muestra todo lo que se cargó alguna vez y deja de contestar la única
 * pregunta que importa, que es qué está cortado HOY y qué se corta el sábado.
 * Por eso el módulo abre en «hoy» y nunca en «todo».
 *
 * La opción viaja en la URL como `periodo` y no como un par de fechas, igual
 * que en Monitoreo: si el valor por defecto fuera una fecha concreta, limpiar
 * el filtro la borraría de la dirección y el defecto volvería a aplicarse solo.
 */
import { sumarDias } from '../../datos/tiempo.js';

export const OPCIONES_PERIODO = Object.freeze([
  { valor: 'hoy', titulo: 'Hoy' },
  { valor: 'manana', titulo: 'Mañana' },
  { valor: '7d', titulo: '7 días' },
  { valor: '30d', titulo: '30 días' },
  { valor: 'todo', titulo: 'Todo' },
  { valor: 'personalizado', titulo: 'Elegir' },
]);

/**
 * Traduce la opción elegida al par de fechas con el que se filtran los cortes.
 * `hasta` vacío significa «sin tope»: un corte abierto sigue contando.
 */
export function resolverPeriodo(filtros = {}, hoy) {
  const opcion = filtros.periodo ?? 'hoy';
  if (opcion === 'todo') return { desde: '', hasta: '', unDia: false };
  if (opcion === 'personalizado') {
    const desde = filtros.desde || hoy;
    const hasta = filtros.hasta || desde;
    return { desde, hasta, unDia: desde === hasta };
  }
  if (opcion === 'manana') {
    const manana = sumarDias(hoy, 1);
    return { desde: manana, hasta: manana, unDia: true };
  }
  if (opcion === '7d') return { desde: hoy, hasta: sumarDias(hoy, 6), unDia: false };
  if (opcion === '30d') return { desde: hoy, hasta: sumarDias(hoy, 29), unDia: false };
  return { desde: hoy, hasta: hoy, unDia: true };
}

/**
 * Mueve el período un día para adelante o para atrás.
 *
 * Sólo tiene sentido cuando el período es de un día: ahí el control deja de ser
 * un filtro y pasa a ser un calendario, que es como se usa («¿y el sábado?»).
 * Devuelve los filtros ya listos para la URL, siempre como `personalizado`
 * porque «hoy más un día» no es ninguna de las opciones fijas.
 */
export function desplazarDia(filtros, hoy, dias) {
  const { desde, unDia } = resolverPeriodo(filtros, hoy);
  if (!unDia) return null;
  const fecha = sumarDias(desde, dias);
  if (fecha === hoy) return { periodo: 'hoy', desde: '', hasta: '' };
  return { periodo: 'personalizado', desde: fecha, hasta: fecha };
}
