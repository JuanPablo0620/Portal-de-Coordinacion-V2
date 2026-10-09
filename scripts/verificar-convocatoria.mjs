/** Flujo en Chrome con Google y sesión ficticios. Nunca consulta cuentas reales. */
import { build, mergeConfig, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import configuracion from '../vite.config.js';

const carpeta = await mkdtemp(join(tmpdir(), 'portal-convocatoria-'));
const rutaDoble = (nombre) => fileURLToPath(new URL(`../pruebas/humo/${nombre}-doble.js`, import.meta.url));
const errores = [];
const consultasGoogle = [];
let servidor;
let navegador;
try {
  await build(mergeConfig(configuracion, {
    configFile: false, logLevel: 'error',
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('cliente-ficticio.apps.googleusercontent.com'),
      'import.meta.env.VITE_GOOGLE_SEGUIMIENTO_FOLDER_ID': JSON.stringify('raiz-prueba-123'),
    },
    build: { outDir: carpeta, emptyOutDir: true },
    plugins: [{
      name: 'convocatoria-dobles-solo-prueba', enforce: 'pre',
      resolveId(fuente) {
        for (const nombre of ['sesion', 'tienda']) if (fuente.endsWith(`/estado/${nombre}.js`)) return rutaDoble(nombre);
      },
      transform(codigo, id) {
        if (id === rutaDoble('tienda')) {
          return codigo + '\nimport { bdVacia } from "../../src/datos/esquema.js"; establecerBD(bdVacia());';
        }
      },
    }],
  }));
  servidor = await preview({ configFile: false, build: { outDir: carpeta }, preview: { host: '127.0.0.1', port: 5187, strictPort: true } });
  navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1000 } });
  pagina.on('pageerror', (error) => errores.push(error.message));
  pagina.on('console', (mensaje) => { if (mensaje.type() === 'error') errores.push(mensaje.text()); });
  await pagina.route('https://accounts.google.com/gsi/client', (ruta) => ruta.fulfill({ contentType: 'application/javascript', body: `
    window.google = { accounts: { oauth2: {
      hasGrantedAllScopes: () => true,
      initTokenClient: (opciones) => ({requestAccessToken: () => opciones.callback({access_token: 'token-ficticio', expires_in: 3600})})
    } } };
  ` }));
  const evento = {
    id: 'reunion-prueba', summary: 'Seguimiento Área de prueba',
    start: { dateTime: '2026-10-14T14:30:00-03:00' }, location: 'Sala de prueba',
    attendees: [{ email: 'area@example.test' }, { email: 'equipo@example.test' }],
  };
  const original = { id: 'word-prueba-123', name: '04. Compromisos Área de prueba 14/09.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  const ppt = { id: 'ppt-prueba-123', name: '05. Seguimiento Área de prueba 14/10.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', webViewLink: 'https://docs.google.com/presentation/d/ppt-prueba-123/edit' };
  const template = { id: 'template-prueba-123', name: 'Template Área de prueba', mimeType: ppt.mimeType };
  const fichero = (id, name) => ({ id, name, mimeType: 'application/vnd.google-apps.folder' });
  let mailMime = '';
  let copiaCreada = false;
  const contestar = async (ruta) => {
    const peticion = ruta.request();
    const url = new URL(peticion.url());
    consultasGoogle.push({ url: url.pathname, metodo: peticion.method() });
    if (url.pathname.endsWith('/profile')) return ruta.fulfill({ json: { emailAddress: 'equipo@example.test' } });
    if (url.pathname.endsWith('/settings/sendAs')) {
      return ruta.fulfill({ json: { sendAs: [{ sendAsEmail: 'equipo@example.test', isPrimary: true, isDefault: true, signature: '<div>Firma de prueba</div>' }] } });
    }
    if (url.pathname.endsWith('/calendarList')) return ruta.fulfill({ json: { items: [{ id: 'calendario-prueba', summary: 'Calendario de prueba', primary: true }] } });
    if (url.pathname.endsWith('/events')) return ruta.fulfill({ json: { items: [evento] } });
    if (url.pathname.endsWith('/events/reunion-prueba')) return ruta.fulfill({ json: evento });
    if (url.pathname.endsWith('/files/raiz-prueba-123')) return ruta.fulfill({ json: fichero('raiz-prueba-123', 'Secretarías') });
    if (url.pathname.endsWith('/files/word-prueba-123') && url.searchParams.get('alt') === 'media') return ruta.fulfill({ body: Buffer.from([80, 75, 3, 4]) });
    if (url.pathname.endsWith('/files/word-prueba-123')) return ruta.fulfill({ json: original });
    if (url.pathname === '/upload/drive/v3/files') return ruta.fulfill({ json: { id: 'temporal-prueba-123' } });
    if (url.pathname.endsWith('/files/temporal-prueba-123/export')) return ruta.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\nPDF ficticio para probar el flujo\n%%EOF' });
    if (url.pathname.endsWith('/files/temporal-prueba-123') && peticion.method() === 'PATCH') {
      assert.deepEqual(peticion.postDataJSON(), { trashed: true });
      return ruta.fulfill({ json: {} });
    }
    if (url.pathname.endsWith('/files/template-prueba-123/copy')) {
      assert.equal(peticion.postDataJSON().name, '05. Seguimiento Área de prueba 14/10.pptx');
      copiaCreada = true;
      return ruta.fulfill({ json: ppt });
    }
    if (url.pathname.endsWith('/drive/v3/files')) {
      const q = url.searchParams.get('q') ?? '';
      const files = q.includes('raiz-prueba-123') ? [fichero('area-prueba-123', '03. Área de prueba')]
        : q.includes('area-prueba-123') ? [fichero('seguimiento-prueba-123', 'Seguimiento')]
          : q.includes('seguimiento-prueba-123') ? [fichero('ppts-prueba-123', 'PPTS'), fichero('compromisos-prueba-123', 'Compromisos')]
            : q.includes('ppts-prueba-123') ? [template, { ...ppt, id: 'anterior-prueba-123', name: '04. Seguimiento Área de prueba 14/09.pptx' }]
              : q.includes('compromisos-prueba-123') ? [original] : [];
      return ruta.fulfill({ json: { files } });
    }
    if (url.pathname.endsWith('/users/me/drafts')) {
      mailMime = peticion.postData();
      return ruta.fulfill({ json: { id: 'borrador-prueba', message: { id: 'mensaje-prueba' } } });
    }
    throw new Error('Consulta de Google inesperada: ' + url.pathname);
  };
  await pagina.route('https://www.googleapis.com/**', contestar);
  await pagina.route('https://gmail.googleapis.com/**', contestar);
  await pagina.goto('http://127.0.0.1:5187/seguimiento');
  await pagina.getByRole('button', { name: 'Enviar convocatoria', exact: true }).click();
  const dialogo = pagina.getByRole('dialog', { name: 'Enviar convocatoria', exact: true });
  await dialogo.getByRole('button', { name: 'Conectar mi cuenta de Google' }).click();
  await dialogo.getByRole('button', { name: 'Buscar reuniones' }).click();
  await dialogo.getByLabel('Reunión de seguimiento', { exact: true }).selectOption('reunion-prueba');
  await dialogo.getByRole('button', { name: 'Buscar carpetas' }).click();
  await dialogo.getByLabel('Carpeta de la secretaría', { exact: true }).selectOption('area-prueba-123');
  await dialogo.getByRole('button', { name: 'Preparar convocatoria', exact: true }).click();
  const guardar = dialogo.getByRole('button', { name: 'Guardar borrador en Gmail' });
  await guardar.waitFor();
  assert.equal(await guardar.isDisabled(), true);
  assert.equal(copiaCreada, true);
  assert.match(await dialogo.getByLabel(/^Mensaje/).inputValue(), /miércoles 14\/10 a las 14:30/);
  assert.match(await dialogo.getByLabel(/^Mensaje/).inputValue(), /martes 13\/10/);
  const capturaDir = fileURLToPath(new URL('../../.tmp/convocatoria-qa/', import.meta.url));
  await mkdir(capturaDir, { recursive: true });
  await dialogo.screenshot({ path: join(capturaDir, 'borrador-escritorio.png') });
  await pagina.setViewportSize({ width: 390, height: 844 });
  await dialogo.screenshot({ path: join(capturaDir, 'borrador-movil.png') });
  assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await dialogo.getByLabel('Revisé los destinatarios, el mensaje, la presentación y el PDF de compromisos.', { exact: true }).check();
  await guardar.click();
  await dialogo.getByText('Convocatoria guardada en Borradores', { exact: true }).waitFor();
  assert.match(mailMime, /To: area@example.test/);
  assert.match(mailMime, /Content-Type: application\/pdf/);
  assert.match(mailMime, /Content-Type: text\/html; charset=UTF-8/);
  const cuerposMime = [...mailMime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n\r\n--/g)]
    .map((m) => Buffer.from(m[1], 'base64').toString('utf8'));
  assert.ok(cuerposMime.some((c) => c.includes('class="gmail_signature"><div>Firma de prueba</div>')), 'falta la firma de Gmail');
  assert.equal(consultasGoogle.filter((r) => r.metodo === 'POST' && r.url.endsWith('/drafts')).length, 1);
  assert.equal(consultasGoogle.some((r) => r.url.endsWith('/send')), false);
  assert.equal(await dialogo.getByRole('link', { name: 'Revisar y enviar en Gmail' }).getAttribute('href'), 'https://mail.google.com/mail/?authuser=equipo%40example.test#drafts');
  await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  await pagina.getByRole('button', { name: 'Enviar convocatoria', exact: true }).waitFor();
  assert.deepEqual(errores, []);
  console.log('✓ Chrome: Calendar → Drive → template → PDF → revisión → borrador Gmail; escritorio y móvil.');
  console.log('✓ No hubo envíos de correos ni consultas a cuentas reales.');
  console.log('Capturas: ' + capturaDir);
} finally {
  await navegador?.close();
  await servidor?.httpServer?.close();
  if (dirname(carpeta) === tmpdir() && basename(carpeta).startsWith('portal-convocatoria-')) await rm(carpeta, { recursive: true, force: true });
}
