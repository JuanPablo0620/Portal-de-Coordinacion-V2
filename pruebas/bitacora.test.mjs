import test from 'node:test';
import assert from 'node:assert/strict';
import { diffCampos, crearAsiento } from '../src/datos/bitacora.js';

test('diffCampos detecta sólo los campos que cambiaron', () => {
  const cambios = diffCampos(
    { avance: 120, estado: 'planificado', area: 'Obras' },
    { avance: 180, estado: 'planificado', area: 'Obras' },
  );
  assert.deepEqual(cambios, [{ campo: 'avance', antes: 120, despues: 180 }]);
});

test('diffCampos ignora los campos de trazabilidad', () => {
  assert.deepEqual(diffCampos({ a: 1, creado_en: 'x' }, { a: 1, creado_en: 'y' }), []);
});

test('diffCampos detecta campos nuevos y campos que desaparecen', () => {
  const cambios = diffCampos({ a: 1 }, { a: 1, b: 2 });
  assert.deepEqual(cambios, [{ campo: 'b', antes: undefined, despues: 2 }]);
});

test('diffCampos compara arreglos por contenido, no por referencia', () => {
  assert.deepEqual(diffCampos({ ids: ['x'] }, { ids: ['x'] }), []);
  assert.equal(diffCampos({ ids: ['x'] }, { ids: ['x', 'y'] }).length, 1);
});

test('crearAsiento estampa entidad, acción, usuario y marca de tiempo', () => {
  const a = crearAsiento({
    entidad: 'proyectos',
    id_entidad: 'OBR-2026-014',
    accion: 'edicion',
    cambios: [],
    usuario: 'M. López',
  });
  assert.equal(a.entidad, 'proyectos');
  assert.equal(a.accion, 'edicion');
  assert.equal(a.creado_por, 'M. López');
  assert.match(a.creado_en, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(a.id);
});
