/**
 * Invitación a la Mesa de Eventos en Chrome, con Google y sesión ficticios:
 * conectar, agendar en Calendar y guardar la convocatoria en Gmail. Comprueba
 * lo que el portal le manda a Google —horario, invitados, aviso a invitados,
 * texto con negritas y firma— sin consultar ni escribir cuentas reales.
 */
import { build, mergeConfig, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import configuracion from '../vite.config.js';

const carpeta = await mkdtemp(join(tmpdir(), 'portal-invitacion-'));
const rutaDoble = (nombre) => fileURLToPath(new URL(`../pruebas/humo/${nombre}-doble.js`, import.meta.url));
const errores = [];
const consultas = [];
let servidor;
let navegador;
try {
  await build(mergeConfig(configuracion, {
    configFile: false, logLevel: 'error',
    define: { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('cliente-ficticio.apps.googleusercontent.com') },
    build: { outDir: carpeta, emptyOutDir: true },
    plugins: [{
      name: 'invitacion-dobles-solo-prueba', enforce: 'pre',
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
  servidor = await preview({ configFile: false, build: { outDir: carpeta }, preview: { host: '127.0.0.1', port: 5189, strictPort: true } });
  navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1000 } });
  pagina.on('pageerror', (error) => errores.push(error.message));
  await pagina.route('https://accounts.google.com/gsi/client', (ruta) => ruta.fulfill({ contentType: 'application/javascript', body: `
    window.google = { accounts: { oauth2: {
      hasGrantedAllScopes: () => true,
      initTokenClient: (opciones) => ({requestAccessToken: () => opciones.callback({access_token: 'token-ficticio', expires_in: 3600})})
    } } };
  ` }));
  let evento = null;
  let mailMime = '';
  const contestar = async (ruta) => {
    const peticion = ruta.request();
    const url = new URL(peticion.url());
    consultas.push({ url: url.pathname + url.search, metodo: peticion.method() });
    if (url.pathname.endsWith('/profile')) return ruta.fulfill({ json: { emailAddress: 'equipo@example.test' } });
    if (url.pathname.endsWith('/settings/sendAs')) {
      return ruta.fulfill({ json: { sendAs: [{ isPrimary: true, isDefault: true, signature: '<div>Firma de prueba</div>' }] } });
    }
    if (url.pathname.endsWith('/calendarList')) {
      return ruta.fulfill({ json: { items: [
        { id: 'propio', summary: 'Mi calendario', primary: true, accessRole: 'owner' },
        { id: 'feriados', summary: 'Feriados', accessRole: 'reader' },
      ] } });
    }
    if (url.pathname.endsWith('/calendars/propio/events') && peticion.method() === 'POST') {
      evento = { ...peticion.postDataJSON(), aviso: url.searchParams.get('sendUpdates') };
      return ruta.fulfill({ json: { ...evento, htmlLink: 'https://calendar.google.com/event?eid=prueba' } });
    }
    if (url.pathname.endsWith('/users/me/drafts')) {
      mailMime = Buffer.from(peticion.postDataJSON().message.raw, 'base64url').toString('utf8');
      return ruta.fulfill({ json: { id: 'borrador-prueba', message: { id: 'mensaje-prueba' } } });
    }
    throw new Error('Consulta de Google inesperada: ' + url.pathname);
  };
  await pagina.route('https://www.googleapis.com/**', contestar);
  await pagina.route('https://gmail.googleapis.com/**', contestar);

  await pagina.goto('http://127.0.0.1:5189/mesas');
  await pagina.getByRole('button', { name: 'Invitar a la reunión', exact: true }).click();
  const dialogo = pagina.getByRole('dialog', { name: 'Invitar a la reunión' });
  // La Mesa de Eventos no comparte presentación: el campo no se ofrece.
  assert.equal(await dialogo.getByLabel(/Presentación para completar/).count(), 0);
  await dialogo.getByLabel(/^Fecha/).fill('2030-10-09');
  const invitados = dialogo.getByLabel(/^Invitados/);
  await invitados.fill('area@example.test, otra@example.test');
  await invitados.press('Enter');
  await dialogo.getByRole('button', { name: 'Conectar mi cuenta de Google' }).click();
  await dialogo.getByText('equipo@example.test', { exact: true }).waitFor();

  // Agendar: sin la confirmación el botón no se habilita.
  const agendar = dialogo.getByRole('button', { name: 'Agendar en Calendar' });
  assert.equal(await agendar.isDisabled(), true);
  await dialogo.getByLabel(/Google les manda la invitación a 2 personas/).check();
  await agendar.click();
  await dialogo.getByText('Evento creado y enviado a los invitados', { exact: true }).waitFor();
  assert.equal(evento.aviso, 'all');
  assert.equal(evento.summary, 'Reunión Mesa Eventos');
  assert.equal(evento.location, 'Sala de Reuniones de la Privada');
  assert.deepEqual(evento.start, { dateTime: '2030-10-09T15:00:00', timeZone: 'America/Argentina/Buenos_Aires' });
  assert.deepEqual(evento.end, { dateTime: '2030-10-09T16:00:00', timeZone: 'America/Argentina/Buenos_Aires' });
  assert.deepEqual(evento.attendees, [{ email: 'area@example.test' }, { email: 'otra@example.test' }]);
  assert.match(evento.id, /^[a-v0-9]{5,1024}$/);
  assert.equal(evento.description, undefined);
  // El calendario de sólo lectura no se ofrece.
  assert.equal(consultas.filter((c) => c.url.includes('/calendars/feriados')).length, 0);

  // Mail: la vista previa ya muestra el texto de la mesa.
  await dialogo.getByText('Mesa Eventos | 09/10').waitFor();
  const capturas = fileURLToPath(new URL('../../.tmp/invitacion-qa/', import.meta.url));
  await mkdir(capturas, { recursive: true });
  await dialogo.screenshot({ path: join(capturas, 'invitacion-escritorio.png') });
  await dialogo.getByLabel('Revisé el asunto, el mensaje y los destinatarios.', { exact: true }).check();
  await dialogo.getByRole('button', { name: 'Guardar borrador en Gmail' }).click();
  await dialogo.getByText('Convocatoria guardada en Borradores', { exact: true }).waitFor();
  assert.match(mailMime, /To: area@example\.test,\r\n otra@example\.test/);
  assert.doesNotMatch(mailMime, /application\/pdf/);
  const cuerpos = [...mailMime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n\r\n--/g)]
    .map((m) => Buffer.from(m[1], 'base64').toString('utf8'));
  const html = cuerpos.find((c) => c.includes('<div dir="ltr">')) ?? '';
  assert.match(html, /<strong>miércoles 09\/10<\/strong> a las <strong>15:00hs<\/strong>/);
  assert.match(html, /class="gmail_signature"><div>Firma de prueba<\/div>/);
  assert.equal(consultas.some((c) => c.url.endsWith('/send')), false);
  await pagina.setViewportSize({ width: 390, height: 844 });
  await dialogo.screenshot({ path: join(capturas, 'invitacion-movil.png') });
  assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errores, []);
  console.log('✓ Chrome: conectar → agendar en Calendar (con aviso a invitados) → borrador de Gmail; escritorio y móvil.');
  console.log('✓ No hubo envíos de correos ni consultas a cuentas reales.');
  console.log('Capturas: ' + capturas);
} finally {
  await navegador?.close();
  await servidor?.httpServer?.close();
  if (dirname(carpeta) === tmpdir() && basename(carpeta).startsWith('portal-invitacion-')) await rm(carpeta, { recursive: true, force: true });
}
