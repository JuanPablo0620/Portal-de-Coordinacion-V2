/**
 * Verificación de la tanda: aislamiento de la capa de datos + tests + build.
 *
 * El chequeo de aislamiento es el que sostiene el requisito duro del proyecto:
 * `src/datos/almacenamiento.js` es el ÚNICO archivo autorizado a tocar el
 * almacenamiento del navegador. Si otro archivo lo hace, migrar a una API real
 * dejaría de ser un cambio localizado — así que acá falla.
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

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

try {
  execSync('npm run test', { stdio: 'inherit' });
  console.log('✓ tests');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✓ build');
} catch {
  process.exit(1);
}

console.log('\n✓ verificación completa\n');
