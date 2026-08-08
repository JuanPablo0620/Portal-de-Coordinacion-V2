/**
 * Verificación de la tanda: aislamiento de la capa de datos + ausencia de
 * importaciones circulares + tests + build.
 *
 * El chequeo de aislamiento es el que sostiene el requisito duro del proyecto:
 * `src/datos/almacenamiento.js` es el ÚNICO archivo autorizado a tocar el
 * almacenamiento del navegador. Si otro archivo lo hace, migrar a una API real
 * dejaría de ser un cambio localizado — así que acá falla.
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const PERMITIDO = 'src/datos/almacenamiento.js';

function archivosFuente(dir, acc = []) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivosFuente(ruta, acc);
    else if (/\.(js|jsx|mjs)$/.test(entrada)) acc.push(ruta);
  }
  return acc;
}

const normalizar = (p) => p.split('\\').join('/');

const infractores = archivosFuente('src')
  .filter((ruta) => normalizar(ruta) !== PERMITIDO)
  .filter((ruta) => /localStorage|sessionStorage|indexedDB/.test(readFileSync(ruta, 'utf8')));

if (infractores.length) {
  console.error('\n✗ Acceso directo al almacenamiento fuera de la capa de datos:');
  for (const ruta of infractores) console.error('    ' + normalizar(ruta));
  console.error(`\n  Sólo ${PERMITIDO} puede tocar el almacenamiento del navegador.`);
  console.error('  Todo lo demás pasa por src/datos/repositorio.js.\n');
  process.exit(1);
}
console.log('✓ aislamiento de la capa de datos');

/**
 * Importaciones circulares.
 *
 * El bundler las tolera y el build pasa igual, pero en tiempo de ejecución
 * dejan uno de los dos módulos a medio inicializar: el síntoma es un
 * `undefined` en una constante que claramente está exportada. Se detectan acá
 * porque no hay otro lugar donde se noten.
 */
const grafo = new Map();
for (const ruta of archivosFuente('src')) {
  const clave = normalizar(ruta);
  const contenido = readFileSync(ruta, 'utf8');
  const destinos = [...contenido.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) =>
    normalizar(resolve(dirname(ruta), m[1])).replace(normalizar(process.cwd()) + '/', ''),
  );
  grafo.set(clave, destinos);
}

const ciclos = [];
const estado = new Map();

function recorrer(nodo, camino) {
  if (estado.get(nodo) === 'listo') return;
  if (estado.get(nodo) === 'visitando') {
    ciclos.push([...camino.slice(camino.indexOf(nodo)), nodo].join(' → '));
    return;
  }
  estado.set(nodo, 'visitando');
  for (const destino of grafo.get(nodo) ?? []) {
    if (grafo.has(destino)) recorrer(destino, [...camino, nodo]);
  }
  estado.set(nodo, 'listo');
}

for (const nodo of grafo.keys()) recorrer(nodo, []);

if (ciclos.length) {
  console.error('\n✗ Importaciones circulares:');
  for (const ciclo of [...new Set(ciclos)]) console.error('    ' + ciclo);
  console.error('\n  Extraé lo compartido a un módulo propio que no dependa de ninguno de los dos.\n');
  process.exit(1);
}
console.log('✓ sin importaciones circulares');

try {
  execSync('npm run test', { stdio: 'inherit' });
  console.log('✓ tests');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✓ build');
  // Renderiza todas las rutas en Node: es lo único que atrapa los errores de
  // montaje, que el build no ve.
  execSync('npm run humo', { stdio: 'inherit' });
} catch {
  process.exit(1);
}

console.log('\n✓ verificación completa\n');
