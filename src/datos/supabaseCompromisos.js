/**
 * Compromisos contra Supabase.
 *
 * En esta etapa se habilita el origen `seguimiento`, que ya tiene UUID reales
 * en Supabase. Los orígenes de monitoreo y mesa quedan con un error explícito
 * hasta que esas dos colecciones también estén migradas.
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;

let cache = null;

async function catalogos() {
  if (cache) return cache;
  const { data, error } = await supabase.from('areas').select('id, nombre, nombre_formal');
  if (error) throw error;
  const areas = new Map();
  for (const area of data) {
    areas.set(area.nombre, area.id);
    if (area.nombre_formal) areas.set(area.nombre_formal, area.id);
  }
  cache = { areas };
  return cache;
}

export function olvidarCatalogos() {
  cache = null;
}

const CAMPOS = [
  'id, origen_tipo, id_seguimiento_origen, id_tema_origen, id_reunion_origen',
  'proyecto_id, area_id, subsecretaria_id, direccion_id, descripcion, fecha_limite, estado',
  'fecha_cumplimiento, activo, creado_por, created_at, updated_at',
  'id_responsable',
  'area:areas(nombre, nombre_formal), proyecto:proyectos(id_legible)',
].join(', ');

// `id_monitoreo_origen` NO se pide acá a propósito, aunque `aFormaLocal` sepa
// leerlo. Esta consulta trae los compromisos de todo el portal y no está
// aislada: si la columna todavía no existe —el despliegue puede llegar antes
// que 0012_origen_monitoreo.sql— la consulta entera falla y se queda sin
// compromisos media aplicación. El vínculo con el monitoreo lo trae
// `cargarResumen()` en supabaseMonitoreos.js, que sí corre en su propio
// try/catch y como mucho deja un bloque vacío.

/**
 * De dónde nació el compromiso, y en qué columna se guarda.
 *
 * `monitoreo` apunta a `id_tema_origen` y no es un error: ese caso es el
 * compromiso que sale de un TEMA de monitoreo, y lo que se guarda es el id del
 * tema. Es el camino viejo — los temas ya no se cargan.
 *
 * El caso nuevo es el compromiso cargado directamente en la reunión, sin tema.
 * Ese va a `id_monitoreo_origen` (ver 0012_origen_monitoreo.sql) y se elige con
 * `id_monitoreo_origen` en los datos, porque `origen_tipo` es un enum de la
 * base con tres valores y los dos casos comparten el mismo: `monitoreo`.
 */
const origenColumna = {
  seguimiento: 'id_seguimiento_origen',
  monitoreo: 'id_tema_origen',
  mesa: 'id_reunion_origen',
};

function aFormaLocal(fila) {
  const idOrigen =
    fila.id_seguimiento_origen ??
    fila.id_tema_origen ??
    fila.id_reunion_origen ??
    fila.id_monitoreo_origen ??
    null;
  return {
    id: fila.id,
    id_responsable: fila.id_responsable ?? null,
    origen_tipo: fila.origen_tipo ?? '',
    id_origen: idOrigen,
    id_proyecto: fila.proyecto?.id_legible ?? '',
    area: fila.area?.nombre_formal ?? fila.area?.nombre ?? '',
    // Van por uuid y no por nombre —a diferencia del área— porque son sólo
    // una referencia al organigrama: el nombre lo resuelve `unidadDe()` en
    // selectores.js contra `bd.subsecretarias` / `bd.direcciones`.
    id_subsecretaria: fila.subsecretaria_id ?? null,
    id_direccion: fila.direccion_id ?? null,
    descripcion: fila.descripcion ?? '',
    fecha_limite: fila.fecha_limite ?? null,
    estado: fila.estado,
    fecha_cumplimiento: fila.fecha_cumplimiento ?? null,
    activo: fila.activo,
    creado_por: fila.creado_por ?? '',
    creado_en: fila.created_at,
    actualizado_en: fila.updated_at,
  };
}

/**
 * La última novedad de cada compromiso, para mostrarla junto a él.
 *
 * Va en su propia consulta y con su propio try/catch, por el mismo motivo que
 * `id_monitoreo_origen` no entra en CAMPOS: si esto falla —la tabla es de 0014
 * y el trigger que la llena, de 0031— no puede dejar sin compromisos a media
 * aplicación. Sin ella, cada compromiso se muestra igual, sin la novedad.
 *
 * Se descartan las filas que no dicen nada: el trigger asienta también los
 * cambios de `activo` sin comentario ni cambio de estado, y mostrar «se
 * actualizó» sin decir qué cambió es peor que no mostrar nada.
 */
async function ultimasNovedades() {
  const { data, error } = await supabase
    .from('actualizaciones_compromisos')
    .select('compromiso_id, fecha_actualizacion, estado, estado_anterior, comentarios, created_at')
    .order('created_at', { ascending: false });
  if (error) return new Map();

  const ultima = new Map();
  for (const f of data) {
    if (ultima.has(f.compromiso_id)) continue;
    if (!f.comentarios && !f.estado_anterior) continue;
    ultima.set(f.compromiso_id, {
      fecha: f.fecha_actualizacion ?? String(f.created_at ?? '').slice(0, 10),
      texto: f.comentarios ?? '',
      estado: f.estado ?? '',
      estado_anterior: f.estado_anterior ?? '',
    });
  }
  return ultima;
}

export async function cargar() {
  const { data, error } = await supabase
    .from('compromisos')
    .select(CAMPOS)
    .order('fecha_limite', { ascending: true, nullsFirst: false });
  if (error) throw error;

  const novedades = await ultimasNovedades();
  return data.map((f) => ({ ...aFormaLocal(f), ultima_actualizacion: novedades.get(f.id) ?? null }));
}

async function proyectoId(codigo) {
  if (!codigo) return null;
  const { data, error } = await supabase
    .from('proyectos')
    .select('id')
    .eq('id_legible', codigo)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No existe el proyecto ${codigo} en la base.`);
  return data.id;
}

async function aFilaBase(datos, { alta = false } = {}) {
  const fila = {};
  if (alta) {
    const cat = await catalogos();
    const areaId = cat.areas.get(datos.area);
    if (!areaId) throw new Error(`El área «${datos.area}» no existe en el catálogo de la base.`);
    if (datos.origen_tipo && !origenColumna[datos.origen_tipo]) {
      throw new Error(`El origen «${datos.origen_tipo}» todavía no está migrado a Supabase.`);
    }
    // Compromiso cargado a mano en la reunión de monitoreo, sin tema de por
    // medio. Antes se perdía: `crearCompromisoDirecto` mandaba el id del
    // monitoreo pero sin `origen_tipo`, así que el `if` de abajo no entraba y
    // el vínculo se descartaba en silencio.
    if (datos.id_monitoreo_origen) {
      fila.origen_tipo = 'monitoreo';
      fila.id_monitoreo_origen = datos.id_monitoreo_origen;
    } else if (datos.origen_tipo) {
      if (!datos.id_origen) throw new Error('El compromiso necesita un origen válido.');
      fila.origen_tipo = datos.origen_tipo;
      fila[origenColumna[datos.origen_tipo]] = datos.id_origen;
    }
    fila.area_id = areaId;
    fila.proyecto_id = await proyectoId(datos.id_proyecto);
  }
  if ('descripcion' in datos) fila.descripcion = datos.descripcion;
  if ('id_responsable' in datos) fila.id_responsable = datos.id_responsable || null;
  if ('id_subsecretaria' in datos) fila.subsecretaria_id = datos.id_subsecretaria || null;
  if ('id_direccion' in datos) fila.direccion_id = datos.id_direccion || null;
  if ('fecha_limite' in datos) fila.fecha_limite = datos.fecha_limite || null;
  if ('estado' in datos) fila.estado = datos.estado;
  if ('fecha_cumplimiento' in datos) fila.fecha_cumplimiento = datos.fecha_cumplimiento || null;
  if ('activo' in datos) fila.activo = datos.activo;
  return fila;
}

export async function crearCompromiso(datos) {
  const fila = await aFilaBase(datos, { alta: true });
  const { data: sesion } = await supabase.auth.getSession();
  if (sesion?.session?.user?.id) fila.creado_por = sesion.session.user.id;
  const { data, error } = await supabase.from('compromisos').insert(fila).select(CAMPOS).single();
  if (error) throw error;
  return aFormaLocal(data);
}

/**
 * Actualiza un compromiso. Si viene `nuevaActualizacion`, el camino es otro.
 *
 * Un UPDATE comun no puede llevar el texto de la novedad a ningun lado: la
 * tabla del historial NO acepta INSERT desde la API (RLS de 0014, a proposito
 * — un historial que se puede editar no sirve como historial), y el trigger
 * que la llena no tiene de donde sacar ese texto.
 *
 * Por eso la novedad va por la funcion `actualizar_compromiso_con_novedad`
 * (0031), que deja el comentario en una variable local a la transaccion y hace
 * el UPDATE ahi mismo: el trigger la lee y asienta la fila. Un solo viaje, una
 * sola fila, y el compromiso y su historial no pueden quedar desincronizados.
 */
export async function actualizarCompromiso(id, cambios) {
  const novedad = cambios.nuevaActualizacion?.trim();
  if (novedad) return actualizarConNovedad(id, cambios, novedad);

  const fila = await aFilaBase(cambios);
  const { data, error } = await supabase
    .from('compromisos')
    .update(fila)
    .eq('id', id)
    .select(CAMPOS)
    .single();
  if (error) throw error;
  return aFormaLocal(data);
}

async function actualizarConNovedad(id, cambios, novedad) {
  const fila = await aFilaBase(cambios);
  const { error } = await supabase.rpc('actualizar_compromiso_con_novedad', {
    p_id: id,
    p_comentario: novedad,
    p_estado: fila.estado ?? null,
    p_fecha_limite: fila.fecha_limite ?? null,
    // `fecha_limite: null` es ambiguo en un objeto de cambios: puede querer
    // decir «no la toques» o «borrala». La RPC no adivina, se lo decimos.
    p_limpiar_fecha: 'fecha_limite' in fila && fila.fecha_limite === null,
    p_descripcion: fila.descripcion ?? null,
    p_subsecretaria_id: fila.subsecretaria_id ?? null,
    p_direccion_id: fila.direccion_id ?? null,
    p_tocar_unidad: 'subsecretaria_id' in fila || 'direccion_id' in fila,
  });
  if (error) throw error;

  // La RPC devuelve la fila cruda de `compromisos`, sin el area ni el proyecto
  // embebidos que `aFormaLocal` necesita. Se relee con el mismo SELECT de
  // siempre en vez de armar a mano una forma que quedaria distinta.
  const { data, error: errorLectura } = await supabase
    .from('compromisos')
    .select(CAMPOS)
    .eq('id', id)
    .single();
  if (errorLectura) throw errorLectura;
  return aFormaLocal(data);
}

/**
 * Historial de un compromiso, lo mas nuevo primero.
 *
 * Se pide por compromiso y no de una para todos: el historial completo son
 * cientos de filas que casi nunca se miran, y la unica pantalla que lo muestra
 * es el desplegable de un compromiso a la vez.
 */
export async function historial(compromisoId) {
  const { data, error } = await supabase
    .from('actualizaciones_compromisos')
    .select('id, compromiso_id, fecha_actualizacion, estado, estado_anterior, fecha_limite, comentarios, created_at')
    .eq('compromiso_id', compromisoId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((f) => ({
    id: f.id,
    compromiso_id: f.compromiso_id,
    fecha_actualizacion: f.fecha_actualizacion,
    estado: f.estado,
    estado_anterior: f.estado_anterior ?? null,
    fecha_limite: f.fecha_limite ?? null,
    comentarios: f.comentarios ?? '',
    creado_en: f.created_at,
  }));
}
