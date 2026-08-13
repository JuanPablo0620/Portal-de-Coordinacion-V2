import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificarMinuta } from '../src/datos/minutas/separarMinuta.js';
import { separarTemas } from '../src/datos/minutas/separarTemas.js';
import { CATALOGOS_SEMILLA } from '../src/datos/catalogos.js';

const HOY = '2026-08-08';
const CATEGORIAS = CATALOGOS_SEMILLA.categorias_tema.map((c) => ({ valor: c.nombre }));

const transferir = (texto, categorias = CATEGORIAS) => separarTemas(texto, { hoy: HOY, categorias });

/* ── El motor compartido ──────────────────────────────────────────── */

test('la clasificación conserva el orden del texto original', () => {
  const r = clasificarMinuta(
    'Se ejecutaron 200 metros de cordón cuneta. Falta la conformidad del área técnica. ' +
      'Ferreyra va a presentar el informe.',
    HOY,
  );
  assert.deepEqual(
    r.map((o) => o.clase),
    ['avance', 'problema', 'compromiso'],
  );
});

test('un texto vacío no produce temas', () => {
  assert.deepEqual(transferir(''), []);
  assert.deepEqual(transferir('   \n  '), []);
});

/* ── Un tema por oración ──────────────────────────────────────────── */

test('cada oración con sustancia se transfiere a un tema', () => {
  const temas = transferir(
    'Se completó el operativo de bacheo en el barrio Norte. Falta la partida para pagarle al proveedor. ' +
      'Ferreyra va a elevar el expediente antes del 15/09.',
  );
  assert.equal(temas.length, 3);
  for (const t of temas) assert.ok(t.descripcion.trim().length > 0);
});

/* ── Acción y compromiso ──────────────────────────────────────────── */

test('sólo un compromiso llega con acción, responsable y fecha', () => {
  const [tema] = transferir('Ferreyra va a elevar el expediente antes del 15/09.');
  assert.equal(tema.requiere_accion, true);
  assert.equal(tema.responsable, 'Ferreyra');
  assert.equal(tema.fecha_limite, '2026-09-15');
});

test('un avance informado no genera acción', () => {
  const [tema] = transferir('Se ejecutaron 200 metros de cordón cuneta en el sector norte.');
  assert.equal(tema.requiere_accion, false);
  assert.equal(tema.responsable, '');
  assert.equal(tema.fecha_limite, '');
  assert.equal(tema.criticidad, 'baja');
});

/* ── Criticidad propuesta ─────────────────────────────────────────── */

test('una traba urgente se propone en criticidad alta', () => {
  const [tema] = transferir('Los vecinos presentaron un reclamo por la falta de luminarias.');
  assert.equal(tema.criticidad, 'alta');
});

test('una traba sin señal de urgencia se propone en media', () => {
  const [tema] = transferir('Falta la conformidad del área técnica para avanzar.');
  assert.equal(tema.criticidad, 'media');
});

/* ── Categoría contra el catálogo vigente ─────────────────────────── */

test('propone la categoría del catálogo que corresponde', () => {
  const casos = [
    ['Los vecinos presentaron un reclamo por el estado de la calle.', 'Reclamo vecinal'],
    ['Falta la partida para pagarle al proveedor de materiales.', 'Proveedores y contrataciones'],
    ['Ferreyra va a elevar el expediente antes del 15/09.', 'Administrativo / expediente'],
    ['No se aprobó la partida presupuestaria del mes.', 'Presupuestario'],
  ];
  for (const [frase, esperada] of casos) {
    const [tema] = transferir(frase);
    assert.equal(tema.categoria, esperada, `categoría equivocada para: ${frase}`);
  }
});

test('lo específico gana sobre lo general: un pago a proveedor no es presupuestario', () => {
  const [tema] = transferir('Se demoró el pago al proveedor de la obra.');
  assert.equal(tema.categoria, 'Proveedores y contrataciones');
});

test('sin categoría en el catálogo el tema queda sin categoría, no se inventa una', () => {
  const [conCatalogoVacio] = separarTemas('Los vecinos presentaron un reclamo.', { hoy: HOY });
  assert.equal(conCatalogoVacio.categoria, '');

  const [conOtroCatalogo] = transferir('Los vecinos presentaron un reclamo.', [{ valor: 'Otra cosa' }]);
  assert.equal(conOtroCatalogo.categoria, '');
});

/* ── Trazabilidad de la propuesta ─────────────────────────────────── */

test('cada tema informa de qué clase de oración salió', () => {
  const temas = transferir(
    'Se completó el operativo de bacheo. Falta la conformidad técnica. Ferreyra va a presentar el informe.',
  );
  assert.deepEqual(
    temas.map((t) => t.clase),
    ['avance', 'problema', 'compromiso'],
  );
});
