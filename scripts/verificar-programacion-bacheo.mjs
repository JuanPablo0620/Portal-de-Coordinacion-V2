/**
 * Pasa por el lector de Bacheo todos los PDF de una carpeta y muestra qué
 * entendió de cada semana.
 *
 *   node scripts/verificar-programacion-bacheo.mjs <carpeta>
 *
 * La carpeta puede tener subcarpetas (una por semana). Los PDF reales no están
 * en el repo —es público—; viven en el Drive del área y en
 * `Trabajo/analisis/mapas-seguridad-bacheo/fuentes/` de la máquina de JP.
 *
 * Sirve para dos cosas: antes de tocar `tablaProgramacion.js`, para tener con
 * qué comparar; y cuando el área cambie el formato de la planilla, para ver
 * qué se rompió. Falla si algún PDF no se puede leer.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tablaDesdeItems } from '../src/datos/bacheo/tablaProgramacion.js';
import { trabajosDesdeTabla } from '../src/datos/bacheo/programacion.js';

const carpeta = process.argv[2];
if (!carpeta) {
  console.error('Uso: node scripts/verificar-programacion-bacheo.mjs <carpeta con PDF>');
  process.exit(2);
}

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

function pdfsEn(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return pdfsEn(ruta);
    return /\.pdf$/i.test(nombre) ? [ruta] : [];
  });
}

let fallas = 0;
const tipos = new Map();
for (const ruta of pdfsEn(carpeta).sort()) {
  try {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(ruta)), verbosity: 0 }).promise;
    const contenido = await (await doc.getPage(1)).getTextContent();
    const items = contenido.items.map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }));
    // El año se deduce de la fecha de carga; para PDF viejos se usa la fecha
    // del archivo, que en las carpetas de fuentes está en el nombre.
    const hoy = ruta.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10);
    const p = trabajosDesdeTabla(tablaDesdeItems(items), hoy);
    for (const t of p.trabajos) tipos.set(t.tipo, (tipos.get(t.tipo) ?? 0) + 1);
    const nombre = ruta.slice(carpeta.length).replace(/^[\\/]/, '');
    console.log(`${p.tipo.padEnd(8)} ${p.fechas[0]} ${String(p.trabajos.length).padStart(3)} trabajos  ${nombre}`);
    for (const a of p.avisos) console.log(`         aviso: ${a}`);
    for (const n of p.novedades) console.log(`         ${n.fecha}: ${n.texto}`);
    await doc.destroy();
  } catch (error) {
    fallas += 1;
    console.error(`FALLA    ${ruta}: ${error.message}`);
  }
}
console.log(`\nTrabajos por tipo: ${[...tipos].map(([t, n]) => `${t} ${n}`).join(', ')}`);
if (fallas) {
  console.error(`${fallas} PDF no se pudieron leer.`);
  process.exit(1);
}
