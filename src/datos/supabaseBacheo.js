/**
 * Bacheo contra Supabase (tablas de `0038_bacheo.sql`).
 *
 * A diferencia de los cortes, Bacheo NO se hidrata en el store global
 * (`repositorio.js` → `tienda.js`): lo lee y lo escribe su propio módulo, como
 * `/vigentes-supabase`. Dos razones:
 *
 *  - Pesa. Cada semana trae decenas de geometrías y el historial crece todas
 *    las semanas; cargarlo en cada pantalla del portal para que lo use una
 *    sola es tráfico sin sentido.
 *  - No tiene vida en el navegador. Nace en Supabase: no hay versión en el
 *    almacenamiento del navegador que sincronizar ni migrar, que es lo que justifica el
 *    repositorio para las demás colecciones.
 *
 * Ver `docs/decisiones/2026-11-17-bacheo-fuera-del-store.md`.
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const bacheoDisponible = () => supabaseConfigurado;

function exigirSupabase() {
  if (!supabaseConfigurado) {
    throw new Error('Supabase no está configurado en este navegador: el módulo de Bacheo vive solo en la base.');
  }
}

/** Semanas publicadas, de la más nueva a la más vieja. Sin los trabajos. */
export async function listarSemanas() {
  exigirSupabase();
  const { data, error } = await supabase
    .from('bacheo_semanas')
    .select('id, lunes, desde, hasta, archivos, novedades, publicada_en')
    .order('lunes', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Los trabajos de una semana, en el orden de la planilla. */
export async function trabajosDeSemana(semanaId) {
  exigirSupabase();
  const { data, error } = await supabase
    .from('bacheo_trabajos')
    .select(
      'id, orden, cuadrilla, tipo, descripcion, localidad, localidad_planilla, fechas, tareas, m2, novedades, geometria, forma, ubicacion, nota',
    )
    .eq('semana_id', semanaId)
    .order('orden')
    .order('tipo');
  if (error) throw error;
  return data ?? [];
}

/** La memoria de lugares revisados, como `Map` por clave. */
export async function cargarLugares() {
  exigirSupabase();
  const { data, error } = await supabase.from('bacheo_lugares').select('clave, geometria, forma, nota');
  if (error) throw error;
  return new Map((data ?? []).map((l) => [l.clave, l]));
}

/**
 * Publica (o reemplaza) una semana entera en una sola transacción.
 * @returns {Promise<string>} id de la semana
 */
export async function publicarSemana({ semana, trabajos, lugares }) {
  exigirSupabase();
  const { data, error } = await supabase.rpc('publicar_semana_bacheo', {
    p_semana: semana,
    p_trabajos: trabajos,
    p_lugares: lugares,
  });
  if (error) throw error;
  return data;
}
