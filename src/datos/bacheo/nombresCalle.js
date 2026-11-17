/**
 * Del nombre de calle como lo escribe la planilla de Bacheo al nombre oficial
 * del callejero.
 *
 * La planilla abrevia a mano y sin regla fija: «M. S. de Thompson», «J.M. de
 * Rosas», «Sta. Maria de Oro», «Cnel. Julio Moreno», «W de Tata». El callejero
 * normalizado del Geoportal trae el nombre completo («Mariquita Sánchez de
 * Thompson», «Fray Justo Santa María de Oro»). No hay tabla de equivalencias: se
 * empareja por palabras.
 *
 *  - Las palabras de contenido («Thompson», «Rosas») tienen que estar, enteras,
 *    como prefijo («Rodriguez» / «Rodríguez») o con un error de tipeo
 *    («Thompson» / «Thomson», que es como figura en Loma Hermosa).
 *  - Las iniciales («M.», «J.M.») tienen que coincidir con la primera letra de
 *    alguna palabra del nombre oficial.
 *  - Los títulos abreviados («Gral.», «Cnel.», «Sta.») son opcionales: unas
 *    veces el callejero los escribe y otras no.
 *
 * Entre varios candidatos gana el que explica más palabras de la planilla y
 * deja menos sobrantes; a igualdad, el que pasa por la localidad del trabajo.
 *
 * Los ALIAS son los casos que no se resuelven por palabras: rutas nombradas
 * por número y calles renombradas. Cada uno está verificado contra el Geoportal.
 */
import { clave } from './tablaProgramacion.js';

/** Abreviaturas de título → palabra completa. Opcionales al emparejar. */
const TITULOS = Object.freeze({
  AV: null, AVDA: null, AVENIDA: null, CALLE: null, DIAG: null,
  GRAL: 'GENERAL', GRL: 'GENERAL', GENERAL: 'GENERAL',
  CNEL: 'CORONEL', CORONEL: 'CORONEL',
  TTE: 'TENIENTE', TENIENTE: 'TENIENTE',
  SGTO: 'SARGENTO', SARGENTO: 'SARGENTO',
  PRES: 'PRESIDENTE', PTE: 'PRESIDENTE', PRESIDENTE: 'PRESIDENTE',
  DR: 'DOCTOR', DOCTOR: 'DOCTOR',
  ING: 'INGENIERO', INGENIERO: 'INGENIERO',
  GOB: 'GOBERNADOR', GDOR: 'GOBERNADOR', GOBERNADOR: 'GOBERNADOR',
  CAP: 'CAPITAN', CAPITAN: 'CAPITAN',
  ALTE: 'ALMIRANTE', ALMIRANTE: 'ALMIRANTE',
  BRIG: 'BRIGADIER', BRIGADIER: 'BRIGADIER',
  MONS: 'MONSENOR', MONSENOR: 'MONSENOR',
  PJE: 'PASAJE', PASAJE: 'PASAJE',
  STA: 'SANTA', SANTA: 'SANTA', STO: 'SANTO', SANTO: 'SANTO',
  NTRA: 'NUESTRA', NUESTRA: 'NUESTRA', SRA: 'SENORA', SENORA: 'SENORA',
  FRAY: 'FRAY', DON: 'DON', DONA: 'DONA',
  // Vistas en las planillas de junio a noviembre de 2026.
  AVDOR: 'AVIADOR', AVIADOR: 'AVIADOR',
  ALMTE: 'ALMIRANTE',
  ANT: 'ANTARTIDA', ANTARTIDA: 'ANTARTIDA',
});

/*
 * Números escritos de dos maneras: la planilla dice «Tres de Febrero» y el
 * callejero «3 de febrero»; la planilla «Rio IV» y el callejero «Río Cuarto».
 * Se comparan por su forma canónica.
 */
const EQUIVALENTES = Object.freeze({
  1: 'PRIMERO', UNO: 'PRIMERO', PRIMERO: 'PRIMERO',
  3: 'TRES', TRES: 'TRES',
  III: 'TERCERO', TERCERO: 'TERCERO',
  IV: 'CUARTO', 4: 'CUARTO', CUARTO: 'CUARTO',
});
const canonica = (palabra) => EQUIVALENTES[palabra] ?? palabra;
const esNumero = (palabra) => palabra in EQUIVALENTES;

const VACIAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y']);

/**
 * Nombres de la planilla que no se resuelven por palabras. Clave: el nombre
 * normalizado como lo escribe la planilla. Valor: cómo buscarlo.
 */
export const ALIAS_CALLE = Object.freeze({
  // Intersecciones del Geoportal: «Eva Perón RP8». Verificado 13/11/2026.
  'RUTA 8': 'Eva Peron',
  // Camino de Cintura = Av. Márquez.
  'RUTA 4': 'Marquez',
  // Renombrada: el callejero viejo la tiene como Av. Juan B. Justo.
  VENTIVENGA: 'Bentivenga',
  'JUAN B JUSTO': 'Bentivenga',
  // La planilla invierte dos letras; el callejero oficial dice «Luchter».
  LUTCHER: 'Luchter',
});

/**
 * @returns {{ contenido: string[], titulos: string[], iniciales: string[] }}
 */
export function partesDelNombre(texto) {
  const alias = ALIAS_CALLE[
    clave(texto)
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .replace(/^(AV|AVDA|AVENIDA) /, '')
  ];
  const fuente = alias ?? texto;
  // «J.M.» son dos iniciales; «Av .» (con espacio) es la abreviatura de avenida.
  const palabras = clave(fuente)
    .replace(/\b([A-Z])\.(?=[A-Z])/g, '$1. ')
    .split(/[\s,]+/)
    .map((p) => p.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
  const contenido = [];
  const titulos = [];
  const iniciales = [];
  for (const p of palabras) {
    if (VACIAS.has(p)) continue;
    if (p in TITULOS) {
      if (TITULOS[p]) titulos.push(TITULOS[p]);
    } else if (p.length === 1 && /[A-Z]/.test(p)) {
      iniciales.push(p);
    } else if (contenido.at(-1) !== canonica(p)) {
      // Sin repetir: «Av. Hipolito Yrigoyen Yrigoyen» es un tipeo.
      contenido.push(canonica(p));
    }
  }
  return { contenido, titulos, iniciales };
}

/**
 * Fragmentos para buscar candidatos en el Geoportal: los primeros cuatro
 * caracteres de cada palabra de contenido, con las vocales como comodín (ILIKE
 * no ignora acentos). Cuatro y no la palabra entera para que «Thompson»
 * encuentre también «Thomson».
 *
 * La «n» va fija salvo que se pida: como comodín, «Panamá» quedaba en `P___`,
 * que trae cientos de calles y deja la correcta afuera del límite de la
 * consulta. El segundo intento (`comodinEnN`) es para las «ñ».
 */
export function patronesDeBusqueda(texto, { comodinEnN = false } = {}) {
  const { contenido } = partesDelNombre(texto);
  const comodin = comodinEnN ? /[AEIOUN]/g : /[AEIOU]/g;
  // Los números no sirven para buscar (pueden estar escritos con letras) y las
  // palabras de tres letras tampoco si hay otras: «Rio» queda en `R__`, que
  // trae medio partido y deja la calle buscada afuera del límite de la consulta.
  // Un número se busca por su forma en letras (IV → «Cuarto»), que es como
  // suele estar en el callejero; si el callejero lo tiene en cifras, lo
  // encuentran las otras palabras.
  const utiles = contenido.filter((p) => (!esNumero(p) || /^[A-Z]{4,}$/.test(p)) && p.length >= 3);
  const largas = utiles.filter((p) => p.length >= 4);
  return (largas.length ? largas : utiles).map((p) => p.slice(0, 4).replace(comodin, '_'));
}

/**
 * Último recurso para encontrar candidatos: el final de la palabra más larga.
 * Rescata los errores del principio («Pechel» → «Peschel», «de Vicenzi» →
 * «Devicenzi»), que el patrón por el comienzo no ve.
 */
export function patronesDeRespaldo(texto) {
  const { contenido } = partesDelNombre(texto);
  const larga = contenido.filter((p) => !esNumero(p)).sort((a, b) => b.length - a.length)[0];
  if (!larga || larga.length < 4) return [];
  // Palabras de cuatro letras: el comienzo con tres («Fels» → «Felds»).
  if (larga.length === 4) return [larga.slice(0, 3).replace(/[AEIOU]/g, '_')];
  return [larga.slice(-4).replace(/[AEIOU]/g, '_')];
}

function parecidas(a, b) {
  if (a === b) return true;
  // Prefijo con al menos cuatro letras de los dos lados: «Rodriguez» /
  // «Rodríguez Peña» sí; «Nicaragua» / la «N» de «F.I.N.C.A.», no.
  if (Math.min(a.length, b.length) >= 4 && (b.startsWith(a) || a.startsWith(b))) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  // 0,8 deja pasar una letra de más o de menos en palabras de cinco
  // («Cuelli» / «Cueli», «Fels» / «Felds») y una transposición en las largas
  // («Madgalena» / «Magdalena»). Entre 0,8 y 0,84 la coincidencia es dudosa
  // («Marina» / «María» también da 0,83): se acepta, pero `esDudosa` lo marca
  // para avisar en la nota en vez de ubicar callado en la calle equivocada.
  return similitud(a, b) >= 0.8;
}

const segura = (a, b) =>
  a === b ||
  (Math.min(a.length, b.length) >= 4 && (b.startsWith(a) || a.startsWith(b))) ||
  (Math.min(a.length, b.length) >= 4 && similitud(a, b) >= 0.84);

/**
 * ¿El emparejamiento de `texto` con `oficial` usó alguna coincidencia dudosa?
 * Quien llama lo informa como «se tomó X como Y».
 */
export function esDudosa(texto, oficial) {
  const { contenido } = partesDelNombre(texto);
  const palabras = palabrasOficiales(oficial);
  if (similitud(pegado(texto), pegado(oficial)) >= 0.85) return false;
  return contenido.some((p) => !palabras.some((o) => segura(p, o)));
}

/**
 * Similitud normalizada de 0 a 1 por distancia de Damerau (con transposición
 * de letras vecinas como un solo error: «Madgalena» está a uno de «Magdalena»).
 */
export function similitud(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length, 1);
}

const palabrasOficiales = (oficial) =>
  clave(oficial)
    .split(/[\s,.]+/)
    .map((p) => p.replace(/[^A-Z0-9]/g, ''))
    .filter((p) => p && !VACIAS.has(p))
    .map(canonica);

/** Todo junto, sin espacios: «de Vicenzi» y «Devicenzi» son lo mismo. */
const pegado = (texto) => clave(texto).replace(/[^A-Z0-9]/g, '');

/**
 * Qué tan bien explica `oficial` lo que dice la planilla. `null` si no sirve.
 */
export function puntaje(texto, oficial) {
  const q = partesDelNombre(texto);
  if (!q.contenido.length) return null;
  const palabras = palabrasOficiales(oficial);
  const usadas = new Set();
  const usar = (pred) => {
    const i = palabras.findIndex((p, k) => !usadas.has(k) && pred(p));
    if (i === -1) return false;
    usadas.add(i);
    return true;
  };
  let puntos = 0;
  for (const p of q.contenido) {
    if (!usar((o) => parecidas(p, o))) {
      return similitud(pegado(texto), pegado(oficial)) >= 0.85 ? 10 * q.contenido.length : null;
    }
    puntos += 10;
  }
  for (const ini of q.iniciales) if (usar((o) => o.startsWith(ini))) puntos += 3;
  // Un título de la planilla que el nombre oficial no tiene resta: «Pres.
  // Perón» no es «Eva Perón», aunque Eva Perón pase por la localidad.
  for (const t of q.titulos) puntos += usar((o) => o === t || o.startsWith(t.slice(0, 3))) ? 2 : -4;
  // Lo que el nombre oficial tiene y la planilla no explica. Resta poco: los
  // nombres oficiales son largos a propósito.
  const sobrantes = palabras.filter((p, k) => !usadas.has(k) && !(p in TITULOS)).length;
  return puntos - sobrantes;
}

const enLaLocalidad = (candidato, localidad) => {
  const k = clave(localidad);
  return Boolean(k) && candidato.localidades.some((l) => clave(l) === k || clave(l).startsWith(k.split(' ')[0]));
};

/**
 * @param {string} texto como viene en la planilla
 * @param {{ nombre: string, localidades: string[] }[]} candidatos
 * @param {string} localidad oficial del trabajo, para desempatar
 * @returns {string|null} el nombre oficial elegido
 */
export function elegirCalle(texto, candidatos, localidad = '') {
  return elegirCalles(texto, candidatos, localidad)[0] ?? null;
}

/**
 * Todos los nombres oficiales que empatan en el mejor puntaje. «Zanella» en
 * Caseros es Juan Zanella o Santiago Zanella: quedarse con uno al azar dejaba
 * tramos «que no se cruzan». Quien llama los trata como alternativas.
 */
export function elegirCalles(texto, candidatos, localidad = '') {
  let mejor = -Infinity;
  let nombres = [];
  for (const c of candidatos) {
    const p = puntaje(texto, c.nombre);
    if (p === null) continue;
    const total = p + (enLaLocalidad(c, localidad) ? 5 : 0);
    if (total > mejor) {
      mejor = total;
      nombres = [c.nombre];
    } else if (total === mejor && !nombres.includes(c.nombre)) {
      nombres.push(c.nombre);
    }
  }
  return nombres;
}

/**
 * Segunda vuelta, más permisiva: la planilla agrega una palabra que el nombre
 * oficial no tiene («Martin de Álzaga» / «Álzaga»). Se acepta si falta UNA sola
 * palabra (que no sea la última), alguna de las que coinciden tiene cinco letras o más (para no
 * enganchar por un «Rio» o un «San») y la calle pasa por la localidad del
 * trabajo. Quien llama tiene que avisar que interpretó el nombre.
 */
export function elegirCalleFlexible(texto, candidatos, localidad = '') {
  const { contenido } = partesDelNombre(texto);
  if (contenido.length < 2) return null;
  const opciones = candidatos.filter((c) => {
    if (!enLaLocalidad(c, localidad)) return false;
    const palabras = palabrasOficiales(c.nombre);
    const coinciden = contenido.filter((p) => palabras.some((o) => parecidas(p, o)));
    // La que sobra puede ser un nombre de pila, nunca la última: el apellido es
    // lo que identifica la calle («Martin de Álzaga» es Álzaga, no Martín
    // Rodríguez).
    const ultima = contenido.at(-1);
    return (
      coinciden.length === contenido.length - 1 && coinciden.includes(ultima) && coinciden.some((p) => p.length >= 5)
    );
  });
  const unicas = [...new Set(opciones.map((c) => c.nombre))];
  return unicas.length === 1 ? unicas[0] : null;
}

/**
 * El nombre oficial más parecido, para sugerirlo cuando no se encontró nada:
 * es lo que le permite al área corregir la planilla sin buscar en el mapa.
 */
export function sugerirCalle(texto, candidatos) {
  const base = pegado(partesDelNombre(texto).contenido.join(' '));
  let mejor = null;
  for (const c of candidatos) {
    const parecido = Math.max(
      similitud(base, pegado(palabrasOficiales(c.nombre).join(' '))),
      ...palabrasOficiales(c.nombre).map((o) => similitud(base, o)),
    );
    if (!mejor || parecido > mejor.parecido) mejor = { nombre: c.nombre, parecido };
  }
  return mejor && mejor.parecido >= 0.6 ? mejor.nombre : null;
}

/**
 * Qué clase de lugar describe la planilla.
 *
 *  - «Cuadrante 9: A, B, C y D» → área encerrada por esas calles
 *  - «X entre A y B»            → tramo de X
 *  - «A esquina B» / «A y B»    → esquina
 *  - lo demás («Altos de Podestá») → lugar sin calles: se marca a mano una vez
 *    y después lo recuerda `bacheo_lugares`.
 */
export function clasificarDescripcion(descripcion) {
  const d = String(descripcion ?? '').replace(/\s+/g, ' ').trim();
  // El número es opcional («Cuadrante: De los Aromos, …») y las calles pueden
  // venir separadas por comas, «y» o punto y coma.
  let m = d.match(/^cuadrante\s*\d*\s*[:.]?\s+(.+)$/i);
  if (m) {
    return { forma: 'area', calles: m[1].split(/[,;]|\s+y\s+/i).map((s) => s.trim()).filter(Boolean) };
  }
  m = d.match(/^(.+?)\s+entre\s+(.+?)\s+(?:y|hasta)\s+(.+)$/i);
  if (m) return { forma: 'tramo', calle: m[1].trim(), desde: m[2].trim(), hasta: m[3].trim() };
  m = d.match(/^(.+?)\s+(?:esquina|esq\.?)\s+(.+)$/i) ?? d.match(/^(.+?)\s+[ye]\s+(.+)$/i);
  if (m && m[1].length > 2 && m[2].length > 2) return { forma: 'esquina', a: m[1].trim(), b: m[2].trim() };
  return { forma: 'lugar' };
}

/**
 * «Triunvirato / Gral. Lavalle»: la misma calle con dos nombres (cambia al
 * cruzar una avenida). Se prueba cada uno.
 */
export const alternativas = (texto) =>
  String(texto)
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

/** Clave con la que se recuerda un lugar ya ubicado entre semanas. */
export const claveLugar = (descripcion, localidad) =>
  `${clave(descripcion).replace(/[^A-Z0-9]+/g, ' ').trim()}|${clave(localidad)}`;
