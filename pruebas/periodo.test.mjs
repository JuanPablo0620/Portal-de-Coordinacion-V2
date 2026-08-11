/**
 * El período por defecto del módulo de monitoreo.
 *
 * Se prueba porque es un filtro que se aplica SIN que el usuario lo pida: si un
 * día deja de resolverse bien, la hoja de una secretaría muestra otra cosa que
 * la que dice mostrar y nadie se entera. Lo importante acá es que «todo el
 * histórico» siga siendo pedible: ése era el motivo de guardar la opción en la
 * URL en lugar de una fecha.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { OPCIONES_PERIODO, resolverPeriodo } from '../src/modulos/monitoreo/rangoPeriodo.js';
import { generarBaseCompleta } from '../src/datos/base-completa.js';
import { monitoreos, resumenSecretaria } from '../src/datos/selectores.js';

const HOY = '2026-08-10';

test('sin elegir nada, el módulo arranca en los últimos seis meses', () => {
  assert.deepEqual(resolverPeriodo({}, HOY), { desde: '2026-02-08', hasta: '' });
  assert.deepEqual(resolverPeriodo({ periodo: '' }, HOY), { desde: '2026-02-08', hasta: '' });
});

test('doce meses y todo el histórico son opciones distintas y explícitas', () => {
  assert.deepEqual(resolverPeriodo({ periodo: '12m' }, HOY), { desde: '2025-08-10', hasta: '' });
  assert.deepEqual(resolverPeriodo({ periodo: 'todo' }, HOY), { desde: '', hasta: '' });
});

test('el rango personalizado respeta las fechas cargadas', () => {
  assert.deepEqual(
    resolverPeriodo({ periodo: 'personalizado', desde: '2025-01-01', hasta: '2025-03-31' }, HOY),
    { desde: '2025-01-01', hasta: '2025-03-31' },
  );
  // Personalizado sin fechas no vuelve al defecto: el usuario pidió no recortar.
  assert.deepEqual(resolverPeriodo({ periodo: 'personalizado' }, HOY), { desde: '', hasta: '' });
});

test('las cuatro opciones del control resuelven a un rango válido', () => {
  for (const o of OPCIONES_PERIODO) {
    const r = resolverPeriodo({ periodo: o.valor }, HOY);
    assert.ok(r && typeof r.desde === 'string' && typeof r.hasta === 'string', `${o.valor} no resuelve`);
    if (r.desde) assert.ok(r.desde < HOY, `${o.valor} arranca en el futuro`);
  }
});

test('el defecto recorta de verdad la hoja de una secretaría', () => {
  const bd = generarBaseCompleta(HOY);
  const area = 'Secretaría de Obras Públicas';

  const seisMeses = resumenSecretaria(bd, area, resolverPeriodo({}, HOY), HOY);
  const todo = resumenSecretaria(bd, area, resolverPeriodo({ periodo: 'todo' }, HOY), HOY);

  assert.ok(seisMeses.temas.total < todo.temas.total, 'el período por defecto no está recortando nada');
  assert.ok(seisMeses.temas.total > 0, 'el período por defecto dejó la hoja vacía');

  // Lo que NO se recorta: el último monitoreo y la deuda vigente se miden sobre
  // toda la historia, porque son estado actual y no actividad del período.
  assert.equal(seisMeses.ultimo_monitoreo, todo.ultimo_monitoreo);
  assert.equal(seisMeses.compromisos.vencidos, todo.compromisos.vencidos);
  assert.equal(seisMeses.proyectos.total, todo.proyectos.total);
});

test('con el período por defecto, cada monitoreo listado cae dentro de la ventana', () => {
  const bd = generarBaseCompleta(HOY);
  const { desde } = resolverPeriodo({}, HOY);
  for (const m of monitoreos(bd, { desde, hasta: '' })) {
    assert.ok(m.fecha >= desde, `${m.fecha} quedó fuera de la ventana`);
  }
});
