import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;
const CAMPOS = 'id, nombre, activo, recibe_compromisos, organiza_secretaria';

export async function cargar() {
  const { data, error } = await supabase.from('perfiles').select(CAMPOS).order('nombre');
  if (error) throw error;
  return data;
}

export async function configurar(id, cambios) {
  const { data, error } = await supabase.from('perfiles').update({
    recibe_compromisos: Boolean(cambios.recibe_compromisos),
    organiza_secretaria: Boolean(cambios.organiza_secretaria),
  }).eq('id', id).select(CAMPOS).single();
  if (error) throw error;
  return data;
}
