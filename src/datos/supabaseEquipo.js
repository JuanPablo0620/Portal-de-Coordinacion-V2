/**
 * El padrón del equipo. Lee `perfiles` y sólo deja tocar la habilitación:
 * el rol, el nombre y el alta de cuentas se administran en Supabase, no
 * desde el portal.
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;

const CAMPOS = 'id, nombre, rol, activo, recibe_compromisos';

export async function cargar() {
  const { data, error } = await supabase.from('perfiles').select(CAMPOS).order('nombre');
  if (error) throw error;
  return data;
}

export async function configurar(id, cambios) {
  const { data, error } = await supabase
    .from('perfiles')
    .update({ recibe_compromisos: Boolean(cambios.recibe_compromisos) })
    .eq('id', id)
    .select(CAMPOS)
    .single();
  if (error) throw error;
  return data;
}
