/**
 * Bitácora append-only.
 *
 * Un único mecanismo cubre tres requisitos: el versionado exigido por las
 * convenciones (ninguna edición borra el registro anterior), el feed
 * «Última actualización» del dashboard, y la pestaña de historial de cada ficha.
 *
 * No se guardan snapshots completos: inflarían el almacenamiento y ningún flujo
 * del sistema requiere restaurar una versión anterior.
 */
import { nuevoId } from './ids.js';
import { ahoraISO } from './tiempo.js';

const IGNORAR_POR_DEFECTO = ['creado_en', 'creado_por', 'id'];

/**
 * Secuencia monotónica.
 *
 * `creado_en` tiene resolución de milisegundo, y una operación que escribe
 * varios asientos seguidos (dar de alta un tema y su compromiso, importar un
 * lote) los produce dentro del mismo milisegundo. Ordenar sólo por fecha deja
 * esos asientos en orden arbitrario y el historial muestra la baja antes que el
 * alta. La secuencia rompe el empate.
 */
let secuencia = 0;

/** Campos que cambiaron entre dos versiones de un registro. */
export function diffCampos(antes, despues, ignorar = IGNORAR_POR_DEFECTO) {
  const campos = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})]);
  const cambios = [];
  for (const campo of campos) {
    if (ignorar.includes(campo)) continue;
    const a = antes?.[campo];
    const d = despues?.[campo];
    // Comparación por contenido: los campos de arreglo (ids_proyecto,
    // metas_trimestrales) cambian de referencia en cada edición sin cambiar de valor.
    if (JSON.stringify(a) !== JSON.stringify(d)) cambios.push({ campo, antes: a, despues: d });
  }
  return cambios;
}

/**
 * Asiento de bitácora. `id_proyecto` es lo que permite armar el historial de un
 * proyecto y calcular su última actualización, aun cuando el cambio ocurrió en
 * una entidad vinculada (un seguimiento, un compromiso).
 */
export function crearAsiento({ entidad, id_entidad, accion, cambios = [], usuario, id_proyecto = null }) {
  secuencia += 1;
  return {
    id: nuevoId('h'),
    entidad,
    id_entidad,
    accion, // 'alta' | 'edicion' | 'baja'
    cambios,
    id_proyecto,
    creado_por: usuario,
    creado_en: ahoraISO(),
    secuencia,
  };
}

/**
 * Comparador de asientos, del más reciente al más antiguo. Lo usan todas las
 * vistas de historial: tenerlo en un solo lugar evita que una ordene distinto.
 */
export function masRecientePrimero(a, b) {
  const porFecha = String(b.creado_en).localeCompare(String(a.creado_en));
  return porFecha !== 0 ? porFecha : (b.secuencia ?? 0) - (a.secuencia ?? 0);
}
