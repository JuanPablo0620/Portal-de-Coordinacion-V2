/**
 * Forma de la base de datos.
 *
 * `VERSION_ESQUEMA` sirve para descartar una base persistida con forma vieja:
 * al subirla, el arranque recae en `bdVacia()` en lugar de romper con datos
 * incompatibles.
 */
import { CATALOGOS_SEMILLA } from './catalogos.js';

export const VERSION_ESQUEMA = 1;

export const COLECCIONES = Object.freeze([
  'proyectos',
  'seguimientos',
  'compromisos',
  'monitoreos',
  'temas_monitoreo',
  'mesas',
  'reuniones_mesa',
  'eventos',
  'requerimientos_evento',
  'planificacion_anual',
  'proyectos_posicionamiento',
  'historial',
  'reportes_guardados',
  // Qué áreas monitorea cada persona — no es dato institucional de gestión,
  // es preferencia de quién usa el sistema. Como no hay login real, la clave
  // es el nombre de `config.usuario` (ver `guardarAsignacionesMonitoreo` en
  // repositorio.js).
  'asignaciones_monitoreo',
]);

/** Clave primaria de cada colección. `proyectos` es la excepción: usa el id canónico. */
export const CLAVE_PRIMARIA = Object.freeze({
  proyectos: 'id_proyecto',
});

export function claveDe(entidad) {
  return CLAVE_PRIMARIA[entidad] ?? 'id';
}

export function bdVacia() {
  const bd = {
    version: VERSION_ESQUEMA,
    config: { usuario: 'Coordinación' },
    catalogos: structuredClone(CATALOGOS_SEMILLA),
  };
  for (const coleccion of COLECCIONES) bd[coleccion] = [];
  return bd;
}

/**
 * Completa una base leída del almacenamiento con las colecciones que falten.
 * Evita que agregar una colección nueva rompa las bases ya guardadas.
 */
export function normalizarBD(bd) {
  if (!bd || bd.version !== VERSION_ESQUEMA) return bdVacia();
  const base = bdVacia();
  return {
    ...base,
    ...bd,
    config: { ...base.config, ...(bd.config ?? {}) },
    catalogos: { ...base.catalogos, ...(bd.catalogos ?? {}) },
    ...Object.fromEntries(COLECCIONES.map((c) => [c, Array.isArray(bd[c]) ? bd[c] : []])),
  };
}
