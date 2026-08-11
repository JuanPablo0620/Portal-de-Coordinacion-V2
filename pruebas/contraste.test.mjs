/**
 * Contraste de los tokens de color.
 *
 * El sistema visual dice que los tokens son la fuente única de verdad y que
 * cambiar uno propaga a toda la aplicación. Eso vale también para lo que se
 * rompe: bajarle un punto de luminosidad a un token puede dejar ilegible una
 * pantalla entera sin que nada falle. Acá se miden las combinaciones tal como
 * las usa la interfaz, contra los mínimos de la WCAG 2.1 nivel AA.
 *
 * Lo que encontró cuando se escribió: el naranja de «vence en 3 días» daba 2,34
 * sobre blanco y el amarillo de «requiere atención», 2,06. Eran las dos frases
 * más importantes del sistema y las dos menos legibles.
 *
 * La solución no fue oscurecer el semáforo —el naranja se volvía marrón y el
 * amarillo, oliva, y un semáforo que no se lee de un vistazo no es un
 * semáforo—, sino separar el color de RELLENO del color de TEXTO. Por eso hay
 * dos umbrales distintos: 4,5:1 para lo que se lee y 3:1 para lo que se mira.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/estilos/index.css', import.meta.url), 'utf8');

const TOKENS = Object.fromEntries(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]),
);

/** Luminancia relativa según la fórmula de la WCAG. */
function luminancia(hex) {
  const canales = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

function contraste(a, b) {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** `[color de texto, fondo, dónde se usa]` */
const TEXTO = [
  ['tinta', 'card', 'texto principal'],
  ['tinta', 'paper', 'texto principal sobre el fondo'],
  ['gris', 'card', 'texto secundario'],
  ['gris', 'paper', 'texto secundario sobre el fondo'],
  ['gris', 'sindato-suave', 'chip neutro'],
  ['tenue', 'card', 'texto terciario (11px)'],
  ['tenue', 'paper', 'texto terciario sobre el fondo'],
  ['acento', 'card', 'enlaces y acciones'],
  ['acento-fuerte', 'acento-suave', 'chip de acento'],
  ['vencido-texto', 'vencido-suave', 'chip vencido'],
  ['proximo-texto', 'proximo-suave', 'chip por vencer'],
  ['atencion-texto', 'atencion-suave', 'chip de atención'],
  ['enregla-texto', 'enregla-suave', 'chip en regla'],
  ['vencido-texto', 'card', 'texto de vencimiento'],
  ['proximo-texto', 'card', 'texto de próximo a vencer'],
  ['atencion-texto', 'card', 'texto de atención'],
  ['enregla-texto', 'card', 'texto en regla'],
  ['sindato-texto', 'card', 'texto sin dato'],
];

/** Rellenos de puntos, barras, series y contornos de controles. */
const GRAFICOS = [
  'vencido', 'proximo', 'atencion', 'enregla', 'sindato', 'acento',
  'borde-fuerte',
  'serie-1', 'serie-2', 'serie-3', 'serie-4', 'serie-5', 'serie-6', 'serie-7', 'serie-8',
  'capa-seguimiento', 'capa-evento', 'capa-mesa', 'capa-vencimiento', 'capa-monitoreo',
  'capa-hito', 'capa-cambio',
];

test('los tokens del sistema visual se leen del archivo de estilos', () => {
  assert.ok(Object.keys(TOKENS).length > 30, `sólo se encontraron ${Object.keys(TOKENS).length} tokens`);
  for (const [a, b] of TEXTO) {
    assert.ok(TOKENS[a], `falta el token --color-${a}`);
    assert.ok(TOKENS[b], `falta el token --color-${b}`);
  }
});

test('todo texto llega a 4,5:1 contra su fondo', () => {
  const fallas = [];
  for (const [color, fondo, donde] of TEXTO) {
    const r = contraste(TOKENS[color], TOKENS[fondo]);
    if (r < 4.5) fallas.push(`${donde} (${color} sobre ${fondo}): ${r.toFixed(2)}`);
  }
  assert.deepEqual(fallas, [], `combinaciones por debajo del mínimo:\n  ${fallas.join('\n  ')}`);
});

test('todo objeto gráfico llega a 3:1 contra la tarjeta', () => {
  const fallas = [];
  for (const color of GRAFICOS) {
    assert.ok(TOKENS[color], `falta el token --color-${color}`);
    const r = contraste(TOKENS[color], TOKENS.card);
    if (r < 3) fallas.push(`${color}: ${r.toFixed(2)}`);
  }
  assert.deepEqual(fallas, [], `rellenos por debajo del mínimo:\n  ${fallas.join('\n  ')}`);
});

test('cada nivel del semáforo tiene relleno y variante de texto', () => {
  for (const nivel of ['vencido', 'proximo', 'atencion', 'enregla', 'sindato']) {
    assert.ok(TOKENS[nivel], `falta el relleno --color-${nivel}`);
    assert.ok(TOKENS[`${nivel}-texto`], `falta la variante --color-${nivel}-texto`);
    assert.ok(TOKENS[`${nivel}-suave`], `falta el fondo --color-${nivel}-suave`);
    // La variante de texto es más oscura que el relleno: si alguien las iguala,
    // vuelve el problema que motivó separarlas.
    assert.ok(
      luminancia(TOKENS[`${nivel}-texto`]) <= luminancia(TOKENS[nivel]),
      `la variante de texto de ${nivel} no es más oscura que su relleno`,
    );
  }
});

test('el borde que delimita un control se distingue del fondo', () => {
  // 1.4.11: el contorno de un campo o un botón es lo que permite reconocerlo.
  assert.ok(contraste(TOKENS['borde-fuerte'], TOKENS.card) >= 3);
  assert.ok(contraste(TOKENS['borde-fuerte'], TOKENS.paper) >= 3);
});
