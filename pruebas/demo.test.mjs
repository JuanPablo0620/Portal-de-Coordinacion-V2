/**
 * El set de demostración tiene que poblar los siete módulos y contener los
 * casos de borde a propósito. Verificarlo acá evita descubrir en la demo que
 * un panel salió vacío.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generarDemo } from '../src/datos/demo.js';
import { calcularAlertas, TIPOS_ALERTA } from '../src/datos/alertas.js';
import { estadoCompromiso, resumenRequerimientos, mesasSinReunion, ultimaActualizacion, diasHasta } from '../src/datos/selectores.js';

const HOY = '2026-08-08';
const bd = generarDemo(HOY);

/* ── Cobertura de los siete módulos ───────────────────────────────── */

test('el set puebla todas las colecciones que alimentan los módulos', () => {
  for (const coleccion of [
    'proyectos',
    'seguimientos',
    'compromisos',
    'monitoreos',
    'temas_monitoreo',
    'mesas',
    'reuniones_mesa',
    'eventos',
    'requerimientos_evento',
    'planificacion_anual',
    'historial',
    'reportes_guardados',
  ]) {
    assert.ok(bd[coleccion].length > 0, `${coleccion} quedó vacía`);
  }
});

test('hay proyectos de todas las áreas del catálogo semilla', () => {
  const areasConProyectos = new Set(bd.proyectos.map((p) => p.area));
  // Las siete secretarías reales — ver la nota en catalogos.js (20/08/2026):
  // el generador ya no usa nombres de área inventados.
  assert.ok(areasConProyectos.size >= 7, 'se esperaban al menos 7 áreas representadas');
  assert.ok(bd.proyectos.length >= 30, 'se esperaban al menos 30 proyectos');
});

test('hay obras y no-obras, para que el contador de obras activas tenga sentido', () => {
  assert.ok(bd.proyectos.some((p) => p.es_obra === true));
  assert.ok(bd.proyectos.some((p) => p.es_obra === false));
});

test('hay proyectos en los cinco estados y en las tres prioridades', () => {
  const estados = new Set(bd.proyectos.map((p) => p.estado));
  for (const e of ['planificado', 'en ejecución', 'demorado', 'finalizado']) {
    assert.ok(estados.has(e), `falta el estado ${e}`);
  }
  const prioridades = new Set(bd.proyectos.map((p) => p.prioridad));
  assert.equal(prioridades.size, 3);
});

test('las mesas cubren los tres tipos, que se muestran en pestañas separadas', () => {
  const tipos = new Set(bd.mesas.map((m) => m.tipo));
  assert.deepEqual([...tipos].sort(), ['barrial', 'otros proyectos', 'temática']);
});

/* ── Casos de borde declarados ────────────────────────────────────── */

test('hay compromisos vencidos', () => {
  const vencidos = bd.compromisos.filter((c) => estadoCompromiso(c, HOY) === 'vencido');
  assert.ok(vencidos.length >= 4, `se esperaban al menos 4 vencidos, hay ${vencidos.length}`);
});

test('hay compromisos que vencen dentro de los próximos 7 días', () => {
  const proximos = bd.compromisos.filter((c) => {
    const d = diasHasta(c.fecha_limite, HOY);
    return c.estado !== 'cumplido' && d >= 0 && d <= 7;
  });
  assert.ok(proximos.length >= 3, `se esperaban al menos 3 próximos, hay ${proximos.length}`);
});

test('hay proyectos sin actualizar hace más de 30 días', () => {
  const sinActualizar = bd.proyectos.filter((p) => {
    const ultima = ultimaActualizacion(bd, p.id_proyecto);
    return ultima && Math.abs(diasHasta(ultima.slice(0, 10), HOY)) > 30;
  });
  assert.ok(sinActualizar.length >= 3, `se esperaban al menos 3, hay ${sinActualizar.length}`);
});

test('hay proyectos con fin previsto vencido y estado distinto de finalizado', () => {
  const vencidos = bd.proyectos.filter(
    (p) => p.estado !== 'finalizado' && diasHasta(p.fecha_fin_prevista, HOY) < 0,
  );
  assert.ok(vencidos.length >= 2, `se esperaban al menos 2, hay ${vencidos.length}`);
});

test('hay un evento próximo con requerimientos sin confirmar', () => {
  const conProblema = bd.eventos.filter((e) => {
    const d = diasHasta(e.fecha, HOY);
    if (d < 0 || d > 5) return false;
    return resumenRequerimientos(bd, e.id).pendientes > 0;
  });
  assert.ok(conProblema.length >= 1, 'falta el evento con requerimientos incompletos a ≤5 días');
});

test('hay temas de criticidad alta sin resolver', () => {
  const criticos = bd.temas_monitoreo.filter((t) => t.criticidad === 'alta' && !t.resuelto);
  assert.ok(criticos.length >= 3, `se esperaban al menos 3, hay ${criticos.length}`);
});

test('hay una mesa activa sin reunión más allá de su periodicidad', () => {
  assert.ok(mesasSinReunion(bd, HOY).length >= 1);
});

test('hay áreas sin monitoreos, para que el panel de cobertura sirva de algo', () => {
  const conMonitoreo = new Set(bd.monitoreos.map((m) => m.area));
  const todas = new Set(bd.proyectos.map((p) => p.area));
  assert.ok(conMonitoreo.size < todas.size, 'todas las áreas tienen monitoreo: no se ve la brecha');
});

test('la planificación tiene desvíos en ambos sentidos', () => {
  const conPlan = bd.planificacion_anual.map((plan) => {
    const p = bd.proyectos.find((x) => x.id_proyecto === plan.id_proyecto);
    const meta = plan.metas_trimestrales[2];
    return meta ? (p.avance / meta) * 100 : null;
  }).filter(Boolean);
  assert.ok(conPlan.some((c) => c >= 95), 'ningún proyecto cumple su meta');
  assert.ok(conPlan.some((c) => c < 60), 'ningún proyecto está muy atrasado');
});

/* ── Integridad referencial ───────────────────────────────────────── */

test('todo compromiso tiene origen declarado', () => {
  for (const c of bd.compromisos) {
    assert.ok(c.origen_tipo, `compromiso ${c.id} sin origen_tipo`);
    assert.ok(c.id_origen, `compromiso ${c.id} sin id_origen`);
    assert.ok(['seguimiento', 'monitoreo', 'mesa'].includes(c.origen_tipo));
  }
});

test('los compromisos nacen de los tres orígenes posibles', () => {
  const origenes = new Set(bd.compromisos.map((c) => c.origen_tipo));
  assert.deepEqual([...origenes].sort(), ['mesa', 'monitoreo', 'seguimiento']);
});

test('todo id_proyecto referenciado existe en la base maestra', () => {
  const ids = new Set(bd.proyectos.map((p) => p.id_proyecto));
  const referencias = [
    ...bd.compromisos.map((c) => c.id_proyecto),
    ...bd.temas_monitoreo.map((t) => t.id_proyecto),
    ...bd.eventos.map((e) => e.id_proyecto),
    ...bd.planificacion_anual.map((p) => p.id_proyecto),
    ...bd.seguimientos.flatMap((s) => s.ids_proyecto ?? []),
    ...bd.mesas.flatMap((m) => m.proyectos_vinculados ?? []),
  ].filter(Boolean);
  for (const ref of referencias) {
    assert.ok(ids.has(ref), `referencia a proyecto inexistente: ${ref}`);
  }
});

test('todo registro tiene trazabilidad y está activo', () => {
  for (const coleccion of ['proyectos', 'seguimientos', 'compromisos', 'monitoreos', 'mesas', 'eventos']) {
    for (const r of bd[coleccion]) {
      assert.ok(r.creado_por, `${coleccion} sin creado_por`);
      assert.ok(r.creado_en, `${coleccion} sin creado_en`);
      assert.equal(r.activo, true);
    }
  }
});

/* ── El motor de alertas encuentra lo que el set fabricó ──────────── */

test('el set produce alertas de todos los tipos previstos', () => {
  const tipos = new Set(calcularAlertas(bd, HOY).map((a) => a.tipo));
  for (const tipo of [
    TIPOS_ALERTA.COMPROMISO_VENCIDO,
    TIPOS_ALERTA.COMPROMISO_POR_VENCER,
    TIPOS_ALERTA.PROYECTO_VENCIDO,
    TIPOS_ALERTA.PROYECTO_SIN_ACTUALIZAR,
    TIPOS_ALERTA.TEMA_CRITICO,
    TIPOS_ALERTA.EVENTO_INCOMPLETO,
    TIPOS_ALERTA.MESA_SIN_REUNION,
  ]) {
    assert.ok(tipos.has(tipo), `el set no genera alertas de tipo ${tipo}`);
  }
});
