/**
 * Carga de los proyectos VALIDADOS del cualitativo.
 *
 * Lo que se fija acá es lo que distingue a esta fuente de la otra, porque es
 * justo lo que un refactor puede romper sin que se note en pantalla:
 *
 *  - que el `eje` que entra sea el REAL del sheet y no el "Puntual" de
 *    aproximación que usa el loader del maestro. Si esto se rompe, los 51
 *    proyectos revisados uno por uno quedan indistinguibles de los que nunca
 *    se revisaron.
 *  - que el estado crudo del `_db` ("Programado", "Alerta") se traduzca al
 *    catálogo Y quede registrado el original. Perder el original es perder la
 *    única forma de auditar la traducción contra el sheet.
 *  - que correrlo dos veces no duplique. El botón está en la interfaz y nadie
 *    se acuerda de si ya lo apretó.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as repo from '../src/datos/repositorio.js';
import { SECRETARIAS_VALIDADAS } from '../src/datos/proyectos-validados-cualitativo.js';

const TOTAL = SECRETARIAS_VALIDADAS.reduce((n, s) => n + s.datos.length, 0);

async function limpio() {
  await repo.vaciarSistema();
}

test('los datos validados traen programa, proyecto y eje en todas las filas', () => {
  assert.ok(TOTAL > 0, 'el archivo de validados no puede estar vacío');
  for (const secretaria of SECRETARIAS_VALIDADAS) {
    for (const d of secretaria.datos) {
      assert.ok(d.proyecto, `falta proyecto en ${secretaria.area.nombre}`);
      assert.ok(d.programa, `falta programa en «${d.proyecto}»`);
      assert.ok(d.eje, `falta eje en «${d.proyecto}»`);
    }
  }
});

test('cargar los validados da de alta los proyectos con su eje real', async () => {
  await limpio();
  const resumen = await repo.cargarProyectosValidadosCualitativo();

  const creados = Object.values(resumen).reduce((a, b) => a + b, 0);
  assert.equal(creados, TOTAL, 'tienen que entrar todos');

  const bd = await repo.obtenerBD();
  assert.equal(bd.proyectos.length, TOTAL);

  // Ninguno cae en el "Puntual" que usa el loader del maestro como aproximación.
  const conEjeDelSheet = bd.proyectos.filter((p) => p.eje && p.eje !== 'Puntual');
  assert.equal(conEjeDelSheet.length, TOTAL, 'el eje real se tiene que respetar');

  // Y el eje que entró es exactamente el del dato, no uno inventado.
  const esperados = new Map();
  for (const s of SECRETARIAS_VALIDADAS) for (const d of s.datos) esperados.set(d.proyecto, d.eje);
  for (const p of bd.proyectos) {
    assert.equal(p.eje, esperados.get(p.proyecto), `eje distinto en «${p.proyecto}»`);
  }
});

test('el estado crudo del sheet se traduce y el original queda en observaciones', async () => {
  await limpio();
  await repo.cargarProyectosValidadosCualitativo();
  const bd = await repo.obtenerBD();

  const CANONICOS = new Set(['planificado', 'en ejecución', 'demorado', 'finalizado', 'suspendido']);
  for (const p of bd.proyectos) {
    assert.ok(CANONICOS.has(p.estado), `«${p.proyecto}» quedó con estado «${p.estado}»`);
  }

  // "Programado" no es un estado del catálogo: se mapea a planificado, pero el
  // valor real tiene que sobrevivir en las observaciones.
  const crudos = SECRETARIAS_VALIDADAS.flatMap((s) => s.datos);
  const programado = crudos.find((d) => d.estado === 'Programado');
  if (programado) {
    const p = bd.proyectos.find((x) => x.proyecto === programado.proyecto);
    assert.equal(p.estado, 'planificado');
    assert.match(p.observaciones, /Programado/, 'el estado original tiene que quedar registrado');
  }
});

test('correrlo dos veces no duplica', async () => {
  await limpio();
  await repo.cargarProyectosValidadosCualitativo();
  const resumenSegundaVez = await repo.cargarProyectosValidadosCualitativo();

  const creados = Object.values(resumenSegundaVez).reduce((a, b) => a + b, 0);
  assert.equal(creados, 0, 'la segunda corrida no tiene que crear nada');

  const bd = await repo.obtenerBD();
  assert.equal(bd.proyectos.length, TOTAL);
});

test('las áreas y los programas del sheet quedan dados de alta en el catálogo', async () => {
  await limpio();
  await repo.cargarProyectosValidadosCualitativo();
  const bd = await repo.obtenerBD();

  const programas = new Set(bd.catalogos.programas.map((x) => x.nombre));
  for (const s of SECRETARIAS_VALIDADAS) {
    for (const d of s.datos) {
      assert.ok(programas.has(d.programa), `«${d.programa}» no quedó en el catálogo`);
    }
  }

  const areas = new Set(bd.catalogos.areas.map((x) => x.nombre));
  for (const s of SECRETARIAS_VALIDADAS) {
    if (s.datos.length) assert.ok(areas.has(s.area.nombre), `falta el área ${s.area.nombre}`);
  }
});

test('cargar todo junto suma las dos fuentes sin pisar una con la otra', async () => {
  await limpio();
  await repo.cargarTodosLosProyectosReales();
  const bd = await repo.obtenerBD();

  // Los validados entran primero, así que ninguno de ellos puede haber quedado
  // con el eje aproximado del maestro.
  const validados = new Map();
  for (const s of SECRETARIAS_VALIDADAS) for (const d of s.datos) validados.set(`${d.programa}||${d.proyecto}`, d.eje);

  for (const p of bd.proyectos) {
    const eje = validados.get(`${p.programa}||${p.proyecto}`);
    if (eje) assert.equal(p.eje, eje, `«${p.proyecto}» perdió su eje real`);
  }

  // Y no hay dos proyectos con el mismo área+programa+nombre.
  const claves = bd.proyectos.map((p) => `${p.area}||${p.programa}||${p.proyecto}`);
  assert.equal(new Set(claves).size, claves.length, 'hay proyectos duplicados');
});
