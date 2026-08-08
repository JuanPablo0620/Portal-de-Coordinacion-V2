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

const IGNORAR_POR_DEFECTO = ['creado_en', 'creado_por', 'id'];

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
  return {
    id: nuevoId('h'),
    entidad,
    id_entidad,
    accion, // 'alta' | 'edicion' | 'baja'
    cambios,
    id_proyecto,
    creado_por: usuario,
    creado_en: new Date().toISOString(),
  };
}
