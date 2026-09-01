/**
 * Tablero por secretaría e historial unificado de proyecto.
 *
 * Lo que se fija acá es la SEMÁNTICA de los agregados, que es donde un cambio
 * silencioso hace más daño: qué recorta el período y qué no, cuándo una
 * secretaría se pinta de rojo, y de qué se compone el historial de un proyecto.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPAS_HISTORIAL,
  etiquetaMes,
  historialUnificado,
  mesesHasta,
  nivelSecretaria,
  nombresAreas,
  resumenSecretaria,
  resumenSecretarias,
  temasDeArea,
} from '../src/datos/selectores.js';

const HOY = '2026-08-08';

const OBRAS = 'Secretaría de Obras Públicas';
const SALUD = 'Secretaría de Salud';

/** Base mínima con dos secretarías en situaciones opuestas. */
function baseDePrueba(cambios = {}) {
  return {
    catalogos: {
      areas: [
        { id: 'a1', nombre: OBRAS, prefijo: 'OBR', activo: true },
        { id: 'a2', nombre: SALUD, prefijo: 'SAL', activo: true },
      ],
    },
    proyectos: [
      { id_proyecto: 'OBR-2026-001', proyecto: 'Pavimento', area: OBRAS, estado: 'en ejecución', objetivo: 100, avance: 40, activo: true },
      { id_proyecto: 'SAL-2026-001', proyecto: 'Postas', area: SALUD, estado: 'finalizado', objetivo: 50, avance: 50, activo: true },
    ],
    monitoreos: [
      { id: 'm1', area: OBRAS, fecha: '2026-08-05', activo: true },
      { id: 'm2', area: OBRAS, fecha: '2026-06-10', activo: true },
    ],
    temas_monitoreo: [
      { id: 't1', id_monitoreo: 'm1', categoria: 'Operativo', descripcion: 'Falta cemento', criticidad: 'alta', resuelto: false, id_proyecto: 'OBR-2026-001', activo: true },
      { id: 't2', id_monitoreo: 'm1', categoria: 'Operativo', descripcion: 'Corte de calle', criticidad: 'baja', resuelto: true, activo: true },
      { id: 't3', id_monitoreo: 'm2', categoria: 'Presupuestario', descripcion: 'Ampliación', criticidad: 'media', resuelto: false, activo: true },
    ],
    seguimientos: [
      { id: 's1', area: OBRAS, fecha: '2026-08-01', tipo: 'realizado', resumen: 'Avanza', ids_proyecto: ['OBR-2026-001'], activo: true },
    ],
    compromisos: [
      { id: 'c1', area: OBRAS, descripcion: 'Comprar cemento', origen_tipo: 'monitoreo', id_origen: 'm1', id_proyecto: 'OBR-2026-001', estado: 'pendiente', fecha_limite: '2026-07-01', activo: true },
      { id: 'c2', area: OBRAS, descripcion: 'Informe', origen_tipo: 'monitoreo', id_origen: 'm1', estado: 'cumplido', fecha_limite: '2026-08-20', activo: true },
    ],
    historial: [
      { id: 'h1', entidad: 'proyectos', id_entidad: 'OBR-2026-001', id_proyecto: 'OBR-2026-001', accion: 'edicion', cambios: [{ campo: 'avance', antes: 20, despues: 40 }], creado_por: 'Coordinación', creado_en: '2026-08-04T10:00:00.000Z', secuencia: 1 },
      // Asiento de una entidad VINCULADA: el compromiso ya viaja en su propia
      // capa, así que no tiene que volver a aparecer como «cambio de ficha».
      { id: 'h2', entidad: 'compromisos', id_entidad: 'c1', id_proyecto: 'OBR-2026-001', accion: 'alta', cambios: [], creado_por: 'Coordinación', creado_en: '2026-08-05T10:00:00.000Z', secuencia: 2 },
    ],
    mesas: [
      { id: 'me1', nombre: 'Obras del oeste', tipo: 'barrial', estado: 'activa', periodicidad: 'mensual', proyectos_vinculados: ['OBR-2026-001'], activo: true },
    ],
    reuniones_mesa: [
      { id: 'r1', id_mesa: 'me1', fecha: '2026-07-20', asistentes: 'Vecinos', temas: 'Estado de la obra', activo: true },
    ],
    eventos: [
      { id: 'e1', nombre: 'Inauguración del tramo 1', fecha: '2026-09-15', tipo: 'Inauguración', lugar: 'Av. San Martín', area_organizadora: OBRAS, id_proyecto: 'OBR-2026-001', estado: 'previsto', activo: true },
    ],
    requerimientos_evento: [],
    planificacion_anual: [
      {
        id: 'p1',
        id_proyecto: 'OBR-2026-001',
        anio: 2026,
        meta_anual: 100,
        metas_trimestrales: [25, 50, 75, 100],
        hitos: [{ id: 'hi1', descripcion: 'Certificación intermedia', fecha: '2026-06-30' }],
        activo: true,
      },
    ],
    reportes_guardados: [],
    ...cambios,
  };
}

/* ── Meses ────────────────────────────────────────────────────────── */

test('mesesHasta devuelve los últimos meses y cruza el fin de año', () => {
  assert.deepEqual(mesesHasta('2026-03-15', 4), ['2025-12', '2026-01', '2026-02', '2026-03']);
  assert.deepEqual(mesesHasta('2026-01-01', 2), ['2025-12', '2026-01']);
});

test('mesesHasta devuelve vacío ante una fecha inválida en lugar de romper', () => {
  assert.deepEqual(mesesHasta('', 3), []);
  assert.deepEqual(mesesHasta('sin-fecha', 3), []);
});

test('etiquetaMes abrevia el mes en español y el año en dos dígitos', () => {
  assert.equal(etiquetaMes('2026-08'), 'ago 26');
  assert.equal(etiquetaMes('2025-12'), 'dic 25');
});

/* ── Universo de secretarías ──────────────────────────────────────── */

test('nombresAreas sale sólo del catálogo, nunca de valores sueltos en los datos', () => {
  // Antes se completaba con cualquier `area` encontrada en proyectos, monitoreos,
  // seguimientos y compromisos: un nombre mal tipeado o desactualizado generaba
  // una tarjeta de secretaría fantasma en la grilla de Monitoreo, en vez de una
  // sola por secretaría real. El catálogo es la única fuente de verdad.
  const bd = baseDePrueba({
    monitoreos: [{ id: 'm9', area: 'Dirección de Ambiente', fecha: '2026-08-01', activo: true }],
  });
  const nombres = nombresAreas(bd);
  assert.ok(
    !nombres.includes('Dirección de Ambiente'),
    'un área que no está en el catálogo no debe generar una tarjeta propia',
  );
  assert.deepEqual(nombres, [OBRAS, SALUD], 'sólo las del catálogo, en orden alfabético');
});

test('nombresAreas no repite una secretaría aunque tenga muchos registros con su nombre', () => {
  const bd = baseDePrueba({
    proyectos: [{ id: 'p9', area: OBRAS, activo: true }],
    monitoreos: [
      { id: 'm9', area: OBRAS, fecha: '2026-08-01', activo: true },
      { id: 'm10', area: OBRAS, fecha: '2026-08-02', activo: true },
    ],
  });
  const nombres = nombresAreas(bd);
  assert.equal(nombres.filter((n) => n === OBRAS).length, 1, 'una sola aparición por secretaría');
});

test('resumenSecretarias arma una tarjeta por secretaría', () => {
  const resumenes = resumenSecretarias(baseDePrueba(), {}, HOY);
  assert.equal(resumenes.length, 2);
  assert.deepEqual(
    [...resumenes].map((r) => r.area).sort(),
    [SALUD, OBRAS].sort(),
  );
});

test('resumenSecretarias ordena primero las secretarías que necesitan intervención', () => {
  const resumenes = resumenSecretarias(baseDePrueba(), {}, HOY);
  assert.equal(resumenes[0].area, OBRAS, 'la que tiene un compromiso vencido va primero');
  assert.equal(resumenes[0].nivel, 'vencido');
});

/* ── Agregados de una secretaría ──────────────────────────────────── */

test('resumenSecretaria contabiliza monitoreos, temas y seguimientos del área', () => {
  const r = resumenSecretaria(baseDePrueba(), OBRAS, {}, HOY);
  assert.equal(r.monitoreos, 2);
  assert.equal(r.temas.total, 3);
  assert.equal(r.temas.sin_resolver, 2);
  assert.equal(r.temas.alta_sin_resolver, 1);
  assert.equal(r.temas.alta, 1);
  assert.equal(r.temas.baja, 1);
  assert.equal(r.seguimientos, 1);
  assert.equal(r.criticidad_maxima, 'alta');
});

test('el período recorta los monitoreos contabilizados', () => {
  const r = resumenSecretaria(baseDePrueba(), OBRAS, { desde: '2026-07-01' }, HOY);
  assert.equal(r.monitoreos, 1, 'el de junio queda fuera de la ventana');
  assert.equal(r.temas.total, 2);
});

test('el período NO recorta los compromisos: un vencido fuera de la ventana se sigue viendo', () => {
  const r = resumenSecretaria(baseDePrueba(), OBRAS, { desde: '2026-08-01' }, HOY);
  assert.equal(r.compromisos.vencidos, 1, 'el compromiso vence en julio y la ventana arranca en agosto');
  assert.equal(r.compromisos.cumplidos, 1);
});

test('ultimo_monitoreo se mide sobre toda la historia, no sobre el período', () => {
  const r = resumenSecretaria(baseDePrueba(), OBRAS, { desde: '2026-08-06', hasta: '2026-08-08' }, HOY);
  assert.equal(r.monitoreos, 0, 'no hubo monitoreos dentro de la ventana');
  assert.equal(r.ultimo_monitoreo, '2026-08-05', 'pero el área sí fue monitoreada hace poco');
  assert.equal(r.dias_sin_monitoreo, 3);
});

test('una secretaría sin monitoreos nunca reporta días sin monitoreo inventados', () => {
  const r = resumenSecretaria(baseDePrueba(), SALUD, {}, HOY);
  assert.equal(r.ultimo_monitoreo, null);
  assert.equal(r.dias_sin_monitoreo, null);
  assert.equal(r.monitoreos, 0);
});

test('el avance agregado suma objetivos y avances de los proyectos del área', () => {
  const r = resumenSecretaria(baseDePrueba(), OBRAS, {}, HOY);
  assert.equal(r.proyectos.total, 1);
  assert.equal(r.proyectos.activos, 1);
  assert.equal(r.proyectos.porcentaje_avance, 40);
});

test('la serie mensual cubre seis meses aunque estén en cero', () => {
  const r = resumenSecretaria(baseDePrueba(), OBRAS, {}, HOY);
  assert.equal(r.serie.length, 6);
  assert.equal(r.serie.at(-1).mes, '2026-08');
  assert.equal(r.serie.at(-1).monitoreos, 1);
  assert.equal(r.serie.find((s) => s.mes === '2026-07').monitoreos, 0);
});

test('la serie mensual cuenta el histórico: el filtro no fabrica meses en cero', () => {
  const r = resumenSecretaria(baseDePrueba(), OBRAS, { desde: '2026-07-01' }, HOY);
  assert.equal(r.monitoreos, 1, 'la métrica sí respeta la ventana');
  assert.equal(
    r.serie.find((s) => s.mes === '2026-06').monitoreos,
    1,
    'junio tuvo un monitoreo: dibujarlo en cero sería inventar una falta de cobertura',
  );
});

test('las acciones comprometidas sin resolver se cuentan aparte de los temas abiertos', () => {
  const bd = baseDePrueba();
  bd.temas_monitoreo[0].requiere_accion = true;
  bd.temas_monitoreo[0].responsable = 'Vialidad';
  const r = resumenSecretaria(bd, OBRAS, {}, HOY);
  assert.equal(r.temas.sin_resolver, 2);
  assert.equal(r.temas.acciones_pendientes, 1);
});

test('el próximo seguimiento es el primero agendado a futuro, no el último realizado', () => {
  const bd = baseDePrueba();
  bd.seguimientos.push(
    { id: 's2', area: OBRAS, fecha: '2026-09-10', tipo: 'programado', ids_proyecto: [], activo: true },
    { id: 's3', area: OBRAS, fecha: '2026-08-20', tipo: 'programado', ids_proyecto: [], activo: true },
    { id: 's4', area: OBRAS, fecha: '2026-07-01', tipo: 'programado', ids_proyecto: [], activo: true },
  );
  const r = resumenSecretaria(bd, OBRAS, {}, HOY);
  assert.equal(r.proximo_seguimiento.fecha, '2026-08-20');
});

test('sin seguimiento agendado a futuro, proximo_seguimiento es null', () => {
  const r = resumenSecretaria(baseDePrueba(), OBRAS, {}, HOY);
  assert.equal(r.proximo_seguimiento, null);
});

test('el comparativo con el período anterior sólo existe si hay período definido', () => {
  assert.equal(resumenSecretaria(baseDePrueba(), OBRAS, {}, HOY).comparativo, null);

  const r = resumenSecretaria(baseDePrueba(), OBRAS, { desde: '2026-07-01', hasta: '2026-08-08' }, HOY);
  assert.equal(r.comparativo.desde, '2026-05-23');
  assert.equal(r.comparativo.hasta, '2026-06-30');
  assert.equal(r.comparativo.monitoreos, 1, 'el monitoreo de junio cae en la ventana anterior');
  assert.equal(r.monitoreos, 1);
  assert.equal(r.comparativo.delta_monitoreos, 0);
});

test('el presupuesto del área suma planificado y ejecutado de sus proyectos', () => {
  const bd = baseDePrueba();
  bd.proyectos[0].monto_planificado = 1000;
  bd.proyectos[0].monto_ejecutado = 750;
  const r = resumenSecretaria(bd, OBRAS, {}, HOY);
  assert.equal(r.presupuesto.planificado, 1000);
  assert.equal(r.presupuesto.ejecutado, 750);
  assert.equal(r.presupuesto.porcentaje, 75);
  assert.equal(r.presupuesto.desvio, -25);
});

test('un área sin montos cargados no reporta porcentajes inventados', () => {
  const r = resumenSecretaria(baseDePrueba(), SALUD, {}, HOY);
  assert.equal(r.presupuesto.planificado, 0);
  assert.equal(r.presupuesto.porcentaje, 0);
  assert.equal(r.presupuesto.desvio, 0);
});

test('las categorías salen ordenadas de mayor a menor', () => {
  const r = resumenSecretaria(baseDePrueba(), OBRAS, {}, HOY);
  assert.deepEqual(r.categorias, [
    { nombre: 'Operativo', cantidad: 2 },
    { nombre: 'Presupuestario', cantidad: 1 },
  ]);
});

/* ── Semáforo de la secretaría ────────────────────────────────────── */

const BASE_NIVEL = {
  compromisos: { vencidos: 0, por_vencer: 0 },
  temas: { alta_sin_resolver: 0, sin_resolver: 0 },
  ultimo_monitoreo: '2026-08-05',
  dias_sin_monitoreo: 3,
  monitoreos: 1,
};

test('un compromiso vencido manda sobre todo lo demás', () => {
  const nivel = nivelSecretaria({ ...BASE_NIVEL, compromisos: { vencidos: 1, por_vencer: 0 } });
  assert.equal(nivel, 'vencido');
});

test('un tema crítico abierto pinta la secretaría de naranja', () => {
  const nivel = nivelSecretaria({ ...BASE_NIVEL, temas: { alta_sin_resolver: 1, sin_resolver: 1 } });
  assert.equal(nivel, 'proximo');
});

test('una secretaría nunca monitoreada queda en «sin dato», no en verde', () => {
  const nivel = nivelSecretaria({ ...BASE_NIVEL, ultimo_monitoreo: null, dias_sin_monitoreo: null, monitoreos: 0 });
  assert.equal(nivel, 'sindato');
});

test('pasado el umbral sin monitorear la secretaría queda en amarillo', () => {
  assert.equal(nivelSecretaria({ ...BASE_NIVEL, dias_sin_monitoreo: 45 }), 'atencion');
  assert.equal(nivelSecretaria({ ...BASE_NIVEL, dias_sin_monitoreo: 29 }), 'enregla');
});

test('verde significa monitoreada y sin deuda', () => {
  assert.equal(nivelSecretaria(BASE_NIVEL), 'enregla');
});

/* ── Temas de un área ─────────────────────────────────────────────── */

test('temasDeArea trae los temas con la fecha de su monitoreo, más recientes primero', () => {
  const temas = temasDeArea(baseDePrueba(), OBRAS);
  assert.equal(temas.length, 3);
  assert.equal(temas[0].fecha, '2026-08-05');
  assert.equal(temas.at(-1).fecha, '2026-06-10');
  assert.equal(temas[0].id_monitoreo, 'm1');
});

/* ── Historial unificado del proyecto ─────────────────────────────── */

test('el historial de un proyecto se compone de monitoreo y seguimiento', () => {
  const items = historialUnificado(baseDePrueba(), 'OBR-2026-001', {}, HOY);
  const capas = new Set(items.map((i) => i.capa));
  assert.ok(capas.has('monitoreo'), 'el tema de monitoreo del proyecto tiene que estar');
  assert.ok(capas.has('seguimiento'), 'el seguimiento que lo incluye tiene que estar');
  assert.ok(capas.has('compromiso'));
  assert.ok(capas.has('cambio'));
});

test('cada capa del historial se puede apagar sin tocar las demás', () => {
  const bd = baseDePrueba();
  const soloNucleo = historialUnificado(
    bd,
    'OBR-2026-001',
    { compromiso: false, hito: false, mesa: false, evento: false, cambio: false },
    HOY,
  );
  assert.deepEqual([...new Set(soloNucleo.map((i) => i.capa))].sort(), ['monitoreo', 'seguimiento']);
});

test('el historial sale del más reciente al más antiguo', () => {
  const items = historialUnificado(baseDePrueba(), 'OBR-2026-001', {}, HOY);
  const fechas = items.map((i) => i.fecha);
  assert.deepEqual(fechas, [...fechas].sort().reverse());
});

test('un tema de monitoreo lleva la fecha de su monitoreo, no la de carga', () => {
  const tema = historialUnificado(
    baseDePrueba(),
    'OBR-2026-001',
    { seguimiento: false, compromiso: false, hito: false, mesa: false, evento: false, cambio: false },
    HOY,
  );
  assert.equal(tema.length, 1);
  assert.equal(tema[0].fecha, '2026-08-05');
  assert.equal(tema[0].nivel, 'vencido', 'criticidad alta sin resolver');
});

test('un compromiso vencido llega al historial con su semáforo y los días de atraso', () => {
  const [item] = historialUnificado(
    baseDePrueba(),
    'OBR-2026-001',
    { monitoreo: false, seguimiento: false, hito: false, mesa: false, evento: false, cambio: false },
    HOY,
  );
  assert.equal(item.capa, 'compromiso');
  assert.equal(item.nivel, 'vencido');
  assert.equal(item.estado, 'alerta · 38 d');
});

test('la capa de cambios muestra sólo la ficha del proyecto, no las entidades vinculadas', () => {
  const cambios = historialUnificado(
    baseDePrueba(),
    'OBR-2026-001',
    { monitoreo: false, seguimiento: false, compromiso: false, hito: false, mesa: false, evento: false },
    HOY,
  );
  assert.equal(cambios.length, 1, 'el alta del compromiso ya viaja como capa «compromiso»');
  assert.equal(cambios[0].clave, 'bit_h1');
});

test('los hitos planificados entran al historial con su semáforo de vencimiento', () => {
  const soloHitos = historialUnificado(
    baseDePrueba(),
    'OBR-2026-001',
    { monitoreo: false, seguimiento: false, compromiso: false, mesa: false, evento: false, cambio: false },
    HOY,
  );
  assert.equal(soloHitos.length, 1);
  assert.equal(soloHitos[0].titulo, 'Certificación intermedia');
  assert.equal(soloHitos[0].fecha, '2026-06-30');
  assert.equal(soloHitos[0].nivel, 'vencido', 'el hito ya pasó y sigue en el historial');
});

test('las reuniones de mesa entran sólo si la mesa tiene el proyecto vinculado', () => {
  const capas = { monitoreo: false, seguimiento: false, compromiso: false, hito: false, evento: false, cambio: false };
  assert.equal(historialUnificado(baseDePrueba(), 'OBR-2026-001', capas, HOY).length, 1);
  assert.equal(historialUnificado(baseDePrueba(), 'SAL-2026-001', capas, HOY).length, 0);
});

test('los eventos del proyecto entran al historial aunque estén por venir', () => {
  const [evento] = historialUnificado(
    baseDePrueba(),
    'OBR-2026-001',
    { monitoreo: false, seguimiento: false, compromiso: false, hito: false, mesa: false, cambio: false },
    HOY,
  );
  assert.equal(evento.titulo, 'Inauguración del tramo 1');
  assert.equal(evento.fecha, '2026-09-15');
});

test('el historial de un proyecto sin movimientos es una lista vacía, no un error', () => {
  assert.deepEqual(historialUnificado(baseDePrueba(), 'SAL-2026-001', {}, HOY), []);
});

test('las capas declaradas y las que produce el selector son las mismas', () => {
  const declaradas = CAPAS_HISTORIAL.map((c) => c.clave).sort();
  const producidas = [
    ...new Set(historialUnificado(baseDePrueba(), 'OBR-2026-001', {}, HOY).map((i) => i.capa)),
  ].sort();
  assert.deepEqual(producidas, declaradas);
});
