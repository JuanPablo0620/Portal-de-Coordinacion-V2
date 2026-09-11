/**
 * Los catálogos administrables, contra Supabase.
 *
 * Eran lo último que quedaba viviendo en el navegador. Configuración deja
 * agregar, renombrar y dar de baja ítems en doce listas, y hasta ahora esos
 * cambios no salían de la máquina de quien los hacía: agregabas una secretaría
 * y no la veía nadie más. Para el vocabulario compartido de un sistema donde
 * nueve personas cargan sobre los mismos datos, eso no tiene sentido — es
 * justamente el dato que TIENE que ser igual para todos, porque de él dependen
 * los desplegables, los filtros y los nombres que salen en los informes.
 *
 * Tres cosas que este módulo tiene que reconciliar:
 *
 *  - Cada tabla nombró su columna de baja a su manera: `areas` usa `activa`,
 *    el resto `activo`. Acá se unifica en `activo`, que es lo que lee el portal.
 *  - `programas` cuelga de un área y los demás no: crear uno exige resolver a
 *    qué secretaría pertenece.
 *  - Tres catálogos respaldan columnas de texto libre y no tienen tabla propia;
 *    viven en `catalogos_libres`, distinguidos por su `clave` (ver 0025).
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;

export function olvidarCatalogos() {}

/**
 * Cómo se guarda cada catálogo del portal.
 *
 * `tabla` es dónde vive; `libre` marca los que comparten `catalogos_libres` y
 * se filtran por `clave`; `activo` nombra la columna de baja cuando no se llama
 * como en el resto; `extra` son las columnas propias de ese catálogo.
 */
const MAPA = Object.freeze({
  areas: { tabla: 'areas', activo: 'activa', extra: ['prefijo'], orden: 'orden', nombreFormal: true },
  programas: { tabla: 'programas', conArea: true },
  ejes: { tabla: 'ejes', orden: 'orden' },
  tipos: { tabla: 'tipos_proyecto', extra: ['es_obra'] },
  unidades: { tabla: 'unidades' },
  categorias_tema: { tabla: 'categorias_tema' },
  items_requerimiento: { tabla: 'items_requerimiento' },
  organismos: { tabla: 'organismos' },
  motivos_estrategicos: { tabla: 'motivos_estrategicos' },
  tipos_evento: { tabla: 'catalogos_libres', libre: 'tipos_evento', orden: 'orden' },
  tipos_proyecto_posicionamiento: {
    tabla: 'catalogos_libres', libre: 'tipos_proyecto_posicionamiento', orden: 'orden',
  },
  periodicidades: { tabla: 'catalogos_libres', libre: 'periodicidades', orden: 'orden' },
});

export const CLAVES = Object.freeze(Object.keys(MAPA));

/** Nombre de la columna de baja de ese catálogo. */
const columnaActivo = (cfg) => cfg.activo ?? 'activo';

/**
 * Slug para las tablas que lo exigen (`not null unique` desde 0001). Se deriva
 * del nombre porque Configuración no lo pide: quien agrega un eje escribe
 * «Obra pública», no «obra-publica».
 *
 * Puede quedar vacío si el nombre es sólo símbolos —«%», «m²»—, y un slug vacío
 * choca con el de otro ítem igual de simbólico. En ese caso se cae a un sufijo
 * aleatorio: es feo de leer, pero el slug de un catálogo no se muestra en
 * ningún lado y lo que importa es que la fila entre.
 */
function aSlug(nombre) {
  const limpio = String(nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return limpio || 'item-' + Math.random().toString(36).slice(2, 8);
}

/** Las tablas que declararon `slug not null unique` en 0001. */
const CON_SLUG = new Set([
  'areas', 'ejes', 'tipos_proyecto', 'unidades', 'categorias_tema',
  'items_requerimiento', 'motivos_estrategicos',
]);

function aFormaLocal(clave, fila) {
  const cfg = MAPA[clave];
  const item = {
    id: fila.id,
    /*
     * Las areas tienen dos nombres y el portal usa el FORMAL: los proyectos,
     * los monitoreos y los compromisos guardan «Secretaria de Obras», no
     * «Obras» (ver 0005). Devolver el corto aca desengancharia el catalogo de
     * todo lo demas: las tarjetas por secretaria, los filtros por area y los
     * desplegables dejarian de encontrar sus propias filas.
     */
    nombre: (cfg.nombreFormal ? fila.nombre_formal ?? fila.nombre : fila.nombre) ?? '',
    activo: fila[columnaActivo(cfg)] ?? true,
  };
  // El slug es la identidad estable del item, la unica que no cambia si alguien
  // lo renombra. Tres pantallas dependen de el para excluir un item puntual.
  if (fila.slug !== undefined) item.slug = fila.slug;
  for (const campo of cfg.extra ?? []) item[campo] = fila[campo] ?? null;
  // El área va con su denominación formal: es la que ofrecen los desplegables
  // del portal y con la que compara `useOpcionesPrograma`.
  if (cfg.conArea) item.area = fila.area?.nombre_formal ?? fila.area?.nombre ?? '';
  return item;
}

function columnas(cfg) {
  const campos = ['id', 'nombre', columnaActivo(cfg), ...(cfg.extra ?? [])];
  if (cfg.nombreFormal) campos.push('nombre_formal');
  if (CON_SLUG.has(cfg.tabla)) campos.push('slug');
  if (cfg.conArea) campos.push('area:areas(nombre, nombre_formal)');
  return campos.join(', ');
}

async function cargarUno(clave) {
  const cfg = MAPA[clave];
  let q = supabase.from(cfg.tabla).select(columnas(cfg));
  if (cfg.libre) q = q.eq('clave', cfg.libre);
  q = cfg.orden ? q.order(cfg.orden).order('nombre') : q.order('nombre');

  const { data, error } = await q;
  if (error) throw error;
  return data.map((f) => aFormaLocal(clave, f));
}

/**
 * Los doce, de una. Se piden en paralelo porque son doce consultas chicas e
 * independientes; en serie sumarían doce viajes de ida y vuelta al arrancar.
 *
 * Un catálogo que falla no se lleva puestos a los otros: se devuelve lo que sí
 * vino. Sin esto, un permiso mal puesto en una sola tabla dejaría al portal sin
 * NINGÚN desplegable, que es mucho peor que quedarse sin uno.
 */
export async function cargar() {
  const resultados = await Promise.allSettled(CLAVES.map((c) => cargarUno(c)));
  const salida = {};
  const fallos = [];
  resultados.forEach((r, i) => {
    const clave = CLAVES[i];
    if (r.status === 'fulfilled') salida[clave] = r.value;
    else fallos.push(clave + ': ' + (r.reason?.message ?? r.reason));
  });
  if (fallos.length) console.error('Catálogos que no se pudieron traer', fallos);
  return salida;
}

/** El uuid de un área por su nombre corto o formal. */
async function areaId(nombre) {
  if (!nombre) return null;
  const { data, error } = await supabase.from('areas').select('id, nombre, nombre_formal');
  if (error) throw error;
  const fila = data.find((a) => a.nombre === nombre || a.nombre_formal === nombre);
  return fila?.id ?? null;
}

function filaRemota(clave, item) {
  const cfg = MAPA[clave];
  // En areas, lo que se edita en Configuracion es el nombre formal. El corto se
  // llena igual en el alta: es el que usan los sheets del area y no puede
  // quedar nulo, pero no se toca al renombrar.
  const fila = cfg.nombreFormal
    ? { nombre: item.nombre, nombre_formal: item.nombre }
    : { nombre: item.nombre };
  fila[columnaActivo(cfg)] = item.activo !== false;
  if (CON_SLUG.has(cfg.tabla)) fila.slug = aSlug(item.nombre);
  if (cfg.libre) fila.clave = cfg.libre;
  for (const campo of cfg.extra ?? []) {
    if (item[campo] !== undefined && item[campo] !== null) fila[campo] = item[campo];
  }
  return fila;
}

/**
 * Guarda la lista completa de un catálogo, como la manda Configuración.
 *
 * La pantalla es un editor de lista: agrega, renombra y da de baja mandando el
 * arreglo entero. Así que acá se compara contra lo que hay y se aplica sólo la
 * diferencia — alta de lo nuevo, edición de lo que cambió, y nada más.
 *
 * Lo que desapareció de la lista NO se borra: en este sistema dar de baja es
 * poner `activo` en false, y Configuración ya lo hace mandando el ítem con la
 * bandera cambiada. Un ítem que se cayera del arreglo por un error de la
 * pantalla no puede llevarse puesto un nombre que otros registros referencian.
 */
export async function guardar(clave, items) {
  const cfg = MAPA[clave];
  if (!cfg) throw new Error('«' + clave + '» no es un catálogo administrable.');

  const previos = await cargarUno(clave);
  const porId = new Map(previos.map((p) => [p.id, p]));

  for (const item of items ?? []) {
    if (!item?.nombre) continue;
    const previo = porId.get(item.id);

    if (!previo) {
      const fila = filaRemota(clave, item);
      if (cfg.conArea) {
        const id = await areaId(item.area);
        if (!id) {
          throw new Error('El programa «' + item.nombre + '» necesita un área que exista en la base.');
        }
        fila.area_id = id;
      }
      const { error } = await supabase.from(cfg.tabla).insert(fila);
      if (error) throw error;
      continue;
    }

    // Sólo lo que cambió: un update por ítem en cada guardado llenaría la
    // auditoría de ediciones que no editaron nada.
    const cambios = {};
    if (item.nombre !== previo.nombre) {
      // Renombrar un area cambia su denominacion formal y deja el nombre corto
      // como esta: «Obras» es como la nombran los sheets, y no es lo que se
      // esta editando.
      if (cfg.nombreFormal) cambios.nombre_formal = item.nombre;
      else cambios.nombre = item.nombre;
      // El slug NO se recalcula: es la identidad estable del item y hay
      // pantallas que dependen de el. Renombrar no es crear otra cosa.
    }
    if ((item.activo !== false) !== (previo.activo !== false)) {
      cambios[columnaActivo(cfg)] = item.activo !== false;
    }
    for (const campo of cfg.extra ?? []) {
      if (item[campo] !== undefined && item[campo] !== previo[campo]) cambios[campo] = item[campo];
    }
    if (!Object.keys(cambios).length) continue;

    const { error } = await supabase.from(cfg.tabla).update(cambios).eq('id', item.id);
    if (error) throw error;
  }

  return cargarUno(clave);
}
