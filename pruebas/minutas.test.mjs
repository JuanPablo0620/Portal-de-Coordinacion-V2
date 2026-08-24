import test from 'node:test';
import assert from 'node:assert/strict';
import { separarMinuta } from '../src/datos/minutas/separarMinuta.js';
import { generarBaseCompleta } from '../src/datos/base-completa.js';

const HOY = '2026-08-08';

/* ── Compromisos ──────────────────────────────────────────────────── */

test('detecta un compromiso con responsable y fecha', () => {
  const r = separarMinuta('Pérez va a enviar el pliego antes del 15/09.', HOY);
  assert.equal(r.compromisos.length, 1);
  assert.match(r.compromisos[0].descripcion, /pliego/i);
  assert.equal(r.compromisos[0].responsable, 'Pérez');
  assert.equal(r.compromisos[0].fecha_limite, '2026-09-15');
});

test('reconoce distintas perífrasis de compromiso', () => {
  for (const frase of [
    'González tiene que presentar el informe.',
    'Quedamos en coordinar la reunión con Legales.',
    'El área deberá remitir el detalle de gastos.',
    'Se compromete a entregar el listado actualizado.',
  ]) {
    const r = separarMinuta(frase, HOY);
    assert.equal(r.compromisos.length, 1, `no detectó compromiso en: ${frase}`);
  }
});

test('un verbo de acción en pasado no es un compromiso', () => {
  const r = separarMinuta('Se envió el pliego la semana pasada.', HOY);
  assert.equal(r.compromisos.length, 0);
});

/* ── Fechas ───────────────────────────────────────────────────────── */

test('resuelve fechas en varios formatos a ISO', () => {
  const casos = [
    ['Ibarra va a enviar el informe el 20/09.', '2026-09-20'],
    ['Ibarra va a enviar el informe el 20/09/2026.', '2026-09-20'],
    ['Ibarra va a enviar el informe el 3 de septiembre.', '2026-09-03'],
  ];
  for (const [texto, esperado] of casos) {
    assert.equal(separarMinuta(texto, HOY).compromisos[0]?.fecha_limite, esperado, texto);
  }
});

test('resuelve expresiones relativas de fecha', () => {
  const finDeMes = separarMinuta('Juárez va a presentar el informe antes de fin de mes.', HOY);
  assert.equal(finDeMes.compromisos[0].fecha_limite, '2026-08-31');

  const semana = separarMinuta('Juárez va a presentar el informe la semana que viene.', HOY);
  assert.equal(semana.compromisos[0].fecha_limite, '2026-08-15');
});

test('un compromiso sin fecha queda con fecha_limite vacía, no inventada', () => {
  const r = separarMinuta('Herrera va a coordinar con el área técnica.', HOY);
  assert.equal(r.compromisos.length, 1);
  assert.equal(r.compromisos[0].fecha_limite, '');
});

/* ── Problemas ────────────────────────────────────────────────────── */

test('clasifica una traba como problema', () => {
  const r = separarMinuta('Falta la conformidad de Ambiente y está trabado desde junio.', HOY);
  assert.equal(r.problemas.length, 1);
  assert.equal(r.compromisos.length, 0);
});

test('reconoce distintos marcadores de traba', () => {
  for (const frase of [
    'No se pudo avanzar con la licitación.',
    'El expediente está pendiente de firma.',
    'Hay demora en la entrega de materiales.',
    'No hay personal disponible para el turno tarde.',
    'La obra se atrasó por las lluvias.',
  ]) {
    const r = separarMinuta(frase, HOY);
    assert.equal(r.problemas.length, 1, `no detectó problema en: ${frase}`);
  }
});

/* ── Avances ──────────────────────────────────────────────────────── */

test('clasifica un hecho consumado como avance', () => {
  const r = separarMinuta('Ya se terminó el movimiento de suelos del sector norte.', HOY);
  assert.equal(r.avances.length, 1);
  assert.equal(r.compromisos.length, 0);
});

test('una oración con cantidad y unidad cuenta como avance', () => {
  const r = separarMinuta('Se ejecutaron 200 metros de cordón cuneta.', HOY);
  assert.equal(r.avances.length, 1);
});

/* ── Minuta mixta ─────────────────────────────────────────────────── */

test('separa los tres bloques de una minuta mixta', () => {
  const r = separarMinuta(
    [
      'Se ejecutaron 200 metros de cordón cuneta.',
      'Falta la aprobación del expediente en Legales.',
      'González va a presentar el informe el 20/09.',
    ].join(' '),
    HOY,
  );
  assert.equal(r.avances.length, 1);
  assert.equal(r.problemas.length, 1);
  assert.equal(r.compromisos.length, 1);
});

test('la precedencia es compromiso sobre problema sobre avance', () => {
  // Tiene marcador de traba Y de compromiso: gana el compromiso.
  const r = separarMinuta('Falta el informe, así que Ledesma va a presentar el detalle el 12/09.', HOY);
  assert.equal(r.compromisos.length, 1);
  assert.equal(r.problemas.length, 0);
});

test('respeta los saltos de línea como separadores de oración', () => {
  const r = separarMinuta('Se terminó la vereda\nFalta la señalización\nNavarro va a relevar el sector', HOY);
  assert.equal(r.avances.length, 1);
  assert.equal(r.problemas.length, 1);
  assert.equal(r.compromisos.length, 1);
});

/* ── Bordes ───────────────────────────────────────────────────────── */

test('un texto vacío devuelve los tres bloques vacíos, sin romper', () => {
  assert.deepEqual(separarMinuta('', HOY), { compromisos: [], avances: [], problemas: [] });
  assert.deepEqual(separarMinuta(null, HOY), { compromisos: [], avances: [], problemas: [] });
});

test('las oraciones de menos de tres palabras se descartan', () => {
  const r = separarMinuta('Ok. Sí. Se terminó la obra del sector norte.', HOY);
  assert.equal(r.avances.length + r.problemas.length + r.compromisos.length, 1);
});

test('ninguna oración con sustancia se pierde: sin señales cae en avances', () => {
  const r = separarMinuta('Se conversó sobre el estado general de la obra.', HOY);
  assert.equal(r.avances.length + r.problemas.length + r.compromisos.length, 1);
});

test('la firma devuelve siempre los tres arreglos, aunque estén vacíos', () => {
  const r = separarMinuta('Se terminó todo el sector previsto.', HOY);
  assert.ok(Array.isArray(r.compromisos));
  assert.ok(Array.isArray(r.avances));
  assert.ok(Array.isArray(r.problemas));
});

/* ── El separador contra un corpus grande ─────────────────────────── */

/**
 * Los tests de arriba prueban frases elegidas a mano; éste pasa el separador
 * por las minutas de la base completa —más de doscientas, con avances,
 * problemas y pedidos mezclados en el mismo párrafo— y compara contra lo que el
 * generador plantó en cada una.
 *
 * Sirvió para encontrar la única familia de trabas que se escapaba entera («el
 * certificado presenta diferencias con lo ejecutado»), y queda como red: una
 * regla nueva que mejore un caso suelto pero rompa la clasificación general
 * falla acá.
 */
test('el separador clasifica bien el corpus completo de minutas', () => {
  const bd = generarBaseCompleta('2026-08-10');
  const minutas = bd.seguimientos.filter((s) => s.texto_crudo?.trim());
  assert.ok(minutas.length > 100, 'el corpus tiene que ser grande para que esto signifique algo');

  let avancesMal = 0;
  let problemasMal = 0;
  let totalAvances = 0;
  let totalProblemas = 0;
  let perdidas = 0;

  for (const s of minutas) {
    const r = separarMinuta(s.texto_crudo, '2026-08-10');
    const todo = [...r.avances, ...r.problemas, ...r.compromisos.map((c) => c.descripcion)];

    // avances/problemas son { descripcion, id_proyecto } desde el 24/08/2026.
    for (const a of s.avances) {
      totalAvances += 1;
      const trozo = a.descripcion.slice(0, 25);
      if (!todo.some((x) => x.includes(trozo))) perdidas += 1;
      else if (!r.avances.some((x) => x.includes(trozo))) avancesMal += 1;
    }
    for (const p of s.problemas) {
      totalProblemas += 1;
      const trozo = p.descripcion.slice(0, 25);
      if (!todo.some((x) => x.includes(trozo))) perdidas += 1;
      else if (!r.problemas.some((x) => x.includes(trozo))) problemasMal += 1;
    }
  }

  // Nada se descarta: una oración mal clasificada la corrige el usuario en la
  // pantalla de carga, pero una que desaparece no la puede recuperar.
  assert.equal(perdidas, 0, `${perdidas} oraciones se perdieron en la separación`);

  const aciertoAvances = 1 - avancesMal / totalAvances;
  const aciertoProblemas = 1 - problemasMal / totalProblemas;
  assert.ok(aciertoAvances >= 0.95, `avances bien clasificados: ${(aciertoAvances * 100).toFixed(1)}%`);
  assert.ok(aciertoProblemas >= 0.95, `problemas bien clasificados: ${(aciertoProblemas * 100).toFixed(1)}%`);
});

test('toda minuta con un pedido produce al menos un compromiso propuesto', () => {
  const bd = generarBaseCompleta('2026-08-10');
  const conPedido = bd.seguimientos.filter((s) => /va a |quedaron en |tiene que |hay que |deberá /i.test(s.texto_crudo ?? ''));
  assert.ok(conPedido.length > 50);
  for (const s of conPedido) {
    const r = separarMinuta(s.texto_crudo, '2026-08-10');
    assert.ok(r.compromisos.length > 0, `no detectó el pedido en: ${s.texto_crudo.slice(0, 80)}…`);
  }
});
