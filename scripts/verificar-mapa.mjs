/** Prueba del portal compilado: el servidor de desarrollo oculta imports faltantes del worker. */
import { build, preview, mergeConfig } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import configuracion from '../vite.config.js';

const carpeta = await mkdtemp(join(tmpdir(), 'portal-mapa-'));
const rutaDoble = (nombre) => fileURLToPath(new URL(`../pruebas/humo/${nombre}-doble.js`, import.meta.url));
const errores = [];
let servidor;
let navegador;
try {
  await build(mergeConfig(configuracion, {
    configFile: false,
    logLevel: 'warn',
    build: { outDir: carpeta, emptyOutDir: true },
    plugins: [{
      name: 'mapa-dobles-solo-prueba',
      enforce: 'pre',
      resolveId(fuente) {
        for (const nombre of ['sesion', 'tienda']) {
          if (fuente.endsWith(`/estado/${nombre}.js`)) return rutaDoble(nombre);
        }
      },
      transform(codigo, id) {
        if (id === rutaDoble('tienda')) {
          return codigo + '\nimport { bdVacia } from "../../src/datos/esquema.js"; establecerBD(bdVacia());';
        }
      },
    }],
  }));
  servidor = await preview({ configFile: false, build: { outDir: carpeta }, preview: { host: '127.0.0.1', port: 5186, strictPort: true } });
  navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const pagina = await navegador.newPage({ viewport: { width: 1500, height: 1000 } });
  pagina.on('pageerror', (error) => errores.push(error.message));
  pagina.on('console', (mensaje) => { if (mensaje.type() === 'error') errores.push(mensaje.text()); });
  // Esta prueba no lee ni escribe datos de gestión reales.
  await pagina.route('**/geo/**', (ruta) => ruta.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
  await pagina.goto('http://127.0.0.1:5186/mapa');
  await pagina.locator('.maplibregl-canvas').waitFor();
  await pagina.waitForTimeout(12000);
  const foto = process.env.MAPA_CAPTURA || join(carpeta, 'mapa.png');
  const captura = await pagina.locator('.mapa-leaflet').screenshot({ path: foto });
  // Medir el centro excluye controles y atribuciones: un fondo vacío también
  // crea un canvas y puede fallar sin emitir pageerror desde el worker.
  const colores = await pagina.evaluate(async (datos) => {
    const imagen = new Image();
    imagen.src = datos;
    await imagen.decode();
    const lienzo = document.createElement('canvas');
    lienzo.width = imagen.width;
    lienzo.height = imagen.height;
    const contexto = lienzo.getContext('2d');
    contexto.drawImage(imagen, 0, 0);
    const pixeles = contexto.getImageData(imagen.width * 0.2, imagen.height * 0.2, imagen.width * 0.6, imagen.height * 0.6).data;
    const distintos = new Set();
    for (let i = 0; i < pixeles.length; i += 16) distintos.add(`${pixeles[i]},${pixeles[i + 1]},${pixeles[i + 2]}`);
    return distintos.size;
  }, `data:image/png;base64,${captura.toString('base64')}`);
  console.log('COLORES_CALLEJERO', colores);
  console.log('CAPTURA', foto);
  console.log('ERRORES', JSON.stringify(errores));
  const recursos = await pagina.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name));
  console.log('WORKERS', recursos.filter((r) => /worker|shared/.test(r)));
  if (errores.length || colores < 300) throw new Error('El mapa compilado está vacío o produjo errores en el navegador.');
  await pagina.getByRole('button', { name: 'Zoom in', exact: true }).click({ clickCount: 2, delay: 400 });
  await pagina.waitForTimeout(4000);
  await pagina.locator('.mapa-leaflet').screenshot({ path: foto.replace(/\.png$/, '-detalle.png') });
  if (errores.length) throw new Error('El mapa produjo errores al acercar.');
} finally {
  await navegador?.close();
  await new Promise((resolver) => servidor ? servidor.httpServer.close(resolver) : resolver());
  await rm(carpeta, { recursive: true, force: true });
}
