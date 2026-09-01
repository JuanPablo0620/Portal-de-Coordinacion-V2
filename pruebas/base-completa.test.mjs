/**
 * La base completa tiene que cumplir todo lo que cumple el set chico —los siete
 * módulos poblados, los casos de borde, la integridad referencial— y además dos
 * cosas que sólo se pueden pedir a escala: volumen suficiente para que las
 * tablas y los tableros se prueben en serio, y distribuciones creíbles.
 *
 * Lo segundo es lo que más fácil se rompe al tocar el generador: alcanza con
 * mover una probabilidad para que todos los proyectos viejos queden
 * «finalizados» —y entonces no hay ni un proyecto vencido que mostrar— o para
 * que todas las áreas tengan deuda y el tablero salga entero en rojo. Por eso
 * acá se afirman rangos, no sólo presencia.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generarBaseCompleta, conteoBD } from '../src/datos/base-completa.js';
import { calcularAlertas, TIPOS_ALERTA } from '../src/datos/alertas.js';
import {
  compromisos,
  diasHasta,
  estadoCompromiso,
  mapaUltimaActualizacion,
  mesasSinReunion,
  proyectos,
  resumenRequerimientos,
  resumenSecretarias,
  serieAvance,
  ultimaActualizacion,
} from '../src/datos/selectores.js';

const HOY = '2026-08-10';
const bd = generarBaseCompleta(HOY);
const conteo = conteoBD(bd);

/* ── Volumen ──────────────────────────────────────────────────────── */

test('la base supera holgadamente los mil registros', () => {
  assert.ok(conteo.total >= 1000, `se esperaban al menos 1000 registros, hay ${conteo.total}`);
});

test('cada colección tiene el volumen que justifica su módulo', () => {
  const minimos = {
    proyectos: 200,
    seguimientos: 150,
    compromisos: 500,
    monitoreos: 120,
    temas_monitoreo: 400,
    mesas: 12,
    reuniones_mesa: 120,
    eventos: 50,
    requerimientos_evento: 250,
    planificacion_anual: 150,
    historial: 2000,
    reportes_guardados: 4,
  };
  for (const [coleccion, minimo] of Object.entries(minimos)) {
    assert.ok(
      bd[coleccion].length >= minimo,
      `${coleccion}: se esperaban al menos ${minimo}, hay ${bd[coleccion].length}`,
    );
  }
});

test('la base persistida entra en la cuota del almacenamiento del navegador', () => {
  // El límite real ronda los 5 MB. Si el generador crece más allá de la mitad
  // de esa cuota, hay que enterarse acá y no cuando el navegador rechace la
  // escritura y el usuario pierda lo cargado.
  const megas = JSON.stringify(bd).length / 1_048_576;
  assert.ok(megas < 3.5, `la base ocupa ${megas.toFixed(2)} MB`);
});

test('el set es determinístico: dos generaciones producen los mismos datos', () => {
  const otra = generarBaseCompleta(HOY);
  // Los ids internos llevan marca de tiempo, así que se comparan los datos.
  const sinIds = (b) => b.proyectos.map((p) => `${p.id_proyecto}|${p.proyecto}|${p.estado}|${p.avance}`);
  assert.deepEqual(sinIds(otra), sinIds(bd));
  assert.equal(conteoBD(otra).total, conteo.total);
});

/* ── Cobertura institucional ──────────────────────────────────────── */

test('hay catorce áreas y todas tienen proyectos', () => {
  const delCatalogo = bd.catalogos.areas.filter((a) => a.activo !== false);
  assert.ok(delCatalogo.length >= 14, `se esperaban 14 áreas, hay ${delCatalogo.length}`);
  const conProyectos = new Set(bd.proyectos.map((p) => p.area));
  for (const area of delCatalogo) {
    assert.ok(conProyectos.has(area.nombre), `${area.nombre} no tiene ningún proyecto`);
  }
});

test('los proyectos cubren tres años de gestión', () => {
  const anios = new Set(bd.proyectos.map((p) => p.fecha_inicio.slice(0, 4)));
  assert.ok(anios.size >= 3, `se esperaban 3 años de proyectos, hay ${[...anios].join(', ')}`);
});

test('los id de proyecto respetan la nomenclatura PREFIJO-AAAA-NNN y son únicos', () => {
  const vistos = new Set();
  for (const p of bd.proyectos) {
    assert.match(p.id_proyecto, /^[A-Z]{3,4}-\d{4}-\d{3}$/, `id inválido: ${p.id_proyecto}`);
    assert.ok(!vistos.has(p.id_proyecto), `id repetido: ${p.id_proyecto}`);
    vistos.add(p.id_proyecto);
  }
});

test('los nombres de proyecto no se repiten', () => {
  const nombres = bd.proyectos.map((p) => p.proyecto);
  assert.equal(new Set(nombres).size, nombres.length, 'hay nombres de proyecto duplicados');
});

test('hay proyectos en los cinco estados y en las tres prioridades', () => {
  const estados = new Set(bd.proyectos.map((p) => p.estado));
  for (const e of ['planificado', 'en ejecución', 'demorado', 'finalizado', 'suspendido']) {
    assert.ok(estados.has(e), `falta el estado ${e}`);
  }
  assert.equal(new Set(bd.proyectos.map((p) => p.prioridad)).size, 3);
});

test('el avance es coherente con el estado declarado', () => {
  for (const p of bd.proyectos) {
    if (p.estado === 'finalizado') assert.equal(p.avance, p.objetivo, `${p.id_proyecto} finalizado sin completar`);
    if (p.estado === 'planificado') assert.equal(p.avance, 0, `${p.id_proyecto} planificado con avance`);
    assert.ok(p.avance <= p.objetivo, `${p.id_proyecto} avanza más que su objetivo`);
  }
});

test('las mesas cubren los tres tipos y los tres estados', () => {
  assert.deepEqual([...new Set(bd.mesas.map((m) => m.tipo))].sort(), ['barrial', 'otros proyectos', 'temática']);
  const estados = new Set(bd.mesas.map((m) => m.estado));
  assert.ok(estados.has('activa') && estados.has('latente'));
});

/* ── Bajas lógicas ────────────────────────────────────────────────── */

test('hay proyectos dados de baja y los selectores no los muestran', () => {
  const bajas = bd.proyectos.filter((p) => p.activo === false);
  assert.ok(bajas.length >= 3, `se esperaban al menos 3 bajas, hay ${bajas.length}`);
  const listados = new Set(proyectos(bd).map((p) => p.id_proyecto));
  for (const p of bajas) assert.ok(!listados.has(p.id_proyecto), `${p.id_proyecto} dado de baja pero listado`);
});

test('cada baja de proyecto dejó su asiento en la bitácora', () => {
  for (const p of bd.proyectos.filter((x) => x.activo === false)) {
    const asientos = bd.historial.filter((h) => h.id_entidad === p.id_proyecto && h.accion === 'baja');
    assert.ok(asientos.length >= 1, `${p.id_proyecto} sin asiento de baja`);
  }
});

test('hay ítems de catálogo dados de baja', () => {
  const conBaja = Object.values(bd.catalogos).filter((items) => items.some((i) => i.activo === false));
  assert.ok(conBaja.length >= 2, 'ningún catálogo tiene ítems dados de baja');
});

/* ── Distribuciones creíbles ──────────────────────────────────────── */

test('la mayoría de los compromisos vencidos ya está cumplida', () => {
  const lista = compromisos(bd, {}, HOY);
  const cumplidos = lista.filter((c) => c.estado_efectivo === 'cumplido').length;
  const proporcion = cumplidos / lista.length;
  assert.ok(proporcion > 0.6, `sólo el ${Math.round(proporcion * 100)}% está cumplido`);
  assert.ok(proporcion < 0.97, `el ${Math.round(proporcion * 100)}% está cumplido: no queda deuda que mostrar`);
});

test('la deuda se concentra en algunas áreas y no en todas', () => {
  const resumenes = resumenSecretarias(bd, {}, HOY);
  const conDeuda = resumenes.filter((r) => r.compromisos.vencidos > 0);
  assert.ok(conDeuda.length >= 2, 'ninguna área acumula compromisos vencidos');
  assert.ok(
    conDeuda.length <= resumenes.length - 3,
    'todas las áreas tienen deuda: el semáforo del tablero no distingue nada',
  );
});

test('el tablero de secretarías muestra al menos tres niveles distintos', () => {
  const niveles = new Set(resumenSecretarias(bd, {}, HOY).map((r) => r.nivel));
  assert.ok(niveles.size >= 3, `el tablero sale casi uniforme: ${[...niveles].join(', ')}`);
});

test('hay áreas sin ninguna cobertura de monitoreo', () => {
  const conMonitoreo = new Set(bd.monitoreos.map((m) => m.area));
  const todas = new Set(bd.proyectos.map((p) => p.area));
  assert.ok(todas.size - conMonitoreo.size >= 2, 'no se ve la brecha de cobertura');
});

test('cada proyecto con avance tiene su serie en la bitácora', () => {
  const conAvance = bd.proyectos.filter((p) => p.activo !== false && p.avance > 0);
  const conSerie = conAvance.filter((p) => serieAvance(bd, p.id_proyecto).length >= 2);
  const proporcion = conSerie.length / conAvance.length;
  assert.ok(proporcion > 0.8, `sólo el ${Math.round(proporcion * 100)}% de los proyectos tiene serie de avance`);
});

test('la planificación tiene desvíos en ambos sentidos', () => {
  const cumplimientos = bd.planificacion_anual
    .map((plan) => {
      const p = bd.proyectos.find((x) => x.id_proyecto === plan.id_proyecto);
      const meta = plan.metas_trimestrales[2];
      return p && meta ? (p.avance / meta) * 100 : null;
    })
    .filter(Boolean);
  assert.ok(cumplimientos.some((c) => c >= 95), 'ningún proyecto cumple su meta');
  assert.ok(cumplimientos.some((c) => c < 60), 'ningún proyecto está muy atrasado');
});

/* ── Casos de borde declarados ────────────────────────────────────── */

test('hay compromisos vencidos, en cantidad de tablero y no de anécdota', () => {
  const vencidos = bd.compromisos.filter((c) => estadoCompromiso(c, HOY) === 'alerta');
  assert.ok(vencidos.length >= 15, `se esperaban al menos 15 vencidos, hay ${vencidos.length}`);
});

test('hay compromisos que vencen dentro de los próximos 7 días', () => {
  const proximos = bd.compromisos.filter((c) => {
    const d = diasHasta(c.fecha_limite, HOY);
    return c.estado !== 'cumplido' && d >= 0 && d <= 7;
  });
  assert.ok(proximos.length >= 5, `se esperaban al menos 5 próximos, hay ${proximos.length}`);
});

test('hay proyectos activos sin actualizar hace más de 30 días', () => {
  const sinActualizar = proyectos(bd).filter((p) => {
    const ultima = ultimaActualizacion(bd, p.id_proyecto);
    return ultima && Math.abs(diasHasta(ultima.slice(0, 10), HOY)) > 30;
  });
  assert.ok(sinActualizar.length >= 10, `se esperaban al menos 10, hay ${sinActualizar.length}`);
});

test('hay proyectos con fin previsto vencido y estado distinto de finalizado', () => {
  const vencidos = bd.proyectos.filter(
    (p) => p.activo !== false && ['planificado', 'en ejecución', 'demorado'].includes(p.estado) &&
      diasHasta(p.fecha_fin_prevista, HOY) < 0,
  );
  assert.ok(vencidos.length >= 3, `se esperaban al menos 3, hay ${vencidos.length}`);
});

test('hay eventos próximos con requerimientos sin confirmar', () => {
  const conProblema = bd.eventos.filter((e) => {
    const d = diasHasta(e.fecha, HOY);
    if (d < 0 || d > 5) return false;
    return resumenRequerimientos(bd, e.id).pendientes > 0;
  });
  assert.ok(conProblema.length >= 1, 'falta el evento con requerimientos incompletos a ≤5 días');
});

test('hay temas de criticidad alta sin resolver', () => {
  const criticos = bd.temas_monitoreo.filter((t) => t.criticidad === 'alta' && !t.resuelto);
  assert.ok(criticos.length >= 5, `se esperaban al menos 5, hay ${criticos.length}`);
});

test('hay mesas activas sin reunión más allá de su periodicidad', () => {
  assert.ok(mesasSinReunion(bd, HOY).length >= 1);
});

/* ── Integridad referencial ───────────────────────────────────────── */

test('todo compromiso tiene origen declarado y de los tres tipos previstos', () => {
  for (const c of bd.compromisos) {
    assert.ok(c.origen_tipo && c.id_origen, `compromiso ${c.id} sin origen`);
    assert.ok(['seguimiento', 'monitoreo', 'mesa'].includes(c.origen_tipo));
  }
  assert.deepEqual(
    [...new Set(bd.compromisos.map((c) => c.origen_tipo))].sort(),
    ['mesa', 'monitoreo', 'seguimiento'],
  );
});

test('el id_origen de cada compromiso apunta a un registro que existe', () => {
  const porTipo = {
    seguimiento: new Set(bd.seguimientos.map((s) => s.id)),
    monitoreo: new Set(bd.monitoreos.map((m) => m.id)),
    mesa: new Set(bd.mesas.map((m) => m.id)),
  };
  for (const c of bd.compromisos) {
    assert.ok(porTipo[c.origen_tipo].has(c.id_origen), `compromiso ${c.id} apunta a un origen inexistente`);
  }
});

test('toda referencia a un proyecto apunta a un proyecto vigente', () => {
  const vigentes = new Set(bd.proyectos.filter((p) => p.activo !== false).map((p) => p.id_proyecto));
  const referencias = [
    ...bd.compromisos.map((c) => c.id_proyecto),
    ...bd.temas_monitoreo.map((t) => t.id_proyecto),
    ...bd.eventos.map((e) => e.id_proyecto),
    ...bd.planificacion_anual.map((p) => p.id_proyecto),
    ...bd.seguimientos.flatMap((s) => s.ids_proyecto ?? []),
    ...bd.mesas.flatMap((m) => m.proyectos_vinculados ?? []),
  ].filter(Boolean);
  for (const ref of referencias) {
    assert.ok(vigentes.has(ref), `referencia a un proyecto inexistente o dado de baja: ${ref}`);
  }
});

test('todo tema pertenece a un monitoreo y todo requerimiento a un evento', () => {
  const monitoreos = new Set(bd.monitoreos.map((m) => m.id));
  for (const t of bd.temas_monitoreo) assert.ok(monitoreos.has(t.id_monitoreo), `tema huérfano: ${t.id}`);
  const eventos = new Set(bd.eventos.map((e) => e.id));
  for (const r of bd.requerimientos_evento) assert.ok(eventos.has(r.id_evento), `requerimiento huérfano: ${r.id}`);
  const mesas = new Set(bd.mesas.map((m) => m.id));
  for (const r of bd.reuniones_mesa) assert.ok(mesas.has(r.id_mesa), `reunión huérfana: ${r.id}`);
});

test('todo tema que requiere acción tiene su compromiso creado', () => {
  const compromisosPorId = new Set(bd.compromisos.map((c) => c.id));
  for (const t of bd.temas_monitoreo.filter((x) => x.requiere_accion)) {
    assert.ok(t.id_compromiso, `tema ${t.id} requiere acción y no tiene compromiso`);
    assert.ok(compromisosPorId.has(t.id_compromiso), `tema ${t.id} apunta a un compromiso inexistente`);
  }
});

test('ninguna planificación duplica proyecto y año', () => {
  const claves = bd.planificacion_anual.map((p) => `${p.id_proyecto}|${p.anio}`);
  assert.equal(new Set(claves).size, claves.length, 'hay planificaciones duplicadas para el mismo año');
});

test('todo registro tiene trazabilidad', () => {
  for (const coleccion of [
    'proyectos', 'seguimientos', 'compromisos', 'monitoreos', 'temas_monitoreo',
    'mesas', 'reuniones_mesa', 'eventos', 'requerimientos_evento', 'planificacion_anual',
  ]) {
    for (const r of bd[coleccion]) {
      assert.ok(r.creado_por, `${coleccion} sin creado_por`);
      assert.match(String(r.creado_en), /^\d{4}-\d{2}-\d{2}T/, `${coleccion} con creado_en inválido`);
    }
  }
});

test('ninguna fecha de carga queda en el futuro', () => {
  for (const p of bd.proyectos) {
    assert.ok(p.fecha_inicio <= HOY, `${p.id_proyecto} arranca en el futuro`);
    assert.ok(p.creado_en.slice(0, 10) <= HOY, `${p.id_proyecto} se creó en el futuro`);
  }
  for (const s of bd.seguimientos.filter((x) => x.tipo === 'realizado')) {
    assert.ok(s.fecha <= HOY, 'hay un seguimiento «realizado» con fecha futura');
  }
  for (const m of bd.monitoreos) assert.ok(m.fecha <= HOY, 'hay un monitoreo con fecha futura');
});

test('la bitácora está ordenada y el índice de última actualización coincide', () => {
  for (let i = 1; i < bd.historial.length; i += 1) {
    assert.ok(
      String(bd.historial[i - 1].creado_en) <= String(bd.historial[i].creado_en),
      'la bitácora no quedó ordenada por fecha',
    );
  }
  const mapa = mapaUltimaActualizacion(bd);
  for (const p of bd.proyectos.slice(0, 40)) {
    assert.equal(mapa.get(p.id_proyecto) ?? null, ultimaActualizacion(bd, p.id_proyecto));
  }
});

/* ── El motor de alertas encuentra lo que el set fabricó ──────────── */

test('el set produce alertas de todos los tipos previstos', () => {
  const alertas = calcularAlertas(bd, HOY);
  const tipos = new Set(alertas.map((a) => a.tipo));
  for (const tipo of Object.values(TIPOS_ALERTA)) {
    assert.ok(tipos.has(tipo), `el set no genera alertas de tipo ${tipo}`);
  }
  // Suficientes para que el panel tenga que agrupar y paginar de verdad.
  assert.ok(alertas.length >= 40, `se esperaban al menos 40 alertas, hay ${alertas.length}`);
});

test('ninguna alerta apunta a un proyecto dado de baja', () => {
  const vigentes = new Set(bd.proyectos.filter((p) => p.activo !== false).map((p) => p.id_proyecto));
  for (const a of calcularAlertas(bd, HOY)) {
    if (a.id_proyecto) assert.ok(vigentes.has(a.id_proyecto), `alerta sobre proyecto no vigente: ${a.id_proyecto}`);
  }
});
