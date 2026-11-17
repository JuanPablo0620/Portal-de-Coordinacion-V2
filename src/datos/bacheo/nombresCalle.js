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
});

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
  // La planilla invierte dos letras; el callejero oficial dice «Luchter».
  LUTCHER: 'Luchter',
});

/**
 * @returns {{ contenido: string[], titulos: string[], iniciales: string[] }}
 */
export function partesDelNombre(texto) {
  const alias = ALIAS_CALLE[clave(texto).replace(/\./g, '').replace(/\s+/g, ' ')];
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
    } else {
      contenido.push(p);
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
  return contenido.filter((p) => p.length >= 3).map((p) => p.slice(0, 4).replace(comodin, '_'));
}

function parecidas(a, b) {
  if (a === b) return true;
  // Prefijo con al menos cuatro letras de los dos lados: «Rodriguez» /
  // «Rodríguez Peña» sí; «Nicaragua» / la «N» de «F.I.N.C.A.», no.
  if (Math.min(a.length, b.length) >= 4 && (b.startsWith(a) || a.startsWith(b))) return true;
  if (Math.min(a.length, b.length) < 5) return false;
  return similitud(a, b) >= 0.84;
}

/** Similitud de Levenshtein normalizada, de 0 a 1. */
export function similitud(a, b) {
  const filaPrevia = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = filaPrevia[0];
    filaPrevia[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = filaPrevia[j];
      filaPrevia[j] = Math.min(filaPrevia[j] + 1, filaPrevia[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = arriba;
    }
  }
  return 1 - filaPrevia[b.length] / Math.max(a.length, b.length, 1);
}

/**
 * Qué tan bien explica `oficial` lo que dice la planilla. `null` si no sirve.
 */
export function puntaje(texto, oficial) {
  const q = partesDelNombre(texto);
  if (!q.contenido.length) return null;
  const palabras = clave(oficial)
    .split(/[\s,.]+/)
    .map((p) => p.replace(/[^A-Z0-9]/g, ''))
    .filter((p) => p && !VACIAS.has(p));
  const usadas = new Set();
  const usar = (pred) => {
    const i = palabras.findIndex((p, k) => !usadas.has(k) && pred(p));
    if (i === -1) return false;
    usadas.add(i);
    return true;
  };
  let puntos = 0;
  for (const p of q.contenido) {
    if (!usar((o) => parecidas(p, o))) return null;
    puntos += 10;
  }
  for (const ini of q.iniciales) if (usar((o) => o.startsWith(ini))) puntos += 3;
  for (const t of q.titulos) if (usar((o) => o === t || o.startsWith(t.slice(0, 3)))) puntos += 2;
  // Lo que el nombre oficial tiene y la planilla no explica. Resta poco: los
  // nombres oficiales son largos a propósito.
  const sobrantes = palabras.filter((p, k) => !usadas.has(k) && !(p in TITULOS)).length;
  return puntos - sobrantes;
}

/**
 * @param {string} texto como viene en la planilla
 * @param {{ nombre: string, localidades: string[] }[]} candidatos
 * @param {string} localidad oficial del trabajo, para desempatar
 * @returns {string|null} el nombre oficial elegido
 */
export function elegirCalle(texto, candidatos, localidad = '') {
  const k = clave(localidad);
  let mejor = null;
  for (const c of candidatos) {
    const p = puntaje(texto, c.nombre);
    if (p === null) continue;
    const enLocalidad = k && c.localidades.some((l) => clave(l) === k || clave(l).startsWith(k.split(' ')[0]));
    const total = p + (enLocalidad ? 5 : 0);
    if (!mejor || total > mejor.total) mejor = { nombre: c.nombre, total };
  }
  return mejor?.nombre ?? null;
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
  let m = d.match(/^cuadrante\s+\d+\s*[:.]\s*(.+)$/i);
  if (m) {
    return { forma: 'area', calles: m[1].split(/,|\s+y\s+/i).map((s) => s.trim()).filter(Boolean) };
  }
  m = d.match(/^(.+?)\s+entre\s+(.+?)\s+y\s+(.+)$/i);
  if (m) return { forma: 'tramo', calle: m[1].trim(), desde: m[2].trim(), hasta: m[3].trim() };
  m = d.match(/^(.+?)\s+(?:esquina|esq\.?)\s+(.+)$/i) ?? d.match(/^(.+?)\s+y\s+(.+)$/i);
  if (m && m[1].length > 2 && m[2].length > 2) return { forma: 'esquina', a: m[1].trim(), b: m[2].trim() };
  return { forma: 'lugar' };
}

/** Clave con la que se recuerda un lugar ya ubicado entre semanas. */
export const claveLugar = (descripcion, localidad) =>
  `${clave(descripcion).replace(/[^A-Z0-9]+/g, ' ').trim()}|${clave(localidad)}`;
