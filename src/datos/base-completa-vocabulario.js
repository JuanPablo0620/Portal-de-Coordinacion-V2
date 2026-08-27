/**
 * ─────────────────────────────────────────────────────────────────────
 * VOCABULARIO DEL SET COMPLETO — el contenido ficticio, separado de la
 * mecánica que lo combina.
 *
 * El generador vecino decide CUÁNTO y CÓMO: cuántos proyectos por área y por
 * año, con qué ritmo avanzan, qué se atrasa. Este archivo decide QUÉ: los
 * nombres de las áreas, las plantillas de proyecto, las frases con las que se
 * escriben las minutas y los catálogos institucionales.
 *
 * Están separados porque se tocan por motivos distintos. Cambiar el contenido
 * —sumar un área, escribir otra traba típica de obra— es editar una lista acá,
 * sin leer una línea de la lógica; cambiar la distribución de la base es al
 * revés. Juntos eran mil doscientas líneas donde una cosa tapaba a la otra.
 *
 * Todo es inventado, como en el resto de los sets: nunca áreas, personas ni
 * proyectos reales del municipio.
 * ─────────────────────────────────────────────────────────────────────
 */

/* ── Vocabulario propio del set completo ────────────────────────────── */

/** Quiénes firman las cargas. El sistema no tiene login: `creado_por` es texto. */
export const EQUIPO = ['Coordinación', 'M. López', 'R. Sosa', 'A. Quiroga', 'J. Vera'];

/* ── Catálogos institucionales del set completo ─────────────────────── */

/**
 * Catálogos más anchos que la semilla: catorce áreas en lugar de ocho, veinte
 * programas, y algunos ítems dados de baja. La cantidad importa: con ocho áreas
 * el tablero de secretarías entra en una pantalla y no se ve el problema de
 * ordenar y priorizar, que es justamente lo que hay que probar.
 */
export const AREAS = [
  {
    nombre: 'Secretaría de Obras Públicas',
    prefijo: 'OBR',
    eje: 'POA',
    programas: ['Infraestructura urbana', 'Hábitat y vivienda', 'Espacios verdes'],
    porAnio: [14, 16, 12],
    cumplimiento: 0.9,
    plantillas: [
      ['Repavimentación de arteria principal', 'Obra', 'cuadras'],
      ['Bacheo integral', 'Obra', 'cuadras'],
      ['Red de desagües pluviales', 'Obra', 'metros lineales'],
      ['Puesta en valor de plaza', 'Obra', 'm²'],
      ['Recambio de alumbrado a LED', 'Obra', 'unidades'],
      ['Refacción de edificio municipal', 'Obra', 'm²'],
      ['Construcción de cordón cuneta', 'Obra', 'metros lineales'],
      ['Señalización y demarcación vial', 'Servicio', 'cuadras'],
      ['Ampliación de red cloacal', 'Obra', 'metros lineales'],
      ['Pavimento de hormigón en calles internas', 'Obra', 'cuadras'],
    ],
  },
  {
    nombre: 'Secretaría de Desarrollo Social',
    prefijo: 'DSO',
    eje: 'POA',
    programas: ['Inclusión social', 'Primera infancia', 'Hábitat y vivienda'],
    porAnio: [10, 11, 9],
    cumplimiento: 0.995,
    plantillas: [
      ['Programa de acompañamiento familiar', 'Programa social', 'beneficiarios'],
      ['Entrega de módulos alimentarios', 'Programa social', 'beneficiarios'],
      ['Centro de primera infancia', 'Programa social', 'beneficiarios'],
      ['Mejoramiento habitacional', 'Obra', 'unidades'],
      ['Operativo de documentación', 'Servicio', 'beneficiarios'],
      ['Dispositivo de abordaje territorial', 'Programa social', 'beneficiarios'],
      ['Refacción de comedor comunitario', 'Obra', 'm²'],
      ['Programa de acompañamiento a personas mayores', 'Programa social', 'beneficiarios'],
    ],
  },
  {
    nombre: 'Secretaría de Servicios Públicos',
    prefijo: 'SPU',
    eje: 'POA',
    programas: ['Higiene urbana', 'Espacios verdes'],
    porAnio: [9, 10, 8],
    cumplimiento: 0.86,
    plantillas: [
      ['Recolección diferenciada', 'Servicio', 'beneficiarios'],
      ['Poda y mantenimiento de arbolado', 'Servicio', 'unidades'],
      ['Limpieza de sumideros', 'Servicio', 'unidades'],
      ['Renovación de contenedores', 'Adquisición', 'unidades'],
      ['Operativo de descacharrado', 'Servicio', 'cuadras'],
      ['Mantenimiento de espacios verdes', 'Servicio', 'm²'],
      ['Renovación de flota de recolección', 'Adquisición', 'unidades'],
    ],
  },
  {
    nombre: 'Secretaría de Salud',
    prefijo: 'SAL',
    eje: 'POA',
    programas: ['Atención primaria de la salud', 'Salud comunitaria'],
    porAnio: [8, 9, 7],
    cumplimiento: 0.998,
    plantillas: [
      ['Refuerzo de atención primaria', 'Servicio', 'beneficiarios'],
      ['Campaña de vacunación', 'Servicio', 'beneficiarios'],
      ['Equipamiento de centro de salud', 'Adquisición', 'unidades'],
      ['Ampliación de sala de atención', 'Obra', 'm²'],
      ['Programa de salud mental comunitaria', 'Programa social', 'beneficiarios'],
      ['Operativo de salud en barrios', 'Servicio', 'beneficiarios'],
      ['Digitalización de historias clínicas', 'Gestión interna', '%'],
    ],
  },
  {
    nombre: 'Subsecretaría de Educación',
    prefijo: 'EDU',
    eje: 'POA',
    programas: ['Trayectorias educativas', 'Primera infancia'],
    porAnio: [7, 7, 6],
    cumplimiento: 0.999,
    plantillas: [
      ['Apoyo escolar en barrios', 'Programa social', 'beneficiarios'],
      ['Refacción de jardín municipal', 'Obra', 'm²'],
      ['Provisión de material didáctico', 'Adquisición', 'unidades'],
      ['Programa de terminalidad educativa', 'Programa social', 'beneficiarios'],
      ['Talleres de robótica escolar', 'Servicio', 'beneficiarios'],
      ['Mantenimiento de establecimientos escolares', 'Obra', 'm²'],
    ],
  },
  {
    nombre: 'Subsecretaría de Cultura',
    prefijo: 'CUL',
    eje: 'POA',
    programas: ['Cultura de cercanía'],
    porAnio: [6, 6, 5],
    cumplimiento: 0.997,
    plantillas: [
      ['Ciclo de cultura en los barrios', 'Programa social', 'beneficiarios'],
      ['Puesta en valor del centro cultural', 'Obra', 'm²'],
      ['Escuela municipal de arte', 'Servicio', 'beneficiarios'],
      ['Programa de bibliotecas populares', 'Servicio', 'beneficiarios'],
      ['Muralismo comunitario', 'Servicio', 'm²'],
      ['Equipamiento de sala de ensayo', 'Adquisición', 'unidades'],
    ],
  },
  {
    nombre: 'Dirección de Producción y Empleo',
    prefijo: 'PRO',
    eje: 'POA',
    programas: ['Empleo joven', 'Economía social'],
    porAnio: [6, 6, 5],
    cumplimiento: 0.99,
    plantillas: [
      ['Formación en oficios', 'Programa social', 'beneficiarios'],
      ['Registro de emprendedores', 'Gestión interna', '%'],
      ['Feria de productores locales', 'Servicio', 'beneficiarios'],
      ['Programa de primer empleo', 'Programa social', 'beneficiarios'],
      ['Asistencia técnica a pymes', 'Servicio', 'beneficiarios'],
      ['Puesta en valor del parque industrial', 'Obra', 'm²'],
    ],
  },
  {
    nombre: 'Dirección de Ambiente',
    prefijo: 'AMB',
    eje: 'POA',
    programas: ['Espacios verdes', 'Higiene urbana'],
    porAnio: [6, 7, 5],
    cumplimiento: 0.995,
    plantillas: [
      ['Forestación urbana', 'Servicio', 'unidades'],
      ['Punto verde de reciclado', 'Obra', 'unidades'],
      ['Educación ambiental en escuelas', 'Programa social', 'beneficiarios'],
      ['Saneamiento de arroyo', 'Obra', 'metros lineales'],
      ['Compostaje comunitario', 'Servicio', 'beneficiarios'],
      ['Censo de arbolado público', 'Gestión interna', 'unidades'],
    ],
  },
  {
    nombre: 'Secretaría de Gobierno',
    prefijo: 'GOB',
    eje: 'POA',
    programas: ['Cercanía y atención al vecino', 'Modernización administrativa'],
    porAnio: [5, 5, 4],
    cumplimiento: 0.88,
    plantillas: [
      ['Puesta en funcionamiento de delegación', 'Obra', 'm²'],
      ['Programa de atención al vecino', 'Servicio', 'beneficiarios'],
      ['Digitalización de licencias de conducir', 'Gestión interna', '%'],
      ['Operativo de regularización dominial', 'Gestión interna', 'unidades'],
      ['Refuerzo del sistema de reclamos', 'Gestión interna', '%'],
    ],
  },
  {
    nombre: 'Secretaría de Hacienda',
    prefijo: 'HAC',
    eje: 'POA',
    programas: ['Modernización administrativa'],
    porAnio: [4, 5, 4],
    cumplimiento: 1,
    plantillas: [
      ['Actualización del padrón de contribuyentes', 'Gestión interna', '%'],
      ['Implementación de expediente electrónico', 'Gestión interna', '%'],
      ['Plan de regularización de deudas', 'Gestión interna', 'beneficiarios'],
      ['Renovación de equipamiento informático', 'Adquisición', 'unidades'],
      ['Capacitación en compras y contrataciones', 'Servicio', 'horas'],
    ],
  },
  {
    nombre: 'Dirección de Deportes',
    prefijo: 'DEP',
    eje: 'POA',
    programas: ['Deporte comunitario', 'Espacios verdes'],
    porAnio: [5, 5, 4],
    cumplimiento: 0.997,
    plantillas: [
      ['Escuelas deportivas municipales', 'Programa social', 'beneficiarios'],
      ['Refacción de polideportivo', 'Obra', 'm²'],
      ['Playón deportivo barrial', 'Obra', 'm²'],
      ['Provisión de indumentaria deportiva', 'Adquisición', 'unidades'],
      ['Colonia de verano municipal', 'Servicio', 'beneficiarios'],
    ],
  },
  {
    nombre: 'Dirección de Juventud',
    prefijo: 'JUV',
    eje: 'POA',
    programas: ['Empleo joven', 'Inclusión social'],
    porAnio: [4, 4, 3],
    cumplimiento: 1,
    plantillas: [
      ['Casa de la juventud', 'Obra', 'm²'],
      ['Programa de becas municipales', 'Programa social', 'beneficiarios'],
      ['Talleres de participación juvenil', 'Servicio', 'beneficiarios'],
      ['Festival de bandas emergentes', 'Servicio', 'beneficiarios'],
    ],
  },
  {
    nombre: 'Dirección de Género y Diversidad',
    prefijo: 'GEN',
    eje: 'POA',
    programas: ['Inclusión social'],
    porAnio: [3, 4, 3],
    cumplimiento: 0.999,
    plantillas: [
      ['Dispositivo de acompañamiento a víctimas', 'Programa social', 'beneficiarios'],
      ['Capacitación en Ley Micaela', 'Servicio', 'horas'],
      ['Casa de protección integral', 'Obra', 'm²'],
      ['Red de promotoras territoriales', 'Programa social', 'beneficiarios'],
    ],
  },
  {
    nombre: 'Dirección de Modernización',
    prefijo: 'MOD',
    eje: 'POA',
    programas: ['Modernización administrativa'],
    porAnio: [4, 4, 4],
    cumplimiento: 1,
    plantillas: [
      ['Portal de trámites a distancia', 'Gestión interna', '%'],
      ['Tablero de indicadores de gestión', 'Gestión interna', '%'],
      ['Red de fibra óptica municipal', 'Obra', 'metros lineales'],
      ['Sistema de turnos digitales', 'Gestión interna', '%'],
    ],
  },
];

export const PROGRAMAS = [
  'Infraestructura urbana', 'Hábitat y vivienda', 'Inclusión social', 'Primera infancia',
  'Higiene urbana', 'Atención primaria de la salud', 'Salud comunitaria', 'Trayectorias educativas',
  'Cultura de cercanía', 'Empleo joven', 'Economía social', 'Espacios verdes',
  'Modernización administrativa', 'Cercanía y atención al vecino', 'Deporte comunitario',
  'Seguridad vial', 'Turismo local', 'Cooperación institucional',
];

// Mismos valores reales que `CATALOGOS_SEMILLA.ejes` (ver catalogos.js) — antes
// tenía ocho ejes genéricos inventados que no existen en ningún sheet. Los
// proyectos de `AREAS` de acá arriba usan todos 'POA'; el resto queda listado
// para que el catálogo de "base completa" no sea más pobre que el real.
export const EJES = ['POA', 'Puntual', 'Mesa Esperanza', 'Mesa EDLA', 'Mesa Favelita / El Libertador', 'Posicionamiento', 'Compromisos'];

export const TIPOS_PROYECTO = [
  ['Obra', true], ['Servicio', false], ['Programa social', false],
  ['Gestión interna', false], ['Adquisición', false], ['Convenio', false],
];

export const UNIDADES = ['m²', 'beneficiarios', 'cuadras', 'unidades', '%', 'metros lineales', 'horas', 'toneladas', 'viviendas'];

export const CATEGORIAS_TEMA = [
  'Operativo', 'Presupuestario', 'Administrativo / expediente', 'Recursos humanos',
  'Reclamo vecinal', 'Articulación entre áreas', 'Proveedores y contrataciones',
  'Técnico / proyecto', 'Normativo', 'Comunicación',
];

export const ITEMS_REQUERIMIENTO = [
  'Sonido', 'Escenario', 'Sillas', 'Vallado', 'Baños químicos', 'Seguridad', 'Limpieza',
  'Gacebos', 'Energía', 'Difusión', 'Traslados', 'Ambulancia', 'Catering', 'Fotografía',
];

export const TIPOS_EVENTO = [
  'Inauguración', 'Feria', 'Jornada', 'Operativo territorial', 'Actividad cultural',
  'Actividad deportiva', 'Acto institucional', 'Capacitación', 'Asamblea barrial',
];

export const PERIODICIDADES = ['semanal', 'quincenal', 'mensual', 'bimestral', 'trimestral'];

/**
 * Catálogos del posicionamiento y de la cartera estratégica.
 *
 * Los tipos coinciden con las claves de `PLANTILLAS_POSICIONAMIENTO` en
 * `sintetico.js`: es lo que hace que el generador pueda armar nombres de
 * proyecto coherentes con su tipo. Los organismos son reales porque son con
 * quienes un municipio se relaciona de verdad; los proyectos concretos, no.
 */
export const TIPOS_PROYECTO_POSICIONAMIENTO = [
  'Hermanamiento', 'Red de ciudades', 'Postulación a fondo', 'Premio o distinción',
  'Misión o visita', 'Convenio de cooperación', 'Evento internacional', 'Membresía en organismo',
];

export const ORGANISMOS = [
  'Mercociudades',
  'CGLU — Ciudades y Gobiernos Locales Unidos',
  'UCCI — Unión de Ciudades Capitales Iberoamericanas',
  'ONU-Hábitat',
  'PNUD',
  'BID',
  'CAF — Banco de Desarrollo de América Latina',
  'Unión Europea',
  'OEI — Organización de Estados Iberoamericanos',
  'AECID — Cooperación Española',
  'GIZ — Cooperación Alemana',
  'C40 Cities',
  'Embajada o consulado',
  'Universidad extranjera',
];

export const MOTIVOS_ESTRATEGICOS = [
  'Compromiso público de gestión',
  'Alto impacto vecinal',
  'Monto o escala excepcional',
  'Financiamiento externo comprometido',
  'Articulación con provincia o nación',
  'Innovación institucional',
  'Riesgo alto si se atrasa',
  'Posicionamiento internacional',
];

/** Ítems dados de baja: el sistema no borra, y hay que verlo también acá. */
export const BAJAS_CATALOGO = new Set(['Turismo local', 'Convenio', 'toneladas', 'Fotografía']);

export function armarCatalogos() {
  const item = (prefijo, nombre, extra = {}) => ({
    id: `${prefijo}_${nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 18)}`,
    nombre,
    activo: !BAJAS_CATALOGO.has(nombre),
    ...extra,
  });
  return {
    areas: AREAS.map((a) => item('ar', a.nombre, { prefijo: a.prefijo })),
    programas: PROGRAMAS.map((p) => item('pr', p)),
    ejes: EJES.map((e) => item('ej', e)),
    tipos: TIPOS_PROYECTO.map(([nombre, esObra]) => item('ti', nombre, { es_obra: esObra })),
    unidades: UNIDADES.map((u) => item('un', u)),
    categorias_tema: CATEGORIAS_TEMA.map((c) => item('ca', c)),
    items_requerimiento: ITEMS_REQUERIMIENTO.map((i) => item('rq', i)),
    tipos_evento: TIPOS_EVENTO.map((t) => item('te', t)),
    periodicidades: PERIODICIDADES.map((p) => item('pe', p)),
    tipos_proyecto_posicionamiento: TIPOS_PROYECTO_POSICIONAMIENTO.map((t) => item('ai', t)),
    organismos: ORGANISMOS.map((o) => item('or', o)),
    motivos_estrategicos: MOTIVOS_ESTRATEGICOS.map((m) => item('me', m)),
  };
}

/* ── Vocabulario de minutas ─────────────────────────────────────────── */

/**
 * Las frases están escritas para que el separador de minutas las reconozca:
 * los avances en pretérito («se ejecutó»), los problemas con marcador explícito
 * («falta», «está trabado») y los compromisos en perífrasis de futuro («va a
 * enviar»). Así el texto crudo de cada seguimiento se puede volver a procesar
 * desde la interfaz y el resultado coincide con lo que quedó guardado.
 */
export const FRASES_AVANCE = [
  'Se ejecutaron los trabajos previstos para el período.',
  'Se completó la etapa de relevamiento en el sector asignado.',
  'Se entregó la documentación técnica al área correspondiente.',
  'Se inició la contratación del servicio con el proveedor adjudicado.',
  'Se realizó la recorrida conjunta con el equipo técnico.',
  'Se terminó la instalación prevista para esta etapa.',
  'Se finalizó la carga de datos del período anterior.',
  'Se ejecutó el operativo territorial programado para el mes.',
  'Se completó la capacitación del personal asignado al programa.',
  'Se entregó el equipamiento a las unidades operativas.',
  'Se realizó la apertura de sobres de la licitación.',
  'Se inició la obra en el frente previsto para el trimestre.',
];

export const FRASES_PROBLEMA = [
  'Falta la conformidad del área técnica para avanzar con la etapa siguiente.',
  'El expediente está trabado en Legales desde hace tres semanas.',
  'No se pudo iniciar el frente de obra por la falta de materiales.',
  'Hay demoras en la entrega del proveedor adjudicado.',
  'No hay personal suficiente para cubrir el turno tarde.',
  'Se registraron reclamos vecinales por el estado de la calzada.',
  'Sin respuesta del área provincial al pedido de refuerzo presupuestario.',
  'El certificado de obra presenta diferencias con lo ejecutado en el frente.',
  'Falta definir la partida presupuestaria para la etapa siguiente.',
  'Se atrasó el cronograma por las lluvias de las últimas semanas.',
  'No se puede avanzar sin el corte de calle que depende de otra área.',
  'Hay faltantes en el listado de beneficiarios que informó el área.',
];

export const FRASES_COMPROMISO = [
  'El área va a enviar el informe de avance actualizado antes de fin de mes.',
  'Quedaron en presentar el pliego técnico en la próxima reunión.',
  'El responsable tiene que remitir el detalle de gastos ejecutados.',
  'Se comprometieron a coordinar la recorrida con el equipo de Legales.',
  'Hay que convocar a los referentes barriales para la etapa siguiente.',
  'El área deberá elevar el expediente para su aprobación.',
  'Van a definir el cronograma de la etapa siguiente esta semana.',
  'Queda pendiente relevar el estado de los frentistas del sector.',
  'Se comprometen a informar el listado actualizado de beneficiarios.',
  'El área va a gestionar la ampliación de la partida presupuestaria.',
];

export const DESCRIPCIONES_COMPROMISO = [
  'Enviar el informe de avance actualizado',
  'Presentar el pliego técnico para licitación',
  'Coordinar la reunión con el área de Legales',
  'Relevar el estado de los frentistas del sector',
  'Definir el cronograma de la etapa siguiente',
  'Remitir el detalle de gastos ejecutados',
  'Convocar a los referentes barriales',
  'Elevar el expediente para su aprobación',
  'Contratar el servicio de mantenimiento',
  'Entregar el listado de beneficiarios actualizado',
  'Gestionar la ampliación de la partida presupuestaria',
  'Confirmar la fecha de inicio del frente de obra',
  'Notificar a los vecinos del corte programado',
  'Cotizar el equipamiento faltante',
  'Actualizar la carga de avance en el sistema',
  'Verificar el certificado presentado por el proveedor',
  'Articular con Servicios Públicos el operativo de limpieza',
  'Designar al responsable técnico del expediente',
  'Programar la próxima recorrida conjunta',
  'Resolver la observación de la auditoría interna',
];

export const TEMAS_MONITOREO = [
  'Demora en la entrega de materiales por parte del proveedor',
  'Reclamos vecinales por el estado de la calzada',
  'Falta de personal para cubrir el turno tarde',
  'Expediente detenido en el área de Legales',
  'Necesidad de coordinar con Servicios Públicos el corte de calle',
  'Diferencia entre el certificado presentado y lo ejecutado en obra',
  'Pedido de ampliación del cupo del programa',
  'Equipamiento fuera de servicio en el centro de atención',
  'Requerimiento de refuerzo presupuestario para la etapa siguiente',
  'Superposición de cronogramas con otra área',
  'Falta de respuesta del organismo provincial al convenio enviado',
  'Rotación de personal en el equipo territorial',
  'Observaciones de la auditoría sobre la rendición del período',
  'Retraso en la publicación del llamado a licitación',
  'Dificultad para acceder al predio por cuestiones dominiales',
  'Necesidad de actualizar el pliego por variación de precios',
  'Pedido de los vecinos de ampliar el horario de atención',
  'Falta de definición sobre el destino final de los residuos del obrador',
  'Duplicación de beneficiarios entre dos programas del área',
  'Reclamo por la señalización provisoria del desvío',
];

export const TEMAS_SEGUIMIENTO = [
  'Avance de obra y requerimientos pendientes',
  'Ejecución presupuestaria del trimestre',
  'Cronograma de la etapa siguiente',
  'Estado de los expedientes en trámite',
  'Coordinación con otras áreas',
  'Revisión de compromisos del período anterior',
  'Planificación del operativo territorial',
  'Situación del personal y equipamiento',
];
