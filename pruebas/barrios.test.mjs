import { crearClienteConvocatorias } from '../src/datos/googleConvocatorias.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { patronTituloMesa, plantillaBarrial, armarInvitacion } from '../src/datos/invitaciones.js';

test('cada mesa barrial encuentra sus reuniones sin interpretar el nombre como regex', () => {
  const patron = patronTituloMesa('Mesa Esperanza');
  assert.ok(patron.test('reunion mesa esperanza | 14/10'));
  assert.ok(!patron.test('reunion mesa edla | 14/10'));
  assert.ok(!patronTituloMesa('Mesa A+B').test('mesa aaab'));
  assert.ok(patronTituloMesa('Mesa A+B').test('reunion mesa a+b'));
  assert.ok(!patronTituloMesa('').test('reunion cualquiera'));
});

test('la convocatoria barrial tiene negritas y no exige una PPT', () => {
  const plantilla = { ...plantillaBarrial(), lugar: 'Sala', hora: '10:00' };
  const mail = armarInvitacion(plantilla, { nombre: 'Mesa Esperanza', fecha: '2026-10-14' });
  assert.equal(mail.titulo, 'Mesa Esperanza | 14/10');
  assert.ok(mail.cuerpo.includes('**Mesa Esperanza**'));
  assert.ok(!mail.cuerpo.includes('{link}'));
});


test('la carpeta del barrio admite Compromisos y PPTS con prefijos numericos', async () => {
  const carpeta = (id, name) => ({ id, name, mimeType: 'application/vnd.google-apps.folder' });
  const cliente = crearClienteConvocatorias('ficticio', Date.now() + 3600000, async (url) => {
    const q = new URL(url).searchParams.get('q') ?? '';
    const files = q.includes("'barrio-prueba-123'")
      ? [carpeta('compromisos-prueba-123', '01. Compromisos'), carpeta('ppts-prueba-123', '02. PPTS')]
      : q.includes("'compromisos-prueba-123'")
        ? [{ id: 'doc-prueba-123', name: '11. Compromisos', mimeType: 'application/vnd.google-apps.document' }]
        : [{ id: 'ppt-prueba-123', name: '11. Reunion', mimeType: 'application/vnd.google-apps.presentation' }];
    return new Response(JSON.stringify({ files }), { status: 200 });
  });
  const materiales = await cliente.materialesMesa('barrio-prueba-123');
  assert.equal(materiales.compromisos[0].id, 'doc-prueba-123');
  assert.equal(materiales.presentaciones[0].id, 'ppt-prueba-123');
});
