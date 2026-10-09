import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PDF, MIME_DOC, MIME_DOCX, MIME_PPTX, areaDelTitulo, coincidenciaUnica, compromisoDeLaReunion, datosDelEvento, fechaConDia, idDeDrive,
  materialesSugeridos, mensajeHtml, mensajeMime, mensajePlano, moverFecha, nombrePresentacion, rawGmail, reunionesRealizadas,
  textoCompromisos, textoConvocatoria, validarConvocatoria,
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
  assert.match(datos.mensaje, /\[PPT \| Seguimiento 14\/10\]/);
  assert.match(datos.mensaje, /\*\*Reunión de Seguimiento de Área de prueba\*\*/);
  assert.ok(datos.mensaje.endsWith('Equipo de prueba'));
});

test('la secretaría sale del título de Calendar y la carpeta se propone sólo si es única', () => {
  const areas = [
    { nombre: 'Secretaría de Ambiente y Servicios Públicos' }, { nombre: 'Secretaría de Capital Humano' },
    { nombre: 'Secretaría de Obras' }, { nombre: 'Secretaría de Salud' }, { nombre: 'Secretaría de Seguridad' },
    { nombre: 'Secretaría de Trabajo y Producción' }, { nombre: 'Dirección de Capital Humano Joven' },
    { nombre: 'Secretaría de Turismo', activo: false },
  ];
  assert.equal(areaDelTitulo('SEGUIMIENTO CAPITAL HUMANO', areas), 'Capital Humano');
  assert.equal(areaDelTitulo('Seguimiento - Ambiente', areas), 'Ambiente y Servicios Públicos');
  assert.equal(areaDelTitulo('Seguimiento Trabajo y Producción', areas), 'Trabajo y Producción');
  assert.equal(areaDelTitulo('Seguimiento Turismo', areas), '');
  assert.equal(areaDelTitulo('Seguimiento general', areas), '');
  const carpetas = [{ id: 'a', name: '01. Ambiente' }, { id: 'c', name: '03. Capital Humano' }, { id: 'o', name: '04. Obras Públicas' }];
  const carpeta = (area) => coincidenciaUnica(area, carpetas, (c) => c.name)?.id ?? null;
  assert.equal(carpeta('Capital Humano'), 'c');
  assert.equal(carpeta('Ambiente y Servicios Públicos'), 'a');
  assert.equal(carpeta('Obras'), 'o');
  assert.equal(carpeta('Salud'), null);
  assert.equal(coincidenciaUnica('Capital', [{ name: 'Capital Humano' }, { name: 'Capital Social' }], (c) => c.name), null);
});

test('envío de compromisos: última reunión realizada, documento del mismo día y sin presentación', () => {
  const evento = (id, dateTime) => ({ id, start: { dateTime } });
  const ahora = new Date('2026-10-08T15:00:00-03:00');
  const realizadas = reunionesRealizadas([
    evento('vieja', '2026-09-30T10:00:00-03:00'), evento('futura', '2026-10-14T14:30:00-03:00'),
    evento('ayer', '2026-10-07T14:30:00-03:00'),
  ], ahora);
  assert.deepEqual(realizadas.map((e) => e.id), ['ayer', 'vieja']);

  const documentos = [
    { id: 'anterior', name: '04. Compromisos de Capital Humano 14/09.docx' },
    { id: 'del-dia', name: '05. Compromisos de Capital Humano 07/10.docx' },
  ];
  assert.equal(compromisoDeLaReunion(documentos, '2026-10-07'), 'del-dia');
  assert.equal(compromisoDeLaReunion(documentos, '2026-10-21'), '');
  assert.equal(compromisoDeLaReunion([...documentos, { id: 'otro', name: 'Compromisos 07/10.pdf' }], '2026-10-07'), '');

  const envio = { tipo: 'compromisos', area: 'Capital Humano', fecha: '2026-10-07', destinatarios: 'ana@example.test', firma: 'Equipo de prueba' };
  Object.assign(envio, textoCompromisos(envio));
  assert.equal(envio.asunto, 'Compromisos | Seguimiento Capital Humano 07/10');
  assert.match(envio.mensaje, /^¡Buenas tardes a todos!\n\nEn este mail les adjunto los compromisos de la reunión de seguimiento del miércoles 07\/10\./);
  assert.ok(envio.mensaje.endsWith('Equipo de prueba'));
  // Sin lugar, entrega ni enlace a la PPT: igual es válido.
  assert.equal(validarConvocatoria(envio, pdf).length, 1);
  assert.throws(() => validarConvocatoria({ ...envio, area: '' }, pdf));
  const mime = mensajeMime(envio, pdf, 'equipo@example.test', 'limite_compromisos');
  assert.doesNotMatch(mime, /href=/);
  assert.equal(mensajeHtml('Ver [esto]', ''), '<div dir="ltr">Ver [esto]</div>');
});

test('el mensaje marca negrita y enlaza sólo a la presentación, sin inyectar HTML', () => {
  const html = mensajeHtml('Hola **<b>equipo</b>** & [la PPT]\n[otra](https://ejemplo.test)', datos.presentacion);
  assert.match(html, /<strong>&lt;b&gt;equipo&lt;\/b&gt;<\/strong> &amp; <a href="https:\/\/docs\.google\.com\/presentation\/d\/presentacion-prueba\/edit">la PPT<\/a><br>/);
  assert.doesNotMatch(html, /ejemplo\.test"/);
  assert.equal(mensajePlano('Ver **esto**: [PPT]', 'https://docs.google.com/x'), 'Ver esto: PPT\nhttps://docs.google.com/x');
  assert.throws(() => validarConvocatoria({ ...datos, mensaje: 'Sin enlace a la presentación' }, pdf), /corchetes/);
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
  const cuerpo = (parte) => Buffer.from(parte.split('\r\n\r\n')[1].trim(), 'base64').toString('utf8');
  const [, plano, html] = partes[1].split('--alt_limite_prueba');
  assert.match(partes[1], /Content-Type: multipart\/alternative/);
  assert.equal(cuerpo(plano), mensajePlano(datos.mensaje, datos.presentacion));
  assert.match(cuerpo(plano), /PPT \| Seguimiento 14\/10\nhttps:\/\/docs\.google\.com\/presentation\/d\/presentacion-prueba\/edit/);
  assert.match(html, /Content-Type: text\/html; charset=UTF-8/);
  assert.equal(cuerpo(html), mensajeHtml(datos.mensaje, datos.presentacion));
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
