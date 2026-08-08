import test from 'node:test';
import assert from 'node:assert/strict';
import { generarIdProyecto, nuevoId } from '../src/datos/ids.js';

const bd = {
  proyectos: [],
  catalogos: { areas: [{ id: 'a1', nombre: 'Obras Públicas', prefijo: 'OBR' }] },
};

test('genera el primer id con correlativo 001', () => {
  assert.equal(generarIdProyecto(bd, 'a1', '2026-03-14'), 'OBR-2026-001');
});

test('continúa el correlativo por prefijo y año', () => {
  const con = { ...bd, proyectos: [{ id_proyecto: 'OBR-2026-001' }, { id_proyecto: 'OBR-2026-007' }] };
  assert.equal(generarIdProyecto(con, 'a1', '2026-05-02'), 'OBR-2026-008');
});

test('el correlativo no se mezcla entre años', () => {
  const con = { ...bd, proyectos: [{ id_proyecto: 'OBR-2025-009' }] };
  assert.equal(generarIdProyecto(con, 'a1', '2026-01-10'), 'OBR-2026-001');
});

test('el correlativo cuenta bajas lógicas para no reusar ids', () => {
  const con = { ...bd, proyectos: [{ id_proyecto: 'OBR-2026-001', activo: false }] };
  assert.equal(generarIdProyecto(con, 'a1', '2026-06-01'), 'OBR-2026-002');
});

test('un área sin prefijo cae en GEN en lugar de romper', () => {
  assert.equal(generarIdProyecto(bd, 'inexistente', '2026-06-01'), 'GEN-2026-001');
});

test('nuevoId devuelve ids únicos con el prefijo pedido', () => {
  const a = nuevoId('sg');
  const b = nuevoId('sg');
  assert.match(a, /^sg_/);
  assert.notEqual(a, b);
});
