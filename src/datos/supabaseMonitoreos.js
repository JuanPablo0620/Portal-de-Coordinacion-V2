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
  // `crearMonitoreo` ya venía guardando el autor; lo que faltaba era traerlo,
  // y por eso la columna «Cargado por» mostraba siempre un guión. Se desambigua
  // por columna porque no es la única referencia posible a `perfiles`.
  'autor:perfiles!creado_por(nombre)',
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
    creado_por: m.autor?.nombre ?? '',
    creado_en: m.created_at,
  };
}

export async function cargar() {
  const { data, error } = await supabase.from('monitoreos').select(CAMPOS).order('fecha', { ascending: false });
  if (error) throw error;
  return data.map(monitoreoLocal);
}

/**
 * Qué se hizo en cada monitoreo: los avances de proyecto informados y los
 * compromisos que nacieron ahí.
 *
 * Va aparte de `cargar()` y no como un embed porque son otras tablas y otra
 * cardinalidad, pero sobre todo porque puede fallar sola: las dos columnas que
 * usa (`actualizaciones.monitoreo_id` y `compromisos.id_monitoreo_origen`) las
 * agrega 0012_origen_monitoreo.sql. Si el deploy llega antes que la migración,
 * esto devuelve vacío y la pantalla pierde los bloques nuevos — pero la lista
 * de monitoreos sigue funcionando, que es lo que importa.
 *
 * Devuelve un mapa por id de monitoreo, ya en forma del portal.
 */
export async function cargarResumen() {
  const [avances, compromisos] = await Promise.all([
    supabase
      .from('actualizaciones')
      .select(
        'id, monitoreo_id, fecha_actualizacion, estado:estados(nombre), ' +
          'proyecto:proyectos(id_legible, nombre, programa:programas(nombre)), ' +
          'cuanti:act_cuantitativas(cantidad, objetivo, unidad:unidades(nombre))',
      )
      .not('monitoreo_id', 'is', null),
    supabase
      .from('compromisos')
      .select('id, id_monitoreo_origen, descripcion, responsable, fecha_limite, estado, activo')
      .not('id_monitoreo_origen', 'is', null),
  ]);
  if (avances.error) throw avances.error;
  if (compromisos.error) throw compromisos.error;

  const resumen = new Map();
  const entrada = (id) => {
    if (!resumen.has(id)) resumen.set(id, { avances: [], compromisos: [] });
    return resumen.get(id);
  };

  for (const a of avances.data) {
    entrada(a.monitoreo_id).avances.push({
      id: a.id,
      id_proyecto: a.proyecto?.id_legible ?? '',
      proyecto: a.proyecto?.nombre ?? '',
      programa: a.proyecto?.programa?.nombre ?? '',
      estado: a.estado?.nombre ? a.estado.nombre.toLowerCase() : '',
      // Lo informado en ESTE monitoreo, que es el aporte del período. El
      // acumulado del proyecto se calcula sumando y no corresponde acá.
      cantidad: a.cuanti ? Number(a.cuanti.cantidad) : null,
      objetivo: a.cuanti?.objetivo != null ? Number(a.cuanti.objetivo) : null,
      unidad: a.cuanti?.unidad?.nombre ?? '',
      fecha: a.fecha_actualizacion,
    });
  }

  for (const c of compromisos.data) {
    if (c.activo === false) continue;
    entrada(c.id_monitoreo_origen).compromisos.push({
      id: c.id,
      descripcion: c.descripcion ?? '',
      responsable: c.responsable ?? '',
      fecha_limite: c.fecha_limite ?? null,
      estado: c.estado,
    });
  }

  return resumen;
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
