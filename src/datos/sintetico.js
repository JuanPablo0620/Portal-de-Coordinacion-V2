/**
 * ─────────────────────────────────────────────────────────────────────
 * PIEZAS COMUNES DE LOS SETS SINTÉTICOS.
 *
 * Las comparten `demo.js` —el set chico, para mostrar el sistema— y
 * `base-completa.js` —el set a escala real, para probarlo con carga—. Estaban
 * duplicadas en los dos archivos, que es la forma más fácil de que se
 * desincronicen: si mañana se corrige cómo se arma una marca de tiempo, hay que
 * acordarse de corregirlo dos veces, y el día que no pase, los dos sets van a
 * estar generando fechas distintas sin que nada falle.
 *
 * Nada de acá toca el reloj ni el almacenamiento: son funciones puras y listas
 * de palabras inventadas.
 * ─────────────────────────────────────────────────────────────────────
 */

export const MS_DIA = 86_400_000;

/** Desplaza una fecha ISO en días, comparando a medianoche UTC. */
export function desplazar(iso, dias) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + dias * MS_DIA).toISOString().slice(0, 10);
}

/**
 * Marca de tiempo local, con el mismo formato que produce `ahoraISO()`: sin
 * sufijo `Z`, porque la cadena representa hora local. Ver `tiempo.js`.
 */
export function marcaTiempo(iso, hora = 10, minuto) {
  const m = minuto ?? (hora * 7) % 60;
  return `${iso}T${String(hora).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00.000`;
}

/**
 * Generador pseudoaleatorio con semilla.
 *
 * Es lo que hace que dos cargas del mismo set produzcan exactamente la misma
 * base: un problema que aparece se puede volver a mirar, y los tests pueden
 * afirmar cantidades. `Math.random()` haría de cada carga un set distinto.
 */
export function crearAzar(semilla) {
  let estado = semilla;
  return function azar() {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}

/* ── Vocabulario ficticio ───────────────────────────────────────────── */

/**
 * Personas y barrios inventados. El set chico usa los primeros; el completo,
 * la lista entera. Nunca nombres ni barrios reales del municipio: los dos sets
 * tienen que ser evidentemente ficticios a simple vista.
 */
export const PERSONAS = [
  'M. Álvarez', 'J. Benítez', 'L. Cardozo', 'R. Domínguez', 'S. Escobar',
  'P. Ferreyra', 'N. Godoy', 'C. Herrera', 'D. Ibarra', 'V. Juárez',
  'A. Ledesma', 'F. Maldonado', 'G. Navarro', 'T. Ojeda', 'B. Paredes',
  'E. Quiroga', 'H. Ramírez', 'I. Sánchez', 'K. Torres', 'O. Ustárez',
  'W. Villalba', 'Y. Zárate', 'C. Acosta', 'M. Barrios', 'L. Cabrera',
  'N. Delgado', 'P. Espínola', 'R. Figueroa', 'S. Gómez', 'T. Insaurralde',
  'A. Lezcano', 'B. Molina', 'D. Núñez', 'F. Olmedo', 'G. Peralta',
  'J. Rolón', 'K. Silva', 'L. Toledo', 'M. Vallejos', 'V. Zalazar',
];

export const BARRIOS = [
  'Los Álamos', 'Villa Esperanza', 'San Ignacio', 'El Progreso', 'Las Acacias',
  'Barrio Norte', 'Santa Rita', 'Los Tilos', 'La Estación', 'Nueva Unión',
  'El Mirador', 'Los Ceibos', 'Villa Alegre', 'San Cayetano', 'Los Robles',
  'Barrio Sur', 'La Cañada', 'El Molino', 'Los Sauces', 'Villa Palmira',
  'Las Lomas', 'El Zanjón', 'Los Naranjos', 'La Loma Verde',
];

/* ── Posicionamiento internacional ──────────────────────────────────── */

/**
 * Ciudades contraparte inventadas.
 *
 * Los ORGANISMOS de los catálogos sí son reales —Mercociudades, CGLU, el BID
 * son con quienes un municipio se relaciona de verdad, y un catálogo con
 * organismos inventados no serviría para nada—, pero las ciudades hermanas y
 * los convenios concretos son ficticios, como todo el resto de los dos sets.
 */
export const CIUDADES_EXTRANJERAS = [
  'Vila Serrana', 'Porto Alegrete', 'Santa Lucía del Norte', 'Villa Marítima',
  'Nuova Terra', 'Alt Bergen', 'Saint-Clair', 'Nova Aurora', 'Puerto Esperanza',
  'San Cristóbal del Valle', 'Monteverde', 'Lago Azul', 'Ciudad Ribera', 'Bela Vista',
];

/**
 * Plantillas de acción internacional, agrupadas por tipo.
 *
 * Las claves son nombres del catálogo `tipos_accion_internacional` y tienen que
 * seguir existiendo ahí: es la única cuerda que ata este vocabulario a los
 * catálogos, y hay un test que la vigila en los dos sets. Los organismos y los
 * países, en cambio, los elige cada generador de SU propio catálogo, así que
 * renombrarlos no rompe nada.
 *
 * `{ciudad}` se reemplaza por una de `CIUDADES_EXTRANJERAS`.
 */
export const ACCIONES_INTERNACIONALES = {
  Hermanamiento: [
    'Hermanamiento con {ciudad}',
    'Acta de hermanamiento con {ciudad}',
    'Renovación del hermanamiento con {ciudad}',
    'Protocolo de ciudades hermanas con {ciudad}',
  ],
  'Red de ciudades': [
    'Incorporación a la red de ciudades por el clima',
    'Participación en la red de ciudades educadoras',
    'Mesa de intercambio de la red de gobiernos locales',
    'Grupo de trabajo de movilidad de la red regional',
  ],
  'Postulación a fondo': [
    'Postulación al fondo de resiliencia urbana',
    'Postulación al programa de movilidad sostenible',
    'Postulación al fondo de primera infancia',
    'Postulación al programa de economía circular',
    'Postulación al fondo de digitalización de trámites',
    'Postulación al programa de espacios públicos inclusivos',
  ],
  'Premio o distinción': [
    'Premio internacional de innovación pública',
    'Distinción a la gestión ambiental local',
    'Concurso de buenas prácticas municipales',
    'Reconocimiento a políticas de primera infancia',
  ],
  'Misión o visita': [
    'Misión técnica de gestión de residuos',
    'Visita protocolar de la delegación de {ciudad}',
    'Misión comercial de productores locales',
    'Pasantía técnica en gestión de datos urbanos',
  ],
  'Convenio de cooperación': [
    'Convenio de cooperación técnica con {ciudad}',
    'Convenio de intercambio académico',
    'Acuerdo de asistencia técnica en datos abiertos',
    'Convenio de formación en gestión pública local',
  ],
  'Evento internacional': [
    'Cumbre regional de gobiernos locales',
    'Foro internacional de ciudades sostenibles',
    'Encuentro iberoamericano de innovación pública',
    'Seminario regional de hábitat y vivienda',
  ],
  'Membresía en organismo': [
    'Membresía plena en el organismo regional',
    'Adhesión al pacto global de intendencias',
    'Incorporación como miembro observador',
  ],
};

/* ── Proyectos estratégicos ─────────────────────────────────────────── */

/** Dónde se comprometió públicamente un proyecto estratégico. */
export const COMPROMISOS_PUBLICOS = [
  'Anunciado en la apertura de sesiones del Concejo Deliberante.',
  'Comprometido en la reunión de gabinete de inicio de gestión.',
  'Incluido en el plan de gobierno presentado a la ciudadanía.',
  'Acordado en la mesa de trabajo con las entidades del distrito.',
  'Comprometido ante el organismo que aporta el financiamiento.',
  'Presentado públicamente en la audiencia vecinal del sector.',
];
