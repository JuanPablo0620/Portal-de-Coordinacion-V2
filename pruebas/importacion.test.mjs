/**
 * El ida y vuelta del CSV de proyectos.
 *
 * «Exporto la tabla, la edito en la planilla y la vuelvo a subir» es lo primero
 * que cualquiera intenta con una base maestra, y era justo lo que no funcionaba:
 * la exportación describía las columnas de la PANTALLA y la importación esperaba
 * las del MODELO, así que el archivo que el sistema producía no podía volver a
 * entrar. Con treinta proyectos tampoco se notaba —nadie exporta para reimportar
 * un set de demostración—; se vio al hacerlo con la base cargada.
 *
 * Este archivo fija el contrato entre los dos lados.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPOS_PLANIFICACION,
  CAMPOS_PROYECTO,
  COLUMNAS_CSV_PROYECTO,
  proponerMapeo,
  validarFilasPlanificacion,
  validarFilasProyecto,
} from '../src/datos/importacion.js';
import { aCSV, filasAObjetos, parsearCSV } from '../src/datos/csv.js';
import { generarBaseCompleta } from '../src/datos/base-completa.js';
import { proyectos as selProyectos } from '../src/datos/selectores.js';

const HOY = '2026-08-10';
const bd = generarBaseCompleta(HOY);
const catalogos = bd.catalogos;

/** Lo que hace la pantalla: exportar, volver a parsear y mapear solo. */
function idaYVuelta(filas) {
  const csv = aCSV(filas, COLUMNAS_CSV_PROYECTO);
  const parseado = parsearCSV(csv);
  const mapeo = proponerMapeo(parseado.encabezados);
  const objetos = filasAObjetos(parseado.filas, mapeo);
  return { csv, parseado, mapeo, ...validarFilasProyecto(objetos, catalogos, HOY) };
}

test('el mapeo automático reconoce los encabezados que el sistema exporta', () => {
  const { mapeo, parseado } = idaYVuelta(selProyectos(bd, {}).slice(0, 5));
  for (const campo of CAMPOS_PROYECTO) {
    assert.ok(mapeo[campo.clave] !== undefined, `no reconoció la columna de ${campo.titulo}`);
  }
  assert.equal(parseado.encabezados.length, COLUMNAS_CSV_PROYECTO.length);
});

test('el mapeo no se pierde por acentos, mayúsculas ni espacios', () => {
  // Los tres estilos que aparecen en archivos reales.
  assert.equal(proponerMapeo(['Área']).area, '0');
  assert.equal(proponerMapeo(['AREA']).area, '0');
  assert.equal(proponerMapeo(['area']).area, '0');
  assert.equal(proponerMapeo(['Fin previsto']).fecha_fin_prevista, '0');
  assert.equal(proponerMapeo(['fecha_fin_prevista']).fecha_fin_prevista, '0');
  assert.equal(proponerMapeo(['MONTO PLANIFICADO']).monto_planificado, '0');
});

test('la base maestra exportada entera se vuelve a importar sin rechazos', () => {
  const originales = selProyectos(bd, {});
  assert.ok(originales.length > 200, 'la prueba tiene sentido con la base cargada');

  const { aceptadas, rechazadas } = idaYVuelta(originales);
  assert.equal(
    rechazadas.length,
    0,
    `${rechazadas.length} filas rechazadas. Primera: ${rechazadas[0]?.motivo}`,
  );
  assert.equal(aceptadas.length, originales.length);
});

test('el ida y vuelta conserva los valores, no sólo la cantidad de filas', () => {
  const originales = selProyectos(bd, {});
  const { aceptadas } = idaYVuelta(originales);

  originales.forEach((p, i) => {
    const r = aceptadas[i];
    assert.equal(r.proyecto, p.proyecto, `cambió el nombre en la fila ${i + 1}`);
    assert.equal(r.area, p.area);
    assert.equal(r.tipo, p.tipo);
    assert.equal(r.unidad, p.unidad);
    assert.equal(r.estado, p.estado);
    assert.equal(r.prioridad, p.prioridad);
    // El avance tiene que ser la CANTIDAD, no el porcentaje que dibuja la tabla:
    // el error silencioso era importar «45» donde el proyecto llevaba 1.200.
    assert.equal(r.avance, p.avance, `el avance no sobrevivió en ${p.id_proyecto}`);
    assert.equal(r.objetivo, p.objetivo);
    assert.equal(r.monto_planificado, p.monto_planificado);
    assert.equal(r.fecha_inicio, p.fecha_inicio);
    assert.equal(r.fecha_fin_prevista, p.fecha_fin_prevista);
    assert.equal(r.es_obra, p.es_obra, `es_obra se derivó mal en ${p.id_proyecto}`);
  });
});

test('los nombres con comas, acentos y rayas sobreviven al archivo', () => {
  const filas = [
    {
      proyecto: 'Repavimentación, bacheo y "puesta en valor" — Los Álamos',
      area: 'Secretaría de Obras Públicas',
      tipo: 'Obra',
      unidad: 'cuadras',
      objetivo: 120,
      avance: 45,
      estado: 'en ejecución',
    },
  ];
  const { aceptadas, rechazadas } = idaYVuelta(filas);
  assert.equal(rechazadas.length, 0, rechazadas[0]?.motivo);
  assert.equal(aceptadas[0].proyecto, filas[0].proyecto);
});

test('una fila a la que le falta un campo obligatorio se rechaza con el motivo', () => {
  const objetos = [{ proyecto: 'Sin área ni unidad', tipo: 'Obra', objetivo: '10' }];
  const { aceptadas, rechazadas } = validarFilasProyecto(objetos, catalogos, HOY);
  assert.equal(aceptadas.length, 0);
  assert.match(rechazadas[0].motivo, /falta área/);
  assert.match(rechazadas[0].motivo, /falta unidad/);
});

test('un valor fuera del catálogo se rechaza nombrando el valor', () => {
  const objetos = [
    { proyecto: 'X', area: 'Secretaría Inventada', tipo: 'Obra', unidad: 'cuadras', objetivo: '10' },
  ];
  const { rechazadas } = validarFilasProyecto(objetos, catalogos, HOY);
  assert.match(rechazadas[0].motivo, /«Secretaría Inventada» no está en el catálogo/);
});

test('los números en formato local y las fechas DD/MM/AAAA se normalizan', () => {
  const objetos = [
    {
      proyecto: 'Con formato de planilla',
      area: 'Secretaría de Salud',
      tipo: 'Obra',
      unidad: 'm²',
      objetivo: '1.250',
      monto_planificado: '45.000.000',
      fecha_inicio: '05/03/2026',
    },
  ];
  const { aceptadas, rechazadas } = validarFilasProyecto(objetos, catalogos, HOY);
  assert.equal(rechazadas.length, 0, rechazadas[0]?.motivo);
  assert.equal(aceptadas[0].objetivo, 1250);
  assert.equal(aceptadas[0].monto_planificado, 45_000_000);
  assert.equal(aceptadas[0].fecha_inicio, '2026-03-05');
  assert.equal(aceptadas[0].fecha_carga, '2026-03-05');
});

/* ── Planificación ────────────────────────────────────────────────── */

/**
 * El importador de planificación arrastraba una copia de la misma lógica de
 * mapeo, con el mismo error y uno peor: su columna «Año» no coincide con la
 * clave `anio` ni sacándole el acento, así que en una planilla con encabezados
 * en castellano —que es como las mandan las áreas— el año no se mapeaba nunca y
 * toda la planificación entraba con el año de la pantalla.
 */
test('el mapeo de planificación reconoce la planilla que manda un área', () => {
  const m = proponerMapeo(
    ['ID de proyecto', 'Año', 'Meta anual', 'Primer trimestre', 'Segundo trimestre', 'Tercer trimestre', 'Cuarto trimestre', 'Presupuesto'],
    CAMPOS_PLANIFICACION,
  );
  for (const campo of CAMPOS_PLANIFICACION) {
    assert.ok(m[campo.clave] !== undefined, `no reconoció la columna de ${campo.titulo}`);
  }
  assert.equal(m.anio, '1', 'la columna «Año» tiene que mapear al campo anio');
});

test('el mapeo de planificación reconoce también la plantilla del sistema', () => {
  const m = proponerMapeo(
    ['id_proyecto', 'anio', 'meta_anual', 't1', 't2', 't3', 't4', 'monto_planificado'],
    CAMPOS_PLANIFICACION,
  );
  assert.equal(Object.keys(m).length, CAMPOS_PLANIFICACION.length);
});

test('la planificación se valida contra la base maestra', () => {
  const ids = new Set(bd.proyectos.map((p) => p.id_proyecto));
  const real = bd.proyectos[0].id_proyecto;

  const { aceptadas, rechazadas } = validarFilasPlanificacion(
    [
      { id_proyecto: real, anio: '2026', meta_anual: '1.200', t1: '300', t2: '600', t3: '900' },
      { id_proyecto: 'NOEXISTE-2026-001', meta_anual: '100' },
      { id_proyecto: real },
    ],
    ids,
    2026,
  );

  assert.equal(aceptadas.length, 1);
  assert.equal(aceptadas[0].meta_anual, 1200);
  // Sin T4 cargado, el cierre del año es la meta anual, no un cero.
  assert.deepEqual(aceptadas[0].metas_trimestrales, [300, 600, 900, 1200]);
  assert.equal(rechazadas.length, 2);
  assert.match(rechazadas[0].motivo, /no existe en la base maestra/);
  assert.match(rechazadas[1].motivo, /falta meta anual/);
});

test('sin columna de año, la planificación toma el año de la pantalla', () => {
  const ids = new Set(bd.proyectos.map((p) => p.id_proyecto));
  const { aceptadas } = validarFilasPlanificacion(
    [{ id_proyecto: bd.proyectos[0].id_proyecto, meta_anual: '500' }],
    ids,
    2027,
  );
  assert.equal(aceptadas[0].anio, 2027);
});
