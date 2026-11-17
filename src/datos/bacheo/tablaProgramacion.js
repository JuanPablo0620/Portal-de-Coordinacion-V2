/**
 * Reconstruye la tabla de la «Programación semanal» de Bacheo a partir de los
 * textos sueltos de un PDF, con su posición.
 *
 * Los PDF los exporta el área desde Excel y llegan dos por semana: asfalto
 * (tabla por cuadrilla) y hormigón (tabla con m²). Un PDF no tiene tablas:
 * tiene textos con coordenadas. pdfplumber, en Python, deduce las celdas de
 * las líneas dibujadas; acá no hay Python, así que se hace con lo que sí trae
 * cada texto: dónde está.
 *
 *  - Las FILAS salen de la coordenada vertical: todo lo que está a la misma
 *    altura es la misma fila.
 *  - Las COLUMNAS salen del encabezado: cada texto va a la columna cuyo
 *    encabezado le queda más cerca. «DIRECCION» es la excepción, porque está
 *    alineada a la izquierda y sus textos son largos: va por el borde izquierdo.
 *  - La CUADRILLA es una celda combinada a la izquierda, con el rótulo centrado
 *    en vertical respecto de sus filas. No hay forma de leer «qué filas abarca»;
 *    se deduce buscando el reparto de filas en el que cada rótulo queda en el
 *    centro de su bloque (ver `repartirFilas`). Repartir por «el rótulo más
 *    cercano» falla con bloques de tamaño desparejo: la última fila de una
 *    cuadrilla de cuatro trabajos queda más cerca del rótulo de la siguiente si
 *    esa tiene uno solo.
 *
 * Esto se validó contra la salida de pdfplumber en los 38 PDF de junio a
 * noviembre de 2026 (ver `pruebas/bacheo-programacion.test.mjs`). Si el área
 * cambia el formato de la planilla, esa prueba es la que avisa.
 *
 * Sin dependencias: recibe `{ str, x, y, w }` (y crece hacia arriba, como en el
 * PDF) y no sabe nada de pdf.js, que vive en `leerPdf.js`.
 */

/** Mayúsculas sin acentos ni espacios repetidos: para comparar rótulos. */
export const clave = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const limpio = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim();

/** Distancia vertical máxima entre dos textos de la misma fila, en puntos. Las
 * filas de la planilla están a 8-10 puntos; los textos de una misma fila
 * difieren en menos de 1. */
const TOLERANCIA_FILA = 2.5;

/** Dos textos de la misma celda están en la misma línea si su altura difiere en
 * menos que esto; si no, el de más arriba va primero. */
const TOLERANCIA_LINEA = 1.5;

/** Cuánto puede correrse a la izquierda un texto de «DIRECCION» respecto de su
 * encabezado y seguir siendo de esa columna. */
const MARGEN_DIRECCION = 4;

/**
 * @param {{ str: string, x: number, y: number, w: number }[]} items
 * @returns {{ tipo: 'asfalto' | 'hormigon', encabezado: string[], filas: string[][] }}
 *   `filas` va en el orden de las columnas del encabezado. En asfalto, la
 *   primera columna es la cuadrilla (encabezado vacío).
 * @throws si no encuentra el encabezado «DIRECCION».
 */
export function tablaDesdeItems(items) {
  const textos = items
    .map((i) => ({ ...i, str: limpio(i.str), centro: i.x + (i.w ?? 0) / 2 }))
    .filter((i) => i.str);

  const direccion = textos.find((i) => clave(i.str) === 'DIRECCION');
  if (!direccion) {
    throw new Error('No se encontró la columna DIRECCION: el PDF no parece una programación semanal de Bacheo.');
  }

  const encabezados = textos
    .filter((i) => Math.abs(i.y - direccion.y) <= TOLERANCIA_FILA)
    .sort((a, b) => a.x - b.x);
  const columnas = encabezados.filter((i) => i.x >= direccion.x - MARGEN_DIRECCION);
  const iDireccion = columnas.indexOf(direccion);

  const cuerpo = textos.filter((i) => i.y < direccion.y - TOLERANCIA_FILA);
  const rotulos = cuerpo.filter((i) => i.x + (i.w ?? 0) < direccion.x - MARGEN_DIRECCION);
  const celdas = cuerpo.filter((i) => !rotulos.includes(i));

  /*
   * Las filas se anclan en DIRECCION: cada fila de la planilla tiene exactamente
   * un texto ahí, en una sola línea. El resto de las celdas va a la fila cuyo
   * ancla le queda más cerca en vertical.
   *
   * Agrupar todo por altura, sin ancla, rompía dos casos reales: las celdas con
   * dos líneas («DESMONTE 9HS / HORMIGON 12HS», cada línea 4 puntos arriba o
   * abajo del centro de la fila) y las celdas combinadas en vertical (los
   * feriados ocupan la columna del día entera), cuyas líneas quedaban como
   * filas sin dirección y se perdían.
   */
  for (const item of celdas) item.columna = columnaDe(item, columnas, iDireccion);
  const anclas = agruparFilas(celdas.filter((i) => i.columna === iDireccion));
  const filas = anclas.map((ancla) => ({ y: ancla.y, items: [] }));
  for (const item of celdas) {
    let cerca = 0;
    for (let f = 1; f < filas.length; f++) {
      if (Math.abs(filas[f].y - item.y) < Math.abs(filas[cerca].y - item.y)) cerca = f;
    }
    if (filas.length) filas[cerca].items.push(item);
  }
  for (const fila of filas) {
    const valores = columnas.map(() => []);
    for (const item of fila.items) valores[item.columna].push(item);
    // De arriba hacia abajo y de izquierda a derecha: así una celda de dos
    // líneas se lee en el orden en que se escribió.
    fila.valores = valores.map((v) =>
      v
        .sort((a, b) => (Math.abs(b.y - a.y) > TOLERANCIA_LINEA ? b.y - a.y : a.x - b.x))
        .map((i) => i.str)
        .join(' '),
    );
  }

  // Lo que va debajo de la tabla (el total de m² del hormigón) no es un trabajo.
  const primeraBasura = filas.findIndex((f) => /^M2 TOTALES/.test(clave(f.valores.join(' '))));
  const trabajos = (primeraBasura === -1 ? filas : filas.slice(0, primeraBasura)).filter(
    (f) => f.valores[iDireccion],
  );

  const conCuadrilla = rotulos.length > 0;
  const bloques = conCuadrilla ? bloquesDeCuadrilla(rotulos) : [];
  const cuadrillaDe = conCuadrilla ? repartirFilas(trabajos.map((f) => f.y), bloques) : [];

  return {
    tipo: textos.some((i) => clave(i.str).includes('M2') && Math.abs(i.y - direccion.y) <= TOLERANCIA_FILA)
      ? 'hormigon'
      : 'asfalto',
    encabezado: (conCuadrilla ? [''] : []).concat(columnas.map((c) => c.str)),
    filas: trabajos.map((f, i) => (conCuadrilla ? [bloques[cuadrillaDe[i]].texto] : []).concat(f.valores)),
  };
}

/** Textos a la misma altura → una fila. De arriba hacia abajo. */
function agruparFilas(items) {
  const filas = [];
  for (const item of [...items].sort((a, b) => b.y - a.y)) {
    const fila = filas.find((f) => Math.abs(f.y - item.y) <= TOLERANCIA_FILA);
    if (fila) fila.items.push(item);
    else filas.push({ y: item.y, items: [item] });
  }
  return filas;
}

function columnaDe(item, columnas, iDireccion) {
  const dir = columnas[iDireccion];
  const siguiente = columnas[iDireccion + 1];
  // Alineada a la izquierda: un texto que arranca donde arranca DIRECCION es de
  // DIRECCION aunque su centro caiga más cerca de LOCALIDAD (pasa con las
  // descripciones largas de los cuadrantes).
  if (Math.abs(item.x - dir.x) <= MARGEN_DIRECCION && (!siguiente || item.x < siguiente.x - MARGEN_DIRECCION)) {
    return iDireccion;
  }
  let mejor = 0;
  for (let c = 1; c < columnas.length; c++) {
    if (Math.abs(columnas[c].centro - item.centro) < Math.abs(columnas[mejor].centro - item.centro)) mejor = c;
  }
  return mejor;
}

/** Rótulos de cuadrilla: un bloque arranca en cada línea «CUADRILLA n». */
function bloquesDeCuadrilla(rotulos) {
  const bloques = [];
  for (const linea of [...rotulos].sort((a, b) => b.y - a.y)) {
    const nuevo = /^CUADRILLA\b/.test(clave(linea.str)) || bloques.length === 0;
    if (nuevo) bloques.push({ lineas: [linea] });
    else bloques[bloques.length - 1].lineas.push(linea);
  }
  return bloques.map((b) => ({
    texto: b.lineas.map((l) => l.str).join(' '),
    centro: (b.lineas[0].y + b.lineas[b.lineas.length - 1].y) / 2,
  }));
}

/**
 * Reparte filas consecutivas entre bloques consecutivos (cada bloque, al menos
 * una fila) minimizando cuánto se aleja cada rótulo del centro de sus filas.
 * Programación dinámica: con ~30 filas y ~6 cuadrillas son unos miles de pasos.
 *
 * @param {number[]} ys altura de cada fila, de arriba hacia abajo
 * @param {{ centro: number }[]} bloques de arriba hacia abajo
 * @returns {number[]} índice de bloque de cada fila
 */
export function repartirFilas(ys, bloques) {
  const n = ys.length;
  const k = bloques.length;
  if (n === 0) return [];
  if (k === 0 || n < k) return ys.map(() => 0);

  const costo = (b, desde, hasta) => Math.abs((ys[desde] + ys[hasta]) / 2 - bloques[b].centro);
  // mejor[b][i]: costo mínimo de repartir las filas 0..i-1 entre los bloques 0..b-1
  const mejor = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(Infinity));
  const corte = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(-1));
  mejor[0][0] = 0;
  for (let b = 1; b <= k; b++) {
    for (let i = b; i <= n - (k - b); i++) {
      for (let j = b - 1; j < i; j++) {
        const c = mejor[b - 1][j] + costo(b - 1, j, i - 1);
        if (c < mejor[b][i]) {
          mejor[b][i] = c;
          corte[b][i] = j;
        }
      }
    }
  }
  const asignacion = new Array(n);
  for (let b = k, i = n; b > 0; b--) {
    const j = corte[b][i];
    for (let f = j; f < i; f++) asignacion[f] = b - 1;
    i = j;
  }
  return asignacion;
}
