/**
 * Posicionamiento contra Supabase.
 *
 * Es uno de los cuatro módulos que hasta hoy guardaban en el navegador de cada
 * persona: lo que cargaba uno no lo veía nadie más y se perdía al limpiar el
 * navegador. La tabla existía en la base desde `0001`, vacía y sin usar.
 *
 * Nunca se había migrado porque el formulario usa catorce campos y la tabla
 * tenía ocho. Los nueve que faltaban los agrega `0015_posicionamiento_completo`.
 *
 * Sigue la misma regla que el resto de los traductores: de acá para afuera solo
 * salen objetos con la forma del portal. Ni `selectores.js` ni un componente se
 * enteran de dónde vienen los datos.
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;

/* ── Catálogos ──────────────────────────────────────────────────────── */

let cache = null;

async function catalogos() {
  if (cache) return cache;

  const [areas, organismos] = await Promise.all([
    supabase.from('areas').select('id, nombre, nombre_formal'),
    supabase.from('organismos').select('id, nombre'),
  ]);
  if (areas.error) throw areas.error;
  if (organismos.error) throw organismos.error;

  // Las áreas entran por sus dos nombres: el portal ofrece el formal y la base
  // guarda el corto (ver 0005_areas_nombre_formal.sql).
  const mapaAreas = new Map();
  for (const a of areas.data) {
    mapaAreas.set(a.nombre, a.id);
    if (a.nombre_formal) mapaAreas.set(a.nombre_formal, a.id);
  }

  cache = {
    areas: mapaAreas,
    organismos: new Map(organismos.data.map((o) => [o.nombre, o.id])),
  };
  return cache;
}

export function olvidarCatalogos() {
  cache = null;
}

const oNulo = (v) => (v === '' || v === undefined ? null : v);
const oNumero = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/* ── Traducción ─────────────────────────────────────────────────────── */

const CAMPOS = [
  'id, nombre, tipo, estado, referente, descripcion, objetivo, resultado',
  'fecha_inicio, fecha_limite, fecha_resolucion, financiamiento_usd, ods',
  'activo, created_at, updated_at',
  'area:areas(nombre, nombre_formal)',
  'organismo:organismos(nombre)',
  // Los proyectos vinculados vienen por la tabla puente. `id_legible` es lo que
  // el portal usa como identificador de proyecto, no el uuid.
  'vinculos:posicionamiento_proyectos(proyecto:proyectos(id_legible))',
].join(', ');

function aFormaLocal(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre ?? '',
    tipo: fila.tipo ?? '',
    organismo: fila.organismo?.nombre ?? '',
    estado: fila.estado ?? 'identificada',
    area: fila.area?.nombre_formal ?? fila.area?.nombre ?? '',
    referente: fila.referente ?? '',
    descripcion: fila.descripcion ?? '',
    // `objetivo` y `descripcion` son campos distintos y los dos existen desde
    // 0015: objetivo es la meta, descripcion es de qué se trata.
    objetivo: fila.objetivo ?? '',
    fecha_inicio: fila.fecha_inicio ?? '',
    fecha_limite: fila.fecha_limite ?? '',
    fecha_resolucion: fila.fecha_resolucion ?? '',
    financiamiento_usd: fila.financiamiento_usd ?? '',
    ods: fila.ods ?? [],
    ids_proyecto: (fila.vinculos ?? []).map((v) => v.proyecto?.id_legible).filter(Boolean),
    resultado: fila.resultado ?? '',
    activo: fila.activo,
    creado_en: fila.created_at,
  };
}

async function aFilaBase(datos, cat) {
  const fila = {};

  if ('nombre' in datos) fila.nombre = datos.nombre;
  if ('tipo' in datos) fila.tipo = oNulo(datos.tipo);
  if ('estado' in datos) fila.estado = oNulo(datos.estado);
  if ('referente' in datos) fila.referente = oNulo(datos.referente);
  if ('descripcion' in datos) fila.descripcion = oNulo(datos.descripcion);
  if ('objetivo' in datos) fila.objetivo = oNulo(datos.objetivo);
  if ('resultado' in datos) fila.resultado = oNulo(datos.resultado);
  if ('fecha_inicio' in datos) fila.fecha_inicio = oNulo(datos.fecha_inicio);
  if ('fecha_limite' in datos) fila.fecha_limite = oNulo(datos.fecha_limite);
  if ('fecha_resolucion' in datos) fila.fecha_resolucion = oNulo(datos.fecha_resolucion);
  if ('financiamiento_usd' in datos) fila.financiamiento_usd = oNumero(datos.financiamiento_usd);
  if ('ods' in datos) fila.ods = (datos.ods ?? []).map(Number).filter(Number.isFinite);
  if ('activo' in datos) fila.activo = datos.activo;

  if ('area' in datos) {
    const id = datos.area ? cat.areas.get(datos.area) : null;
    if (datos.area && !id) {
      throw new Error(`El área «${datos.area}» no existe en el catálogo de la base.`);
    }
    fila.area_id = id;
  }

  // El organismo se da de alta desde Configuración y puede no estar todavía en
  // la base. Se avisa en vez de guardar la acción sin contraparte, que es el
  // dato que después nadie entiende de dónde salió.
  if ('organismo' in datos) {
    const id = datos.organismo ? cat.organismos.get(datos.organismo) : null;
    if (datos.organismo && !id) {
      throw new Error(
        `El organismo «${datos.organismo}» no existe en el catálogo de la base. ` +
          'Pedile a un administrador que lo dé de alta antes de usarlo.',
      );
    }
    fila.organismo_id = id;
  }

  return fila;
}

/* ── Proyectos vinculados ───────────────────────────────────────────── */

/**
 * Reemplaza los vínculos de una acción por la lista que llega.
 *
 * Se borra y se vuelve a insertar en vez de calcular el diff: son a lo sumo un
 * puñado de proyectos por acción, y el diff agregaría una rama de código donde
 * equivocarse a cambio de ahorrar milisegundos que nadie va a notar.
 */
async function sincronizarVinculos(idAccion, idsLegibles) {
  const { error: errorBorrado } = await supabase
    .from('posicionamiento_proyectos')
    .delete()
    .eq('posicionamiento_id', idAccion);
  if (errorBorrado) throw errorBorrado;

  const codigos = (idsLegibles ?? []).filter(Boolean);
  if (!codigos.length) return;

  const { data, error } = await supabase
    .from('proyectos')
    .select('id, id_legible')
    .in('id_legible', codigos);
  if (error) throw error;

  // Un proyecto que ya no existe se ignora en silencio: la acción de
  // posicionamiento sigue siendo válida sin él, y cortar la operación entera
  // por un vínculo viejo sería peor que perder el vínculo.
  const filas = data.map((p) => ({ posicionamiento_id: idAccion, proyecto_id: p.id }));
  if (!filas.length) return;

  const { error: errorAlta } = await supabase.from('posicionamiento_proyectos').insert(filas);
  if (errorAlta) throw errorAlta;
}

/* ── Superficie pública ─────────────────────────────────────────────── */

export async function cargar() {
  const { data, error } = await supabase
    .from('proyectos_posicionamiento')
    .select(CAMPOS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(aFormaLocal);
}

/** Lee una fila por el mismo camino que la lista, para que no puedan diferir. */
async function leerUna(id) {
  const { data, error } = await supabase
    .from('proyectos_posicionamiento')
    .select(CAMPOS)
    .eq('id', id)
    .single();
  if (error) throw error;
  return aFormaLocal(data);
}

export async function crear(datos) {
  const cat = await catalogos();
  const fila = await aFilaBase(datos, cat);

  const { data: sesion } = await supabase.auth.getSession();
  if (sesion?.session?.user?.id) fila.creado_por = sesion.session.user.id;

  const { data, error } = await supabase
    .from('proyectos_posicionamiento')
    .insert(fila)
    .select('id')
    .single();
  if (error) throw error;

  await sincronizarVinculos(data.id, datos.ids_proyecto);
  return leerUna(data.id);
}

export async function actualizar(id, cambios) {
  const cat = await catalogos();
  const fila = await aFilaBase(cambios, cat);

  if (Object.keys(fila).length) {
    fila.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from('proyectos_posicionamiento')
      .update(fila)
      .eq('id', id);
    if (error) throw error;
  }

  if ('ids_proyecto' in cambios) await sincronizarVinculos(id, cambios.ids_proyecto);
  return leerUna(id);
}
