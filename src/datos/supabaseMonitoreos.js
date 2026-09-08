/** Monitoreos y temas contra Supabase. */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;
let cache = null;

async function catalogos() {
  if (cache) return cache;
  const [areas, categorias] = await Promise.all([
    supabase.from('areas').select('id, nombre, nombre_formal'),
    supabase.from('categorias_tema').select('id, nombre').eq('activo', true),
  ]);
  if (areas.error) throw areas.error;
  if (categorias.error) throw categorias.error;
  const porNombre = (filas) => new Map(filas.map((f) => [f.nombre, f.id]));
  const areasMap = porNombre(areas.data);
  for (const a of areas.data) if (a.nombre_formal) areasMap.set(a.nombre_formal, a.id);
  cache = { areas: areasMap, categorias: porNombre(categorias.data) };
  return cache;
}

export function olvidarCatalogos() { cache = null; }

const CAMPOS = [
  'id, fecha, cerrado, activo, created_at, updated_at',
  'area:areas(nombre, nombre_formal)',
  'temas:temas_monitoreo(id, monitoreo_id, proyecto_id, categoria_id, descripcion, criticidad, requiere_accion, responsable, fecha_limite, resuelto, activo, created_at, compromiso_id, categoria:categorias_tema(nombre), proyecto:proyectos(id_legible))',
].join(', ');

function temaLocal(t) {
  return {
    id: t.id,
    id_monitoreo: t.monitoreo_id,
    id_proyecto: t.proyecto?.id_legible ?? null,
    categoria: t.categoria?.nombre ?? '',
    descripcion: t.descripcion ?? '',
    criticidad: t.criticidad ?? 'media',
    requiere_accion: t.requiere_accion,
    responsable: t.responsable ?? '',
    fecha_limite: t.fecha_limite ?? null,
    resuelto: t.resuelto,
    activo: t.activo,
    id_compromiso: t.compromiso_id ?? null,
    compromiso_existente: false,
    creado_en: t.created_at,
  };
}

function monitoreoLocal(m) {
  return {
    id: m.id,
    fecha: m.fecha,
    area: m.area?.nombre_formal ?? m.area?.nombre ?? '',
    cerrado: m.cerrado,
    activo: m.activo,
    temas: (m.temas ?? []).map(temaLocal),
    creado_en: m.created_at,
  };
}

export async function cargar() {
  const { data, error } = await supabase.from('monitoreos').select(CAMPOS).order('fecha', { ascending: false });
  if (error) throw error;
  return data.map(monitoreoLocal);
}

async function proyectoId(codigo) {
  if (!codigo) return null;
  const { data, error } = await supabase.from('proyectos').select('id').eq('id_legible', codigo).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No existe el proyecto ${codigo} en la base.`);
  return data.id;
}

export async function crearMonitoreo(datos) {
  const cat = await catalogos();
  const area_id = cat.areas.get(datos.area);
  if (!area_id) throw new Error(`El área «${datos.area}» no existe en el catálogo de la base.`);
  const { data: sesion } = await supabase.auth.getSession();
  const fila = { fecha: datos.fecha, area_id, cerrado: false };
  if (sesion?.session?.user?.id) fila.creado_por = sesion.session.user.id;
  const { data, error } = await supabase.from('monitoreos').insert(fila).select('id').single();
  if (error) throw error;
  return (await cargar()).find((m) => m.id === data.id);
}

export async function crearTema(idMonitoreo, datos) {
  const cat = await catalogos();
  const categoria_id = cat.categorias.get(datos.categoria);
  if (!categoria_id) throw new Error(`La categoría «${datos.categoria}» no existe en la base.`);
  const fila = {
    monitoreo_id: idMonitoreo,
    // La restricción de la base permite que un tema apunte a un proyecto o a
    // un compromiso, pero no a los dos. Cuando genera una acción, el proyecto
    // queda en el compromiso y el tema conserva la novedad.
    proyecto_id: datos.requiere_accion ? null : await proyectoId(datos.id_proyecto),
    categoria_id,
    descripcion: datos.descripcion,
    criticidad: datos.criticidad ?? 'media',
    requiere_accion: Boolean(datos.requiere_accion),
    responsable: datos.responsable || null,
    fecha_limite: datos.fecha_limite || null,
    resuelto: false,
  };
  const { data, error } = await supabase.from('temas_monitoreo').insert(fila).select('id, monitoreo_id, proyecto_id, categoria_id, descripcion, criticidad, requiere_accion, responsable, fecha_limite, resuelto, activo, created_at, compromiso_id, categoria:categorias_tema(nombre), proyecto:proyectos(id_legible)').single();
  if (error) throw error;
  return temaLocal(data);
}

export async function actualizarTema(id, cambios) {
  const cat = await catalogos();
  const fila = {};
  for (const [local, remoto] of [['descripcion', 'descripcion'], ['criticidad', 'criticidad'], ['requiere_accion', 'requiere_accion'], ['responsable', 'responsable'], ['fecha_limite', 'fecha_limite'], ['resuelto', 'resuelto'], ['activo', 'activo']]) {
    if (local in cambios) fila[remoto] = cambios[local] || (local === 'fecha_limite' || local === 'responsable' ? null : cambios[local]);
  }
  if ('categoria' in cambios) fila.categoria_id = cat.categorias.get(cambios.categoria);
  if ('id_proyecto' in cambios) fila.proyecto_id = cambios.requiere_accion ? null : await proyectoId(cambios.id_proyecto);
  if ('requiere_accion' in cambios && cambios.requiere_accion) fila.proyecto_id = null;
  const { data, error } = await supabase.from('temas_monitoreo').update(fila).eq('id', id).select('id, monitoreo_id, proyecto_id, categoria_id, descripcion, criticidad, requiere_accion, responsable, fecha_limite, resuelto, activo, created_at, compromiso_id, categoria:categorias_tema(nombre), proyecto:proyectos(id_legible)').single();
  if (error) throw error;
  return temaLocal(data);
}

export async function finalizarMonitoreo(id) {
  const { data, error } = await supabase.from('monitoreos').update({ cerrado: true }).eq('id', id).select(CAMPOS).single();
  if (error) throw error;
  return monitoreoLocal(data);
}

export async function vincularCompromiso(idTema, idCompromiso) {
  const { data, error } = await supabase.from('temas_monitoreo').update({ compromiso_id: idCompromiso }).eq('id', idTema).select('id, monitoreo_id, proyecto_id, categoria_id, descripcion, criticidad, requiere_accion, responsable, fecha_limite, resuelto, activo, created_at, compromiso_id, categoria:categorias_tema(nombre), proyecto:proyectos(id_legible)').single();
  if (error) throw error;
  return temaLocal(data);
}
