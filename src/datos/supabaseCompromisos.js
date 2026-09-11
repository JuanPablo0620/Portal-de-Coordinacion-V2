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
  'proyecto_id, area_id, descripcion, fecha_limite, estado',
  'fecha_cumplimiento, activo, creado_por, created_at, updated_at',
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
    origen_tipo: fila.origen_tipo ?? '',
    id_origen: idOrigen,
    id_proyecto: fila.proyecto?.id_legible ?? '',
    area: fila.area?.nombre_formal ?? fila.area?.nombre ?? '',
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

export async function cargar() {
  const { data, error } = await supabase
    .from('compromisos')
    .select(CAMPOS)
    .order('fecha_limite', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data.map(aFormaLocal);
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

export async function actualizarCompromiso(id, cambios) {
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
