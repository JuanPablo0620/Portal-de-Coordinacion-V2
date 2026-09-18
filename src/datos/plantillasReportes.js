/**
 * Plantillas institucionales de Reportes.
 *
 * No viven en `reportes_guardados`: esas configuraciones son personales y se
 * pueden borrar. Las plantillas de esta lista son parte del circuito de trabajo
 * del área y aparecen para todas las cuentas, aun si nadie guardó una copia.
 */

const secretaria = [
  ['Estación de Lourdes', ['Recuperación de la Estación de Lourdes']],
  ['Casona Bosch', ['Restauración casona Bosch']],
  ['Sumideros', ['Intervenciones en sumideros']],
  ['Túnel Hornos', ['Túnel Hornos']],
  ['Túnel América', ['Túnel America']],
  ['Intervención en puntos estratégicos', ['Intervención en puntos estratégicos']],
  ['Miramar', ['Intervención Miramar']],
  ['Los Rusos', ['Los Rusos']],
  ['Suministro de cartelería', ['Suministro de cartelería']],
  ['Congreso de Educación y de Salud', ['Congreso de Salud / Congreso de Educación']],
  ['Plan 1000 días', ['Plan 1000 días']],
  ['SISU', ['SISU']],
  ['Bunker Libertador', ['Bunker Libertador']],
  ['CAPS 10', ['CAPS 10']],
  ['Bajadas territoriales', ['Bajadas Territoriales']],
  ['RIL', ['RIL']],
  ['Bloomberg WWC', ['Bloomberg WWC']],
  ['CIIAR', ['CIIAR']],
  ['Generación Trabajo', ['Generación Trabajo']],
  ['CAF', ['CAF']],
  ['Senado de la Nación', ['Senado de la Nación']],
  ['Regularización dominial', ['Regularización dominial']],
  ['Movilización de suelo', ['Movilización de suelo']],
  ['Plan 18 viviendas', ['Plan 18 viviendas']],
  ['Parque Logístico', ['Parque Logístico']],
];

export const PLANTILLAS_REPORTES = [
  {
    id: 'informe-secretaria',
    nombre: 'Informe de Secretaría',
    descripcion: 'Temas priorizados para la reunión de Secretaría.',
    filtros: { plantilla: 'informe-secretaria' },
    bloques: {
      resumen: true, proyectos: true, compromisos: true, minutas: true,
      monitoreos: true, mesas: true, eventos: true,
    },
    proyectos: secretaria.map(([titulo, nombres]) => ({ titulo, nombres })),
    // Legales no es un proyecto: es un compromiso que surge del seguimiento
    // de Coordinación. Va separado para que no se mezcle con la tabla de
    // proyectos ni se atribuya a otra secretaría.
    compromisos: [{ titulo: 'Legales', descripciones: ['Legales'] }],
  },
];

export function plantillaReporte(id) {
  return PLANTILLAS_REPORTES.find((p) => p.id === id) ?? null;
}

const normalizar = (texto) => String(texto ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es-AR')
  .trim();

/** Devuelve los proyectos en el orden de la agenda institucional. */
export function proyectosDePlantilla(proyectos, idPlantilla) {
  const plantilla = plantillaReporte(idPlantilla);
  if (!plantilla) return { proyectos, ausentes: [] };

  const porNombre = new Map(proyectos.map((p) => [normalizar(p.proyecto), p]));
  const encontrados = [];
  const ausentes = [];
  for (const item of plantilla.proyectos) {
    const proyecto = item.nombres.map((nombre) => porNombre.get(normalizar(nombre))).find(Boolean);
    if (proyecto) encontrados.push(proyecto);
    else ausentes.push(item.titulo);
  }
  return { proyectos: encontrados, ausentes };
}

/** Indica si un compromiso es uno de los temas explícitos de la plantilla. */
export function esCompromisoDePlantilla(compromiso, idPlantilla) {
  const plantilla = plantillaReporte(idPlantilla);
  if (!plantilla) return false;
  const descripcion = normalizar(compromiso?.descripcion);
  return (plantilla.compromisos ?? []).some((item) =>
    item.descripciones.some((texto) => normalizar(texto) === descripcion),
  );
}

/** Compromisos de la plantilla que todavía no tienen un registro cargado. */
export function compromisosAusentesDePlantilla(compromisos, idPlantilla) {
  const plantilla = plantillaReporte(idPlantilla);
  if (!plantilla) return [];
  return (plantilla.compromisos ?? [])
    .filter((item) => !compromisos.some((compromiso) =>
      item.descripciones.some((texto) => normalizar(texto) === normalizar(compromiso.descripcion)),
    ))
    .map((item) => item.titulo);
}
