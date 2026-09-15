/**
 * El criterio de aceptación central del constructor: dos combinaciones de
 * filtros distintas tienen que producir documentos distintos, y los filtros
 * aplicados tienen que quedar explicitados.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { armarReporte, describirFiltros, resolverRango } from '../src/datos/reportes.js';
import { generarDemo } from '../src/datos/demo.js';
import { compromisos } from '../src/datos/selectores.js';

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

/* ── Lo que salió a la luz con la base a escala real ──────────────── */

/**
 * Estos tres se escribieron después de auditar el constructor con la base
 * completa cargada. Ninguno se veía con treinta registros: los tres producían
 * documentos que decían algo distinto de lo que el usuario pidió.
 */

test('el período no esconde la deuda vencida que viene de antes', () => {
  const semanal = armarReporte(bd, { rango: 'semana' }, HOY);
  const vencidosDelSistema = compromisos(bd, {}, HOY).filter((c) => c.estado_efectivo === 'alerta').length;

  // Filtrando sólo por fecha de vencimiento, un informe semanal contaba cero
  // vencidos mientras el bloque de alertas del mismo documento los listaba.
  assert.equal(semanal.resumen.compromisosVencidos, vencidosDelSistema);
  assert.ok(
    semanal.compromisos.length < armarReporte(bd, {}, HOY).compromisos.length,
    'el período tiene que seguir recortando lo que no está vencido',
  );
});

test('el módulo de origen recorta también los proyectos', () => {
  const soloMesas = armarReporte(bd, { modulo: 'mesas' }, HOY);
  assert.equal(soloMesas.proyectos.length, 0, 'un informe de mesas traía la tabla de proyectos entera');
  assert.equal(soloMesas.resumen.proyectos, 0);
  assert.ok(soloMesas.mesas.length > 0, 'el módulo pedido sí tiene que venir');

  const soloProyectos = armarReporte(bd, { modulo: 'proyectos' }, HOY);
  assert.ok(soloProyectos.proyectos.length > 0);
  assert.equal(soloProyectos.mesas.length, 0);
});

test('las mesas del reporte respetan el período por sus reuniones', () => {
  const sinRango = armarReporte(bd, {}, HOY);
  const semanal = armarReporte(bd, { rango: 'semana' }, HOY);
  assert.ok(sinRango.mesas.length > 0);
  assert.ok(
    semanal.mesas.length <= sinRango.mesas.length,
    'un informe de una semana listaba mesas que no se reunían hacía meses',
  );
  for (const m of semanal.mesas) {
    const enVentana = bd.reuniones_mesa.some(
      (r) => r.id_mesa === m.id && r.fecha >= semanal.rango.desde && r.fecha <= semanal.rango.hasta,
    );
    assert.ok(enVentana, `la mesa ${m.nombre} no sesionó en el período`);
  }
});

/* ── El eje recorta proyectos, y ese recorte se propaga ─────────────── */

/**
 * Filtrar por un eje que ningún proyecto usa deja el reporte ENTERO en cero,
 * no sólo la tabla de proyectos: los compromisos, las alertas y las minutas se
 * limitan a los proyectos del recorte.
 *
 * Es el comportamiento correcto —el recorte es lo que ata las entidades al
 * mismo universo— pero convierte a cualquier opción sin proyectos detrás en una
 * trampa: no vacía una tabla, vacía el documento. Por eso los filtros de
 * proyecto se derivan de los datos y no del catálogo. Esta prueba fija la
 * razón, para que a nadie le parezca que puede volver a ofrecerse el catálogo
 * plano sin consecuencias.
 */
test('un eje que ningún proyecto usa vacía también los compromisos', () => {
  const ejeInexistente = 'Eje que nadie usa';
  assert.equal(
    bd.proyectos.filter((p) => p.eje === ejeInexistente).length,
    0,
    'la premisa de la prueba: ningún proyecto tiene ese eje',
  );

  const r = armarReporte(bd, { eje: ejeInexistente }, HOY);
  assert.deepEqual(r.proyectos, []);
  // Los que cuelgan de un proyecto se van con él. Los sueltos sobreviven.
  assert.ok(r.compromisos.every((c) => !c.id_proyecto));
});

test('filtrar por un eje real conserva los compromisos de esos proyectos', () => {
  const eje = bd.proyectos.find((p) => p.eje)?.eje;
  assert.ok(eje, 'la demo tiene al menos un proyecto con eje');

  const r = armarReporte(bd, { eje }, HOY);
  assert.ok(r.proyectos.length > 0);
  assert.ok(r.proyectos.every((p) => p.eje === eje));

  const ids = new Set(r.proyectos.map((p) => p.id_proyecto));
  assert.ok(r.compromisos.every((c) => !c.id_proyecto || ids.has(c.id_proyecto)));
});

/* ── Cada entidad se filtra por SU estado ───────────────────────────── */

test('el estado del compromiso recorta compromisos, no proyectos', () => {
  const estado = bd.compromisos.find((c) => c.estado)?.estado;
  assert.ok(estado, 'la demo tiene compromisos con estado');

  const r = armarReporte(bd, { estado_compromiso: estado }, HOY);
  assert.ok(r.compromisos.length > 0);
  assert.ok(r.compromisos.every((c) => c.estado === estado));
  // Los proyectos quedan enteros: el estado del compromiso no los recorta.
  assert.equal(r.proyectos.length, bd.proyectos.length);
});

test('el estado del proyecto no recorta los compromisos por su propio estado', () => {
  const estado = bd.proyectos.find((p) => p.estado)?.estado;
  const r = armarReporte(bd, { estado }, HOY);
  assert.ok(r.proyectos.every((p) => p.estado === estado));
  // Lo que sí pasa es el recorte por proyecto, que es otra cosa.
  const ids = new Set(r.proyectos.map((p) => p.id_proyecto));
  assert.ok(r.compromisos.every((c) => !c.id_proyecto || ids.has(c.id_proyecto)));
});

/* ── El período mide vigencia, no fecha de carga ────────────────────── */

test('un proyecto que arrancó antes del período pero sigue vivo entra igual', () => {
  const p = bd.proyectos.find((x) => x.fecha_inicio && x.fecha_inicio < '2026-08-01');
  assert.ok(p, 'la demo tiene proyectos anteriores a agosto');

  const r = armarReporte(bd, { rango: 'personalizado', desde: '2026-08-01', hasta: '2026-08-31' }, HOY);
  const entro = r.proyectos.some((x) => x.id_proyecto === p.id_proyecto);
  const terminoAntes = p.fecha_fin_prevista && p.fecha_fin_prevista < '2026-08-01';
  assert.equal(entro, !terminoAntes);
});

test('un proyecto que termina antes de la ventana queda afuera', () => {
  const r = armarReporte(bd, { rango: 'personalizado', desde: '2026-08-01', hasta: '2026-08-31' }, HOY);
  assert.ok(
    r.proyectos.every((p) => !p.fecha_fin_prevista || p.fecha_fin_prevista >= '2026-08-01'),
  );
});

test('cada mesa del reporte dice qué secretarías asumieron algo en ella', () => {
  const r = armarReporte(bd, {}, HOY);
  assert.ok(r.mesas.length > 0);

  for (const m of r.mesas) {
    assert.ok(Array.isArray(m.areas), `la mesa ${m.nombre} no trae la lista de secretarías`);
    // Lo que sale son las áreas de los compromisos de SUS reuniones, no las
    // del sistema entero.
    const reuniones = new Set(bd.reuniones_mesa.filter((x) => x.id_mesa === m.id).map((x) => x.id));
    const esperadas = new Set(
      bd.compromisos
        .filter((c) => c.origen_tipo === 'mesa' && reuniones.has(c.id_origen) && c.area)
        .map((c) => c.area),
    );
    assert.deepEqual(new Set(m.areas), esperadas, `secretarías mal atribuidas en ${m.nombre}`);
  }
});

/* ── El orden de los compromisos en el informe ──────────────────────── */

test('dentro de una secretaría, lo vencido va primero y lo sin fecha último', async () => {
  const { agruparParaInforme } = await import('../src/datos/reportes.js');
  const filas = [
    { descripcion: 'sin fecha', area: 'Obras', estado_efectivo: 'pendiente', fecha_limite: null, dias_atraso: 0 },
    { descripcion: 'vence lejos', area: 'Obras', estado_efectivo: 'pendiente', fecha_limite: '2026-12-01', dias_atraso: 0 },
    { descripcion: 'vencido hace poco', area: 'Obras', estado_efectivo: 'alerta', fecha_limite: '2026-08-01', dias_atraso: 7 },
    { descripcion: 'vencido hace mucho', area: 'Obras', estado_efectivo: 'alerta', fecha_limite: '2026-01-01', dias_atraso: 220 },
    { descripcion: 'vence pronto', area: 'Obras', estado_efectivo: 'pendiente', fecha_limite: '2026-09-01', dias_atraso: 0 },
  ];

  const [[area, ordenados]] = agruparParaInforme(filas);
  assert.equal(area, 'Obras');
  assert.deepEqual(ordenados.map((c) => c.descripcion), [
    'vencido hace mucho',
    'vencido hace poco',
    'vence pronto',
    'vence lejos',
    'sin fecha',
  ]);
});

test('los compromisos sin secretaría van al final, con rótulo propio', async () => {
  const { agruparParaInforme } = await import('../src/datos/reportes.js');
  const grupos = agruparParaInforme([
    { descripcion: 'a', area: '', estado_efectivo: 'pendiente', fecha_limite: null, dias_atraso: 0 },
    { descripcion: 'b', area: 'Salud', estado_efectivo: 'pendiente', fecha_limite: null, dias_atraso: 0 },
    { descripcion: 'c', area: 'Ambiente', estado_efectivo: 'pendiente', fecha_limite: null, dias_atraso: 0 },
  ]);

  assert.deepEqual(grupos.map(([a]) => a), ['Ambiente', 'Salud', 'Sin secretaría asignada']);
});
