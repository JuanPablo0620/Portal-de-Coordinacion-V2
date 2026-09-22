/**
 * Plantillas institucionales de Reportes.
 *
 * No viven en `reportes_guardados`: esas configuraciones son personales y se
 * pueden borrar. Las plantillas de esta lista son parte del circuito de trabajo
 * del área y aparecen para todas las cuentas, aun si nadie guardó una copia.
 */

export const PLANTILLAS_REPORTES = [
  {
    id: 'informe-direccion',
    nombre: 'Informe de Dirección',
    descripcion: 'Eventos de esta semana y la próxima, compromisos vigentes por secretaría y compromisos de las mesas.',
    filtros: { plantilla: 'informe-direccion' },
    // El resto va apagado a propósito: `aplicarPlantilla` mezcla con los
    // bloques iniciales, que dejan prendidos Resumen y Proyectos.
    bloques: {
      resumen: false, proyectos: false, compromisos: true,
      minutas: false, monitoreos: false, mesas: true, eventos: true,
    },
    // Esta plantilla no recorta por proyecto ni por período: muestra TODO lo
    // vigente, porque el informe se imprime el lunes y un compromiso abierto
    // no deja de importar porque nadie lo tocó esa semana. Sólo los eventos
    // tienen ventana: la semana en curso y la siguiente.
    soloVigentes: true,
    ventanaEventos: 'dos-semanas',
    // Sin código de proyecto ni renglones de anotaciones por compromiso: con
    // todo lo vigente cargado, esos renglones pasarían las cuarenta hojas.
    compacto: true,
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
  if (!plantilla?.proyectos) return { proyectos, ausentes: [] };

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

/** La plantilla trae su propia lista de proyectos (y por eso recorta la base). */
export function plantillaTraeProyectos(idPlantilla) {
  return Boolean(plantillaReporte(idPlantilla)?.proyectos);
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
