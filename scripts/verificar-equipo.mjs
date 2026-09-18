/** Interacciones reales con repositorio local y sesión ficticia; cero producción. */
import { createServer, mergeConfig } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import configuracion from '../vite.config.js';

const ruta = (nombre) => fileURLToPath(new URL(`../pruebas/equipo/${nombre}`, import.meta.url));
const servidor = await createServer(mergeConfig(configuracion, {
  configFile: false, logLevel: 'warn',
  server: { host: '127.0.0.1', port: 5191, strictPort: true },
  plugins: [{
    name: 'equipo-solo-prueba', enforce: 'pre',
    resolveId(fuente) {
      if (fuente.endsWith('/estado/sesion.js')) return ruta('sesion.js');
      if (fuente.endsWith('/datos/supabaseClient.js')) return ruta('supabase.js');
    },
    transform(codigo, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/main.jsx')) {
        return `import { iniciarEscenario } from '/pruebas/equipo/escenario.js';\nawait iniciarEscenario();\n${codigo}`;
      }
    },
  }],
}));
let navegador;
try {
  await servidor.listen();
  navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1000 } });
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  await pagina.route('**/rest/v1/**', () => { throw new Error('La prueba intentó acceder a una API real'); });
  await pagina.goto('http://127.0.0.1:5191/reuniones?tipo=direccion');
  await pagina.getByRole('heading', { name: 'Compromiso histórico sin asignar', exact: true }).waitFor();
  await pagina.getByRole('heading', { name: 'Enviar el relevamiento completo', exact: true }).waitFor();
  await pagina.getByRole('button', { name: 'Actualizar o derivar compromiso' }).first().click();
  assert.equal(await pagina.locator('select').filter({ has: pagina.locator('option', { hasText: 'Persona Consulta' }) }).count(), 0);
  // Se elige el compromiso por su título, no por el orden de agrupación.
  const tarjeta = pagina.locator('section.tarjeta').filter({ has: pagina.getByRole('heading', { name: 'Confirmar el cronograma de trabajo', exact: true }) });
  await tarjeta.getByRole('button', { name: 'Actualizar o derivar compromiso' }).click();
  await tarjeta.getByLabel('Responsable en Coordinación').selectOption('p2');
  await tarjeta.getByRole('button', { name: 'Derivar compromiso', exact: true }).click();
  await pagina.waitForFunction(async () => (await globalThis.pruebaEquipo.base()).compromisos.find((c) => c.id === 'c1').id_responsable === 'p2');
  await pagina.evaluate(() => globalThis.pruebaEquipo.cambiarUsuario('p2'));
  await pagina.getByRole('link', { name: 'Mi seguimiento', exact: true }).click();
  await pagina.getByText('Confirmar el cronograma de trabajo', { exact: true }).waitFor();
  await pagina.getByLabel('Ver compromisos').selectOption('asignados');
  await pagina.getByText('Confirmar el cronograma de trabajo', { exact: true }).waitFor();
  await pagina.getByRole('link', { name: 'Reuniones', exact: true }).click();
  assert.equal(await pagina.getByRole('heading', { name: 'Preparar temario' }).count(), 0);
  await pagina.evaluate(() => globalThis.pruebaEquipo.cambiarUsuario('p1'));
  await pagina.getByLabel('Tema nuevo', { exact: true }).fill('Organización de la semana');
  await pagina.getByRole('button', { name: 'Agregar al temario' }).click();
  await pagina.getByRole('heading', { name: 'Organización de la semana', exact: true }).waitFor();
  const nuevo = pagina.locator('section.tarjeta').filter({ has: pagina.getByRole('heading', { name: 'Nuevo compromiso de esta reunión', exact: true }) });
  await nuevo.getByLabel('Qué hay que hacer').fill('Preparar información para la próxima reunión');
  await nuevo.getByLabel('Área', { exact: true }).selectOption({ index: 1 });
  await nuevo.getByLabel('Responsable en Coordinación').selectOption('p2');
  await nuevo.getByLabel('Fecha límite').fill('2026-10-06');
  await nuevo.getByRole('button', { name: 'Crear y asignar compromiso' }).click();
  await pagina.getByText('Compromiso creado y asignado.', { exact: true }).waitFor();
  await mkdir('../.tmp/portal-equipo', { recursive: true });
  await pagina.screenshot({ path: '../.tmp/portal-equipo/secretaria-escritorio.png', fullPage: true });
  await pagina.setViewportSize({ width: 375, height: 812 });
  await pagina.emulateMedia({ reducedMotion: 'reduce' });
  await pagina.screenshot({ path: '../.tmp/portal-equipo/secretaria-movil.png', fullPage: true });
  assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Sin desborde horizontal');
  assert.deepEqual(errores, []);
  console.log('OK: Dirección completa; derivación entre cuentas; Mi seguimiento sin áreas; Secretaría sólo organizador; alta con responsable; móvil sin desborde.');
} finally {
  await navegador?.close();
  await servidor.close();
}
