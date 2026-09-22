/**
 * La revisión de Dirección. No tiene temario propio —repasa todo lo
 * vigente—, así que el cierre lo resuelve `cerrar_reunion_direccion` en la
 * base, en una transacción: materializa la lista completa de ese día y
 * marca la reunión como cerrada sin que se cuele nada en el medio.
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;

const REUNION = 'id, fecha, cerrada, creado_por, created_at';
const TEMA = 'id, reunion_id, compromiso_id, titulo, nota, acuerdo, orden, revisado';
const CAMPOS_TEMA = ['reunion_id', 'compromiso_id', 'titulo', 'nota', 'acuerdo', 'orden', 'revisado'];

export async function cargar() {
  const [reuniones, temas] = await Promise.all([
    supabase.from('reuniones_direccion').select(REUNION).order('fecha', { ascending: false }),
    supabase.from('temas_reunion_direccion').select(TEMA).order('orden'),
  ]);
  if (reuniones.error) throw reuniones.error;
  if (temas.error) throw temas.error;
  return { reuniones_direccion: reuniones.data, temas_reunion_direccion: temas.data };
}

export async function crear(datos) {
  const { data, error } = await supabase
    .from('reuniones_direccion')
    .insert({ fecha: datos.fecha })
    .select(REUNION)
    .single();
  if (error) throw error;
  return data;
}

export async function guardarTema(datos) {
  const fila = Object.fromEntries(
    CAMPOS_TEMA.filter((k) => datos[k] !== undefined).map((k) => [k, datos[k]]),
  );
  const consulta = datos.id
    ? supabase.from('temas_reunion_direccion').update(fila).eq('id', datos.id)
    : supabase.from('temas_reunion_direccion').upsert(fila, { onConflict: 'reunion_id,compromiso_id' });
  const { data, error } = await consulta.select(TEMA).single();
  if (error) throw error;
  return data;
}

export async function quitarTema(id) {
  const { error } = await supabase.from('temas_reunion_direccion').delete().eq('id', id);
  if (error) throw error;
}

export async function cerrar(id) {
  const { error } = await supabase.rpc('cerrar_reunion_direccion', { p_id: id });
  if (error) throw error;
  return cargar();
}
