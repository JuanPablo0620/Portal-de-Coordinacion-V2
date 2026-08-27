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

/**
 * Coordenadas de los barrios ficticios, para que el mapa de obras tenga qué
 * dibujar en los dos sets.
 *
 * Caen dentro del rectángulo que ocupa el partido —así la escala del plano y
 * las distancias entre obras son plausibles— pero los barrios son inventados y
 * sus posiciones también: NO son la ubicación real de ningún barrio ni de
 * ninguna obra. El día que entren datos reales, entran por el campo `latitud` /
 * `longitud` de cada proyecto, que es lo que el mapa lee; esta tabla sólo
 * alimenta los sets de prueba.
 */
export const COORDENADAS_BARRIO = {
  'Los Álamos': [-34.578, -58.612],
  'Villa Esperanza': [-34.592, -58.598],
  'San Ignacio': [-34.605, -58.586],
  'El Progreso': [-34.584, -58.574],
  'Las Acacias': [-34.616, -58.601],
  'Barrio Norte': [-34.571, -58.594],
  'Santa Rita': [-34.598, -58.563],
  'Los Tilos': [-34.624, -58.578],
  'La Estación': [-34.589, -58.545],
  'Nueva Unión': [-34.612, -58.552],
  'El Mirador': [-34.575, -58.556],
  'Los Ceibos': [-34.602, -58.617],
  'Villa Alegre': [-34.629, -58.593],
  'San Cayetano': [-34.581, -58.531],
  'Los Robles': [-34.607, -58.538],
  'Barrio Sur': [-34.631, -58.566],
  'La Cañada': [-34.568, -58.577],
  'El Molino': [-34.595, -58.628],
  'Los Sauces': [-34.619, -58.545],
  'Villa Palmira': [-34.586, -58.560],
  'Las Lomas': [-34.573, -58.539],
  'El Zanjón': [-34.610, -58.624],
  'Los Naranjos': [-34.626, -58.610],
  'La Loma Verde': [-34.600, -58.605],
};

/**
 * Punto dentro del barrio, no el barrio entero: sin dispersión, las cuarenta
 * obras de un barrio se dibujan una encima de otra y el mapa muestra un punto
 * donde hay cuarenta. El desplazamiento es de unos pocos centenares de metros.
 */
export function puntoEnBarrio(barrio, azar) {
  const centro = COORDENADAS_BARRIO[barrio];
  if (!centro) return null;
  const desvio = () => (azar() - 0.5) * 0.008;
  return {
    latitud: Number((centro[0] + desvio()).toFixed(5)),
    longitud: Number((centro[1] + desvio()).toFixed(5)),
  };
}

/* ── Posicionamiento ───────────────────────────────────────────────── */

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
 * Plantillas de proyecto de posicionamiento, agrupadas por tipo.
 *
 * Las claves son nombres del catálogo `tipos_proyecto_posicionamiento` y tienen
 * que seguir existiendo ahí: es la única cuerda que ata este vocabulario a los
 * catálogos, y hay un test que la vigila en los dos sets. Los organismos, en
 * cambio, los elige cada generador de SU propio catálogo, así que renombrarlos
 * no rompe nada.
 *
 * `{ciudad}` se reemplaza por una de `CIUDADES_EXTRANJERAS`.
 */
export const PLANTILLAS_POSICIONAMIENTO = {
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
