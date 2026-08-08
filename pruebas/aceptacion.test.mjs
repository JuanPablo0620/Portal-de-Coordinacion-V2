/**
 * Criterios de aceptación del prototipo, verificados sobre los mismos módulos
 * que usa la interfaz.
 *
 * Los criterios que son visuales o de interacción (que las mesas se vean
 * separadas sin filtros, que cada módulo se vea terminado) no se comprueban
 * acá: los cubre la prueba de humo (`npm run humo`) y la revisión a ojo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generarDemo } from '../src/datos/demo.js';
import { bdVacia } from '../src/datos/esquema.js';
import { TIPOS_ALERTA, calcularAlertas, filtrarAlertas, vencimientosProximos } from '../src/datos/alertas.js';
import { armarReporte } from '../src/datos/reportes.js';
import {
  activos,
  compromisos as selCompromisos,
  historialArea,
  monitoreosPorArea,
  porDimension,
  proyectos as selProyectos,
  resumenRequerimientos,
  diasHasta,
} from '../src/datos/selectores.js';

const HOY = '2026-08-08';
const bd = generarDemo(HOY);

/* ── 1 · Un proyecto cargado se refleja en dashboard, planificación y reportes ── */

test('un proyecto de la base maestra aparece en dashboard, planificación y reportes sin recargarlo', () => {
  const p = bd.proyectos.find((x) => x.prioridad === 'alta' && x.estado === 'en ejecución');
  assert.ok(p, 'la demo debe tener un prioritario activo');

  // Dashboard: contador de prioritarios
  const prioritarios = selProyectos(bd, { solo_prioritarios: true, solo_activos: true });
  assert.ok(prioritarios.some((x) => x.id_proyecto === p.id_proyecto));

  // Planificación: entra en los agregados por área
  const porArea = porDimension(bd, 'area', {});
  assert.ok(porArea.some((a) => a.nombre === p.area));

  // Reportes: entra en el recorte
  const reporte = armarReporte(bd, {}, HOY);
  assert.ok(reporte.proyectos.some((x) => x.id_proyecto === p.id_proyecto));

  // Y es UNA sola definición: el mismo id en todos lados
  assert.equal(
    new Set(bd.proyectos.map((x) => x.id_proyecto)).size,
    bd.proyectos.length,
    'los ids de proyecto deben ser únicos',
  );
});

/* ── 2 · Los compromisos de un seguimiento llegan a la lista y a las alertas ── */

test('los compromisos nacidos de un seguimiento están en la lista general y alimentan las alertas', () => {
  const deSeguimiento = bd.compromisos.filter((c) => c.origen_tipo === 'seguimiento');
  assert.ok(deSeguimiento.length > 0);

  const lista = selCompromisos(bd, {}, HOY);
  for (const c of deSeguimiento) {
    assert.ok(lista.some((x) => x.id === c.id), `el compromiso ${c.id} debe estar en la lista general`);
  }

  const vencidos = lista.filter((c) => c.estado_efectivo === 'vencido');
  const alertas = calcularAlertas(bd, HOY).filter((a) => a.tipo === TIPOS_ALERTA.COMPROMISO_VENCIDO);
  assert.equal(vencidos.length, alertas.length, 'todo vencido de la lista debe tener su alerta');
});

/* ── 3 · Temas de monitoreo encadenados con estructura idéntica ── */

test('todos los temas de monitoreo tienen la misma estructura, sin importar cuántos lleve el monitoreo', () => {
  const CAMPOS = ['id_monitoreo', 'categoria', 'descripcion', 'criticidad', 'requiere_accion', 'resuelto'];
  for (const t of bd.temas_monitoreo) {
    for (const campo of CAMPOS) {
      assert.ok(campo in t, `el tema ${t.id} no tiene ${campo}`);
    }
  }
  // Hay monitoreos con varios temas: la carga encadenada no tiene tope
  const conteos = new Map();
  for (const t of bd.temas_monitoreo) conteos.set(t.id_monitoreo, (conteos.get(t.id_monitoreo) ?? 0) + 1);
  assert.ok(Math.max(...conteos.values()) >= 3);
});

test('un tema con acción requerida genera su compromiso; uno sin acción, no', () => {
  const conAccion = bd.temas_monitoreo.filter((t) => t.requiere_accion);
  const sinAccion = bd.temas_monitoreo.filter((t) => !t.requiere_accion);
  assert.ok(conAccion.length > 0 && sinAccion.length > 0);

  for (const t of conAccion) assert.ok(t.id_compromiso, `el tema ${t.id} debería haber generado compromiso`);
  for (const t of sinAccion) assert.ok(!t.id_compromiso, `el tema ${t.id} no debería tener compromiso`);

  const ids = new Set(bd.compromisos.map((c) => c.id));
  for (const t of conAccion) assert.ok(ids.has(t.id_compromiso));
});

/* ── 4 · Un compromiso vencido aparece en los tres lugares a la vez ── */

test('un compromiso vencido aparece en dashboard, panel de alertas e historial del área, con el mismo atraso', () => {
  const alertas = calcularAlertas(bd, HOY);
  const vencido = alertas.find((a) => a.tipo === TIPOS_ALERTA.COMPROMISO_VENCIDO && a.area);
  assert.ok(vencido, 'la demo debe traer un compromiso vencido con área');

  // (a) Dashboard — vencimientos próximos
  const enDashboard = vencimientosProximos(bd, HOY, 15).find((v) => v.ruta.includes(vencido.id_origen));
  assert.ok(enDashboard, 'debe figurar en los vencimientos del inicio');
  assert.equal(enDashboard.nivel, 'vencido');
  assert.equal(Math.abs(enDashboard.dias), vencido.dias_atraso, 'los días de atraso deben coincidir');

  // (b) Panel de alertas del módulo de monitoreo — misma función
  assert.ok(alertas.some((a) => a.id === vencido.id));

  // (c) Historial del área
  const historial = historialArea(bd, vencido.area, HOY);
  const enHistorial = historial.compromisos.find((c) => c.id === vencido.id_origen);
  assert.ok(enHistorial, 'debe figurar en el historial del área');
  assert.equal(enHistorial.estado_efectivo, 'vencido');
  assert.equal(enHistorial.dias_atraso, vencido.dias_atraso, 'los días de atraso deben coincidir');

  // (d) Y también en las alertas filtradas por área
  assert.ok(filtrarAlertas(alertas, { area: vencido.area }).some((a) => a.id === vencido.id));
});

/* ── 5 · Mesas separadas por tipo ── */

test('las mesas se agrupan por tipo sin necesidad de filtrar', () => {
  const porTipo = {};
  for (const m of activos(bd.mesas)) (porTipo[m.tipo] ??= []).push(m);
  assert.deepEqual(Object.keys(porTipo).sort(), ['barrial', 'otros proyectos', 'temática']);
  for (const [tipo, lista] of Object.entries(porTipo)) {
    assert.ok(lista.length > 0, `el tipo ${tipo} debe tener al menos una mesa`);
  }
});

/* ── 6 · Evento con requerimientos incompletos a 5 días ── */

test('un evento con requerimientos incompletos a 5 días o menos genera alerta', () => {
  const alerta = calcularAlertas(bd, HOY).find((a) => a.tipo === TIPOS_ALERTA.EVENTO_INCOMPLETO);
  assert.ok(alerta, 'la demo debe traer el evento en alerta');

  const evento = bd.eventos.find((e) => e.id === alerta.id_origen);
  assert.ok(diasHasta(evento.fecha, HOY) <= 5);
  assert.ok(resumenRequerimientos(bd, evento.id).pendientes > 0);
});

/* ── 7 · El reporte cambia según los filtros y los explicita ── */

test('el constructor produce un documento distinto según los filtros, con los filtros explicitados', () => {
  const areas = [...new Set(bd.proyectos.map((p) => p.area))];
  const a = armarReporte(bd, { area: areas[0] }, HOY);
  const b = armarReporte(bd, { area: areas[1], solo_obras: true }, HOY);

  assert.notDeepEqual(a.proyectos.map((p) => p.id_proyecto), b.proyectos.map((p) => p.id_proyecto));
  assert.notEqual(a.resumen.proyectos, b.resumen.proyectos);
  assert.ok(a.resumenFiltros.some((f) => f.includes(areas[0])));
  assert.ok(b.resumenFiltros.some((f) => f.includes('Sólo obras')));
});

/* ── 8 · Ningún dato requiere doble carga ── */

test('las entidades vinculadas referencian el proyecto por id, no lo redefinen', () => {
  // Ninguna colección vinculada guarda el NOMBRE del proyecto: sólo su id.
  for (const coleccion of ['compromisos', 'temas_monitoreo', 'eventos', 'planificacion_anual']) {
    for (const r of bd[coleccion]) {
      assert.ok(!('proyecto' in r), `${coleccion} no debe duplicar el nombre del proyecto`);
      assert.ok(!('objetivo' in r && 'avance' in r), `${coleccion} no debe duplicar las magnitudes`);
    }
  }
  // Y los compromisos no se duplican por origen: cada uno aparece una sola vez.
  assert.equal(new Set(bd.compromisos.map((c) => c.id)).size, bd.compromisos.length);
});

/* ── 9 · Demo puebla los siete módulos; vaciar deja el sistema navegable ── */

test('vaciar el sistema deja las colecciones limpias pero los catálogos utilizables', () => {
  const vacia = bdVacia();
  for (const coleccion of ['proyectos', 'seguimientos', 'compromisos', 'monitoreos', 'mesas', 'eventos']) {
    assert.equal(vacia[coleccion].length, 0);
  }
  // Los catálogos siguen ahí: sin ellos no se podría cargar nada después de vaciar
  assert.ok(vacia.catalogos.areas.length > 0);
  assert.ok(vacia.catalogos.tipos.length > 0);
  assert.equal(vacia.config.usuario, 'Coordinación');

  // Y todos los selectores toleran la base vacía sin romper
  assert.deepEqual(selProyectos(vacia, {}), []);
  assert.deepEqual(selCompromisos(vacia, {}, HOY), []);
  assert.deepEqual(calcularAlertas(vacia, HOY), []);
  assert.deepEqual(vencimientosProximos(vacia, HOY, 15), []);
  assert.equal(armarReporte(vacia, {}, HOY).resumen.proyectos, 0);
  // El panel de cobertura muestra las áreas del catálogo en cero
  assert.equal(monitoreosPorArea(vacia, {}).length, vacia.catalogos.areas.length);
});

/* ── 10 · Trazabilidad y borrado lógico ── */

test('toda entidad lleva creado_por y creado_en, y el borrado es lógico', () => {
  for (const coleccion of ['proyectos', 'seguimientos', 'compromisos', 'monitoreos', 'temas_monitoreo', 'mesas', 'eventos']) {
    for (const r of bd[coleccion]) {
      assert.ok(r.creado_por && r.creado_en, `${coleccion}: falta trazabilidad`);
      assert.ok('activo' in r, `${coleccion}: falta el campo de borrado lógico`);
    }
  }
});

test('la bitácora registra el antes y el después de cada edición', () => {
  const ediciones = bd.historial.filter((h) => h.accion === 'edicion');
  assert.ok(ediciones.length > 0);
  for (const h of ediciones) {
    assert.ok(h.cambios.length > 0, 'una edición sin cambios no debería asentarse');
    for (const c of h.cambios) {
      assert.ok('campo' in c && 'antes' in c && 'despues' in c);
    }
  }
});
