/**
 * Proyectos reales del eje "Ejes de Gestión 2026", relevados el 08/09/2026
 * por Valentín Olavarría (coordinador de gestión, Secretaría de Coordinación)
 * en `Ejes_de_Gestion_2026.pdf`.
 *
 * Es DATO REAL institucional, no sintético — a diferencia de `demo.js` y
 * `base-completa.js`. Sigue el mismo patrón que `posicionamiento-real.js`:
 * este archivo guarda sólo lo relevado (nombre, contexto y prioridad tal
 * como los dio Valentín), y el mapeo a los campos del catálogo real
 * (área/programa/eje/tipo) vive en el loader.
 *
 * Ninguno de estos 21 ejes tiene todavía un estado de avance cargado por su
 * secretaría de origen — el PDF da contexto y prioridad, no un `%` ni un
 * estado. Por eso todos entran como `planificado`: es el default del
 * catálogo para lo que no tiene evidencia de ejecución en curso, no una
 * afirmación de que recién arrancan.
 *
 * `area` marca de qué secretaría es el proyecto (mismo nombre de catálogo
 * que usa `proyectos-reales-secretarias.js`, para que el proyecto aparezca
 * bajo la misma área que el resto de esa secretaría, no una duplicada).
 * `area: null` quiere decir que es una iniciativa propia de Valentín, sin
 * secretaría de origen — confirmado por JP el 15/09/2026: no adivinar
 * secretaría para lo que no se confirmó.
 */
export const PROYECTOS_EJES_ESTRATEGICOS_REAL = [
  {
    nombre: 'Recuperación de la Estación de Lourdes',
    area: 'Secretaría de Obras',
    prioridad: 'media',
    contexto: 'Sin registro de detalle disponible aún; pendiente de definición de estado y próximos pasos.',
  },
  {
    nombre: 'Plan 1000 días',
    area: 'Secretaría de Salud',
    prioridad: 'media',
    contexto:
      'Posible articulación con el programa de salud materna y primera infancia; requiere confirmar alcance específico.',
  },
  {
    nombre: 'Operativos y protocolos conjuntos en barrios populares',
    area: null,
    prioridad: 'alta',
    contexto:
      'Se articula desde la Mesa de Barrios Populares (Esperanza, Favelita/El Libertador, Ejército de los Andes) ' +
      'y el protocolo de recuperación de espacios.',
  },
  {
    nombre: 'Parque Logístico',
    area: null,
    prioridad: 'media',
    contexto: 'Iniciativa vinculada al desarrollo productivo del distrito; pendiente de precisar estado actual del expediente.',
  },
  {
    nombre: 'Estación de Bosch',
    area: 'Secretaría de Obras',
    prioridad: 'alta',
    contexto:
      'Gestión con ADIF S.A. por el permiso de uso y la restauración de la Casona Villa Bosch; pliego técnico ya ' +
      'aprobado y carácter urgente declarado por el Municipio.',
  },
  {
    nombre: 'JJ Urquiza',
    area: null,
    prioridad: 'media',
    contexto: 'Sin registro de detalle disponible aún; pendiente de definición de estado y próximos pasos.',
  },
  {
    nombre: 'Venta de Tierras',
    area: null,
    prioridad: 'alta',
    contexto:
      'Se trabaja en el marco de la Comisión de Tierras intersecretarial (Finanzas, Ambiente, Obras Públicas, ' +
      'Coordinación, Capital Humano y Secretaría General).',
  },
  {
    nombre: 'Bajadas Territoriales',
    area: null,
    prioridad: 'media',
    contexto: 'Plan de recorridas y atención territorial en barrios; pendiente de actualizar estado de implementación.',
  },
  {
    nombre: 'CAF',
    area: null,
    prioridad: 'alta',
    contexto:
      'Cooperación técnica en curso, con convenio, plan de trabajo y solicitud de desembolsos en elaboración; ' +
      'sujeta a reglas estrictas de procurement (mínimo tres cotizaciones y no objeción de CAF). ' +
      'También cargada en Posicionamiento (programa de relaciones con organismos externos) por pedido de JP.',
  },
  {
    nombre: 'Regularización Dominial',
    area: 'Secretaría de Capital Humano',
    prioridad: 'alta',
    contexto: 'Herramienta central del eje de hábitat e integración socio-urbana; vinculada a RENABAP y a la Comisión de Tierras.',
  },
  {
    nombre: 'RENABAP (Barrio Maldonado y Puerta 8/Once de Septiembre)',
    area: null,
    prioridad: 'alta',
    contexto: 'Gestión activa con SISU/FISU para retomar obras frenadas; RDT pendientes y notas cruzadas sin resolver.',
  },
  {
    nombre: 'Restitución Linares 5248',
    area: null,
    prioridad: 'media',
    contexto: 'Sin registro de detalle disponible aún; pendiente de definición de estado y próximos pasos.',
  },
  {
    nombre: 'Mejora de score IGEC (UBA)',
    area: null,
    prioridad: 'alta',
    contexto: 'Los indicadores del índice tienen ponderación despareja; conviene priorizar las variables con mayor valor relativo por indicador.',
  },
  {
    nombre: 'Eventos RA',
    area: null,
    prioridad: 'baja',
    contexto: 'Pendiente de precisar a qué agenda institucional corresponde este eje.',
  },
  {
    nombre: 'World Bank GovTech Bootcamp',
    area: null,
    prioridad: 'media',
    contexto:
      'Vinculado al trabajo previo en gobierno digital e inteligencia artificial (foro CONECTA IA con CAF y CIIAR); ' +
      'pendiente de precisar alcance.',
  },
  {
    nombre: 'BID Gobernarte',
    area: null,
    prioridad: 'media',
    contexto: 'Concurso de innovación en gestión pública del BID; sin postulación formalizada por el momento.',
  },
  {
    nombre: 'Convocatoria interna (DDJJ, Monotasa, mi3F, RIGI/Mercado Libre, separación de residuos)',
    area: null,
    prioridad: 'media',
    contexto: 'Paquete de iniciativas internas de cumplimiento, modernización y adhesión a programas nacionales/provinciales.',
  },
  {
    nombre: 'Reforma de licencias de conducir / REPRE',
    area: null,
    prioridad: 'media',
    contexto:
      'Tema con relato político sensible: conviene distinguir el elogio a la desregulación nacional de la crítica ' +
      'puntual a la implementación provincial.',
  },
  {
    nombre: 'Pilotos de vehículos abandonados',
    area: null,
    prioridad: 'baja',
    contexto: 'Sin registro de detalle disponible aún; pendiente de definición de estado y próximos pasos.',
  },
  {
    nombre: 'Congreso de Salud / Congreso de Educación',
    area: null,
    prioridad: 'media',
    contexto: 'Sin registro de detalle disponible aún; pendiente de definición de estado y próximos pasos.',
  },
  {
    nombre: 'Barrios Populares',
    area: null,
    prioridad: 'alta',
    contexto: 'Eje transversal permanente, con mesa mensual, tres zonas activas y seguimiento de la Dirección de Control de Gestión.',
  },
];
