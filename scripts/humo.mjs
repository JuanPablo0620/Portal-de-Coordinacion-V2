/**
 * Prueba de humo: compila la app para Node y renderiza todas las rutas, con
 * datos de demostración y con el sistema vacío.
 *
 * Es lo que atrapa los errores de montaje que el build no ve: un componente
 * usado sin importar, una propiedad leída de un objeto nulo, un selector que
 * rompe con la colección vacía. Cada ruta declara un texto que tiene que
 * aparecer en su marcado, para que la prueba no pase con sólo la barra lateral
 * renderizada.
 *
 * Al elegir un marcador: React inserta `<!-- -->` entre texto estático e
 * interpolación, así que `Total: {n}` NO se encuentra como «Total: 5». Usar
 * cadenas literales completas, no frases que crucen una llave.
 */
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const SALIDA = 'node_modules/.humo';

/** `[ruta, texto que debe aparecer]` con los datos de demostración cargados. */
const CON_DEMO = [
  ['/', 'Próximos vencimientos importantes'],
  ['/', 'Proyectos activos'],
  ['/proyectos', 'Base maestra de proyectos'],
  ['/proyectos?solo_activos=1&es_obra=1', 'Sólo obras'],
  ['/seguimiento', 'Próximos seguimientos'],
  ['/seguimiento?vista=lista', 'Temas a tratar'],
  ['/seguimiento?tab=cargar', 'Separar automáticamente'],
  ['/seguimiento?tab=compromisos', 'Compromiso'],
  ['/seguimiento?tab=historial', 'Elegí un área'],
  ['/monitoreo', 'Panel de alertas'],
  ['/monitoreo', 'Criticidad máxima'],
  ['/monitoreo?tab=cobertura', 'Áreas sin cobertura'],
  ['/monitoreo?tab=cargar', 'Iniciar monitoreo'],
  ['/monitoreo?tab=alertas', 'Compromisos vencidos'],
  ['/planificacion', 'Ejecución presupuestaria'],
  ['/planificacion?tab=comparativo', 'Comparativo al T'],
  ['/planificacion?tab=carga', 'Elegí un proyecto'],
  ['/mesas', 'Espacios intersectoriales por tema de gestión.'],
  ['/mesas?tipo=barrial', 'Espacios de participación territorial'],
  ['/mesas?tipo=otros%20proyectos', 'Convenios, planes y proyectos con seguimiento propio.'],
  ['/mesas', 'Ver ficha'],
  ['/eventos', 'Próximos eventos'],
  ['/eventos?tab=lista', 'Requerimientos'],
  ['/eventos?tab=checklist', 'Requerimientos sin confirmar'],
  ['/reportes', 'Municipio de Tres de Febrero'],
  ['/reportes', 'Filtros aplicados'],
  ['/configuracion', 'Usuario actual'],
  ['/configuracion', 'Cargar datos de demostración'],
];

/** Con el sistema vacío: se espera el estado vacío, no un error ni una pantalla en blanco. */
const CON_SISTEMA_VACIO = [
  ['/', 'El sistema está vacío'],
  ['/proyectos', 'La base maestra está vacía'],
  ['/seguimiento', 'Sin seguimientos agendados'],
  ['/seguimiento?tab=cargar', '1 · Proyectos'],
  ['/seguimiento?tab=compromisos', 'Sin compromisos'],
  ['/seguimiento?tab=historial', 'Elegí un área'],
  ['/monitoreo', 'Sin alertas activas'],
  // Vaciar el sistema no vacía los catálogos: las 8 áreas semilla siguen ahí,
  // así que la cobertura las muestra todas en cero. Es lo correcto.
  ['/monitoreo?tab=cobertura', 'Áreas sin cobertura'],
  ['/monitoreo?tab=cargar', 'Iniciar monitoreo'],
  ['/monitoreo?tab=alertas', 'Sin alertas activas'],
  ['/planificacion', 'Sin proyectos para analizar'],
  ['/planificacion?tab=comparativo', 'Sin proyectos planificados'],
  ['/planificacion?tab=carga', 'Elegí un proyecto'],
  ['/mesas', 'Sin mesas temáticas'],
  ['/mesas?tipo=barrial', 'Sin mesas barriales'],
  ['/eventos', 'Sin eventos próximos'],
  ['/eventos?tab=lista', 'Sin eventos cargados'],
  ['/eventos?tab=checklist', 'Sin eventos pendientes'],
  ['/reportes', 'Sin filtros aplicados'],
  ['/configuracion', 'Usuario actual'],
];

/** `{id}` se reemplaza por un id real de la demo; `{proyecto}`, por su nombre. */
const RUTAS_PROFUNDAS = [
  ['/proyectos/{id}', '{proyecto}'],
  ['/proyectos/{id}', 'Historial'],
  ['/proyectos/INEXISTENTE-0000-000', 'Proyecto no encontrado'],
];

try {
  execSync(
    `npx vite build --config pruebas/humo/vite.config.js --ssr pruebas/humo/entrada.jsx ` +
      `--outDir ${SALIDA} --emptyOutDir --logLevel error`,
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
} catch {
  console.error('✗ no se pudo compilar la app para la prueba de humo');
  process.exit(1);
}

const { correr } = await import(`../${SALIDA}/entrada.js`);
const fallos = correr(CON_DEMO, CON_SISTEMA_VACIO, RUTAS_PROFUNDAS);

rmSync(SALIDA, { recursive: true, force: true });

if (fallos.length) {
  console.error('\n✗ Rutas que no renderizan lo esperado:');
  for (const f of fallos) console.error('    ' + f);
  console.error('');
  process.exit(1);
}

const total = CON_DEMO.length + CON_SISTEMA_VACIO.length + RUTAS_PROFUNDAS.length;
console.log(`✓ humo · ${total} comprobaciones de render (con demo, sistema vacío y rutas profundas)`);
