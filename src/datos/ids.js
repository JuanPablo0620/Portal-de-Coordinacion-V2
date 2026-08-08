/**
 * Generación de identificadores.
 *
 * El formato del id de proyecto (`SEC-AAAA-NNN`) queda encapsulado acá porque
 * su validación contra la nomenclatura del POA está diferida a la etapa
 * siguiente: cuando se defina, se cambia sólo este archivo.
 */

/**
 * `PREFIJO-AAAA-NNN` — prefijo del área, año de alta y correlativo de tres
 * dígitos por prefijo y año.
 */
export function generarIdProyecto(bd, idArea, fecha) {
  const area = bd.catalogos?.areas?.find((a) => a.id === idArea);
  const prefijo = area?.prefijo || 'GEN';
  const anio = String(fecha || new Date().toISOString()).slice(0, 4);
  const raiz = `${prefijo}-${anio}-`;

  // Cuenta también las bajas lógicas: un id dado de baja nunca se reutiliza.
  const usados = (bd.proyectos ?? [])
    .filter((p) => String(p.id_proyecto).startsWith(raiz))
    .map((p) => Number(String(p.id_proyecto).slice(raiz.length)))
    .filter((n) => Number.isFinite(n));

  const siguiente = (usados.length ? Math.max(...usados) : 0) + 1;
  return raiz + String(siguiente).padStart(3, '0');
}

let contador = 0;

/** Id interno de entidades no-proyecto. Único dentro de la sesión y estable al persistir. */
export function nuevoId(prefijo) {
  contador += 1;
  return `${prefijo}_${Date.now().toString(36)}${contador.toString(36)}`;
}
