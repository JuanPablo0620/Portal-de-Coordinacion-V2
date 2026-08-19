/**
 * Proyectos reales del eje Posicionamiento, relevados el 19/08/2026 desde
 * `Coordinacion_db` (pestaña "Estado de proyectos", Programa = Posicionamiento).
 *
 * Es DATO REAL institucional, no sintético — a diferencia de `demo.js` y
 * `base-completa.js`, que generan hermanamientos y postulaciones ficticias
 * con ciudades inventadas. No usar `crearAzar` ni fechas relativas a `hoy`
 * acá: esto refleja lo que Coordinación efectivamente tiene cargado hoy.
 *
 * Comentarios y fechas copiados tal como están en el sheet (con limpieza
 * ortográfica menor), no reformulados. `RIL` no tiene fila en "Estado de
 * proyectos" — solo aparece en el registro semanal de "1. Cualitativo",
 * última carga real el 27/04/26 — así que su estado puede estar
 * desactualizado; queda marcado.
 *
 * No se encontró ningún proyecto llamado "UBA - ciudades inteligentes" en
 * el sheet: los comentarios de UBA mencionan una secuencia de evaluación
 * (Institucional y Desarrollo Económico → Sociedad → Ambiente), pero no como
 * proyecto propio. No se inventa acá — si existe, hay que cargarlo.
 */
export const PROYECTOS_POSICIONAMIENTO_REAL = [
  {
    nombre: 'CIPPEC',
    estado: 'en ejecución',
    fecha_actualizacion: '2026-08-10',
    interes_roco: true,
    comentario:
      'Curso de 50 horas: comenzó el 3/8 con 30 participantes. Ya se coordinó con Juventud. ' +
      'Propuesta de desaceleración en evaluación.',
  },
  {
    nombre: 'UBA',
    estado: 'finalizado',
    fecha_actualizacion: '2026-08-10',
    interes_roco: true,
    comentario: 'A la espera del puntaje final.',
  },
  {
    nombre: 'Bloomberg City Lab',
    estado: 'finalizado',
    fecha_actualizacion: '2026-06-15',
    interes_roco: true,
    comentario: 'Se armó la nota y fue enviada a Roco.',
  },
  {
    nombre: 'CIIAR',
    estado: 'en ejecución',
    fecha_actualizacion: '2026-08-10',
    interes_roco: true,
    comentario:
      'Se anotaron 83 startups. Tres de Febrero eligió Vortigon, Let’s Make It y Neural. ' +
      'En agosto, reunión con intendentes para definir las empresas ganadoras. Autodiagnóstico de RIL IA.',
  },
  {
    nombre: 'RECIA',
    estado: 'finalizado',
    fecha_actualizacion: '2026-06-15',
    interes_roco: true,
    comentario: 'Publicación de comunicación lista.',
  },
  {
    nombre: 'UBER',
    estado: 'pendiente',
    fecha_actualizacion: '2026-08-10',
    interes_roco: true,
    comentario: 'Contactar con UBER.',
  },
  {
    nombre: 'Bloomberg WWC',
    estado: 'en ejecución',
    fecha_actualizacion: '2026-08-10',
    interes_roco: true,
    comentario:
      'En diciembre se puede presentar la nueva certificación. Se está recopilando documentación. ' +
      'A fin de junio hay que volver a comunicarse con Bloomberg para indicaciones de cómo avanzar.',
  },
  {
    nombre: 'RIL',
    estado: 'pendiente',
    fecha_actualizacion: '2026-04-27',
    interes_roco: true,
    sin_maestro: true, // no está en "Estado de proyectos": dato posiblemente desactualizado
    comentario:
      'Firma de convenio por $40M con RIL: $20M Programa 30C, $10M Programa Ciudades Digitales, ' +
      '$10M Programa Ciudades Desarrollo Económico.',
  },
];
