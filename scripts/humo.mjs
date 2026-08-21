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
 *
 * Se compila en modo desarrollo a propósito: en producción React elimina sus
 * avisos, y la captura de avisos de `entrada.jsx` no encontraría nada nunca.
 *
 * Lo que NO cubre: el anidamiento inválido de DOM (`<div>` dentro de `<p>`),
 * que React valida al hidratar en el navegador y no al renderizar en Node; y
 * todo lo que dependa de interacción o de efectos, que no corren en SSR.
 */
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const SALIDA = 'node_modules/.humo';

/** `[ruta, texto que debe aparecer]` con los datos de demostración cargados. */
const CON_DEMO = [
  ['/', 'Próximos vencimientos importantes'],
  ['/', 'Proyectos activos'],
  ['/mis-areas', 'Tus áreas'],
  ['/mis-areas', 'Todavía no elegiste ninguna área'],
  ['/proyectos', 'Base maestra de proyectos'],
  ['/proyectos?solo_activos=1&es_obra=1', 'Sólo obras'],
  ['/obras', 'Dónde están las obras'],
  ['/obras', 'Plano de coordenadas'],
  ['/obras', 'Sin ubicar en el mapa'],
  ['/obras?tab=listado', 'ubicada'],
  ['/obras?tab=zonas', 'Obras por zona'],
  ['/obras?tab=alertas', 'Alertas de obras'],
  ['/seguimiento', 'Próximos seguimientos'],
  ['/seguimiento?vista=lista', 'Temas a tratar'],
  ['/seguimiento?tab=cargar', 'Transferir'],
  ['/seguimiento?tab=cargar', '3 · Campos transferidos'],
  ['/seguimiento?tab=compromisos', 'Compromiso'],
  ['/seguimiento?tab=historial', 'Elegí un área'],
  ['/monitoreo', 'Panel de alertas'],
  ['/monitoreo', 'Secretarías en la hoja'],
  ['/monitoreo', 'Criticidad de los temas'],
  ['/monitoreo?secretaria=Secretar%C3%ADa%20de%20Obras', 'Temas del período'],
  ['/monitoreo?secretaria=Secretar%C3%ADa%20de%20Obras', 'Compromisos vigentes'],
  ['/monitoreo?secretaria=Secretar%C3%ADa%20de%20Obras', 'Ejecución presupuestaria'],
  ['/monitoreo?secretaria=Secretar%C3%ADa%20de%20Obras', 'Proyectos de la secretaría'],
  ['/monitoreo?tab=ultimos', 'Criticidad máxima'],
  ['/monitoreo?tab=cobertura', 'Secretarías sin cobertura'],
  ['/monitoreo?tab=cargar', 'Iniciar monitoreo'],
  ['/monitoreo?tab=alertas', 'Compromisos vencidos'],
  ['/estrategicos', 'Lo que hay que mirar esta semana'],
  ['/estrategicos', 'Por qué son estratégicos'],
  ['/estrategicos?tab=cartera', 'Sin novedades'],
  ['/estrategicos?tab=promover', 'De dónde sale esta lista'],
  ['/posicionamiento', 'Qué cierra primero'],
  ['/posicionamiento', 'Proyectos de Posicionamiento en curso'],
  ['/posicionamiento?tab=acciones', 'Financiamiento'],
  ['/posicionamiento?tab=alianzas', 'Cobertura de la Agenda 2030'],
  ['/posicionamiento?tab=alianzas', 'Ciudades y comunidades sostenibles'],
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

/**
 * Con la base a escala real —catorce áreas, miles de registros—. Se repiten las
 * pantallas que agregan y ordenan, que son las que sólo fallan con volumen: el
 * tablero de secretarías, el comparativo de planificación, el panel de alertas
 * y el reporte imprimible.
 */
const CON_BASE_COMPLETA = [
  ['/', 'Próximos vencimientos importantes'],
  ['/', 'Proyectos activos'],
  ['/mis-areas', 'Tus áreas'],
  ['/proyectos', 'Base maestra de proyectos'],
  ['/proyectos?solo_activos=1&es_obra=1', 'Sólo obras'],
  ['/obras', 'Dónde están las obras'],
  ['/obras?tab=zonas', 'Obras por zona'],
  ['/obras?tab=alertas', 'Alertas de obras'],
  ['/seguimiento?tab=compromisos', 'Compromiso'],
  ['/seguimiento?vista=lista', 'Temas a tratar'],
  ['/monitoreo', 'Secretarías en la hoja'],
  ['/monitoreo?secretaria=Secretar%C3%ADa%20de%20Obras', 'Proyectos de la secretaría'],
  ['/monitoreo?tab=cobertura', 'Secretarías sin cobertura'],
  ['/monitoreo?tab=alertas', 'Compromisos vencidos'],
  ['/estrategicos', 'Lo que hay que mirar esta semana'],
  ['/estrategicos', 'Por qué son estratégicos'],
  ['/estrategicos?tab=cartera', 'Sin novedades'],
  ['/estrategicos?tab=promover', 'De dónde sale esta lista'],
  ['/posicionamiento', 'Qué cierra primero'],
  ['/posicionamiento', 'Proyectos de Posicionamiento en curso'],
  ['/posicionamiento?tab=acciones', 'Financiamiento'],
  ['/posicionamiento?tab=alianzas', 'Cobertura de la Agenda 2030'],
  ['/posicionamiento?tab=alianzas', 'Ciudades y comunidades sostenibles'],
  ['/planificacion', 'Ejecución presupuestaria'],
  ['/planificacion?tab=comparativo', 'Comparativo al T'],
  ['/mesas', 'Ver ficha'],
  ['/eventos?tab=checklist', 'Requerimientos sin confirmar'],
  ['/reportes', 'Filtros aplicados'],
  ['/configuracion', 'Cargar base completa'],
];

/** Con el sistema vacío: se espera el estado vacío, no un error ni una pantalla en blanco. */
const CON_SISTEMA_VACIO = [
  ['/', 'El sistema está vacío'],
  ['/mis-areas', 'Todavía no elegiste ninguna área'],
  ['/proyectos', 'La base maestra está vacía'],
  ['/obras', 'No hay ninguna obra cargada'],
  ['/seguimiento', 'Sin seguimientos agendados'],
  ['/seguimiento?tab=cargar', '1 · De qué seguimiento se trata'],
  ['/seguimiento?tab=compromisos', 'Sin compromisos'],
  ['/seguimiento?tab=historial', 'Elegí un área'],
  ['/monitoreo', 'Sin alertas activas'],
  // Vaciar el sistema no vacía los catálogos: las 8 áreas semilla siguen ahí,
  // así que la hoja las muestra todas en cero y sin monitorear. Es lo correcto.
  ['/monitoreo', 'Nunca monitoreada'],
  ['/monitoreo?secretaria=Secretar%C3%ADa%20de%20Salud', 'Sin temas en el período'],
  ['/monitoreo?tab=cobertura', 'Secretarías sin cobertura'],
  ['/monitoreo?tab=cargar', 'Iniciar monitoreo'],
  ['/monitoreo?tab=alertas', 'Sin alertas activas'],
  ['/estrategicos?tab=cartera', 'Sin proyectos estratégicos'],
  ['/estrategicos?tab=promover', 'Sin candidatos'],
  ['/posicionamiento?tab=acciones', 'Sin acciones internacionales'],
  ['/posicionamiento?tab=alianzas', 'ODS cubiertos'],
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

/**
 * La pestaña de historial de la ficha no se alcanza por URL —es estado local—,
 * así que se comprueba montando el componente directamente. Es la única forma
 * de que la línea de tiempo unificada entre en la prueba de humo.
 */
const COMPONENTES = [
  ['HistorialProyecto', 'Historial del proyecto'],
  ['HistorialProyecto', 'Cambios de ficha'],
  ['HistorialProyecto', 'Hitos planificados'],
  // El formulario de tema con un borrador transferido adentro: el compromiso
  // detectado tiene que llegar con la acción marcada y sus campos abiertos.
  ['FormularioTema', 'Requiere acción'],
  ['FormularioTema', 'Responsable'],
  ['FormularioTema', 'Administrativo / expediente'],
];

try {
  execSync(
    `npx vite build --config pruebas/humo/vite.config.js --ssr pruebas/humo/entrada.jsx ` +
      `--mode development --outDir ${SALIDA} --emptyOutDir --logLevel error`,
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
} catch {
  console.error('✗ no se pudo compilar la app para la prueba de humo');
  process.exit(1);
}

const { correr } = await import(`../${SALIDA}/entrada.js`);
const fallos = correr(CON_DEMO, CON_SISTEMA_VACIO, RUTAS_PROFUNDAS, COMPONENTES, CON_BASE_COMPLETA);

rmSync(SALIDA, { recursive: true, force: true });

if (fallos.length) {
  console.error('\n✗ Rutas que no renderizan lo esperado:');
  for (const f of fallos) console.error('    ' + f);
  console.error('');
  process.exit(1);
}

const total =
  CON_DEMO.length + CON_SISTEMA_VACIO.length + RUTAS_PROFUNDAS.length + COMPONENTES.length + CON_BASE_COMPLETA.length;
console.log(
  `✓ humo · ${total} comprobaciones de render (con demo, base completa, sistema vacío, rutas profundas y componentes sueltos)` +
    `
✓ accesibilidad · ${CON_BASE_COMPLETA.length} rutas auditadas (etiquetas, nombres accesibles, teclado, foco, encabezados)`,
);
