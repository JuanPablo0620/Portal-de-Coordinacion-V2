import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;
const REUNION = 'id, tipo, fecha, cerrada, creado_por, created_at';
const TEMA = 'id, reunion_id, compromiso_id, titulo, nota, acuerdo, orden, revisado';

export async function cargar() {
  const [reuniones, temas] = await Promise.all([
    supabase.from('reuniones_equipo').select(REUNION).order('fecha', { ascending: false }),
    supabase.from('temas_reunion_equipo').select(TEMA).order('orden'),
  ]);
  if (reuniones.error) throw reuniones.error;
  if (temas.error) throw temas.error;
  return { reuniones_equipo: reuniones.data, temas_reunion_equipo: temas.data };
}

export async function crear(datos) {
  const { data, error } = await supabase.from('reuniones_equipo')
    .insert({ tipo: datos.tipo, fecha: datos.fecha }).select(REUNION).single();
  if (error) throw error;
  return data;
}

export async function guardarTema(datos) {
  const fila = Object.fromEntries(['reunion_id', 'compromiso_id', 'titulo', 'nota', 'acuerdo', 'orden', 'revisado']
    .filter((k) => datos[k] !== undefined).map((k) => [k, datos[k]]));
  const consulta = datos.id
    ? supabase.from('temas_reunion_equipo').update(fila).eq('id', datos.id)
    : supabase.from('temas_reunion_equipo').upsert(fila, { onConflict: 'reunion_id,compromiso_id' });
  const { data, error } = await consulta.select(TEMA).single();
  if (error) throw error;
  return data;
}

export async function quitarTema(id) {
  const { error } = await supabase.from('temas_reunion_equipo').delete().eq('id', id);
  if (error) throw error;
}

export async function cerrar(id) {
  const { error } = await supabase.rpc('cerrar_reunion_equipo', { p_id: id });
  if (error) throw error;
  return cargar();
}
