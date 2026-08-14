/**
 * Módulo de obras: selección, desagregado por zona y geometría del mapa.
 *
 * Lo que se afirma acá es lo que el módulo promete y no se ve a simple vista:
 * que el semáforo de una obra mide su PLAZO y no su estado, que una obra a
 * medio ubicar no se dibuja, y que dos obras a un kilómetro caen a la distancia
 * correcta en el plano.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { bdVacia } from '../src/datos/esquema.js';
import { obras, obrasPorZona, resumenObras, tieneUbicacion, zonasDeObras } from '../src/datos/selectores.js';
import { ALTO, ANCHO, KM_POR_GRADO, encuadrar, escalaDe } from '../src/componentes/proyeccionMapa.js';
import { generarDemo } from '../src/datos/demo.js';

const HOY = '2026-06-15';

function baseConObras() {
  const bd = bdVacia();
  bd.proyectos = [
    {
      id_proyecto: 'OBR-2026-001',
      proyecto: 'Repavimentación — Los Álamos',
      area: 'Secretaría de Obras Públicas',
      zona: 'Los Álamos',
      latitud: -34.578,
      longitud: -58.612,
      tipo: 'Obra',
      es_obra: true,
      estado: 'en ejecución',
      prioridad: 'alta',
      objetivo: 100,
      avance: 40,
      unidad: 'cuadras',
      monto_planificado: 1000,
      monto_ejecutado: 400,
      fecha_fin_prevista: '2026-05-01', // vencida
      activo: true,
    },
    {
      id_proyecto: 'OBR-2026-002',
      proyecto: 'Alumbrado LED — Los Álamos',
      area: 'Secretaría de Obras Públicas',
      zona: 'Los Álamos',
      latitud: -34.58,
      longitud: -58.61,
      tipo: 'Obra',
      es_obra: true,
      estado: 'finalizado',
      prioridad: 'media',
      objetivo: 50,
      avance: 50,
      unidad: 'unidades',
      monto_planificado: 500,
      monto_ejecutado: 500,
      fecha_fin_prevista: '2026-01-10', // pasada, pero finalizada
      activo: true,
    },
    {
      id_proyecto: 'OBR-2026-003',
      proyecto: 'Desagües — Villa Esperanza',
      area: 'Secretaría de Servicios Públicos',
      zona: 'Villa Esperanza',
      // Media coordenada: no ubica.
      latitud: -34.592,
      longitud: null,
      tipo: 'Obra',
      es_obra: true,
      estado: 'planificado',
      prioridad: 'baja',
      objetivo: 200,
      avance: 0,
      unidad: 'metros lineales',
      monto_planificado: 800,
      monto_ejecutado: 0,
      fecha_fin_prevista: '2026-12-01',
      activo: true,
    },
    {
      id_proyecto: 'DSO-2026-001',
      proyecto: 'Apoyo escolar — Los Álamos',
      area: 'Secretaría de Desarrollo Social',
      zona: 'Los Álamos',
      tipo: 'Programa social',
      es_obra: false,
      estado: 'en ejecución',
      prioridad: 'media',
      objetivo: 300,
      avance: 100,
      unidad: 'beneficiarios',
      monto_planificado: 100,
      monto_ejecutado: 30,
      fecha_fin_prevista: '2026-11-01',
      activo: true,
    },
  ];
  return bd;
}

/* ── Selección ──────────────────────────────────────────────────────── */

test('obras deja afuera lo que no es obra', () => {
  const lista = obras(baseConObras(), {}, HOY);
  assert.equal(lista.length, 3);
  assert.ok(!lista.some((o) => o.id_proyecto === 'DSO-2026-001'));
});

test('el semáforo de una obra mide el plazo, no el estado', () => {
  const porId = new Map(obras(baseConObras(), {}, HOY).map((o) => [o.id_proyecto, o]));
  // Activa con fin previsto pasado: en rojo.
  assert.equal(porId.get('OBR-2026-001').nivel, 'vencido');
  // Finalizada con fin previsto pasado: NO es un problema pendiente.
  assert.equal(porId.get('OBR-2026-002').nivel, 'enregla');
  // Con plazo lejano, en regla.
  assert.equal(porId.get('OBR-2026-003').nivel, 'enregla');
});

test('media coordenada no ubica una obra', () => {
  assert.equal(tieneUbicacion({ latitud: -34.6, longitud: null }), false);
  assert.equal(tieneUbicacion({ latitud: -34.6, longitud: '' }), false);
  assert.equal(tieneUbicacion({ latitud: -34.6, longitud: -58.5 }), true);
  // Cero es una coordenada válida, pero un campo vacío no es cero.
  assert.equal(tieneUbicacion({ latitud: undefined, longitud: undefined }), false);
  assert.equal(tieneUbicacion({ latitud: 0, longitud: 0 }), true);
  // Fuera de rango: no es una coordenada.
  assert.equal(tieneUbicacion({ latitud: 123, longitud: -58.5 }), false);
});

test('el filtro por zona y el de sin ubicar acotan la lista', () => {
  const bd = baseConObras();
  assert.equal(obras(bd, { zona: 'Los Álamos' }, HOY).length, 2);
  const sinUbicar = obras(bd, { solo_sin_ubicar: true }, HOY);
  assert.deepEqual(
    sinUbicar.map((o) => o.id_proyecto),
    ['OBR-2026-003'],
  );
});

/* ── Agregados ──────────────────────────────────────────────────────── */

test('resumenObras cuenta vencidas sólo entre las activas', () => {
  const resumen = resumenObras(obras(baseConObras(), {}, HOY));
  assert.equal(resumen.total, 3);
  assert.equal(resumen.activas, 2); // en ejecución + planificado
  assert.equal(resumen.finalizadas, 1);
  assert.equal(resumen.vencidas, 1); // la finalizada tarde no cuenta
  assert.equal(resumen.sin_ubicar, 1);
  assert.equal(resumen.ubicadas, 2);
  assert.equal(resumen.monto_planificado, 2300);
});

test('obrasPorZona agrupa y no esconde las obras sin zona', () => {
  const bd = baseConObras();
  bd.proyectos.push({ ...bd.proyectos[0], id_proyecto: 'OBR-2026-004', zona: '', proyecto: 'Bacheo sin zona' });
  const grupos = obrasPorZona(obras(bd, {}, HOY));
  const sinZona = grupos.find((g) => g.zona === 'Sin zona cargada');
  assert.ok(sinZona, 'la obra sin zona tiene que aparecer agrupada, no desaparecer');
  assert.equal(sinZona.total, 1);
  assert.equal(grupos.find((g) => g.zona === 'Los Álamos').total, 2);
});

test('zonasDeObras sólo devuelve zonas con obras, ordenadas', () => {
  assert.deepEqual(zonasDeObras(baseConObras()), ['Los Álamos', 'Villa Esperanza']);
});

/* ── Geometría del mapa ─────────────────────────────────────────────── */

test('sin puntos no hay encuadre', () => {
  assert.equal(encuadrar([]), null);
});

test('la escala del plano es la misma en los dos ejes', () => {
  const vista = encuadrar([
    { latitud: -34.56, longitud: -58.63 },
    { latitud: -34.64, longitud: -58.52 },
  ]);
  const k = Math.cos((-34.6 * Math.PI) / 180);
  const pxPorGradoLat = ALTO / (vista.limites.lat1 - vista.limites.lat0);
  const pxPorGradoLonCorregido = ANCHO / ((vista.limites.lon1 - vista.limites.lon0) * k);
  assert.ok(
    Math.abs(pxPorGradoLat - pxPorGradoLonCorregido) / pxPorGradoLat < 0.001,
    'una escala por eje deformaría las distancias del plano',
  );
});

test('el encuadre contiene todos los puntos con margen', () => {
  const puntos = [
    { latitud: -34.57, longitud: -58.62 },
    { latitud: -34.63, longitud: -58.53 },
    { latitud: -34.6, longitud: -58.58 },
  ];
  const vista = encuadrar(puntos);
  for (const p of puntos) {
    const x = vista.x(p.longitud);
    const y = vista.y(p.latitud);
    assert.ok(x > 0 && x < ANCHO, 'el punto queda dentro del lienzo');
    assert.ok(y > 0 && y < ALTO, 'el punto queda dentro del lienzo');
  }
});

test('una obra sola no produce un zoom infinito', () => {
  const vista = encuadrar([{ latitud: -34.6, longitud: -58.58 }]);
  assert.ok(vista.gradosAlto > 0.01, 'con un punto el encuadre usa la extensión mínima');
  assert.ok(Number.isFinite(vista.x(-58.58)));
});

test('la barra de escala mide una distancia redonda y entra en el lienzo', () => {
  for (const gradosAlto of [0.02, 0.05, 0.12, 0.4]) {
    const escala = escalaDe(gradosAlto);
    assert.ok([0.25, 0.5, 1, 2, 5, 10, 20].includes(escala.km));
    assert.ok(escala.px > 0 && escala.px < ANCHO * 0.7, `la barra de ${escala.km} km no puede tapar el plano`);
    // La barra dice la verdad: su largo en píxeles corresponde a sus kilómetros.
    const pxPorKm = ALTO / (gradosAlto * KM_POR_GRADO);
    assert.ok(Math.abs(escala.px - escala.km * pxPorKm) < 1e-9);
  }
});

/* ── Set de demostración ────────────────────────────────────────────── */

test('la demo carga obras ubicables, con zona y coordenadas', () => {
  const bd = generarDemo(HOY);
  const lista = obras(bd, {}, HOY);
  assert.ok(lista.length > 0, 'la demo tiene que traer obras');
  assert.ok(lista.every((o) => o.zona), 'toda obra de la demo declara su zona');
  assert.ok(
    lista.every((o) => o.ubicada),
    'toda obra de la demo se puede dibujar en el mapa',
  );
  // Las coordenadas ficticias caen dentro del rectángulo del partido.
  for (const o of lista) {
    assert.ok(o.latitud < -34.55 && o.latitud > -34.65, `latitud fuera del encuadre: ${o.latitud}`);
    assert.ok(o.longitud < -58.51 && o.longitud > -58.65, `longitud fuera del encuadre: ${o.longitud}`);
  }
});

test('las obras de la demo se reparten en varias zonas', () => {
  const bd = generarDemo(HOY);
  assert.ok(zonasDeObras(bd).length >= 3, 'un mapa con una sola zona no diría nada');
});
