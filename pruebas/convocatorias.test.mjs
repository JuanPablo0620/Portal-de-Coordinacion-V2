import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PDF, MIME_DOC, MIME_DOCX, MIME_PPTX, datosDelEvento, fechaConDia, idDeDrive,
  materialesSugeridos, mensajeMime, moverFecha, nombrePresentacion, rawGmail, textoConvocatoria, validarConvocatoria,
} from '../src/datos/convocatorias.js';
import { crearClienteConvocatorias } from '../src/datos/googleConvocatorias.js';

const pdf = { nombre: 'Compromisos anteriores.pdf', bytes: new TextEncoder().encode('%PDF-1.4\nPDF de prueba') };
const datos = {
  area: 'Área de prueba', fecha: '2026-10-14', hora: '14:30', lugar: 'Sala de prueba', modalidad: 'presencial',
  entrega: '2026-10-13', destinatarios: 'ana@example.test, otro@example.test',
  presentacion: 'https://docs.google.com/presentation/d/presentacion-prueba/edit', firma: 'Equipo de prueba',
};
Object.assign(datos, textoConvocatoria(datos));
const respuesta = (json, estado = 200) => new Response(JSON.stringify(json), { status: estado, headers: { 'Content-Type': 'application/json' } });
const cliente = (fetch) => { const c = crearClienteConvocatorias('token-ficticio', Date.now() + 3600000, fetch); c.email = 'equipo@example.test'; return c; };

test('reunión de Calendar: conserva la fecha y hora argentina aunque venga en UTC', () => {
  assert.deepEqual(datosDelEvento({ start: { dateTime: '2026-10-15T01:30:00Z' }, location: 'Sala', attendees: [
    { email: 'ANA@example.test' }, { email: 'ana@example.test' }, { email: 'sala@example.test', resource: true },
    { email: 'otro@example.test', responseStatus: 'declined' },
  ] }), { fecha: '2026-10-14', hora: '22:30', lugar: 'Sala', destinatarios: 'ana@example.test, otro@example.test' });
});

test('no prepara eventos cancelados, de día entero o con invitados ocultos', () => {
  for (const evento of [{ status: 'cancelled' }, { start: { date: '2026-10-14' } }, { start: { dateTime: '2026-10-14T14:30:00-03:00' }, attendeesOmitted: true }]) {
    assert.throws(() => datosDelEvento(evento));
  }
});

test('fechas lineales: convocatoria a siete días, entrega al día anterior y cruces de año', () => {
  assert.equal(moverFecha('2026-10-14', -7), '2026-10-07');
  assert.equal(moverFecha('2026-01-01', -1), '2025-12-31');
  assert.equal(fechaConDia('2026-10-14'), 'miércoles 14/10');
  assert.throws(() => moverFecha('2026-02-30', -1));
});

test('materiales: la última edición no define cuál fue la última reunión', () => {
  const ppts = [
    { id: 'template', name: 'Template del área', mimeType: MIME_PPTX },
    { id: 'ppt', name: '05. Seguimiento Área 14/10.pptx' },
  ];
  const documentos = [
    { id: 'anterior', name: '04. Compromisos del área 14/09.docx', modifiedTime: '2026-09-15' },
    { id: 'viejo', name: '03. Compromisos del área 15/07.docx', modifiedTime: '2026-10-06' },
    { id: 'futuro', name: '05. Compromisos del área 14/10.docx' },
  ];
  assert.deepEqual(materialesSugeridos(ppts, documentos, '2026-10-14'), { presentacion: 'ppt', compromiso: 'anterior', plantilla: 'template' });
  assert.equal(nombrePresentacion(ppts, 'Área de prueba', '2026-10-14', ppts[0]), '06. Seguimiento Área de prueba 14/10.pptx');
  assert.equal(materialesSugeridos(ppts, [...documentos, { id: 'duplicado', name: '04. Compromisos área 14/09.pdf' }], '2026-10-14').compromiso, '');
});

test('la convocatoria reproduce el pedido de entrega, el enlace editable y la firma', () => {
  assert.equal(datos.asunto, 'Convocatoria | Reunión de seguimiento Área de prueba 14/10');
  assert.match(datos.mensaje, /miércoles 14\/10 a las 14:30/);
  assert.match(datos.mensaje, /martes 13\/10/);
  assert.match(datos.mensaje, /presencial en Sala de prueba/);
  assert.match(datos.mensaje, /PPT \| Seguimiento 14\/10/);
  assert.ok(datos.mensaje.endsWith('Equipo de prueba'));
});

test('validación bloquea cabeceras inyectadas, destinatarios inválidos y archivos falsos', () => {
  assert.equal(validarConvocatoria(datos, pdf).length, 2);
  for (const cambios of [{ asunto: 'Texto\r\nBcc: tercero@example.test' }, { destinatarios: 'incorrecto' },
    { destinatarios: 'ana@example.test\r\nBcc: tercero@example.test' }, { entrega: '2026-10-15' },
    { presentacion: 'javascript:alert(1)' }, { lugar: '' }]) assert.throws(() => validarConvocatoria({ ...datos, ...cambios }, pdf));
  assert.throws(() => validarConvocatoria(datos, { bytes: new TextEncoder().encode('no es PDF') }));
  assert.throws(() => validarConvocatoria(datos, { bytes: new Uint8Array(MAX_PDF + 1) }));
});

test('MIME y base64url preservan acentos, cuerpo y bytes del adjunto sin habilitar cabeceras', () => {
  const mime = mensajeMime(datos, pdf, 'equipo@example.test', 'limite_prueba');
  const raw = rawGmail(mime);
  assert.equal(Buffer.from(raw, 'base64url').toString('utf8'), mime);
  assert.match(mime, /Content-Type: multipart\/mixed/);
  assert.match(mime, /Content-Type: application\/pdf/);
  const asunto = [...mime.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)].map((m) => Buffer.from(m[1], 'base64').toString('utf8')).join('');
  assert.equal(asunto, datos.asunto);
  const partes = mime.split('--limite_prueba');
  assert.equal(Buffer.from(partes[1].split('\r\n\r\n')[1].trim(), 'base64').toString('utf8'), datos.mensaje);
  assert.deepEqual(new Uint8Array(Buffer.from(partes[2].split('\r\n\r\n')[1].trim(), 'base64')), pdf.bytes);
  assert.throws(() => mensajeMime(datos, pdf, 'equipo@example.test\r\nBcc: tercero@example.test'));
});

test('IDs de Drive: acepta enlaces reales y bloquea dominios e inyección en consultas', () => {
  assert.equal(idDeDrive('https://drive.google.com/drive/folders/carpeta-prueba-123'), 'carpeta-prueba-123');
  for (const id of ['https://drive.google.com.ejemplo.test/drive/folders/carpeta-prueba-123', "id' or trashed=true", 'javascript:alert(1)']) assert.throws(() => idDeDrive(id));
});

test('drafts.create recibe MIME con adjunto: un segundo clic no duplica ni manda el mail', async () => {
  const llamadas = [];
  const c = cliente(async (url, opciones) => {
    llamadas.push({ url, opciones });
    return respuesta({ id: 'borrador-prueba', message: { id: 'mensaje-prueba' } });
  });
  const creado = await c.crearBorrador(datos, pdf);
  assert.equal(creado.id, 'borrador-prueba');
  assert.match(creado.url, /#drafts$/);
  await assert.rejects(c.crearBorrador(datos, pdf), /Revisá Borradores/);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, 'https://gmail.googleapis.com/gmail/v1/users/me/drafts');
  assert.equal(llamadas[0].opciones.method, 'POST');
  assert.match(Buffer.from(JSON.parse(llamadas[0].opciones.body).message.raw, 'base64url').toString('utf8'), /application\/pdf/);
});

test('respuesta perdida de Gmail bloquea el reintento; un rechazo explícito permite corregir', async () => {
  const c = cliente(async () => { throw new Error('timeout de prueba'); });
  await assert.rejects(c.crearBorrador(datos, pdf), (e) => e.resultadoIncierto === true);
  await assert.rejects(c.crearBorrador(datos, pdf), /Revisá Borradores/);
  let intentos = 0;
  const otro = cliente(async () => ++intentos === 1 ? respuesta({}, 403) : respuesta({ id: 'ok' }));
  await assert.rejects(otro.crearBorrador(datos, pdf), /permiso/);
  assert.equal((await otro.crearBorrador(datos, pdf)).id, 'ok');
});

test('la paginación trae todos los calendarios y sesiones cerradas no siguen consultando', async () => {
  const urls = [];
  const c = cliente(async (url) => {
    urls.push(url);
    return respuesta(url.includes('pageToken=segunda') ? { items: [{ id: 'compartido' }] } : { items: [{ id: 'principal' }], nextPageToken: 'segunda' });
  });
  assert.equal((await c.calendarios()).length, 2);
  c.cerrar();
  await assert.rejects(c.perfil(), /venció/);
  assert.equal(urls.length, 2);
});

test('Word se convierte en copia temporal, se exporta y se retira sin tocar el original', async () => {
  const llamadas = [];
  const c = cliente(async (url, opciones) => {
    llamadas.push({ url, opciones });
    if (url.includes('/upload/')) return respuesta({ id: 'temporal-prueba-123' });
    if (url.includes('/export?')) return new Response(pdf.bytes);
    if (url.includes('alt=media')) return new Response(new Uint8Array([80, 75, 3, 4]));
    if (opciones.method === 'PATCH') return respuesta({ id: 'temporal-prueba-123', trashed: true });
    return respuesta({ id: 'original-prueba-123', name: '04. Compromisos 14/09.docx', mimeType: MIME_DOCX });
  });
  const exportado = await c.pdfCompromisos('original-prueba-123');
  assert.match(exportado.nombre, /\.pdf$/);
  assert.deepEqual(exportado.bytes, pdf.bytes);
  const escribir = llamadas.filter((l) => l.opciones.method !== 'GET');
  assert.equal(escribir.length, 2);
  assert.match(escribir[0].opciones.body, new RegExp(MIME_DOC.replaceAll('.', '\\.')));
  assert.ok(escribir[1].url.endsWith('/temporal-prueba-123'));
  assert.deepEqual(JSON.parse(escribir[1].opciones.body), { trashed: true });
});

test('también retira la conversión temporal si el export de PDF falla', async () => {
  let retirado = false;
  const c = cliente(async (url, opciones) => {
    if (url.includes('/upload/')) return respuesta({ id: 'temporal-prueba-123' });
    if (url.includes('/export?')) return respuesta({}, 500);
    if (url.includes('alt=media')) return new Response(new Uint8Array([80, 75]));
    if (opciones.method === 'PATCH') { retirado = true; return respuesta({}); }
    return respuesta({ id: 'original-prueba-123', name: 'Compromisos.docx', mimeType: MIME_DOCX });
  });
  await assert.rejects(c.pdfCompromisos('original-prueba-123'));
  assert.equal(retirado, true);
});

test('Google Docs se exporta directamente: no se crea ni se modifica una copia', async () => {
  const llamadas = [];
  const c = cliente(async (url, opciones) => {
    llamadas.push(opciones.method);
    return url.includes('/export?') ? new Response(pdf.bytes) : respuesta({ id: 'documento-prueba-123', name: 'Compromisos', mimeType: MIME_DOC });
  });
  await c.pdfCompromisos('documento-prueba-123');
  assert.deepEqual(llamadas, ['GET', 'GET']);
});

test('si otro integrante ya preparó la PPT para esa fecha, la reconsulta evita otra copia', async () => {
  const plantilla = { id: 'template-prueba-123', name: 'Template de prueba', mimeType: MIME_PPTX };
  const presentacion = { id: 'ppt-prueba-123', name: '05. Seguimiento Área de prueba 14/10.pptx', mimeType: MIME_PPTX };
  const metodos = [];
  const c = cliente(async (_url, opciones) => { metodos.push(opciones.method); return respuesta({ files: [plantilla, presentacion] }); });
  const existente = await c.copiarPresentacion({ carpetaPPTS: 'carpeta-prueba-123', presentaciones: [plantilla] }, plantilla.id, 'Área de prueba', '2026-10-14');
  assert.equal(existente.id, presentacion.id);
  assert.deepEqual(metodos, ['GET']);
});
