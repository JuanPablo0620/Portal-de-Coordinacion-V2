import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularAlertas, TIPOS_ALERTA, alertasPorTipo, vencimientosProximos } from '../src/datos/alertas.js';

const HOY = '2026-08-08';

const base = {
  catalogos: { areas: [] },
  proyectos: [],
  seguimientos: [],
  compromisos: [],
  monitoreos: [],
  temas_monitoreo: [],
  mesas: [],
  reuniones_mesa: [],
  eventos: [],
  requerimientos_evento: [],
  planificacion_anual: [],
  historial: [],
};

/* ── Compromisos ──────────────────────────────────────────────────── */

test('un compromiso vencido genera alerta crítica con los días de atraso', () => {
  const bd = {
    ...base,
    compromisos: [
      {
        id: 'c1', activo: true, estado: 'pendiente', fecha_limite: '2026-08-01',
        area: 'Obras', responsable: 'J. Pérez', id_proyecto: 'OBR-2026-001',
        descripcion: 'Enviar pliego',
      },
    ],
  };
  const a = calcularAlertas(bd, HOY);
  assert.equal(a.length, 1);
  assert.equal(a[0].tipo, TIPOS_ALERTA.COMPROMISO_VENCIDO);
  assert.equal(a[0].severidad, 'critica');
  assert.equal(a[0].dias_atraso, 7);
  assert.equal(a[0].responsable, 'J. Pérez');
  assert.equal(a[0].area, 'Obras');
  assert.ok(a[0].ruta_origen.includes('c1'), 'la alerta debe linkear a su registro de origen');
});

test('un compromiso cumplido fuera de término no genera alerta', () => {
  const bd = {
    ...base,
    compromisos: [{ id: 'c1', activo: true, estado: 'cumplido', fecha_limite: '2026-08-01', fecha_cumplimiento: '2026-08-06' }],
  };
  assert.equal(calcularAlertas(bd, HOY).length, 0);
});

test('un compromiso que vence dentro de 7 días genera alerta, uno a 8 días no', () => {
  const c = (id, f) => ({ id, activo: true, estado: 'pendiente', fecha_limite: f, descripcion: 'x' });
  const bd = { ...base, compromisos: [c('c1', '2026-08-14'), c('c2', '2026-08-16')] };
  const a = calcularAlertas(bd, HOY);
  assert.equal(a.length, 1);
  assert.equal(a[0].tipo, TIPOS_ALERTA.COMPROMISO_POR_VENCER);
  assert.equal(a[0].severidad, 'alta');
});

test('un compromiso sin fecha límite no genera alerta de vencimiento', () => {
  const bd = { ...base, compromisos: [{ id: 'c1', activo: true, estado: 'pendiente', fecha_limite: null }] };
  assert.equal(calcularAlertas(bd, HOY).length, 0);
});

/* ── Proyectos ────────────────────────────────────────────────────── */

test('un proyecto vencido y no finalizado alerta; uno finalizado no', () => {
  const p = (id, estado) => ({
    id_proyecto: id, activo: true, estado, fecha_fin_prevista: '2026-07-01',
    area: 'Obras', proyecto: `Proy ${id}`, responsable: 'R',
  });
  const bd = { ...base, proyectos: [p('P1', 'en ejecución'), p('P2', 'finalizado')] };
  const a = calcularAlertas(bd, HOY).filter((x) => x.tipo === TIPOS_ALERTA.PROYECTO_VENCIDO);
  assert.equal(a.length, 1);
  assert.equal(a[0].id_proyecto, 'P1');
  assert.equal(a[0].dias_atraso, 38);
});

test('un proyecto suspendido con fin vencido tampoco alerta', () => {
  const bd = {
    ...base,
    proyectos: [{ id_proyecto: 'P1', activo: true, estado: 'suspendido', fecha_fin_prevista: '2026-07-01', proyecto: 'x' }],
  };
  assert.equal(calcularAlertas(bd, HOY).filter((x) => x.tipo === TIPOS_ALERTA.PROYECTO_VENCIDO).length, 0);
});

test('un proyecto sin asientos hace más de 30 días alerta; uno reciente no', () => {
  const bd = {
    ...base,
    proyectos: [
      { id_proyecto: 'P1', activo: true, estado: 'en ejecución', proyecto: 'Uno', area: 'A' },
      { id_proyecto: 'P2', activo: true, estado: 'en ejecución', proyecto: 'Dos', area: 'A' },
    ],
    historial: [
      { id_proyecto: 'P1', creado_en: '2026-06-01T10:00:00' },
      { id_proyecto: 'P2', creado_en: '2026-08-05T10:00:00' },
    ],
  };
  const a = calcularAlertas(bd, HOY).filter((x) => x.tipo === TIPOS_ALERTA.PROYECTO_SIN_ACTUALIZAR);
  assert.equal(a.length, 1);
  assert.equal(a[0].id_proyecto, 'P1');
  assert.equal(a[0].dias_atraso, 68);
});

test('un proyecto finalizado no alerta por falta de actualización', () => {
  const bd = {
    ...base,
    proyectos: [{ id_proyecto: 'P1', activo: true, estado: 'finalizado', proyecto: 'x' }],
    historial: [{ id_proyecto: 'P1', creado_en: '2026-01-01T10:00:00' }],
  };
  assert.equal(calcularAlertas(bd, HOY).filter((x) => x.tipo === TIPOS_ALERTA.PROYECTO_SIN_ACTUALIZAR).length, 0);
});

/* ── Temas de monitoreo ───────────────────────────────────────────── */

test('un tema de criticidad alta sin resolver alerta', () => {
  const bd = {
    ...base,
    monitoreos: [{ id: 'm1', activo: true, area: 'Obras', fecha: '2026-07-20' }],
    temas_monitoreo: [
      { id: 't1', id_monitoreo: 'm1', activo: true, criticidad: 'alta', resuelto: false, descripcion: 'Sin cuadrilla' },
      { id: 't2', id_monitoreo: 'm1', activo: true, criticidad: 'alta', resuelto: true, descripcion: 'x' },
      { id: 't3', id_monitoreo: 'm1', activo: true, criticidad: 'media', resuelto: false, descripcion: 'x' },
    ],
  };
  const a = calcularAlertas(bd, HOY).filter((x) => x.tipo === TIPOS_ALERTA.TEMA_CRITICO);
  assert.equal(a.length, 1);
  assert.match(a[0].titulo, /Sin cuadrilla/);
});

/* ── Eventos ──────────────────────────────────────────────────────── */

test('un evento a 5 días o menos con requerimientos sin confirmar alerta', () => {
  const bd = {
    ...base,
    eventos: [
      { id: 'e1', activo: true, nombre: 'Feria', fecha: '2026-08-11', estado: 'confirmado', area_organizadora: 'Cultura' },
      { id: 'e2', activo: true, nombre: 'Muestra', fecha: '2026-09-20', estado: 'confirmado', area_organizadora: 'Cultura' },
    ],
    requerimientos_evento: [
      { id: 'r1', id_evento: 'e1', activo: true, estado: 'solicitado' },
      { id: 'r2', id_evento: 'e2', activo: true, estado: 'solicitado' },
    ],
  };
  const a = calcularAlertas(bd, HOY).filter((x) => x.tipo === TIPOS_ALERTA.EVENTO_INCOMPLETO);
  assert.equal(a.length, 1);
  assert.match(a[0].titulo, /Feria/);
});

test('un evento próximo con todo confirmado no alerta', () => {
  const bd = {
    ...base,
    eventos: [{ id: 'e1', activo: true, nombre: 'Feria', fecha: '2026-08-11', estado: 'confirmado' }],
    requerimientos_evento: [{ id: 'r1', id_evento: 'e1', activo: true, estado: 'confirmado' }],
  };
  assert.equal(calcularAlertas(bd, HOY).filter((x) => x.tipo === TIPOS_ALERTA.EVENTO_INCOMPLETO).length, 0);
});

test('un evento ya realizado no alerta aunque tenga requerimientos pendientes', () => {
  const bd = {
    ...base,
    eventos: [{ id: 'e1', activo: true, nombre: 'Feria', fecha: '2026-08-06', estado: 'realizado' }],
    requerimientos_evento: [{ id: 'r1', id_evento: 'e1', activo: true, estado: 'solicitado' }],
  };
  assert.equal(calcularAlertas(bd, HOY).filter((x) => x.tipo === TIPOS_ALERTA.EVENTO_INCOMPLETO).length, 0);
});

/* ── Mesas ────────────────────────────────────────────────────────── */

test('una mesa activa sin reunión más allá de su periodicidad alerta', () => {
  const bd = {
    ...base,
    mesas: [{ id: 'm1', activo: true, nombre: 'Mesa X', tipo: 'temática', periodicidad: 'mensual', estado: 'activa' }],
    reuniones_mesa: [{ id: 'r1', id_mesa: 'm1', activo: true, fecha: '2026-05-30' }],
  };
  const a = calcularAlertas(bd, HOY).filter((x) => x.tipo === TIPOS_ALERTA.MESA_SIN_REUNION);
  assert.equal(a.length, 1);
  assert.match(a[0].titulo, /Mesa X/);
});

/* ── Orden, agrupación y borrado lógico ───────────────────────────── */

test('las alertas salen ordenadas por severidad', () => {
  const bd = {
    ...base,
    compromisos: [
      { id: 'c1', activo: true, estado: 'pendiente', fecha_limite: '2026-08-12', descripcion: 'x' },
      { id: 'c2', activo: true, estado: 'pendiente', fecha_limite: '2026-07-20', descripcion: 'y' },
    ],
  };
  const a = calcularAlertas(bd, HOY);
  assert.equal(a[0].severidad, 'critica');
  assert.equal(a[1].severidad, 'alta');
});

test('dentro de la misma severidad, primero lo más atrasado', () => {
  const bd = {
    ...base,
    compromisos: [
      { id: 'c1', activo: true, estado: 'pendiente', fecha_limite: '2026-08-05', descripcion: 'x' },
      { id: 'c2', activo: true, estado: 'pendiente', fecha_limite: '2026-07-01', descripcion: 'y' },
    ],
  };
  const a = calcularAlertas(bd, HOY);
  assert.equal(a[0].id_origen, 'c2');
});

test('las bajas lógicas no generan alertas', () => {
  const bd = {
    ...base,
    compromisos: [{ id: 'c1', activo: false, estado: 'pendiente', fecha_limite: '2026-07-01' }],
    proyectos: [{ id_proyecto: 'P1', activo: false, estado: 'en ejecución', fecha_fin_prevista: '2026-01-01' }],
    temas_monitoreo: [{ id: 't1', activo: false, criticidad: 'alta', resuelto: false }],
  };
  assert.equal(calcularAlertas(bd, HOY).length, 0);
});

test('alertasPorTipo agrupa conservando el orden', () => {
  const bd = {
    ...base,
    compromisos: [
      { id: 'c1', activo: true, estado: 'pendiente', fecha_limite: '2026-08-01', descripcion: 'x' },
      { id: 'c2', activo: true, estado: 'pendiente', fecha_limite: '2026-08-12', descripcion: 'y' },
    ],
  };
  const grupos = alertasPorTipo(calcularAlertas(bd, HOY));
  assert.equal(grupos[TIPOS_ALERTA.COMPROMISO_VENCIDO].length, 1);
  assert.equal(grupos[TIPOS_ALERTA.COMPROMISO_POR_VENCER].length, 1);
});

/* ── Vencimientos del dashboard ───────────────────────────────────── */

test('vencimientosProximos unifica compromisos, hitos y fines previstos a 15 días', () => {
  const bd = {
    ...base,
    proyectos: [
      { id_proyecto: 'P1', activo: true, estado: 'en ejecución', proyecto: 'Obra A', area: 'Obras', fecha_fin_prevista: '2026-08-18' },
    ],
    compromisos: [{ id: 'c1', activo: true, estado: 'pendiente', fecha_limite: '2026-08-10', descripcion: 'Enviar pliego', area: 'Obras' }],
    planificacion_anual: [
      {
        id: 'pl1', activo: true, id_proyecto: 'P1', anio: 2026,
        hitos: [
          { id: 'h1', descripcion: 'Certificación', fecha: '2026-08-14' },
          { id: 'h2', descripcion: 'Cierre', fecha: '2026-12-01' },
        ],
      },
    ],
  };
  const v = vencimientosProximos(bd, HOY, 15);
  assert.equal(v.length, 3, 'compromiso + hito + fin previsto, sin el hito de diciembre');
  assert.deepEqual(v.map((x) => x.fecha), ['2026-08-10', '2026-08-14', '2026-08-18']);
});

test('vencimientosProximos incluye los ya vencidos, que son los urgentes', () => {
  const bd = {
    ...base,
    compromisos: [{ id: 'c1', activo: true, estado: 'pendiente', fecha_limite: '2026-08-01', descripcion: 'Atrasado' }],
  };
  const v = vencimientosProximos(bd, HOY, 15);
  assert.equal(v.length, 1);
  assert.equal(v[0].dias, -7);
  assert.equal(v[0].nivel, 'vencido');
});
