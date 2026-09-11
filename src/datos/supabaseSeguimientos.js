/**
 * Seguimientos contra Supabase.
 *
 * El portal trabaja con nombres de área y códigos visibles de proyecto; la
 * base guarda UUID. Este módulo traduce ambos sentidos y conserva los tres
 * bloques que produce la transferencia de una minuta.
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

function nombreArea(area) {
  return area?.nombre_formal ?? area?.nombre ?? '';
}

const CAMPOS = [
  'id, fecha, hora, tipo, participantes, texto_crudo, resumen, temas, avances, problemas',
  'estado_reportado, activo, created_at, updated_at',
  'area:areas(nombre, nombre_formal)',
].join(', ');

async function idsProyecto(codigo) {
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

function aFormaLocal(fila, codigos = []) {
  return {
    id: fila.id,
    area: nombreArea(fila.area),
    fecha: fila.fecha ?? '',
    hora: fila.hora ? fila.hora.slice(0, 5) : '',
    tipo: fila.tipo ?? 'programado',
    participantes: fila.participantes ?? '',
    texto_crudo: fila.texto_crudo ?? '',
    resumen: fila.resumen ?? '',
    temas: fila.temas ?? '',
    avances: Array.isArray(fila.avances) ? fila.avances : [],
    problemas: Array.isArray(fila.problemas) ? fila.problemas : [],
    estado_reportado: fila.estado_reportado ?? '',
    ids_proyecto: codigos,
    activo: fila.activo,
    creado_por: fila.creado_por ?? '',
    creado_en: fila.created_at,
    actualizado_en: fila.updated_at,
  };
}

async function proyectosPorSeguimiento(ids) {
  if (!ids.length) return new Map();
  const { data, error } = await supabase
    .from('seguimientos_proyectos')
    .select('seguimiento_id, proyecto:proyectos(id_legible)')
    .in('seguimiento_id', ids);
  if (error) throw error;
  const resultado = new Map();
  for (const fila of data) {
    if (!resultado.has(fila.seguimiento_id)) resultado.set(fila.seguimiento_id, []);
    if (fila.proyecto?.id_legible) resultado.get(fila.seguimiento_id).push(fila.proyecto.id_legible);
  }
  return resultado;
}

export async function cargar() {
  const { data, error } = await supabase
    .from('seguimientos')
    .select(CAMPOS)
    .order('fecha', { ascending: false });
  if (error) throw error;
  const porSeguimiento = await proyectosPorSeguimiento(data.map((f) => f.id));
  return data.map((fila) => aFormaLocal(fila, porSeguimiento.get(fila.id) ?? []));
}

/**
 * `alta` reconstruye la fila entera, como siempre hizo esto — `crearSeguimiento`
 * manda los diez campos igual que antes. `actualizarSeguimiento` en cambio
 * puede llegar con una edición parcial (por ejemplo, sólo `{ activo: false }`
 * para dar de baja un seguimiento cargado por error): ahí no correspondía
 * exigir un área que la edición ni siquiera trae.
 */
async function aFilaBase(datos, { alta = false } = {}) {
  const fila = {};
  if (alta || 'area' in datos) {
    const cat = await catalogos();
    const areaId = cat.areas.get(datos.area);
    if (!areaId) throw new Error(`El área «${datos.area}» no existe en el catálogo de la base.`);
    fila.area_id = areaId;
  }
  if (alta || 'fecha' in datos) fila.fecha = datos.fecha;
  if (alta || 'hora' in datos) fila.hora = datos.hora || null;
  if (alta || 'tipo' in datos) fila.tipo = datos.tipo || 'programado';
  if (alta || 'participantes' in datos) fila.participantes = datos.participantes || null;
  if (alta || 'texto_crudo' in datos) fila.texto_crudo = datos.texto_crudo || null;
  if (alta || 'resumen' in datos) fila.resumen = datos.resumen || null;
  if (alta || 'temas' in datos) fila.temas = datos.temas || null;
  if (alta || 'avances' in datos) fila.avances = datos.avances ?? [];
  if (alta || 'problemas' in datos) fila.problemas = datos.problemas ?? [];
  if (alta || 'estado_reportado' in datos) fila.estado_reportado = datos.estado_reportado || null;
  if ('activo' in datos) fila.activo = datos.activo;
  return fila;
}

async function vincularProyectos(seguimientoId, codigos = []) {
  const relaciones = [];
  for (const codigo of codigos) {
    relaciones.push({ seguimiento_id: seguimientoId, proyecto_id: await idsProyecto(codigo) });
  }
  const { error: borrarError } = await supabase
    .from('seguimientos_proyectos')
    .delete()
    .eq('seguimiento_id', seguimientoId);
  if (borrarError) throw borrarError;
  if (!relaciones.length) return;
  const { error } = await supabase.from('seguimientos_proyectos').insert(relaciones);
  if (error) throw error;
}

async function conProyectos(fila) {
  const { data, error } = await supabase
    .from('seguimientos')
    .select(CAMPOS)
    .eq('id', fila.id)
    .single();
  if (error) throw error;
  const porSeguimiento = await proyectosPorSeguimiento([fila.id]);
  return aFormaLocal(data, porSeguimiento.get(fila.id) ?? []);
}

export async function crearSeguimiento(datos) {
  const fila = await aFilaBase(datos, { alta: true });
  const { data: sesion } = await supabase.auth.getSession();
  if (sesion?.session?.user?.id) fila.creado_por = sesion.session.user.id;

  const { data, error } = await supabase.from('seguimientos').insert(fila).select('id').single();
  if (error) throw error;
  try {
    await vincularProyectos(data.id, datos.ids_proyecto ?? []);
  } catch (errorVinculo) {
    await supabase.from('seguimientos').delete().eq('id', data.id);
    throw errorVinculo;
  }
  return conProyectos(data);
}

export async function actualizarSeguimiento(id, cambios) {
  const fila = await aFilaBase(cambios);
  const { error } = await supabase.from('seguimientos').update(fila).eq('id', id);
  if (error) throw error;
  if ('ids_proyecto' in cambios) await vincularProyectos(id, cambios.ids_proyecto);
  return conProyectos({ id });
}
