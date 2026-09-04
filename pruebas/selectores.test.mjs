import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activos,
  porcentajeAvance,
  estadoCompromiso,
  diasHasta,
  ultimaActualizacion,
  resumenRequerimientos,
  compromisos,
  proyectos,
  mesasSinReunion,
  desvioTrimestral,
  trimestreDe,
} from '../src/datos/selectores.js';

const HOY = '2026-08-08';

/* ── Derivación de avance ─────────────────────────────────────────── */

test('porcentajeAvance se acota a 100', () => {
  assert.equal(porcentajeAvance({ avance: 150, objetivo: 100 }), 100);
  assert.equal(porcentajeAvance({ avance: 25, objetivo: 100 }), 25);
});

test('porcentajeAvance devuelve 0 si el objetivo es cero o falta', () => {
  assert.equal(porcentajeAvance({ avance: 10, objetivo: 0 }), 0);
  assert.equal(porcentajeAvance({ avance: 10 }), 0);
  assert.equal(porcentajeAvance(null), 0);
});

/* ── Estado derivado de compromisos ───────────────────────────────── */

test('un compromiso con fecha pasada y sin cumplir es vencido', () => {
  assert.equal(estadoCompromiso({ estado: 'pendiente', fecha_limite: '2026-08-01' }, HOY), 'alerta');
});

test('un compromiso cumplido nunca es vencido, aunque la fecha haya pasado', () => {
  assert.equal(estadoCompromiso({ estado: 'cumplido', fecha_limite: '2026-08-01' }, HOY), 'cumplido');
});

test('un compromiso que vence hoy todavía no está vencido', () => {
  assert.equal(estadoCompromiso({ estado: 'pendiente', fecha_limite: HOY }, HOY), 'pendiente');
});

test('un compromiso en curso vencido pasa a vencido', () => {
  assert.equal(estadoCompromiso({ estado: 'en_curso', fecha_limite: '2026-07-01' }, HOY), 'alerta');
});

test('un compromiso sin fecha límite nunca vence', () => {
  assert.equal(estadoCompromiso({ estado: 'pendiente', fecha_limite: null }, HOY), 'pendiente');
});

/* ── Fechas ───────────────────────────────────────────────────────── */

test('diasHasta es negativo para fechas pasadas', () => {
  assert.equal(diasHasta('2026-08-11', HOY), 3);
  assert.equal(diasHasta('2026-08-05', HOY), -3);
  assert.equal(diasHasta(HOY, HOY), 0);
});

test('diasHasta cruza el cambio de mes sin desfasarse', () => {
  assert.equal(diasHasta('2026-09-01', '2026-08-31'), 1);
  assert.equal(diasHasta('2027-01-01', '2026-12-31'), 1);
});

test('trimestreDe ubica el mes en su trimestre', () => {
  assert.equal(trimestreDe('2026-01-15'), 1);
  assert.equal(trimestreDe('2026-04-01'), 2);
  assert.equal(trimestreDe('2026-08-08'), 3);
  assert.equal(trimestreDe('2026-12-31'), 4);
});

/* ── Borrado lógico ───────────────────────────────────────────────── */

test('activos filtra las bajas lógicas', () => {
  assert.equal(activos([{ activo: true }, { activo: false }, { activo: true }]).length, 2);
});

test('activos trata como activo lo que no tiene el campo', () => {
  assert.equal(activos([{}, { activo: false }]).length, 1);
});

/* ── Última actualización ─────────────────────────────────────────── */

test('ultimaActualizacion toma el asiento de bitácora más reciente del proyecto', () => {
  const bd = {
    historial: [
      { id_proyecto: 'OBR-2026-001', creado_en: '2026-07-01T10:00:00' },
      { id_proyecto: 'OBR-2026-001', creado_en: '2026-08-05T10:00:00' },
      { id_proyecto: 'OBR-2026-002', creado_en: '2026-08-07T10:00:00' },
    ],
  };
  assert.equal(ultimaActualizacion(bd, 'OBR-2026-001'), '2026-08-05T10:00:00');
  assert.equal(ultimaActualizacion(bd, 'OBR-2026-999'), null);
});

/* ── Requerimientos de evento ─────────────────────────────────────── */

test('resumenRequerimientos cuenta confirmados y entregados como confirmados', () => {
  const bd = {
    requerimientos_evento: [
      { id_evento: 'e1', estado: 'solicitado', activo: true },
      { id_evento: 'e1', estado: 'confirmado', activo: true },
      { id_evento: 'e1', estado: 'entregado', activo: true },
      { id_evento: 'e2', estado: 'solicitado', activo: true },
    ],
  };
  assert.deepEqual(resumenRequerimientos(bd, 'e1'), { total: 3, confirmados: 2, pendientes: 1, porcentaje: 67 });
});

test('resumenRequerimientos de un evento sin requerimientos no divide por cero', () => {
  assert.deepEqual(resumenRequerimientos({ requerimientos_evento: [] }, 'e1'), {
    total: 0,
    confirmados: 0,
    pendientes: 0,
    porcentaje: 0,
  });
});

/* ── Filtros combinables ──────────────────────────────────────────── */

test('proyectos aplica sólo los filtros presentes y omite los vacíos', () => {
  const bd = {
    proyectos: [
      { id_proyecto: 'A', area: 'Obras', estado: 'en ejecución', prioridad: 'alta', es_obra: true, activo: true },
      { id_proyecto: 'B', area: 'Salud', estado: 'finalizado', prioridad: 'baja', es_obra: false, activo: true },
      { id_proyecto: 'C', area: 'Obras', estado: 'en ejecución', prioridad: 'baja', es_obra: false, activo: false },
    ],
  };
  assert.equal(proyectos(bd, {}).length, 2, 'sin filtros devuelve los activos');
  assert.equal(proyectos(bd, { area: '' }).length, 2, 'un filtro vacío no filtra');
  assert.equal(proyectos(bd, { area: 'Obras' }).length, 1);
  assert.equal(proyectos(bd, { es_obra: true }).length, 1);
  assert.equal(proyectos(bd, { prioridad: 'alta', area: 'Obras' }).length, 1);
  assert.equal(proyectos(bd, { prioridad: 'alta', area: 'Salud' }).length, 0);
});

test('compromisos anexa estado_efectivo y dias_atraso', () => {
  const bd = {
    compromisos: [
      { id: 'c1', estado: 'pendiente', fecha_limite: '2026-08-01', activo: true },
      { id: 'c2', estado: 'cumplido', fecha_limite: '2026-08-01', activo: true },
    ],
  };
  const r = compromisos(bd, {}, HOY);
  assert.equal(r[0].estado_efectivo, 'alerta');
  assert.equal(r[0].dias_atraso, 7);
  assert.equal(r[1].estado_efectivo, 'cumplido');
  assert.equal(r[1].dias_atraso, 0);
});

test('compromisos filtra por el estado efectivo, no por el persistido', () => {
  const bd = {
    compromisos: [
      { id: 'c1', estado: 'pendiente', fecha_limite: '2026-08-01', activo: true },
      { id: 'c2', estado: 'pendiente', fecha_limite: '2026-09-01', activo: true },
    ],
  };
  assert.equal(compromisos(bd, { estado: 'alerta' }, HOY).length, 1);
  assert.equal(compromisos(bd, { estado: 'pendiente' }, HOY).length, 1);
});

/* ── Mesas ────────────────────────────────────────────────────────── */

test('mesasSinReunion compara la última reunión contra la periodicidad declarada', () => {
  const bd = {
    mesas: [
      { id: 'm1', nombre: 'Mensual atrasada', periodicidad: 'mensual', estado: 'activa', activo: true },
      { id: 'm2', nombre: 'Mensual al día', periodicidad: 'mensual', estado: 'activa', activo: true },
      { id: 'm3', nombre: 'Cerrada', periodicidad: 'mensual', estado: 'cerrada', activo: true },
    ],
    reuniones_mesa: [
      { id_mesa: 'm1', fecha: '2026-05-30', activo: true },
      { id_mesa: 'm2', fecha: '2026-08-01', activo: true },
      { id_mesa: 'm3', fecha: '2026-01-01', activo: true },
    ],
  };
  const r = mesasSinReunion(bd, HOY);
  assert.equal(r.length, 1, 'sólo la mensual atrasada; las cerradas no cuentan');
  assert.equal(r[0].id, 'm1');
  assert.ok(r[0].dias_sin_reunion > 30);
});

/* ── Planificación ────────────────────────────────────────────────── */

test('desvioTrimestral compara el avance acumulado contra la meta del trimestre', () => {
  const bd = {
    proyectos: [{ id_proyecto: 'A', proyecto: 'Obra A', area: 'Obras', avance: 60, activo: true }],
    planificacion_anual: [
      { id_proyecto: 'A', anio: 2026, metas_trimestrales: [25, 50, 75, 100], activo: true },
    ],
  };
  const r = desvioTrimestral(bd, 2026, 3);
  assert.equal(r.length, 1);
  assert.equal(r[0].meta, 75);
  assert.equal(r[0].real, 60);
  assert.equal(r[0].cumplimiento, 80);
  assert.equal(r[0].desvio, -15);
});

/* ── Ciclo de vida del compromiso (regla confirmada por JP el 01/09/2026) ── */

test('sumarDias no se corre un día por la zona horaria', async () => {
  const { sumarDias } = await import('../src/datos/tiempo.js');
  // En Argentina (UTC-3), construir la fecha en hora local devolvía el día
  // anterior. Seis semanas después del 01/09 es el 13/10, no el 12.
  assert.equal(sumarDias('2026-09-01', 42), '2026-10-13');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(sumarDias('', 42), '');
});

test('un compromiso vencido y abierto queda en alerta, no en su estado guardado', async () => {
  const { estadoCompromiso } = await import('../src/datos/selectores.js');
  const HOY_ = '2026-09-01';
  assert.equal(estadoCompromiso({ estado: 'pendiente', fecha_limite: '2026-08-01' }, HOY_), 'alerta');
  assert.equal(estadoCompromiso({ estado: 'en_curso', fecha_limite: '2026-08-01' }, HOY_), 'alerta');
  // Cumplido gana: aunque haya vencido, ya está hecho.
  assert.equal(estadoCompromiso({ estado: 'cumplido', fecha_limite: '2026-08-01' }, HOY_), 'cumplido');
  // Todavía no vence: conserva el estado guardado.
  assert.equal(estadoCompromiso({ estado: 'pendiente', fecha_limite: '2026-10-01' }, HOY_), 'pendiente');
});

test('sin fecha límite un compromiso NUNCA llega a alerta', async () => {
  const { estadoCompromiso } = await import('../src/datos/selectores.js');
  // Es el caso de los 124 compromisos históricos de los `_db`: quedan
  // pendientes para siempre. Por eso la fecha es obligatoria al cargar uno
  // nuevo desde el portal.
  assert.equal(estadoCompromiso({ estado: 'pendiente', fecha_limite: null }, '2026-09-01'), 'pendiente');
  assert.equal(estadoCompromiso({ estado: 'en_curso' }, '2026-09-01'), 'en_curso');
});
