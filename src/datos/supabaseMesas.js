/**
 * Mesas de trabajo y sus reuniones, contra Supabase.
 *
 * Otro de los módulos que guardaba en el navegador de cada persona. A
 * diferencia de Posicionamiento, este NO necesitó migración de esquema: sus
 * campos ya coincidían con las tablas de `0001`. Lo único que le faltaba era
 * este traductor y las políticas, que agregó `0015`.
 *
 * Las mesas son territoriales —Esperanza, EDLA, Favelita/El Libertador— y lo
 * que se registra en ellas es acuerdo con vecinos. Que eso viviera en una sola
 * computadora era de lo más difícil de justificar del relevamiento.
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;

// Mantiene la misma superficie que los demás adaptadores remotos. Mesas no
// cachea catálogos, pero `refrescar()` los invalida a todos en conjunto.
export function olvidarCatalogos() {}

/**
 * El portal dice «temática» y «otros proyectos»; el enum de la base guarda
 * `tematica` y `otros_proyectos`. Se normaliza en vez de mapear a mano: así
 * agregar un tipo nuevo no obliga a tocar este archivo.
 */
function aSlug(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Del enum de la base al texto que muestran los desplegables del portal. */
const TEXTO_TIPO = {
  tematica: 'temática',
  barrial: 'barrial',
  otros_proyectos: 'otros proyectos',
};

const oNulo = (v) => (v === '' || v === undefined ? null : v);

/* ── Traducción ─────────────────────────────────────────────────────── */

const CAMPOS_MESA = [
  'id, nombre, tipo, descripcion, referente, periodicidad, estado, activo, created_at',
  'vinculos:mesas_proyectos(proyecto:proyectos(id_legible))',
].join(', ');

const CAMPOS_REUNION = 'id, mesa_id, fecha, asistentes, temas, activo, created_at';

function mesaLocal(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre ?? '',
    tipo: TEXTO_TIPO[fila.tipo] ?? fila.tipo ?? '',
    descripcion: fila.descripcion ?? '',
    referente: fila.referente ?? '',
    periodicidad: fila.periodicidad ?? '',
    estado: fila.estado ?? 'activa',
    proyectos_vinculados: (fila.vinculos ?? [])
      .map((v) => v.proyecto?.id_legible)
      .filter(Boolean),
    activo: fila.activo,
    creado_en: fila.created_at,
  };
}

function reunionLocal(fila) {
  return {
    id: fila.id,
    id_mesa: fila.mesa_id,
    fecha: fila.fecha ?? '',
    asistentes: fila.asistentes ?? '',
    temas: fila.temas ?? '',
    activo: fila.activo,
    creado_en: fila.created_at,
  };
}

function aFilaMesa(datos) {
  const fila = {};
  if ('nombre' in datos) fila.nombre = datos.nombre;
  if ('tipo' in datos) fila.tipo = aSlug(datos.tipo);
  if ('descripcion' in datos) fila.descripcion = oNulo(datos.descripcion);
  if ('referente' in datos) fila.referente = oNulo(datos.referente);
  if ('periodicidad' in datos) fila.periodicidad = oNulo(datos.periodicidad);
  if ('estado' in datos) fila.estado = datos.estado;
  if ('activo' in datos) fila.activo = datos.activo;
  return fila;
}

/* ── Proyectos vinculados ───────────────────────────────────────────── */

/** Mismo criterio que en posicionamiento: se reemplaza la lista entera. */
async function sincronizarVinculos(idMesa, idsLegibles) {
  const { error: errorBorrado } = await supabase
    .from('mesas_proyectos')
    .delete()
    .eq('mesa_id', idMesa);
  if (errorBorrado) throw errorBorrado;

  const codigos = (idsLegibles ?? []).filter(Boolean);
  if (!codigos.length) return;

  const { data, error } = await supabase
    .from('proyectos')
    .select('id, id_legible')
    .in('id_legible', codigos);
  if (error) throw error;

  const filas = data.map((p) => ({ mesa_id: idMesa, proyecto_id: p.id }));
  if (!filas.length) return;

  const { error: errorAlta } = await supabase.from('mesas_proyectos').insert(filas);
  if (errorAlta) throw errorAlta;
}

/* ── Superficie pública ─────────────────────────────────────────────── */

/**
 * Trae mesas y reuniones juntas: una mesa sin sus reuniones no dice nada, y
 * pedirlas en dos momentos deja la pantalla mostrando mesas vacías un instante.
 */
export async function cargar() {
  const [mesas, reuniones] = await Promise.all([
    supabase.from('mesas').select(CAMPOS_MESA).order('nombre'),
    supabase.from('reuniones_mesa').select(CAMPOS_REUNION).order('fecha', { ascending: false }),
  ]);
  if (mesas.error) throw mesas.error;
  if (reuniones.error) throw reuniones.error;

  return {
    mesas: mesas.data.map(mesaLocal),
    reuniones_mesa: reuniones.data.map(reunionLocal),
  };
}

async function leerMesa(id) {
  const { data, error } = await supabase.from('mesas').select(CAMPOS_MESA).eq('id', id).single();
  if (error) throw error;
  return mesaLocal(data);
}

export async function crearMesa(datos) {
  const fila = aFilaMesa(datos);
  const { data: sesion } = await supabase.auth.getSession();
  if (sesion?.session?.user?.id) fila.creado_por = sesion.session.user.id;

  const { data, error } = await supabase.from('mesas').insert(fila).select('id').single();
  if (error) throw error;

  await sincronizarVinculos(data.id, datos.proyectos_vinculados);
  return leerMesa(data.id);
}

export async function actualizarMesa(id, cambios) {
  const fila = aFilaMesa(cambios);

  if (Object.keys(fila).length) {
    fila.updated_at = new Date().toISOString();
    const { error } = await supabase.from('mesas').update(fila).eq('id', id);
    if (error) throw error;
  }

  if ('proyectos_vinculados' in cambios) {
    await sincronizarVinculos(id, cambios.proyectos_vinculados);
  }
  return leerMesa(id);
}

export async function crearReunion(datos) {
  const fila = {
    mesa_id: datos.id_mesa,
    fecha: oNulo(datos.fecha),
    asistentes: oNulo(datos.asistentes),
    temas: oNulo(datos.temas),
  };
  const { data: sesion } = await supabase.auth.getSession();
  if (sesion?.session?.user?.id) fila.creado_por = sesion.session.user.id;

  const { data, error } = await supabase
    .from('reuniones_mesa')
    .insert(fila)
    .select(CAMPOS_REUNION)
    .single();
  if (error) throw error;
  return reunionLocal(data);
}

export async function actualizarReunion(id, cambios) {
  const fila = {};
  if ('fecha' in cambios) fila.fecha = oNulo(cambios.fecha);
  if ('asistentes' in cambios) fila.asistentes = oNulo(cambios.asistentes);
  if ('temas' in cambios) fila.temas = oNulo(cambios.temas);
  if ('activo' in cambios) fila.activo = cambios.activo;

  const { data, error } = await supabase
    .from('reuniones_mesa')
    .update(fila)
    .eq('id', id)
    .select(CAMPOS_REUNION)
    .single();
  if (error) throw error;
  return reunionLocal(data);
}
