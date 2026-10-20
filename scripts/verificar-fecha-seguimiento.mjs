/** Reprogramación en Chrome con datos sintéticos y sin servicios externos. */
import { build, mergeConfig, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import configuracion from '../vite.config.js';
import { bdVacia } from '../src/datos/esquema.js';

const carpeta = await mkdtemp(join(tmpdir(), 'portal-fecha-'));
const base = bdVacia();
const fecha = new Date().toISOString().slice(0, 10);
const otraFecha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const reunion = {
  id: 'seguimiento-prueba', area: 'Obras', fecha, hora: '10:30', tipo: 'programado',
  activo: true, participantes: 'Equipo de prueba', temas: 'Agenda de prueba',
  ids_proyecto: [], resumen: 'Conservar resumen', avances: ['Conservar avance'],
};
base.seguimientos.push(reunion);
base.compromisos.push({ id: 'compromiso-prueba', origen_tipo: 'seguimiento', id_origen: reunion.id, descripcion: 'Conservar compromiso', estado: 'pendiente', activo: true });
let servidor;
let navegador;
try {
  await build(mergeConfig(configuracion, {
    configFile: false, logLevel: 'error',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': '""',
      'import.meta.env.VITE_SUPABASE_ANON_KEY': '""',
    },
    build: { outDir: carpeta, emptyOutDir: true },
    plugins: [{
      name: 'fecha-sesion-sintetica', enforce: 'pre',
      resolveId(fuente) {
        if (fuente.endsWith('/estado/sesion.js')) return fileURLToPath(new URL('../pruebas/humo/sesion-doble.js', import.meta.url));
      },
      transform(codigo, id) {
        if (id.replaceAll('\\', '/').endsWith('/src/datos/repositorio.js')) {
          return codigo.replace('export async function actualizarSeguimiento(id, cambios) {', `export async function actualizarSeguimiento(id, cambios) {
            if (window.fallarGuardadoFecha) throw new Error('Error de prueba al guardar');
            await new Promise((resolver) => setTimeout(resolver, 300));`);
        }
      },
    }],
  }));
  servidor = await preview({ configFile: false, build: { outDir: carpeta }, preview: { host: '127.0.0.1', port: 5191, strictPort: true } });
  navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1000 } });
  const errores = [];
  pagina.on('pageerror', (error) => errores.push(error.message));
  await pagina.route('**/*', (ruta) => ruta.request().url().startsWith('http://127.0.0.1:5191/') ? ruta.continue() : ruta.abort());
  await pagina.addInitScript((base) => {
    if (!localStorage.getItem('coord3f_bd_v1')) localStorage.setItem('coord3f_bd_v1', JSON.stringify(base));
  }, base);
  const leer = () => pagina.evaluate(() => JSON.parse(localStorage.getItem('coord3f_bd_v1')));
  await pagina.goto('http://127.0.0.1:5191/seguimiento?vista=lista');
  const abrir = () => pagina.getByRole('button', { name: 'Modificar fecha', exact: true }).click();
  const dialogo = pagina.getByRole('dialog', { name: 'Modificar fecha de reunión' });
  await abrir();
  assert.equal(await dialogo.getByLabel(/^Fecha/).inputValue(), fecha);
  assert.equal(await dialogo.getByLabel(/^Hora/).inputValue(), '10:30');
  await dialogo.getByLabel(/^Fecha/).fill(otraFecha);
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  assert.equal((await leer()).seguimientos[0].fecha, fecha);
  await abrir();
  await dialogo.getByLabel(/^Fecha/).fill('');
  await dialogo.getByRole('button', { name: 'Guardar cambios' }).click();
  assert.equal(await dialogo.getByLabel(/^Fecha/).evaluate((campo) => campo.validity.valueMissing), true);
  assert.equal((await leer()).seguimientos[0].fecha, fecha);
  await dialogo.getByLabel(/^Fecha/).fill(otraFecha);
  await dialogo.getByLabel(/^Hora/).fill('15:45');
  await pagina.evaluate(() => { window.fallarGuardadoFecha = true; });
  await dialogo.getByRole('button', { name: 'Guardar cambios' }).click();
  await dialogo.getByRole('alert').getByText('Error de prueba al guardar').waitFor();
  assert.equal(await dialogo.getByLabel(/^Fecha/).inputValue(), otraFecha);
  assert.equal((await leer()).seguimientos[0].fecha, fecha);
  await pagina.evaluate(() => { window.fallarGuardadoFecha = false; });
  await dialogo.getByRole('button', { name: 'Guardar cambios' }).click();
  assert.equal(await dialogo.getByRole('button', { name: 'Guardando…' }).isDisabled(), true);
  await dialogo.waitFor({ state: 'hidden' });
  const guardada = await leer();
  for (const [campo, valor] of Object.entries(reunion)) {
    if (!['fecha', 'hora'].includes(campo)) assert.deepEqual(guardada.seguimientos[0][campo], valor);
  }
  assert.equal(guardada.seguimientos[0].fecha, otraFecha);
  assert.equal(guardada.seguimientos[0].hora, '15:45');
  assert.deepEqual(guardada.compromisos, base.compromisos);
  assert.ok(guardada.historial.some((asiento) => asiento.id_entidad === reunion.id && asiento.cambios.some((cambio) => cambio.campo === 'fecha')));
  await pagina.reload();
  await abrir();
  assert.equal(await dialogo.getByLabel(/^Fecha/).inputValue(), otraFecha);
  await dialogo.getByLabel(/^Hora/).fill('');
  await dialogo.getByRole('button', { name: 'Guardar cambios' }).click();
  await dialogo.waitFor({ state: 'hidden' });
  assert.equal((await leer()).seguimientos[0].hora, '');
  await pagina.goto('http://127.0.0.1:5191/seguimiento');
  // El calendario abre la misma reunión por su identificador.
  await pagina.getByRole('button', { name: /Seguimiento.*Obras/ }).click();
  await dialogo.waitFor();
  const capturas = fileURLToPath(new URL('../../.tmp/fecha-seguimiento-qa/', import.meta.url));
  await mkdir(capturas, { recursive: true });
  await dialogo.screenshot({ path: join(capturas, 'escritorio.png') });
  await pagina.setViewportSize({ width: 375, height: 812 });
  await pagina.emulateMedia({ reducedMotion: 'reduce' });
  await dialogo.screenshot({ path: join(capturas, 'movil.png') });
  assert.equal(await dialogo.evaluate((elemento) => elemento.scrollWidth <= elemento.clientWidth), true);
  await pagina.keyboard.press('Escape');
  await pagina.goto('http://127.0.0.1:5191/seguimiento?tab=historial&area=Obras');
  await abrir();
  await dialogo.waitFor();
  assert.equal(await dialogo.getByLabel(/^Fecha/).inputValue(), otraFecha);
  assert.deepEqual(errores, []);
  console.log('✓ Lista, calendario e historial; cancelar, fecha obligatoria, error y reintento, guardado y recarga, hora opcional, vínculos y bitácora.');
  console.log('✓ Escritorio y móvil con datos ficticios, sin servicios externos. Capturas: ' + capturas);
} finally {
  await navegador?.close();
  await servidor?.httpServer?.close();
  if (dirname(carpeta) === tmpdir() && basename(carpeta).startsWith('portal-fecha-')) await rm(carpeta, { recursive: true, force: true });
}
