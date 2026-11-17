/**
 * Bacheo en Chrome, de punta a punta: subir los PDF, revisar, marcar a mano,
 * publicar, ver la semana y volver a cargarla.
 *
 *   node scripts/verificar-bacheo.mjs <carpeta con los dos PDF de una semana>
 *
 * Supabase se reemplaza por un doble en memoria (`pruebas/humo/supabase-bacheo-doble.js`)
 * y la sesión por la de la prueba de humo: no se toca la base real. El
 * Geoportal SÍ es el real —es lo que se quiere probar—, servido por un proxy
 * de la prueba, como el `/geo` de Vite y de Vercel.
 *
 * Los PDF no están en el repo (es público): ver `docs/bacheo.md`. Sin carpeta,
 * la prueba no corre. Las capturas quedan en `BACHEO_CAPTURAS` o en una
 * carpeta temporal.
 */
import { build, mergeConfig, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import configuracion from '../vite.config.js';

const carpetaPdf = process.argv[2];
if (!carpetaPdf) {
  console.log('Sin carpeta de PDF: no se corre. Uso: node scripts/verificar-bacheo.mjs <carpeta>');
  process.exit(0);
}
const pdfs = (await readdir(carpetaPdf)).filter((n) => /\.pdf$/i.test(n) && !/emitido \d\d-\d\d\.pdf$/i.test(n));
assert.equal(pdfs.length, 2, 'la carpeta tiene que tener los dos PDF de la semana (asfalto y hormigón)');

const carpeta = await mkdtemp(join(tmpdir(), 'portal-bacheo-'));
const capturas = process.env.BACHEO_CAPTURAS || carpeta;
const PUERTO = 5193;
let servidor;
let navegador;
try {
  await build(
    mergeConfig(configuracion, {
      configFile: false,
      logLevel: 'error',
      define: {
        'import.meta.env.VITE_SUPABASE_URL': '""',
        'import.meta.env.VITE_SUPABASE_ANON_KEY': '""',
      },
      build: { outDir: carpeta, emptyOutDir: true },
      plugins: [
        {
          name: 'bacheo-dobles',
          enforce: 'pre',
          resolveId(fuente) {
            if (fuente.endsWith('/estado/sesion.js')) {
              return fileURLToPath(new URL('../pruebas/humo/sesion-doble.js', import.meta.url));
            }
            if (fuente.endsWith('/supabaseBacheo.js')) {
              return fileURLToPath(new URL('../pruebas/humo/supabase-bacheo-doble.js', import.meta.url));
            }
          },
        },
      ],
    }),
  );
  servidor = await preview({
    configFile: false,
    build: { outDir: carpeta },
    preview: { host: '127.0.0.1', port: PUERTO, strictPort: true },
  });
  navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1000 } });
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));

  const local = `http://127.0.0.1:${PUERTO}/`;
  await pagina.route('**/*', async (ruta) => {
    const url = ruta.request().url();
    if (url.startsWith(`${local}geo/`)) {
      const real = url.replace(`${local}geo/`, 'https://geoportal.tresdefebrero.gob.ar/');
      const respuesta = await fetch(real);
      return ruta.fulfill({ status: respuesta.status, contentType: 'application/json', body: await respuesta.text() });
    }
    return url.startsWith(local) ? ruta.continue() : ruta.abort();
  });

  // 1. Sin semanas
  await pagina.goto(`${local}bacheo`);
  await pagina.getByText('Todavía no hay ninguna semana publicada').waitFor();

  // 2. Carga
  const cargar = async () => {
    await pagina.getByRole('button', { name: 'Cargar semana' }).click();
    await pagina.getByLabel('Elegir los PDF de programación').setInputFiles(pdfs.map((n) => join(carpetaPdf, n)));
    await pagina.getByRole('button', { name: 'Leer y ubicar' }).click();
    await pagina.getByRole('button', { name: /^Publicar/ }).waitFor({ timeout: 120000 });
  };
  await cargar();
  const encabezado = await pagina.locator('b', { hasText: /^Semana / }).first().textContent();
  console.log(`  ${encabezado}`);
  const lista = pagina.getByRole('list', { name: 'Trabajos a revisar' });
  const cuantos = await lista.locator(':scope > li').count();
  console.log(`  ${cuantos} trabajos leídos`);
  const conteo = [];
  for (const estado of ['Revisada', 'Automática, sin revisar', 'Aproximada', 'Sin ubicar']) {
    conteo.push(`${estado} ${await lista.getByText(estado, { exact: true }).count()}`);
  }
  console.log(`  ubicación: ${conteo.join(', ')}`);
  await pagina.screenshot({ path: join(capturas, 'bacheo-revision.png') });

  // 3. Marcar a mano lo que haya quedado sin ubicar (Altos de Podestá, sin memoria)
  const sinUbicar = lista.locator(':scope > li', { hasText: 'Sin ubicar' }).first();
  if (await sinUbicar.count()) {
    const nombre = (await sinUbicar.locator('span.text-sm').first().textContent()).trim();
    await sinUbicar.getByRole('button').first().click();
    await sinUbicar.getByRole('button', { name: 'Marcar en el mapa' }).click();
    const mapa = await pagina.locator('.mapa-leaflet').boundingBox();
    const cx = mapa.x + mapa.width / 2;
    const cy = mapa.y + mapa.height / 2;
    for (const [dx, dy] of [[-40, -30], [40, -30], [40, 30], [-40, 30]]) await pagina.mouse.click(cx + dx, cy + dy);
    await pagina.getByRole('button', { name: 'Listo' }).click();
    await lista.locator(':scope > li', { hasText: nombre }).getByText('Marcada a mano').waitFor();
    console.log(`  marcado a mano: ${nombre}`);
  }

  // 4. Error al publicar: no se pierde la revisión
  await pagina.evaluate(() => (window.fallarPublicacionBacheo = true));
  await pagina.getByRole('button', { name: /^Publicar/ }).click();
  await pagina.getByText('Error de prueba al publicar').waitFor();
  assert.equal(await lista.locator(':scope > li').count(), cuantos, 'la revisión sigue ahí después del error');
  await pagina.evaluate(() => (window.fallarPublicacionBacheo = false));

  // 5. Publicar y ver
  await pagina.getByRole('button', { name: /^Publicar/ }).click();
  await pagina.getByRole('region', { name: 'Trabajos por localidad' }).waitFor();
  const metricas = await pagina.locator('main').innerText();
  assert.match(metricas, /Trabajos\s*\n?\s*\d+/);
  const lugares = await pagina.evaluate(() => window.__bacheo.lugares.map((l) => `${l.descripcion} (${l.origen})`));
  console.log(`  memoria de lugares: ${lugares.join('; ') || 'vacía'}`);
  await pagina.locator('.mapa-leaflet path').first().waitFor();
  await pagina.waitForTimeout(600);
  await pagina.screenshot({ path: join(capturas, 'bacheo-semana.png'), fullPage: true });
  const dia = pagina.getByRole('group', { name: 'Día' }).getByRole('button').nth(3);
  await dia.click();
  await pagina.waitForTimeout(300);
  await pagina.screenshot({ path: join(capturas, 'bacheo-un-dia.png'), fullPage: true });

  // 6. Volver a cargar la misma semana: avisa que la reemplaza y reusa lo marcado
  await cargar();
  await pagina.getByText('Esta semana ya está publicada').waitFor();
  if (lugares.length) {
    const recordado = lista.locator(':scope > li', { hasText: lugares[0].replace(/ \(manual\)$/, '') }).first();
    await recordado.getByText('Revisada').waitFor();
    console.log('  la segunda carga reusa lo marcado a mano');
  }
  await pagina.getByRole('button', { name: 'Publicar y reemplazar' }).click();
  await pagina.getByRole('region', { name: 'Trabajos por localidad' }).waitFor();
  const semanas = await pagina.evaluate(() => window.__bacheo.semanas.length);
  assert.equal(semanas, 1, 'republicar no duplica la semana');

  assert.deepEqual(errores, [], `errores en el navegador: ${errores.join(' | ')}`);
  console.log(`✓ bacheo · carga, revisión, publicación y reemplazo en Chrome · capturas en ${capturas}`);
} finally {
  await navegador?.close();
  await new Promise((resolver) => (servidor ? servidor.httpServer.close(resolver) : resolver()));
  await rm(carpeta, { recursive: true, force: true });
}
