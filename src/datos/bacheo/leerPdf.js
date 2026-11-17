/**
 * Lee un PDF de programación de Bacheo en el navegador y lo devuelve
 * interpretado.
 *
 * pdf.js se importa adentro de la función, no arriba del archivo: pesa cerca de
 * un megabyte con su worker y solo lo necesita quien sube una planilla. Así
 * queda en un fragmento aparte que el resto del portal nunca descarga, y la
 * prueba de humo (que renderiza las rutas en Node) no lo evalúa.
 *
 * Solo la primera página: la planilla es una hoja de Excel exportada y entra
 * entera. Si algún día viene en dos páginas, hay que juntarlas acá.
 */
import { tablaDesdeItems } from './tablaProgramacion.js';
import { trabajosDesdeTabla } from './programacion.js';

let pdfjs = null;
async function cargarPdfjs() {
  if (pdfjs) return pdfjs;
  const [modulo, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  modulo.GlobalWorkerOptions.workerSrc = worker.default;
  pdfjs = modulo;
  return pdfjs;
}

/**
 * @param {File} archivo
 * @param {string} hoy fecha ISO, para deducir el año de los encabezados
 * @returns {Promise<object>} lo que devuelve `trabajosDesdeTabla`, más `nombre`
 */
export async function leerProgramacion(archivo, hoy) {
  const { getDocument } = await cargarPdfjs();
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const documento = await getDocument({ data: datos }).promise;
  try {
    const pagina = await documento.getPage(1);
    const contenido = await pagina.getTextContent();
    const items = contenido.items
      .filter((i) => typeof i.str === 'string')
      .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }));
    return { nombre: archivo.name, ...trabajosDesdeTabla(tablaDesdeItems(items), hoy) };
  } finally {
    documento.destroy();
  }
}
