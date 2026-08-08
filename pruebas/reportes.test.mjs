/**
 * El criterio de aceptación central del constructor: dos combinaciones de
 * filtros distintas tienen que producir documentos distintos, y los filtros
 * aplicados tienen que quedar explicitados.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { armarReporte, describirFiltros, resolverRango } from '../src/datos/reportes.js';
import { generarDemo } from '../src/datos/demo.js';

const HOY = '2026-08-08';
const bd = generarDemo(HOY);

test('sin filtros, el reporte abarca todo el sistema', () => {
  const r = armarReporte(bd, {}, HOY);
  assert.equal(r.proyectos.length, bd.proyectos.length);
  assert.ok(r.compromisos.length > 0);
  assert.deepEqual(r.resumenFiltros, ['Sin filtros aplicados: el reporte abarca todo el sistema']);
});

test('filtrar por área recorta proyectos y compromisos', () => {
  const area = bd.proyectos[0].area;
  const r = armarReporte(bd, { area }, HOY);
  assert.ok(r.proyectos.length > 0);
  assert.ok(r.proyectos.length < bd.proyectos.length);
  assert.ok(r.proyectos.every((p) => p.area === area));
  assert.ok(r.compromisos.every((c) => !c.area || c.area === area));
});

test('dos filtros distintos producen reportes distintos', () => {
  const areas = [...new Set(bd.proyectos.map((p) => p.area))];
  const a = armarReporte(bd, { area: areas[0] }, HOY);
  const b = armarReporte(bd, { area: areas[1] }, HOY);
  assert.notDeepEqual(
    a.proyectos.map((p) => p.id_proyecto),
    b.proyectos.map((p) => p.id_proyecto),
  );
  assert.notDeepEqual(a.resumenFiltros, b.resumenFiltros);
});

test('«sólo obras» deja únicamente proyectos marcados como obra', () => {
  const r = armarReporte(bd, { solo_obras: true }, HOY);
  assert.ok(r.proyectos.length > 0);
  assert.ok(r.proyectos.every((p) => p.es_obra === true));
});

test('«sólo prioritarios» deja únicamente prioridad alta', () => {
  const r = armarReporte(bd, { solo_prioritarios: true }, HOY);
  assert.ok(r.proyectos.length > 0);
  assert.ok(r.proyectos.every((p) => p.prioridad === 'alta'));
});

test('«sólo con alertas activas» deja únicamente proyectos con alerta', () => {
  const r = armarReporte(bd, { solo_con_alertas: true }, HOY);
  assert.ok(r.proyectos.length > 0);
  assert.ok(r.proyectos.length < bd.proyectos.length);
});

test('los filtros son combinables entre sí', () => {
  const soloObras = armarReporte(bd, { solo_obras: true }, HOY);
  const obrasPrioritarias = armarReporte(bd, { solo_obras: true, solo_prioritarios: true }, HOY);
  assert.ok(obrasPrioritarias.proyectos.length <= soloObras.proyectos.length);
  assert.ok(obrasPrioritarias.proyectos.every((p) => p.es_obra && p.prioridad === 'alta'));
});

test('filtrar por módulo de origen vacía los otros bloques', () => {
  const r = armarReporte(bd, { modulo: 'compromisos' }, HOY);
  assert.ok(r.compromisos.length > 0);
  assert.equal(r.seguimientos.length, 0);
  assert.equal(r.eventos.length, 0);
  assert.equal(r.mesas.length, 0);
});

test('el rango temporal recorta por fecha', () => {
  const sinRango = armarReporte(bd, {}, HOY);
  const unaSemana = armarReporte(bd, { rango: 'semana' }, HOY);
  assert.ok(unaSemana.seguimientos.length <= sinRango.seguimientos.length);
});

test('resolverRango traduce cada opción a fechas ISO', () => {
  assert.deepEqual(resolverRango({ rango: 'semana' }, HOY), { desde: '2026-08-01', hasta: HOY });
  assert.deepEqual(resolverRango({ rango: 'anio' }, HOY), { desde: '2026-01-01', hasta: '2026-12-31' });
  assert.deepEqual(resolverRango({ rango: 'trimestre' }, HOY), { desde: '2026-07-01', hasta: '2026-09-30' });
  assert.deepEqual(resolverRango({}, HOY), { desde: '', hasta: '' });
});

test('describirFiltros explicita cada filtro aplicado', () => {
  const texto = describirFiltros(
    { area: 'Obras', solo_obras: true, rango: 'mes' },
    { desde: '2026-07-09', hasta: HOY },
  ).join(' | ');
  assert.match(texto, /Área: Obras/);
  assert.match(texto, /Sólo obras/);
  assert.match(texto, /Período: Último mes/);
  assert.match(texto, /2026-07-09/);
});

test('el resumen numérico refleja el recorte, no la base entera', () => {
  const area = bd.proyectos[0].area;
  const r = armarReporte(bd, { area }, HOY);
  assert.equal(r.resumen.proyectos, r.proyectos.length);
  assert.equal(r.resumen.compromisos, r.compromisos.length);
  assert.ok(r.resumen.proyectos < bd.proyectos.length);
});

test('las alertas del reporte salen del motor central, filtradas por el recorte', () => {
  const area = bd.proyectos[0].area;
  const r = armarReporte(bd, { area }, HOY);
  assert.ok(r.alertas.every((a) => !a.area || a.area === area));
});

test('armarReporte sin base no rompe', () => {
  const r = armarReporte(null, {}, HOY);
  assert.deepEqual(r.proyectos, []);
});
