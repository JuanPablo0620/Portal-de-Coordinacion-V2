/**
 * Bacheo: lectura de la programación semanal y ubicación de los trabajos.
 *
 * Los casos salen de los 38 PDF reales de junio a noviembre de 2026, que no se
 * suben al repo (es público). Se reproducen con textos sintéticos en las
 * posiciones en que los deja pdf.js, cada uno con el problema que rompió una
 * versión anterior:
 *
 *  - cuadrillas de tamaño desparejo (cuatro trabajos y uno solo): repartir por
 *    «el rótulo más cercano» asigna mal la última fila de la grande;
 *  - celdas de dos líneas («DESMONTE 9HS / HORMIGON 12HS»);
 *  - feriados en celdas combinadas en vertical, cuyos pedazos caen en filas
 *    cualquiera;
 *  - el «M2 TOTALES» debajo de la tabla de hormigón.
 *
 * Contra los PDF reales se valida con
 * `node scripts/verificar-programacion-bacheo.mjs <carpeta>`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { repartirFilas, tablaDesdeItems } from '../src/datos/bacheo/tablaProgramacion.js';
import {
  cuadrillaLinda,
  fechaDeEncabezado,
  localidadOficial,
  lunesDe,
  tareasHormigon,
  trabajosDesdeTabla,
  unirProgramaciones,
} from '../src/datos/bacheo/programacion.js';
import {
  claveLugar,
  clasificarDescripcion,
  elegirCalle,
  partesDelNombre,
  patronesDeBusqueda,
  puntaje,
} from '../src/datos/bacheo/nombresCalle.js';
import { aFormaMapa, cascoConvexo, contiene, deLeaflet } from '../src/datos/bacheo/geometria.js';
import { agruparPorLocalidad, armarPublicacion, diasDeSemana, resumenSemana } from '../src/datos/bacheo/semana.js';

/* ── Fixtures ───────────────────────────────────────────────────────── */

const DIAS_X = [364, 452, 540, 628, 715];
const t = (str, x, y, w = 30) => ({ str, x, y, w });

/** Asfalto: cuadrilla 1 con 4 trabajos, cuadrilla 2 con 1, feriado el lunes. */
function itemsAsfalto() {
  const filas = [
    ['Cuadrante 4: G. Ezeiza, M. S. de Thompson, Congreso, Cnel. Julio Moreno', 'Loma Hermosa', { 1: 'SELLADO DE JUNTAS' }],
    ['Cuadrante 8: Av. Hugo del Carril, M. S. de Thompson, G. Ezeiza y A. Berutti', 'Loma Hermosa', { 2: 'ASFALTO CALIENTE', 3: 'ASFALTO CALIENTE' }],
    ['J.J. Urquiza entre Olavarria y M. T. de Alvear', 'Caseros Sur', { 2: 'RECONSTRUCCIÓN DE CORDONES', 4: 'PINTURA DE CORDONES' }],
    ['Av . Gaona entre Av. República y Ventivenga', 'Ciudadela', { 4: 'ASFALTO CALIENTE' }],
    ['Altos de Podestá', 'Pablo Podestá', { 1: 'ASFALTO CALIENTE' }],
  ];
  const items = [
    t('PLANIFICACIÓN SEMANAL CUADRILLAS', 400, 386, 120),
    t('DIRECCION', 104, 376),
    t('LOCALIDAD', 288, 376),
    ...['LUN 16/11', 'MAR 17/11', 'MIE 18/11', 'JUE 19/11', 'VIE 20/11'].map((h, i) => t(h, DIAS_X[i], 376, 29)),
  ];
  filas.forEach(([dir, loc, dias], i) => {
    const y = 366 - i * 10;
    items.push(t(dir, 104, y, 135), t(loc, 290, y + 0.3, 28));
    for (const [d, texto] of Object.entries(dias)) items.push(t(texto, DIAS_X[d] - 6, y - 0.2, 42));
  });
  // Rótulo de la cuadrilla 1, centrado en sus cuatro filas (366..336 → 351).
  items.push(t('CUADRILLA 1', 48, 357.3, 27), t('(ASF CALIENTE)', 45, 351, 31), t('LOMA HERMOSA', 44, 344.7, 35));
  // Cuadrilla 2, una sola fila (326).
  items.push(t('CUADRILLA 5', 48, 329, 27), t('(ASF CALIENTE) EMERGENCIAS', 40, 323, 40));
  // Feriado del lunes: celda combinada en vertical, dos líneas en el medio.
  items.push(t('FERIADO NACIONAL', DIAS_X[0] - 8, 352, 45), t('DÍA DE PRUEBA', DIAS_X[0] - 6, 346, 40));
  return items;
}

/** Hormigón: con m², una celda de dos líneas y el total al pie. */
function itemsHormigon() {
  const xs = { dir: 104, m2: 300, loc: 360, dias: [430, 500, 570, 640, 710] };
  return [
    t('PLANIFICACIÓN SEMANAL - HORMIGÓN', 400, 386, 120),
    t('DIRECCIÓN', xs.dir, 376),
    t('APROX m2', xs.m2, 376, 25),
    t('LOCALIDAD', xs.loc, 376),
    ...['LUN 16/11', 'MAR 17/11', 'MIER 18/11', 'JUE 19/11', 'VIE 20/11'].map((h, i) => t(h, xs.dias[i], 376, 29)),
    t('Falucho y Frione', xs.dir, 366, 60),
    t('115', xs.m2 + 8, 366, 12),
    t('Ciudadela', xs.loc + 6, 366, 20),
    t('HORMIGON 9HS', xs.dias[0], 366),
    t('Rosella entre Rio IV y San Luis', xs.dir, 356, 100),
    t('518', xs.m2 + 8, 356, 12),
    t('EL Libertador', xs.loc + 2, 356, 28),
    t('DESMONTE 9HS', xs.dias[3], 360),
    t('HORMIGON 12HS', xs.dias[3], 352),
    t('Lluvia', xs.dias[1] + 8, 356, 14),
    t('M2 TOTALES', xs.dir, 330, 40),
    t('421', xs.m2 + 8, 330, 12),
  ];
}

/* ── Tabla ──────────────────────────────────────────────────────────── */

test('reparte las filas entre cuadrillas de tamaño desparejo', () => {
  const tabla = tablaDesdeItems(itemsAsfalto());
  assert.equal(tabla.tipo, 'asfalto');
  assert.deepEqual(
    tabla.filas.map((f) => f[0]),
    [
      'CUADRILLA 1 (ASF CALIENTE) LOMA HERMOSA',
      'CUADRILLA 1 (ASF CALIENTE) LOMA HERMOSA',
      'CUADRILLA 1 (ASF CALIENTE) LOMA HERMOSA',
      'CUADRILLA 1 (ASF CALIENTE) LOMA HERMOSA',
      'CUADRILLA 5 (ASF CALIENTE) EMERGENCIAS',
    ],
  );
});

test('repartirFilas: la última fila de un bloque grande no se va con el chico', () => {
  // Rótulo más cercano diría que la fila 30 (a 3 del centro 27) es del bloque
  // de abajo; el reparto correcto la deja en el de arriba.
  assert.deepEqual(repartirFilas([60, 50, 40, 30, 20], [{ centro: 45 }, { centro: 20 }]), [0, 0, 0, 0, 1]);
});

test('una celda de dos líneas queda en su fila y en orden', () => {
  const tabla = tablaDesdeItems(itemsHormigon());
  assert.equal(tabla.tipo, 'hormigon');
  assert.equal(tabla.filas.length, 2, 'el M2 TOTALES no es un trabajo');
  assert.equal(tabla.filas[1][6], 'DESMONTE 9HS HORMIGON 12HS');
});

test('sin columna DIRECCION no es una programación', () => {
  assert.throws(() => tablaDesdeItems([t('Otra cosa', 10, 10)]), /DIRECCION/);
});

/* ── Programación ───────────────────────────────────────────────────── */

test('asfalto: un trabajo por fila y tipo, con fechas reales', () => {
  const p = trabajosDesdeTabla(tablaDesdeItems(itemsAsfalto()), '2026-11-17');
  const urquiza = p.trabajos.filter((x) => x.descripcion.startsWith('J.J. Urquiza'));
  assert.deepEqual(
    urquiza.map((x) => [x.tipo, x.fechas]),
    [
      ['reconstruccion', ['2026-11-18']],
      ['pintura', ['2026-11-20']],
    ],
  );
  assert.equal(urquiza[0].localidad, 'Caseros', '«Caseros Sur» es Caseros');
  assert.equal(p.trabajos.find((x) => x.descripcion.includes('Gaona')).descripcion, 'Av. Gaona entre Av. República y Ventivenga');
  assert.deepEqual(p.novedades, [{ fecha: '2026-11-16', texto: 'Feriado nacional día de prueba' }]);
});

test('hormigón: tareas por día, m² y lluvia aparte', () => {
  const p = trabajosDesdeTabla(tablaDesdeItems(itemsHormigon()), '2026-11-17');
  const rosella = p.trabajos[1];
  assert.equal(rosella.m2, 518);
  assert.equal(rosella.localidad, 'El Libertador');
  assert.deepEqual(rosella.tareas, [
    { fecha: '2026-11-19', tarea: 'Desmonte', hora: '9 h' },
    { fecha: '2026-11-19', tarea: 'Hormigón', hora: '12 h' },
  ]);
  assert.deepEqual(rosella.novedades, [{ fecha: '2026-11-17', texto: 'Lluvia' }]);
});

test('tareas de hormigón: rico y pobre conservan la calidad', () => {
  assert.deepEqual(tareasHormigon('HORMIGON RICO 9HS'), [{ tarea: 'Hormigón rico', hora: '9 h' }]);
  assert.deepEqual(tareasHormigon('DESMONTE 9HS - HORMIGON 14HS').map((x) => x.tarea), ['Desmonte', 'Hormigón']);
});

test('el año sale de la fecha de carga, también en el cambio de año', () => {
  assert.equal(fechaDeEncabezado('LUN 29/12', '2027-01-02'), '2026-12-29');
  assert.equal(fechaDeEncabezado('VIE 02/01', '2026-12-30'), '2027-01-02');
  assert.equal(fechaDeEncabezado('MIER 18/11', '2026-11-17'), '2026-11-18');
});

test('localidades de la planilla → oficiales', () => {
  assert.equal(localidadOficial('EL Libertador'), 'El Libertador');
  assert.equal(localidadOficial('Altos de Podesta'), 'Pablo Podestá');
  assert.equal(localidadOficial('Ciudad Jardin'), 'Ciudad Jardín Lomas del Palomar');
  assert.equal(localidadOficial('Martin Coronado'), 'Martín Coronado');
  assert.equal(localidadOficial('Narnia'), '');
});

test('la semana se identifica por su lunes aunque arranque martes', () => {
  assert.equal(lunesDe('2026-06-16'), '2026-06-15');
  assert.equal(lunesDe('2026-11-16'), '2026-11-16');
});

test('no se mezclan PDF de semanas distintas', () => {
  const a = { fechas: ['2026-11-16'], trabajos: [], novedades: [], avisos: [] };
  const b = { fechas: ['2026-11-23'], trabajos: [], novedades: [], avisos: [] };
  assert.throws(() => unirProgramaciones([a, b]), /semanas distintas/);
});

test('el mismo feriado en los dos PDF queda una vez', () => {
  const a = { fechas: ['2026-07-06'], trabajos: [], avisos: [], novedades: [{ fecha: '2026-07-09', texto: 'Dia de la independencia' }] };
  const b = { fechas: ['2026-07-06'], trabajos: [], avisos: [], novedades: [{ fecha: '2026-07-09', texto: 'Día de la independencia ' }] };
  assert.equal(unirProgramaciones([a, b]).novedades.length, 1);
});

test('cuadrillas con mayúsculas de nombre propio', () => {
  assert.equal(cuadrillaLinda('CUADRILLA 6 (ASF FRÍO)'), 'Cuadrilla 6 (Asf Frío)');
});

/* ── Nombres de calle ───────────────────────────────────────────────── */

test('iniciales, títulos y contenido', () => {
  assert.deepEqual(partesDelNombre('M. S. de Thompson'), { contenido: ['THOMPSON'], titulos: [], iniciales: ['M', 'S'] });
  assert.deepEqual(partesDelNombre('J.M. de Rosas').iniciales, ['J', 'M']);
  assert.deepEqual(partesDelNombre('Sta. Maria de Oro'), { contenido: ['MARIA', 'ORO'], titulos: ['SANTA'], iniciales: [] });
  assert.deepEqual(partesDelNombre('Ruta 8').contenido, ['EVA', 'PERON'], 'la Ruta 8 es la Av. Eva Perón');
});

test('patrones de búsqueda: vocales como comodín, la n solo si se pide', () => {
  assert.deepEqual(patronesDeBusqueda('Panamá'), ['P_N_']);
  assert.deepEqual(patronesDeBusqueda('Panamá', { comodinEnN: true }), ['P___']);
});

test('elige el nombre oficial correcto', () => {
  const candidatos = [
    { nombre: 'Mariquita Sánchez de Thompson', localidades: ['Santos Lugares'] },
    { nombre: 'M Sánchez de Thomson', localidades: ['Loma Hermosa'] },
  ];
  assert.equal(elegirCalle('M. S. de Thompson', candidatos, 'Loma Hermosa'), 'M Sánchez de Thomson');
  assert.equal(
    elegirCalle('Nicaragua', [{ nombre: 'Boulevard F.I.N.C.A.', localidades: [] }, { nombre: 'Nicaragua', localidades: [] }]),
    'Nicaragua',
  );
  assert.equal(puntaje('Nicaragua', 'Boulevard F.I.N.C.A.'), null, 'una inicial no explica una palabra');
  assert.equal(
    elegirCalle('Sta. Maria de Oro', [{ nombre: 'Fray Justo Santa María de Oro', localidades: ['Caseros'] }], 'Caseros'),
    'Fray Justo Santa María de Oro',
  );
});

test('clasifica cuadrantes, tramos, esquinas y lugares', () => {
  assert.deepEqual(clasificarDescripcion('Cuadrante 6. Lutcher, Nolting, Díaz Vélez, Pampa y Gral. Paz'), {
    forma: 'area',
    calles: ['Lutcher', 'Nolting', 'Díaz Vélez', 'Pampa', 'Gral. Paz'],
  });
  assert.deepEqual(clasificarDescripcion('Alpatacal entre Av. Rodriguez Peña y Landin'), {
    forma: 'tramo',
    calle: 'Alpatacal',
    desde: 'Av. Rodriguez Peña',
    hasta: 'Landin',
  });
  assert.equal(clasificarDescripcion('Santa Rosalia esquina San Pedro').forma, 'esquina');
  assert.equal(clasificarDescripcion('Falucho y Frione').forma, 'esquina');
  assert.equal(clasificarDescripcion('Altos de Podestá').forma, 'lugar');
});

test('la clave de un lugar no depende de acentos ni signos', () => {
  assert.equal(claveLugar('Av . Gaona entre Av. República y Ventivenga', 'Ciudadela'), claveLugar('AV GAONA ENTRE AV REPUBLICA Y VENTIVENGA', 'ciudadela'));
});

/* ── Geometría ──────────────────────────────────────────────────────── */

test('casco convexo de las esquinas de un cuadrante', () => {
  const p = (lat, lng) => ({ lat, lng });
  const casco = cascoConvexo([p(0, 0), p(0, 1), p(1, 1), p(1, 0), p(0.5, 0.5), p(0, 0)]);
  assert.equal(casco.length, 4, 'el punto interior y el repetido no cuentan');
  assert.ok(contiene([casco], p(0.5, 0.5)));
  assert.ok(!contiene([casco], p(2, 2)));
});

test('GeoJSON ↔ Leaflet no invierte latitud y longitud', () => {
  const punto = { lat: -34.6, lng: -58.55 };
  const geo = deLeaflet.punto(punto);
  assert.deepEqual(geo.coordinates, [-58.55, -34.6]);
  assert.deepEqual(aFormaMapa(geo), { tipo: 'punto', puntos: punto });
  const poligono = deLeaflet.poligono([punto, { lat: -34.61, lng: -58.55 }, { lat: -34.61, lng: -58.56 }]);
  assert.deepEqual(poligono.coordinates[0][0], poligono.coordinates[0].at(-1), 'el anillo se cierra');
});

/* ── Semana ─────────────────────────────────────────────────────────── */

const trabajo = (extra) => ({
  cuadrilla: 'Hormigón',
  tipo: 'hormigon',
  descripcion: 'Falucho y Frione',
  localidad: 'Ciudadela',
  localidad_planilla: 'Ciudadela',
  fechas: ['2026-11-16'],
  tareas: [],
  m2: 115,
  orden: 0,
  geometria: deLeaflet.punto({ lat: -34.63, lng: -58.53 }),
  forma: 'esquina',
  ubicacion: 'automatica',
  nota: '',
  ...extra,
});

test('agrupa por localidad y deja «Sin localidad» al final', () => {
  const grupos = agruparPorLocalidad([trabajo({ localidad: '' }), trabajo({ localidad: 'Caseros' }), trabajo()]);
  assert.deepEqual(grupos.map((g) => g.localidad), ['Caseros', 'Ciudadela', 'Sin localidad']);
  assert.equal(grupos[0].m2, 115);
});

test('resumen: m² de hormigón calculados, no copiados de la planilla', () => {
  const r = resumenSemana([trabajo(), trabajo({ m2: 371 }), trabajo({ tipo: 'sellado', m2: null, geometria: null })]);
  assert.equal(r.m2Hormigon, 486);
  assert.equal(r.sinUbicar, 1);
  assert.equal(r.provisorios, 2);
});

test('solo lo marcado o confirmado por una persona pasa a la memoria', () => {
  const pub = armarPublicacion({
    semana: { lunes: '2026-11-16', desde: '2026-11-16', hasta: '2026-11-20', novedades: [] },
    trabajos: [
      trabajo(),
      trabajo({ descripcion: 'Machado y Peschel', ubicacion: 'revisada', recordar: true }),
      trabajo({ descripcion: 'Corrientes y Peron', ubicacion: 'manual', recordar: true }),
      trabajo({ descripcion: 'Altos de Podestá', geometria: null, ubicacion: 'manual', recordar: true }),
    ],
    archivos: [{ tipo: 'hormigon', nombre: 'x.pdf', otra: 'cosa' }],
  });
  assert.deepEqual(pub.lugares.map((l) => [l.descripcion, l.origen]), [
    ['Machado y Peschel', 'confirmada'],
    ['Corrientes y Peron', 'manual'],
  ]);
  assert.equal(pub.trabajos[3].ubicacion, 'sin_ubicar');
  assert.deepEqual(pub.semana.archivos, [{ tipo: 'hormigon', nombre: 'x.pdf' }]);
});

test('días hábiles de la semana', () => {
  assert.deepEqual(diasDeSemana({ desde: '2026-06-16', hasta: '2026-06-19' }), ['2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19']);
});

/* ── Escrituras de la planilla vistas de junio a noviembre ──────────── */

test('números escritos con letras o romanos', async () => {
  const { puntaje: p } = await import('../src/datos/bacheo/nombresCalle.js');
  assert.notEqual(p('Tres de Febrero', '3 de febrero'), null);
  assert.notEqual(p('Rio IV', 'Río Cuarto'), null);
  assert.notEqual(p('1 de Mayo', 'Primero de mayo'), null);
});

test('errores chicos de tipeo y palabras pegadas', async () => {
  const { puntaje: p, similitud } = await import('../src/datos/bacheo/nombresCalle.js');
  assert.notEqual(p('Cuelli', 'Cueli'), null);
  assert.notEqual(p('de Vicenzi', 'Devicenzi'), null);
  assert.notEqual(p('Avdor Palazzo', 'Aviador Palazzo'), null);
  assert.ok(similitud('MADGALENA', 'MAGDALENA') > 0.88, 'una transposición es un solo error');
});

test('vuelta flexible y sugerencia', async () => {
  const { elegirCalleFlexible, sugerirCalle } = await import('../src/datos/bacheo/nombresCalle.js');
  const alzaga = [{ nombre: 'Álzaga', localidades: ['Caseros'] }];
  assert.equal(elegirCalleFlexible('Martin de Álzaga', alzaga, 'Caseros'), 'Álzaga');
  assert.equal(elegirCalleFlexible('Martin de Álzaga', alzaga, 'Ciudadela'), null, 'solo en la localidad del trabajo');
  assert.equal(sugerirCalle('Rosseti', [{ nombre: 'Rosetti', localidades: [] }, { nombre: 'Roma', localidades: [] }]), 'Rosetti');
});

test('cuadrantes sin número, con punto y coma, y calles con dos nombres', () => {
  assert.deepEqual(clasificarDescripcion('Cuadrante: De los Aromos, De los Paraisos y De los Geranios').calles, [
    'De los Aromos',
    'De los Paraisos',
    'De los Geranios',
  ]);
  assert.equal(clasificarDescripcion('Cuadrante 11: Av Maldonado, Av Juan B justo; Av gral Paz; Av. Maipú').calles.length, 4);
  assert.equal(clasificarDescripcion('Av. Mitre entre M. T. de Alvear hasta Constitución').forma, 'tramo');
  assert.equal(clasificarDescripcion('Ituzaingo e Iguazu').forma, 'esquina');
});

test('un título que no coincide resta: «Pres. Perón» no es «Eva Perón»', () => {
  const candidatos = [
    { nombre: 'Eva Perón RP8', localidades: ['Loma Hermosa'] },
    { nombre: 'Avenida Presidente Juan Domingo Perón', localidades: ['Martín Coronado'] },
  ];
  assert.equal(elegirCalle('Pres. Perón', candidatos, 'Loma Hermosa'), 'Avenida Presidente Juan Domingo Perón');
});

test('una coincidencia dudosa se avisa', async () => {
  const { esDudosa } = await import('../src/datos/bacheo/nombresCalle.js');
  assert.equal(esDudosa('Sta. Marina', 'Fray Justo Santa María de Oro'), true);
  assert.equal(esDudosa('M. S. de Thompson', 'M Sánchez de Thomson'), false);
  assert.equal(esDudosa('de Vicenzi', 'Devicenzi'), false);
});

test('el fragmento de búsqueda no deja un %XX que el Geoportal decodifique', async () => {
  const { fragmentoSeguro } = await import('../src/datos/geoportal.js');
  assert.equal(fragmentoSeguro('1852'), '_852');
  assert.equal(fragmentoSeguro('25 de Mayo'), '_5 de Mayo');
  assert.equal(fragmentoSeguro('Castelli'), '_astelli', '«Ca» también es un par hexadecimal (0xCA)');
  assert.equal(fragmentoSeguro('9 de Julio'), '9 de Julio');
});

test('la palabra que sobra no puede ser el apellido', async () => {
  const { elegirCalleFlexible } = await import('../src/datos/bacheo/nombresCalle.js');
  const candidatos = [
    { nombre: 'Álzaga', localidades: ['Caseros'] },
    { nombre: 'Martín Rodríguez', localidades: ['Caseros'] },
  ];
  assert.equal(elegirCalleFlexible('Martin de Álzaga', candidatos, 'Caseros'), 'Álzaga');
});

test('calles que empatan se devuelven todas («Zanella» en Caseros)', async () => {
  const { elegirCalles } = await import('../src/datos/bacheo/nombresCalle.js');
  const candidatos = [
    { nombre: 'Juan Zanella', localidades: ['Caseros'] },
    { nombre: 'Santiago Zanella', localidades: ['Caseros'] },
  ];
  assert.deepEqual(elegirCalles('Zanella', candidatos, 'Caseros'), ['Juan Zanella', 'Santiago Zanella']);
  assert.deepEqual(elegirCalles('Santiago Zanella', candidatos, 'Caseros'), ['Santiago Zanella']);
});
