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
 */
export const PROYECTOS_EJES_ESTRATEGICOS_REAL = [
  {
    nombre: 'Recuperación de la Estación de Lourdes',
    prioridad: 'media',
    contexto: 'Sin registro de detalle disponible aún; pendiente de definición de estado y próximos pasos.',
  },
  {
    nombre: 'Plan 1000 días',
    prioridad: 'media',
    contexto:
      'Posible articulación con el programa de salud materna y primera infancia; requiere confirmar alcance específico.',
  },
  {
    nombre: 'Operativos y protocolos conjuntos en barrios populares',
    prioridad: 'alta',
    contexto:
      'Se articula desde la Mesa de Barrios Populares (Esperanza, Favelita/El Libertador, Ejército de los Andes) ' +
      'y el protocolo de recuperación de espacios.',
  },
  {
    nombre: 'Parque Logístico',
    prioridad: 'media',
    contexto: 'Iniciativa vinculada al desarrollo productivo del distrito; pendiente de precisar estado actual del expediente.',
  },
  {
    nombre: 'Estación de Bosch',
    prioridad: 'alta',
    contexto:
      'Gestión con ADIF S.A. por el permiso de uso y la restauración de la Casona Villa Bosch; pliego técnico ya ' +
      'aprobado y carácter urgente declarado por el Municipio.',
  },
  {
    nombre: 'JJ Urquiza',
    prioridad: 'media',
    contexto: 'Sin registro de detalle disponible aún; pendiente de definición de estado y próximos pasos.',
  },
  {
    nombre: 'Venta de Tierras',
    prioridad: 'alta',
    contexto:
      'Se trabaja en el marco de la Comisión de Tierras intersecretarial (Finanzas, Ambiente, Obras Públicas, ' +
      'Coordinación, Capital Humano y Secretaría General).',
  },
  {
    nombre: 'Bajadas Territoriales',
    prioridad: 'media',
    contexto: 'Plan de recorridas y atención territorial en barrios; pendiente de actualizar estado de implementación.',
  },
  {
    nombre: 'CAF',
    prioridad: 'alta',
    contexto:
      'Cooperación técnica en curso, con convenio, plan de trabajo y solicitud de desembolsos en elaboración; ' +
      'sujeta a reglas estrictas de procurement (mínimo tres cotizaciones y no objeción de CAF).',
  },
  {
    nombre: 'Regularización Dominial',
    prioridad: 'alta',
    contexto: 'Herramienta central del eje de hábitat e integración socio-urbana; vinculada a RENABAP y a la Comisión de Tierras.',
  },
  {
    nombre: 'RENABAP (Barrio Maldonado y Puerta 8/Once de Septiembre)',
    prioridad: 'alta',
    contexto: 'Gestión activa con SISU/FISU para retomar obras frenadas; RDT pendientes y notas cruzadas sin resolver.',
  },
  {
    nombre: 'Restitución Linares 5248',
    prioridad: 'media',
    contexto: 'Sin registro de detalle disponible aún; pendiente de definición de estado y próximos pasos.',
  },
  {
    nombre: 'Mejora de score IGEC (UBA)',
    prioridad: 'alta',
    contexto: 'Los indicadores del índice tienen ponderación despareja; conviene priorizar las variables con mayor valor relativo por indicador.',
  },
  {
    nombre: 'Eventos RA',
    prioridad: 'baja',
    contexto: 'Pendiente de precisar a qué agenda institucional corresponde este eje.',
  },
  {
    nombre: 'World Bank GovTech Bootcamp',
    prioridad: 'media',
    contexto:
      'Vinculado al trabajo previo en gobierno digital e inteligencia artificial (foro CONECTA IA con CAF y CIIAR); ' +
      'pendiente de precisar alcance.',
  },
  {
    nombre: 'BID Gobernarte',
    prioridad: 'media',
    contexto: 'Concurso de innovación en gestión pública del BID; sin postulación formalizada por el momento.',
  },
  {
    nombre: 'Convocatoria interna (DDJJ, Monotasa, mi3F, RIGI/Mercado Libre, separación de residuos)',
    prioridad: 'media',
    contexto: 'Paquete de iniciativas internas de cumplimiento, modernización y adhesión a programas nacionales/provinciales.',
  },
  {
    nombre: 'Reforma de licencias de conducir / REPRE',
    prioridad: 'media',
    contexto:
      'Tema con relato político sensible: conviene distinguir el elogio a la desregulación nacional de la crítica ' +
      'puntual a la implementación provincial.',
  },
  {
    nombre: 'Pilotos de vehículos abandonados',
    prioridad: 'baja',
    contexto: 'Sin registro de detalle disponible aún; pendiente de definición de estado y próximos pasos.',
  },
  {
    nombre: 'Congreso de Salud / Congreso de Educación',
    prioridad: 'media',
    contexto: 'Sin registro de detalle disponible aún; pendiente de definición de estado y próximos pasos.',
  },
  {
    nombre: 'Barrios Populares',
    prioridad: 'alta',
    contexto: 'Eje transversal permanente, con mesa mensual, tres zonas activas y seguimiento de la Dirección de Control de Gestión.',
  },
];
