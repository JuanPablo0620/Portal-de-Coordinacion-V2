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
