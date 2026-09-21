/**
 * Un borrador de compromiso sólo cuenta como actualización si algo cambió.
 * De eso depende que «Finalizar monitoreo» deje UNA actualización por
 * compromiso y ninguna para los que se abrieron y se cerraron sin tocar.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { borradoresAplicables, esBorradorVacio } from '../src/datos/borradoresCompromisos.js';

const compromiso = { id: 'c1', estado: 'pendiente', fecha_limite: '2026-10-01', id_subsecretaria: null, id_direccion: null };

test('sin borrador, o sin cambios, no hay actualización', () => {
  assert.equal(esBorradorVacio(undefined, compromiso), true);
  assert.equal(esBorradorVacio({}, compromiso), true);
  assert.equal(esBorradorVacio({ nuevaActualizacion: '   ' }, compromiso), true);
});

test('volver a poner el mismo valor tampoco es una novedad', () => {
  assert.equal(esBorradorVacio({ estado: 'pendiente', fecha_limite: '2026-10-01' }, compromiso), true);
  assert.equal(esBorradorVacio({ fecha_limite: '' , id_direccion: ''}, { ...compromiso, fecha_limite: null }), true);
});

test('texto, estado, fecha o unidad distintos son actualización', () => {
  assert.equal(esBorradorVacio({ nuevaActualizacion: 'Se firmó el convenio' }, compromiso), false);
  assert.equal(esBorradorVacio({ estado: 'en_curso' }, compromiso), false);
  assert.equal(esBorradorVacio({ fecha_limite: '2026-11-01' }, compromiso), false);
  assert.equal(esBorradorVacio({ id_direccion: 'd1' }, compromiso), false);
});

test('borradoresAplicables descarta los vacíos y los de compromisos que ya no existen', () => {
  const aplicables = borradoresAplicables(
    {
      c1: { nuevaActualizacion: 'Avance' },
      c2: { nuevaActualizacion: '' },
      c3: { nuevaActualizacion: 'Huérfano' },
    },
    [compromiso, { ...compromiso, id: 'c2' }],
  );
  assert.deepEqual(aplicables.map(([id]) => id), ['c1']);
});
