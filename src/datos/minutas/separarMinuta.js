// ─────────────────────────────────────────────────────────────────────
// SEPARACIÓN DE MINUTAS — implementación simulada por reglas locales.
//
// En el prototipo no hay backend donde alojar una clave de API, así que la
// separación se aproxima con heurísticas: verbos de acción, nombres propios,
// fechas y conectores.
//
// Al conectar un modelo de lenguaje se reemplaza ÚNICAMENTE el cuerpo de
// `separarMinuta()`. La firma y la forma del valor devuelto no cambian, y la
// interfaz de carga ya está construida como funcionaría con procesamiento
// real: propone, el usuario corrige, y recién ahí se persiste.
//
// Este archivo no importa nada del resto del sistema, a propósito: es
// reemplazable de una sola pieza.
// ─────────────────────────────────────────────────────────────────────

/* ── Vocabulario de detección ───────────────────────────────────────── */

/** Verbos que denotan una acción comprometida. */
const VERBOS_ACCION =
  'enviar|presentar|coordinar|definir|relevar|contratar|entregar|convocar|elevar|remitir|firmar|licitar|' +
  'gestionar|articular|confirmar|informar|revisar|preparar|cotizar|notificar|programar|verificar|' +
  'mandar|pedir|solicitar|resolver|cerrar|avanzar|actualizar|completar|asignar|designar';

/**
 * Perífrasis de futuro. El compromiso se detecta por la construcción, no por el
 * verbo solo: «se envió» es un avance, «va a enviar» es un compromiso.
 */
const PERIFRASIS = [
  /\b(va|van|voy|vamos)\s+a\s+(\w+)/i,
  /\bqued(?:a|amos|aron|ó)\s+en\s+(\w+)/i,
  /\bse\s+comprometi(?:ó|eron)\s+a\s+(\w+)/i,
  /\bse\s+compromete\s+a\s+(\w+)/i,
  /\b(deberá|deberán|debe|deben)\s+(\w+)/i,
  /\b(tiene|tienen)\s+que\s+(\w+)/i,
  /\b(hay)\s+que\s+(\w+)/i,
  /\bse\s+(?:compromete|comprometen)\b/i,
];

/** Futuro simple: «enviará», «presentarán». (Mismo cuidado con `\b` y el acento.) */
const FUTURO_SIMPLE = new RegExp(`\\b(?:${VERBOS_ACCION})á(?:n\\b|(?![a-záéíóúñü]))`, 'i');

/** Imperativo/pendiente explícito: «queda pendiente enviar…». */
const PENDIENTE_ACCION = new RegExp(`\\bqueda\\s+pendiente\\s+(?:de\\s+)?(?:${VERBOS_ACCION})\\b`, 'i');

/**
 * `\b` en JavaScript es ASCII: entre «ó» y un espacio NO hay frontera de
 * palabra, así que `atrasó\b` nunca matchearía. Donde el patrón termina en
 * vocal acentuada se usa este lookahead en lugar de `\b`.
 */
const FIN = '(?![a-záéíóúñü])';

const MARCADORES_PROBLEMA = [
  /\bfalta[n]?\b/i,
  /\bno\s+se\s+pudo\b/i,
  /\bno\s+hay\b/i,
  /\bno\s+se\s+puede\b/i,
  new RegExp(`\\bestá\\s+trabad[oa]\\b`, 'i'),
  /\btrabad[oa]\b/i,
  /\bdemora[s]?\b/i,
  new RegExp(`\\bse\\s+atras(?:ó${FIN}|aron\\b)`, 'i'),
  /\batras(?:o|ado)\b/i,
  /\bpendiente\s+de\b/i,
  /\bsin\s+respuesta\b/i,
  new RegExp(`\\bno\\s+se\\s+recibió${FIN}`, 'i'),
  /\bproblema[s]?\b/i,
  /\bdificultad(?:es)?\b/i,
  /\bfrenad[oa]\b/i,
  /\breclamo[s]?\b/i,
  /\bfaltante[s]?\b/i,
  /**
   * Discrepancias.
   *
   * Se agregaron después de pasar el separador por un corpus de doscientas
   * veintiséis minutas: la única familia de trabas que se le escapaba entera
   * era ésta —«el certificado presenta diferencias con lo ejecutado en el
   * frente»—, que no tiene ningún marcador de los de arriba y terminaba
   * clasificada como avance. Es, además, de las trabas más comunes en el
   * seguimiento de obra, así que perderla no era un detalle.
   *
   * Van sin la palabra «observaciones», que es ambigua: «se aprobó sin
   * observaciones» es un avance, y el separador prefiere no clasificar antes
   * que clasificar mal.
   */
  /\bdiferencias?\b/i,
  /\bdiscrepancias?\b/i,
  /\binconsistencias?\b/i,
  /\bno\s+coinciden?\b/i,
  new RegExp(`\\brechaz(?:ó${FIN}|aron\\b|ad[oa]\\b)`, 'i'),
];

const MARCADORES_AVANCE = [
  new RegExp(`\\bse\\s+termin(?:ó${FIN}|aron\\b)`, 'i'),
  new RegExp(`\\bse\\s+ejecut(?:ó${FIN}|aron\\b)`, 'i'),
  new RegExp(`\\bse\\s+complet(?:ó${FIN}|aron\\b)`, 'i'),
  new RegExp(`\\bse\\s+entreg(?:ó${FIN}|aron\\b)`, 'i'),
  new RegExp(`\\bse\\s+realiz(?:ó${FIN}|aron\\b)`, 'i'),
  new RegExp(`\\bse\\s+finaliz(?:ó${FIN}|aron\\b)`, 'i'),
  new RegExp(`\\bse\\s+inici(?:ó${FIN}|aron\\b)`, 'i'),
  new RegExp(`\\bya\\s+está${FIN}`, 'i'),
  /\bavanzamos\b/i,
  new RegExp(`\\bqued(?:ó${FIN}|aron\\b)\\s+(?:list|termin|hech)`, 'i'),
  new RegExp(`\\bse\\s+avanzó${FIN}`, 'i'),
  new RegExp(`\\bse\\s+aprobó${FIN}`, 'i'),
  new RegExp(`\\bse\\s+colocó${FIN}`, 'i'),
];

/** Cantidad seguida de unidad: señal fuerte de avance informado. */
const CANTIDAD_CON_UNIDAD =
  /\b\d+(?:[.,]\d+)?\s*(?:m2|m²|metros?|cuadras?|unidades?|beneficiarios?|%|por\s?ciento|hs|horas?|toneladas?|viviendas?|luminarias?)\b/i;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'setiembre', 'octubre', 'noviembre', 'diciembre',
];

const NUMERO_MES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const DIAS_SEMANA = {
  lunes: 1, martes: 2, miércoles: 3, miercoles: 3, jueves: 4,
  viernes: 5, sábado: 6, sabado: 6, domingo: 7,
};

/**
 * Palabras que se escriben con mayúscula sin ser nombres de persona. Sin esta
 * lista, «Legales» o «Septiembre» terminarían cargados como responsables.
 */
const MAYUSCULAS_NO_PERSONA = new Set([
  ...MESES.map((m) => m[0].toUpperCase() + m.slice(1)),
  'Legales', 'Ambiente', 'Obras', 'Hacienda', 'Salud', 'Educación', 'Cultura', 'Coordinación',
  'Secretaría', 'Subsecretaría', 'Dirección', 'Municipio', 'Intendencia', 'Provincia', 'Nación',
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
  'El', 'La', 'Los', 'Las', 'Se', 'Ya', 'No', 'Sí', 'Falta', 'Hay', 'Queda', 'Quedamos', 'Además',
  'También', 'Por', 'Para', 'Con', 'Sin', 'Desde', 'Hasta', 'Antes', 'Después', 'Durante',
]);

/* ── Utilidades de fecha ────────────────────────────────────────────── */

const MS_DIA = 86_400_000;

function aISO(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function desplazar(hoyISO, dias) {
  return aISO(new Date(Date.parse(`${hoyISO}T00:00:00Z`) + dias * MS_DIA));
}

function armar(anio, mes, dia) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Primera fecha reconocible de la oración, resuelta a ISO contra `hoy`.
 * Devuelve cadena vacía si no hay ninguna: no se inventan fechas límite.
 */
function extraerFecha(oracion, hoy) {
  const anioActual = Number(hoy.slice(0, 4));
  const mesActual = Number(hoy.slice(5, 7));

  // DD/MM/AAAA
  let m = oracion.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) return armar(m[3], Number(m[2]), Number(m[1]));

  // DD/MM — se asume el año en curso, salvo que la fecha ya pasó
  m = oracion.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    const anio = mes < mesActual ? anioActual + 1 : anioActual;
    return armar(anio, mes, dia);
  }

  // «3 de septiembre» / «3 de septiembre de 2027»
  m = oracion.match(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MESES.join('|')})(?:\\s+de\\s+(\\d{4}))?`, 'i'));
  if (m) {
    const mes = NUMERO_MES[m[2].toLowerCase()];
    const anio = m[3] ? Number(m[3]) : mes < mesActual ? anioActual + 1 : anioActual;
    return armar(anio, mes, Number(m[1]));
  }

  // «antes de fin de mes» → último día del mes en curso
  if (/\bfin\s+de\s+mes\b/i.test(oracion)) {
    const ultimo = new Date(Date.UTC(anioActual, mesActual, 0)).getUTCDate();
    return armar(anioActual, mesActual, ultimo);
  }

  // «la semana que viene» / «la próxima semana»
  if (/\b(?:la\s+)?(?:semana\s+que\s+viene|próxima\s+semana|proxima\s+semana)\b/i.test(oracion)) {
    return desplazar(hoy, 7);
  }

  // «el mes que viene»
  if (/\b(?:el\s+)?(?:mes\s+que\s+viene|próximo\s+mes|proximo\s+mes)\b/i.test(oracion)) {
    return desplazar(hoy, 30);
  }

  if (/\bmañana\b/i.test(oracion)) return desplazar(hoy, 1);
  if (/\bpasado\s+mañana\b/i.test(oracion)) return desplazar(hoy, 2);

  // «el viernes» → el próximo día de esa semana
  m = oracion.match(new RegExp(`\\bel\\s+(${Object.keys(DIAS_SEMANA).join('|')})\\b`, 'i'));
  if (m) {
    const objetivo = DIAS_SEMANA[m[1].toLowerCase()];
    const hoyDia = ((new Date(`${hoy}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const delta = ((objetivo - hoyDia + 7) % 7) || 7;
    return desplazar(hoy, delta);
  }

  // «en 10 días»
  m = oracion.match(/\ben\s+(\d{1,3})\s+d[íi]as?\b/i);
  if (m) return desplazar(hoy, Number(m[1]));

  return '';
}

/**
 * Responsable candidato: nombre propio de la oración que no sea el arranque
 * genérico ni una palabra institucional capitalizada.
 */
function extraerResponsable(oracion) {
  // «Apellido va a…» — el nombre encabeza la oración seguido de la perífrasis
  const alInicio = oracion.match(/^\s*((?:[A-ZÁÉÍÓÚÑ]\.\s*)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s+(?:va\s+a|tiene\s+que|deberá|debe)/);
  if (alInicio && !MAYUSCULAS_NO_PERSONA.has(alInicio[1].trim())) return alInicio[1].trim();

  // Inicial + apellido en cualquier posición: «M. López»
  const conInicial = oracion.match(/\b([A-ZÁÉÍÓÚÑ]\.\s?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\b/);
  if (conInicial) return conInicial[1].replace(/\.\s?/, '. ').trim();

  // Cualquier palabra capitalizada que no esté en la lista de exclusión
  const palabras = oracion.match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\b/g) ?? [];
  for (const palabra of palabras) {
    if (!MAYUSCULAS_NO_PERSONA.has(palabra)) return palabra;
  }
  return '';
}

/* ── Clasificación ──────────────────────────────────────────────────── */

function esCompromiso(oracion) {
  if (PENDIENTE_ACCION.test(oracion)) return true;
  if (FUTURO_SIMPLE.test(oracion)) return true;
  for (const patron of PERIFRASIS) {
    const m = oracion.match(patron);
    if (!m) continue;
    // La perífrasis tiene que apuntar a un verbo de acción, no a cualquier verbo:
    // «va a llover» no es un compromiso.
    const verbo = m[2] ?? m[1] ?? '';
    if (new RegExp(`^(?:${VERBOS_ACCION})$`, 'i').test(verbo)) return true;
    if (/^se\s+compromete/i.test(m[0])) return true;
  }
  return false;
}

const esProblema = (oracion) => MARCADORES_PROBLEMA.some((p) => p.test(oracion));

const esAvance = (oracion) =>
  MARCADORES_AVANCE.some((p) => p.test(oracion)) || CANTIDAD_CON_UNIDAD.test(oracion);

/** Parte el texto en oraciones y descarta las que no tienen sustancia. */
function partirEnOraciones(texto) {
  return String(texto)
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((o) => o.trim().replace(/^[-•*\s]+/, ''))
    .filter((o) => o.split(/\s+/).filter(Boolean).length >= 3);
}

/* ── API pública ────────────────────────────────────────────────────── */

/**
 * Clasifica el texto oración por oración, EN ORDEN.
 *
 * Es el motor: `separarMinuta()` agrupa esta lista en tres bloques y
 * `separarTemas()` la convierte en temas de monitoreo. Se devuelve ordenada
 * —y no agrupada— porque quien revisa la transferencia la lee contra el texto
 * original que acaba de pegar, y agrupar pierde ese orden.
 *
 * @param {string} texto minuta cruda
 * @param {string} hoy fecha ISO de referencia para resolver fechas relativas
 * @returns {{descripcion: string, clase: 'compromiso'|'problema'|'avance',
 *            responsable: string, fecha_limite: string}[]}
 */
export function clasificarMinuta(texto, hoy = new Date().toISOString().slice(0, 10)) {
  if (!texto || !String(texto).trim()) return [];

  return partirEnOraciones(texto).map((oracion) => ({
    descripcion: oracion,
    // Precedencia deliberada: compromiso > problema > avance. Una oración que
    // menciona una traba pero define una acción es, sobre todo, un compromiso.
    // Y todo lo que no tiene señal clara cae en avance: es preferible que el
    // usuario reclasifique una oración a mano antes que perderla.
    clase: esCompromiso(oracion) ? 'compromiso' : esProblema(oracion) ? 'problema' : 'avance',
    responsable: extraerResponsable(oracion),
    fecha_limite: extraerFecha(oracion, hoy),
  }));
}

/**
 * Separa una minuta en tres bloques.
 *
 * Todo lo que devuelve es PROPUESTA: la interfaz de carga los muestra
 * editables y el sistema no persiste nada hasta que el usuario confirma.
 *
 * @param {string} texto minuta cruda
 * @param {string} hoy fecha ISO de referencia para resolver fechas relativas
 * @returns {{compromisos: {descripcion: string, responsable: string, fecha_limite: string}[],
 *            avances: string[], problemas: string[]}}
 */
export function separarMinuta(texto, hoy = new Date().toISOString().slice(0, 10)) {
  const resultado = { compromisos: [], avances: [], problemas: [] };

  for (const { descripcion, clase, responsable, fecha_limite } of clasificarMinuta(texto, hoy)) {
    if (clase === 'compromiso') resultado.compromisos.push({ descripcion, responsable, fecha_limite });
    else if (clase === 'problema') resultado.problemas.push(descripcion);
    else resultado.avances.push(descripcion);
  }

  return resultado;
}
