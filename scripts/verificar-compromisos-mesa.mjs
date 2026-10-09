/**
 * Compromisos de la Mesa de Eventos en Chrome, con Google y sesión ficticios:
 * la última reunión de Calendar, el último documento de Compromisos y la última
 * PPT de Drive, y un borrador con el PDF y el .pptx adjuntos. No consulta ni
 * escribe cuentas reales.
 */
import { build, mergeConfig, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import configuracion from '../vite.config.js';

const carpeta = await mkdtemp(join(tmpdir(), 'portal-compromisos-mesa-'));
const rutaDoble = (nombre) => fileURLToPath(new URL(`../pruebas/humo/${nombre}-doble.js`, import.meta.url));
const errores = [];
const consultas = [];
// La reunión fue ayer a las 15 en Buenos Aires, sea cual sea el día de la prueba.
const ayer = new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
const [, mesAyer, diaAyer] = ayer.split('-');
let servidor;
let navegador;
try {
  await build(mergeConfig(configuracion, {
    configFile: false, logLevel: 'error',
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('cliente-ficticio.apps.googleusercontent.com'),
      'import.meta.env.VITE_GOOGLE_EVENTOS_FOLDER_ID': JSON.stringify('raiz-eventos-123'),
    },
    build: { outDir: carpeta, emptyOutDir: true },
    plugins: [{
      name: 'compromisos-mesa-dobles-solo-prueba', enforce: 'pre',
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
  servidor = await preview({ configFile: false, build: { outDir: carpeta }, preview: { host: '127.0.0.1', port: 5190, strictPort: true } });
  navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1000 } });
  pagina.on('pageerror', (error) => errores.push(error.message));
  await pagina.route('https://accounts.google.com/gsi/client', (ruta) => ruta.fulfill({ contentType: 'application/javascript', body: `
    window.google = { accounts: { oauth2: {
      hasGrantedAllScopes: () => true,
      initTokenClient: (opciones) => ({requestAccessToken: () => opciones.callback({access_token: 'token-ficticio', expires_in: 3600})})
    } } };
  ` }));
  const reunion = {
    id: 'reunion-eventos', summary: 'Reunión Mesa Eventos', status: 'confirmed',
    start: { dateTime: `${ayer}T15:00:00-03:00` },
    attendees: [{ email: 'area@example.test' }, { email: 'otra@example.test' }, { email: 'sala@resource.calendar.google.com', resource: true }],
  };
  const carpetaDrive = (id, name) => ({ id, name, mimeType: 'application/vnd.google-apps.folder' });
  const doc = (id, name) => ({ id, name, mimeType: 'application/vnd.google-apps.document' });
  const slides = (id, name) => ({ id, name, mimeType: 'application/vnd.google-apps.presentation' });
  let mailMime = '';
  const contestar = async (ruta) => {
    const peticion = ruta.request();
    const url = new URL(peticion.url());
    consultas.push({ url: url.pathname + url.search, metodo: peticion.method() });
    if (url.pathname.endsWith('/profile')) return ruta.fulfill({ json: { emailAddress: 'equipo@example.test' } });
    if (url.pathname.endsWith('/settings/sendAs')) return ruta.fulfill({ json: { sendAs: [{ isDefault: true, signature: '<div>Firma de prueba</div>' }] } });
    if (url.pathname.endsWith('/calendarList')) return ruta.fulfill({ json: { items: [{ id: 'propio', summary: 'Mi calendario', primary: true }] } });
    if (url.pathname.endsWith('/calendars/propio/events')) {
      return ruta.fulfill({ json: { items: [reunion, { ...reunion, id: 'otra', summary: 'Seguimiento Salud' }] } });
    }
    if (url.pathname.endsWith('/events/reunion-eventos')) return ruta.fulfill({ json: reunion });
    if (url.pathname.endsWith('/drive/v3/files')) {
      const q = url.searchParams.get('q');
      const files = q.includes('raiz-eventos-123') ? [carpetaDrive('cultura-123', 'Cultura'), carpetaDrive('migrantes-123', 'Migrantes')]
        : q.includes('cultura-123') ? [carpetaDrive('compromisos-123', 'Compromisos'), carpetaDrive('presentaciones-123', 'PPT'), carpetaDrive('temario-123', 'Temario')]
          : q.includes('compromisos-123') ? [doc('compromiso-17-abc', '17. Compromisos'), doc('compromiso-18-abc', `18. Compromisos Reunión Eventos ${diaAyer}/${mesAyer}.docx`)]
            : q.includes('presentaciones-123') ? [slides('ppt-16-abcdef', '16. Activamos Juventud'), slides('ppt-17-abcdef', '17. Eventos .pptx')] : [];
      return ruta.fulfill({ json: { files } });
    }
    if (url.pathname.endsWith('/files/compromiso-18-abc')) return ruta.fulfill({ json: doc('compromiso-18-abc', `18. Compromisos Reunión Eventos ${diaAyer}/${mesAyer}.docx`) });
    if (url.pathname.endsWith('/files/compromiso-18-abc/export')) return ruta.fulfill({ body: Buffer.from('%PDF-1.4\nPDF de prueba'), contentType: 'application/pdf' });
    if (url.pathname.endsWith('/files/ppt-17-abcdef')) return ruta.fulfill({ json: slides('ppt-17-abcdef', '17. Eventos .pptx') });
    if (url.pathname.endsWith('/files/ppt-17-abcdef/export')) {
      assert.equal(url.searchParams.get('mimeType'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      return ruta.fulfill({ body: Buffer.from('PK\u0003\u0004pptx de prueba'), contentType: 'application/octet-stream' });
    }
    if (url.pathname.endsWith('/users/me/drafts')) {
      assert.equal(url.pathname, '/upload/gmail/v1/users/me/drafts');
      mailMime = peticion.postData();
      return ruta.fulfill({ json: { id: 'borrador-prueba', message: { id: 'mensaje-prueba' } } });
    }
    throw new Error('Consulta de Google inesperada: ' + url.pathname);
  };
  await pagina.route('https://www.googleapis.com/**', contestar);
  await pagina.route('https://gmail.googleapis.com/**', contestar);

  await pagina.goto('http://127.0.0.1:5190/mesas');
  await pagina.getByRole('button', { name: 'Enviar compromisos', exact: true }).click();
  const dialogo = pagina.getByRole('dialog', { name: 'Enviar compromisos' });
  await dialogo.getByRole('button', { name: 'Conectar mi cuenta de Google' }).click();
  // Se proponen solos: la reunión de ayer y el número más alto de cada carpeta.
  await dialogo.getByRole('button', { name: 'Preparar envío' }).waitFor();
  assert.equal(await dialogo.getByLabel(/^Fecha de la reunión/).inputValue(), ayer);
  assert.equal(await dialogo.getByLabel(/^Destinatarios/).inputValue(), 'area@example.test, otra@example.test');
  assert.equal(await dialogo.getByLabel(/^Compromisos/).inputValue(), 'compromiso-18-abc');
  assert.equal(await dialogo.getByLabel(/^Presentación/).inputValue(), 'ppt-17-abcdef');
  await dialogo.getByRole('button', { name: 'Preparar envío' }).click();

  const guardar = dialogo.getByRole('button', { name: 'Guardar borrador en Gmail' });
  await guardar.waitFor();
  assert.equal(await guardar.isDisabled(), true);
  assert.equal(await dialogo.getByLabel(/^Asunto/).inputValue(), `Compromisos | Mesa Eventos ${diaAyer}/${mesAyer}`);
  const capturas = fileURLToPath(new URL('../../.tmp/compromisos-mesa-qa/', import.meta.url));
  await mkdir(capturas, { recursive: true });
  await dialogo.screenshot({ path: join(capturas, 'compromisos-mesa-escritorio.png') });
  await dialogo.getByLabel('Revisé los destinatarios, el mensaje y los adjuntos.', { exact: true }).check();
  await guardar.click();
  await dialogo.getByText('Compromisos guardados en Borradores', { exact: true }).waitFor();

  assert.match(mailMime, /To: area@example\.test,\r\n otra@example\.test/);
  assert.match(mailMime, /Content-Type: application\/pdf/);
  assert.match(mailMime, /filename="Presentacion\.pptx"; filename\*=UTF-8''17\.%20Eventos%20\.pptx/);
  const cuerpos = [...mailMime.matchAll(/Content-Transfer-Encoding: base64\r\n(?:Content-Disposition: [^\r]*\r\n)?\r\n([\s\S]*?)\r\n\r\n--/g)]
    .map((m) => Buffer.from(m[1], 'base64').toString('utf8'));
  const html = cuerpos.find((c) => c.includes('<div dir="ltr">')) ?? '';
  assert.match(html, /<strong>compromisos<\/strong> y la <strong>presentación<\/strong> de la reunión de la <strong>mesa Eventos del /);
  assert.match(html, /class="gmail_signature"><div>Firma de prueba<\/div>/);
  assert.ok(cuerpos.some((c) => c.startsWith('PK')), 'falta el .pptx adjunto');
  assert.equal(consultas.some((c) => c.url.endsWith('/send')), false);
  await pagina.setViewportSize({ width: 390, height: 844 });
  await dialogo.screenshot({ path: join(capturas, 'compromisos-mesa-movil.png') });
  assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errores, []);
  console.log('✓ Chrome: última reunión → último documento y PPT → borrador con PDF y .pptx; escritorio y móvil.');
  console.log('✓ No hubo envíos de correos ni consultas a cuentas reales.');
  console.log('Capturas: ' + capturas);
} finally {
  await navegador?.close();
  await servidor?.httpServer?.close();
  if (dirname(carpeta) === tmpdir() && basename(carpeta).startsWith('portal-compromisos-mesa-')) await rm(carpeta, { recursive: true, force: true });
}
