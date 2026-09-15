/**
 * Imprime el informe a PDF y lo revisa.
 *
 * Existe porque la maquetación de papel no se puede comprobar leyendo el CSS:
 * `break-inside`, la repetición del encabezado y el desbordamiento de un
 * contenedor sólo se manifiestan cuando el navegador pagina de verdad. Tres
 * intentos seguidos de arreglar el PDF "a ciegas" dejaron el informe peor —
 * bloques pisados, encabezados vacíos, páginas en blanco— y cada vuelta
 * costaba un despliegue y una captura del área.
 *
 * Uso:
 *   node scripts/verificar-impresion.mjs [--pdf salida.pdf]
 *
 * Imprime un resumen por consola y deja el PDF para mirarlo.
 */
import { build, preview, mergeConfig } from 'vite';
import { chromium } from 'playwright';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import configuracion from '../vite.config.js';

const salida =
  process.argv.includes('--pdf')
    ? process.argv[process.argv.indexOf('--pdf') + 1]
    : join(await mkdtemp(join(tmpdir(), 'portal-pdf-')), 'reporte.pdf');

const carpeta = await mkdtemp(join(tmpdir(), 'portal-impresion-'));
const rutaDoble = (nombre) => fileURLToPath(new URL(`../pruebas/humo/${nombre}-doble.js`, import.meta.url));

let servidor;
let navegador;
try {
  await build(
    mergeConfig(configuracion, {
      configFile: false,
      logLevel: 'warn',
      build: { outDir: carpeta, emptyOutDir: true },
      plugins: [
        {
          name: 'impresion-dobles-solo-prueba',
          enforce: 'pre',
          resolveId(fuente) {
            for (const nombre of ['sesion', 'tienda']) {
              if (fuente.endsWith(`/estado/${nombre}.js`)) return rutaDoble(nombre);
            }
          },
          transform(codigo, id) {
            // La base a escala real: es la que hace largas las tablas, que es
            // justo donde la paginación se rompe.
            if (id === rutaDoble('tienda')) {
              return (
                codigo +
                '\nimport { generarBaseCompleta } from "../../src/datos/base-completa.js";' +
                '\nestablecerBD(generarBaseCompleta(new Date().toISOString().slice(0, 10)));'
              );
            }
          },
        },
      ],
    }),
  );

  servidor = await preview({
    configFile: false,
    build: { outDir: carpeta },
    preview: { host: '127.0.0.1', port: 5187, strictPort: true },
  });

  navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const pagina = await navegador.newPage({ viewport: { width: 1400, height: 1000 } });
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));

  // Todos los bloques prendidos: el informe más largo posible es el que rompe.
  await pagina.goto('http://127.0.0.1:5187/reportes');
  await pagina.getByText('Resumen del recorte').waitFor({ timeout: 15_000 });

  // Las casillas no tienen id propio: se marcan todas las del panel, que en
  // esta pantalla son exactamente los bloques a incluir.
  for (const casilla of await pagina.locator('input[type="checkbox"]').all()) {
    if (!(await casilla.isChecked())) await casilla.check();
  }
  await pagina.waitForTimeout(500);

  await pagina.pdf({
    path: salida,
    format: 'A4',
    printBackground: true,
    margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
  });

  /*
   * Dónde cae cada bloque en la hoja.
   *
   * Con `media: print` el navegador aplica la hoja de impresión pero sigue
   * maquetando en una sola columna continua: midiendo cada bloque contra el
   * alto útil de una A4 se sabe en qué página empieza y termina, si dos se
   * superponen, y si alguna página queda vacía. Es la información que las
   * capturas de pantalla dan de a una.
   */
  await pagina.emulateMedia({ media: 'print' });
  await pagina.waitForTimeout(300);

  const paginacion = await pagina.evaluate(() => {
    // A4 menos los márgenes de @page, a 96 dpi.
    const ALTO = ((297 - 14 - 16) / 25.4) * 96;
    const bloques = [...document.querySelectorAll('.bloque-reporte')]
      .filter((b) => !b.parentElement.closest('.bloque-reporte'))
      .map((b) => {
        const r = b.getBoundingClientRect();
        const arriba = r.top + window.scrollY;
        return {
          titulo: (b.querySelector('h2, h3')?.textContent ?? '(sin título)').slice(0, 44),
          arriba: Math.round(arriba),
          abajo: Math.round(arriba + r.height),
          alto: Math.round(r.height),
          desde: Math.floor(arriba / ALTO) + 1,
          hasta: Math.floor((arriba + r.height - 1) / ALTO) + 1,
        };
      });

    const superpuestos = [];
    for (let i = 1; i < bloques.length; i += 1) {
      if (bloques[i].arriba < bloques[i - 1].abajo) {
        superpuestos.push(`${bloques[i - 1].titulo} ↔ ${bloques[i].titulo}`);
      }
    }

    const ocupadas = new Set();
    for (const b of bloques) for (let x = b.desde; x <= b.hasta; x += 1) ocupadas.add(x);
    const ultima = Math.max(...bloques.map((b) => b.hasta));
    const vacias = [];
    for (let x = 1; x <= ultima; x += 1) if (!ocupadas.has(x)) vacias.push(x);

    return { bloques, superpuestos, vacias, altoPagina: Math.round(ALTO) };
  });

  console.log('ALTO ÚTIL (px)', paginacion.altoPagina);
  for (const b of paginacion.bloques) {
    console.log(`  p${String(b.desde).padStart(2)}-${String(b.hasta).padEnd(2)} · ${String(b.alto).padStart(5)}px · ${b.titulo}`);
  }
  console.log('SUPERPUESTOS', JSON.stringify(paginacion.superpuestos));
  console.log('PÁGINAS SIN NINGÚN BLOQUE', JSON.stringify(paginacion.vacias));

  /* ── Lo que se puede comprobar sin ojos ── */
  const diagnostico = await pagina.evaluate(() => {
    const bloques = [...document.querySelectorAll('.bloque-reporte')];
    return {
      bloques: bloques.length,
      vacios: bloques
        .filter((b) => b.textContent.trim().length < 30)
        .map((b) => b.querySelector('h2, h3')?.textContent ?? '(sin título)'),
      tablas: document.querySelectorAll('.bloque-reporte table').length,
      encabezadosSinTexto: [...document.querySelectorAll('.bloque-reporte thead th')].filter(
        (th) => !th.textContent.trim(),
      ).length,
    };
  });

  console.log('PDF', salida);
  console.log('BLOQUES', diagnostico.bloques, '· TABLAS', diagnostico.tablas);
  console.log('BLOQUES CASI VACÍOS', JSON.stringify(diagnostico.vacios));
  console.log('ENCABEZADOS SIN TEXTO', diagnostico.encabezadosSinTexto);
  console.log('ERRORES', JSON.stringify(errores));
} finally {
  await navegador?.close();
  await servidor?.close();
}
