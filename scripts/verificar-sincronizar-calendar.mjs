/**
 * «Actualizar desde Calendar» en Chrome, con Google ficticio y datos
 * sintéticos: pide sólo lectura de Calendar, propone reprogramar, agendar y
 * dar de baja, aplica sólo lo tildado y nunca escribe en Google.
 */
import { build, mergeConfig, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import configuracion from '../vite.config.js';
import { bdVacia } from '../src/datos/esquema.js';
import { moverFecha } from '../src/datos/convocatorias.js';

const PUERTO = 5193;
const carpeta = await mkdtemp(join(tmpdir(), 'portal-sync-calendar-'));
const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
const dia = (n) => moverFecha(hoy, n);
const base = bdVacia();
const agendado = (id, area, fecha, hora) => ({
  id, area, fecha, hora, tipo: 'programado', activo: true, participantes: '', temas: '',
  ids_proyecto: [], resumen: '', avances: [], problemas: [],
});
base.seguimientos.push(
  agendado('s-obras', 'Secretaría de Obras', dia(5), '10:00'),
  agendado('s-capital', 'Secretaría de Capital Humano', dia(3), '09:00'),
  agendado('s-seguridad', 'Secretaría de Seguridad', dia(10), '12:00'),
);
const evento = (id, titulo, fecha, hora) => ({
  id, status: 'confirmed', summary: titulo, start: { dateTime: `${fecha}T${hora}:00-03:00` },
  htmlLink: `https://calendar.google.com/event?eid=${id}`,
});
const eventos = [
  evento('e1', 'SEGUIMIENTO CAPITAL HUMANO', dia(3), '09:00'),
  evento('e2', 'Seguimiento Obras', dia(7), '11:00'),
  evento('e3', ' Seguimiento - Trabajo y Producción ', dia(12), '14:00'),
  evento('e4', 'SG - SEGUIMIENTO', dia(1), '08:00'),
  evento('e5', 'Almuerzo de equipo', dia(2), '13:00'),
];

let servidor;
let navegador;
try {
  await build(mergeConfig(configuracion, {
    configFile: false, logLevel: 'error',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': '""',
      'import.meta.env.VITE_SUPABASE_ANON_KEY': '""',
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('cliente-ficticio.apps.googleusercontent.com'),
    },
    build: { outDir: carpeta, emptyOutDir: true },
    plugins: [{
      name: 'sync-sesion-sintetica', enforce: 'pre',
      resolveId(fuente) {
        if (fuente.endsWith('/estado/sesion.js')) return fileURLToPath(new URL('../pruebas/humo/sesion-doble.js', import.meta.url));
      },
    }],
  }));
  servidor = await preview({ configFile: false, build: { outDir: carpeta }, preview: { host: '127.0.0.1', port: PUERTO, strictPort: true } });
  navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1000 } });
  const errores = [];
  const consultas = [];
  pagina.on('pageerror', (error) => errores.push(error.message));
  await pagina.route('**/*', (ruta) => ruta.request().url().startsWith(`http://127.0.0.1:${PUERTO}/`) ? ruta.continue() : ruta.abort());
  await pagina.route('https://accounts.google.com/gsi/client', (ruta) => ruta.fulfill({ contentType: 'application/javascript', body: `
    window.google = { accounts: { oauth2: {
      hasGrantedAllScopes: () => true,
      initTokenClient: (opciones) => { window.permisosPedidos = opciones.scope; return {
        requestAccessToken: () => opciones.callback({ access_token: 'token-ficticio', expires_in: 3600 }),
      }; },
    } } };
  ` }));
  await pagina.route('https://www.googleapis.com/**', (ruta) => {
    const peticion = ruta.request();
    const url = new URL(peticion.url());
    consultas.push({ metodo: peticion.method(), ruta: url.pathname });
    if (url.pathname.endsWith('/calendars/primary')) return ruta.fulfill({ json: { id: 'equipo@example.test' } });
    if (url.pathname.endsWith('/calendars/primary/events')) return ruta.fulfill({ json: { items: eventos } });
    throw new Error('Consulta de Google inesperada: ' + url.pathname);
  });
  await pagina.addInitScript((base) => {
    if (!localStorage.getItem('coord3f_bd_v1')) localStorage.setItem('coord3f_bd_v1', JSON.stringify(base));
  }, base);
  const leer = () => pagina.evaluate(() => JSON.parse(localStorage.getItem('coord3f_bd_v1')));

  const capturas = fileURLToPath(new URL('../.tmp/sync-calendar-qa/', import.meta.url));
  await mkdir(capturas, { recursive: true });
  await pagina.goto(`http://127.0.0.1:${PUERTO}/seguimiento`);
  const boton = pagina.getByRole('button', { name: 'Actualizar desde Calendar' });
  await boton.waitFor();
  await pagina.screenshot({ path: join(capturas, 'boton-en-la-tarjeta.png'), clip: { x: 0, y: 0, width: 1440, height: 620 } });
  await boton.click();
  const dialogo = pagina.getByRole('dialog', { name: 'Actualizar desde Google Calendar' });
  await dialogo.getByRole('button', { name: 'Conectar y revisar' }).click();
  await dialogo.getByText('Cambiaron de fecha u hora').waitFor();

  // Sólo lectura de Calendar, y sólo lecturas.
  assert.equal(await pagina.evaluate(() => window.permisosPedidos), 'https://www.googleapis.com/auth/calendar.readonly');
  assert.ok(consultas.every((c) => c.metodo === 'GET'));

  await dialogo.getByText('equipo@example.test').waitFor();
  await dialogo.getByText('1 seguimiento coincide').waitFor();
  await dialogo.getByText('Agendados sin evento en tu Calendar').waitFor();
  await dialogo.getByText('1 reunión de Calendar no se pudo asociar a una secretaría').waitFor();
  const baja = dialogo.getByRole('checkbox', { name: /Seguridad/ });
  assert.equal(await baja.isChecked(), false, 'la baja viene destildada');
  assert.equal(await dialogo.getByRole('checkbox', { name: /Obras/ }).isChecked(), true);
  assert.equal(await dialogo.getByRole('checkbox', { name: /Trabajo y Producción/ }).isChecked(), true);
  const aplicar = dialogo.getByRole('button', { name: 'Aplicar 2 cambios' });
  await aplicar.waitFor();

  await dialogo.screenshot({ path: join(capturas, 'revision-escritorio.png') });

  await aplicar.click();
  await dialogo.getByText('Se aplicaron 2 cambios.').waitFor();
  const bd = await leer();
  const obras = bd.seguimientos.find((s) => s.id === 's-obras');
  assert.deepEqual([obras.fecha, obras.hora, obras.activo], [dia(7), '11:00', true]);
  const nuevo = bd.seguimientos.find((s) => s.area === 'Secretaría de Trabajo y Producción');
  assert.deepEqual([nuevo.fecha, nuevo.hora, nuevo.tipo], [dia(12), '14:00', 'programado']);
  assert.equal(bd.seguimientos.find((s) => s.id === 's-seguridad').activo, true, 'lo destildado no se toca');
  assert.equal(bd.seguimientos.filter((s) => s.activo !== false).length, 4);

  // Revisar de nuevo con la agenda ya corregida: sólo queda la baja sugerida.
  await dialogo.getByRole('button', { name: 'Revisar de nuevo' }).click();
  await dialogo.getByText('3 seguimientos coinciden').waitFor();
  assert.equal(await dialogo.getByText('Cambiaron de fecha u hora').count(), 0);
  await dialogo.getByRole('checkbox', { name: /Seguridad/ }).check();
  await dialogo.getByRole('button', { name: 'Aplicar 1 cambio' }).click();
  await dialogo.getByText('Se aplicó 1 cambio.').waitFor();
  assert.equal((await leer()).seguimientos.find((s) => s.id === 's-seguridad').activo, false);

  await dialogo.getByRole('button', { name: 'Revisar de nuevo' }).click();
  await dialogo.getByText('Todo coincide').waitFor();
  await pagina.setViewportSize({ width: 390, height: 844 });
  await dialogo.screenshot({ path: join(capturas, 'todo-coincide-movil.png') });
  assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.ok(consultas.every((c) => c.metodo === 'GET'), 'nunca se escribe en Google');
  assert.deepEqual(errores, []);
  console.log('✓ Chrome: sólo lectura de Calendar → revisión → aplica lo tildado; la baja pide tildarla; escritorio y móvil.');
  console.log('Capturas: ' + capturas);
} finally {
  await navegador?.close();
  await servidor?.httpServer?.close();
  if (dirname(carpeta) === tmpdir() && basename(carpeta).startsWith('portal-sync-calendar-')) await rm(carpeta, { recursive: true, force: true });
}
