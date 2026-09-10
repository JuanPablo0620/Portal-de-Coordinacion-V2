/**
 * Planificación anual, reportes guardados y «Mis áreas» contra Supabase.
 *
 * Las tres últimas colecciones que quedaban en el navegador. Van juntas en un
 * archivo porque son chicas y de la misma naturaleza —una tabla, sin lógica de
 * traducción de modelo— y separarlas serían tres archivos de cuarenta líneas.
 *
 * La planificación es la única con estructura: el portal la guarda como un
 * objeto con `metas_trimestrales` e `hitos` adentro, y la base la reparte en
 * tres tablas. Eso se traduce acá.
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;

// Los catálogos que necesita los resuelve por id_legible en el momento; no hay
// nada que cachear. Se expone igual para que `refrescar()` los trate a todos
// por igual.
export function olvidarCatalogos() {}

const oNulo = (v) => (v === '' || v === undefined ? null : v);

/* ── Planificación anual ────────────────────────────────────────────── */

const CAMPOS_PLAN = [
  'id, anio, meta_anual, monto_planificado, activo, created_at',
  'proyecto:proyectos(id_legible)',
  'trimestres:planificacion_trimestres(trimestre, meta)',
  'hitos:hitos_planificacion(id, nombre, fecha, cumplido)',
].join(', ');

function planLocal(fila) {
  /*
   * Las metas trimestrales son un arreglo de cuatro posiciones en el portal y
   * cuatro filas en la base. Se reconstruye por número de trimestre y no por
   * el orden en que vinieron: PostgREST no garantiza orden en un embed, y
   * confiar en él pondría la meta del cuarto trimestre en el primero.
   */
  const metas = [0, 0, 0, 0];
  for (const t of fila.trimestres ?? []) {
    if (t.trimestre >= 1 && t.trimestre <= 4) metas[t.trimestre - 1] = Number(t.meta) || 0;
  }

  return {
    id: fila.id,
    id_proyecto: fila.proyecto?.id_legible ?? '',
    anio: fila.anio,
    meta_anual: fila.meta_anual ?? 0,
    metas_trimestrales: metas,
    monto_planificado: fila.monto_planificado ?? 0,
    hitos: (fila.hitos ?? []).map((h) => ({
      id: h.id,
      nombre: h.nombre ?? '',
      fecha: h.fecha ?? '',
      cumplido: h.cumplido ?? false,
    })),
    activo: fila.activo,
    creado_en: fila.created_at,
  };
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

/**
 * Reemplaza trimestres e hitos por los que llegan.
 *
 * Se borra y se vuelve a insertar, igual que los vínculos de mesas y
 * posicionamiento: son cuatro filas y un puñado de hitos, y calcular el diff
 * agregaría una rama donde equivocarse a cambio de nada.
 */
async function sincronizarDetalle(idPlan, metas, hitos) {
  const borrados = await Promise.all([
    supabase.from('planificacion_trimestres').delete().eq('planificacion_id', idPlan),
    supabase.from('hitos_planificacion').delete().eq('planificacion_id', idPlan),
  ]);
  for (const b of borrados) if (b.error) throw b.error;

  const filasTrimestre = (metas ?? [])
    .map((meta, i) => ({ planificacion_id: idPlan, trimestre: i + 1, meta: Number(meta) || 0 }))
    // Un trimestre en cero no es una meta: es que todavía no se planificó.
    // Guardarlo llenaría la tabla de ceros que después hay que distinguir.
    .filter((f) => f.meta > 0);

  const filasHito = (hitos ?? [])
    .filter((h) => h?.nombre)
    .map((h) => ({
      planificacion_id: idPlan,
      nombre: h.nombre,
      fecha: oNulo(h.fecha),
      cumplido: Boolean(h.cumplido),
    }));

  if (filasTrimestre.length) {
    const { error } = await supabase.from('planificacion_trimestres').insert(filasTrimestre);
    if (error) throw error;
  }
  if (filasHito.length) {
    const { error } = await supabase.from('hitos_planificacion').insert(filasHito);
    if (error) throw error;
  }
}

export async function cargarPlanificacion() {
  const { data, error } = await supabase
    .from('planificacion_anual')
    .select(CAMPOS_PLAN)
    .order('anio', { ascending: false });
  if (error) throw error;
  return data.map(planLocal);
}

async function leerPlan(id) {
  const { data, error } = await supabase
    .from('planificacion_anual')
    .select(CAMPOS_PLAN)
    .eq('id', id)
    .single();
  if (error) throw error;
  return planLocal(data);
}

/**
 * Una planificación por proyecto y año. La base lo garantiza con un `unique`,
 * así que acá se busca la existente antes de insertar en vez de dejar que
 * falle: el mensaje de una violación de unicidad no le dice nada a nadie.
 */
export async function guardarPlan(datos) {
  const proyecto_id = await proyectoId(datos.id_proyecto);

  const { data: existente, error: errorBusqueda } = await supabase
    .from('planificacion_anual')
    .select('id')
    .eq('proyecto_id', proyecto_id)
    .eq('anio', datos.anio)
    .maybeSingle();
  if (errorBusqueda) throw errorBusqueda;

  const fila = {
    proyecto_id,
    anio: datos.anio,
    meta_anual: Number(datos.meta_anual) || 0,
    monto_planificado: Number(datos.monto_planificado) || 0,
  };

  let id = existente?.id;
  if (id) {
    const { error } = await supabase.from('planificacion_anual').update(fila).eq('id', id);
    if (error) throw error;
  } else {
    const { data: sesion } = await supabase.auth.getSession();
    if (sesion?.session?.user?.id) fila.creado_por = sesion.session.user.id;
    const { data, error } = await supabase
      .from('planificacion_anual')
      .insert(fila)
      .select('id')
      .single();
    if (error) throw error;
    id = data.id;
  }

  await sincronizarDetalle(id, datos.metas_trimestrales, datos.hitos);
  return leerPlan(id);
}

export async function actualizarPlan(id, cambios) {
  const fila = {};
  if ('anio' in cambios) fila.anio = cambios.anio;
  if ('meta_anual' in cambios) fila.meta_anual = Number(cambios.meta_anual) || 0;
  if ('monto_planificado' in cambios) fila.monto_planificado = Number(cambios.monto_planificado) || 0;
  if ('activo' in cambios) fila.activo = cambios.activo;

  if (Object.keys(fila).length) {
    fila.updated_at = new Date().toISOString();
    const { error } = await supabase.from('planificacion_anual').update(fila).eq('id', id);
    if (error) throw error;
  }

  if ('metas_trimestrales' in cambios || 'hitos' in cambios) {
    const actual = await leerPlan(id);
    await sincronizarDetalle(
      id,
      cambios.metas_trimestrales ?? actual.metas_trimestrales,
      cambios.hitos ?? actual.hitos,
    );
  }
  return leerPlan(id);
}

/* ── Reportes guardados ─────────────────────────────────────────────── */

// La tabla los llama `bloques_incluidos` y el portal `bloques`. Se traduce.
const CAMPOS_REPORTE = 'id, nombre, filtros, bloques_incluidos, created_at';

const reporteLocal = (f) => ({
  id: f.id,
  nombre: f.nombre ?? '',
  filtros: f.filtros ?? {},
  bloques: f.bloques_incluidos ?? [],
  activo: true,
  creado_en: f.created_at,
});

export async function cargarReportes() {
  const { data, error } = await supabase
    .from('reportes_guardados')
    .select(CAMPOS_REPORTE)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(reporteLocal);
}

export async function guardarReporte({ nombre, filtros, bloques }) {
  const fila = { nombre, filtros: filtros ?? {}, bloques_incluidos: bloques ?? [] };
  const { data: sesion } = await supabase.auth.getSession();
  if (sesion?.session?.user?.id) fila.creado_por = sesion.session.user.id;

  const { data, error } = await supabase
    .from('reportes_guardados')
    .insert(fila)
    .select(CAMPOS_REPORTE)
    .single();
  if (error) throw error;
  return reporteLocal(data);
}

/**
 * Un reporte guardado SÍ se borra de verdad, a diferencia del resto del
 * sistema. No es dato de gestión: es una vista que alguien armó para sí. No
 * hay nada que auditar en que la haya descartado, y una baja lógica dejaría la
 * tabla creciendo con vistas que nadie va a volver a mirar.
 */
export async function borrarReporte(id) {
  const { error } = await supabase.from('reportes_guardados').delete().eq('id', id);
  if (error) throw error;
}

/* ── «Mis áreas» ────────────────────────────────────────────────────── */

export async function cargarAsignaciones() {
  const { data, error } = await supabase
    .from('asignaciones_monitoreo')
    .select('perfil_id, perfil:perfiles(nombre), area:areas(nombre, nombre_formal)');
  if (error) throw error;

  // El portal las indexa por NOMBRE de usuario, no por id: es lo que tiene a
  // mano en `config.usuario`. La política de la base ya se encarga de que solo
  // vengan las propias.
  return data.map((a) => ({
    usuario: a.perfil?.nombre ?? '',
    area: a.area?.nombre_formal ?? a.area?.nombre ?? '',
  }));
}

/** Reemplaza de una vez las áreas que sigue la persona de la sesión. */
export async function guardarAsignaciones(areas) {
  const { data: sesion } = await supabase.auth.getSession();
  const perfilId = sesion?.session?.user?.id;
  if (!perfilId) throw new Error('No hay sesión activa.');

  const { error: errorBorrado } = await supabase
    .from('asignaciones_monitoreo')
    .delete()
    .eq('perfil_id', perfilId);
  if (errorBorrado) throw errorBorrado;

  const nombres = (areas ?? []).filter(Boolean);
  if (!nombres.length) return [];

  const { data: filasArea, error } = await supabase
    .from('areas')
    .select('id, nombre, nombre_formal');
  if (error) throw error;

  const porNombre = new Map();
  for (const a of filasArea) {
    porNombre.set(a.nombre, a.id);
    if (a.nombre_formal) porNombre.set(a.nombre_formal, a.id);
  }

  const filas = nombres
    .map((nombre) => porNombre.get(nombre))
    .filter(Boolean)
    .map((area_id) => ({ perfil_id: perfilId, area_id }));

  if (!filas.length) return [];
  const { error: errorAlta } = await supabase.from('asignaciones_monitoreo').insert(filas);
  if (errorAlta) throw errorAlta;
  return cargarAsignaciones();
}
