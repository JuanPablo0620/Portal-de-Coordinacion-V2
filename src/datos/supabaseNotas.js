/**
 * Notas y recordatorios de un proyecto, contra Supabase.
 *
 * Son las anotaciones que no cuelgan de ningún compromiso: «el contacto de
 * Compras cambió», «las fotos están en tal carpeta», «preguntar en el
 * seguimiento si Vialidad respondió». Las usa la cartera estratégica.
 *
 * Una nota con `fecha_recordatorio` es un recordatorio y sube al panel del
 * tablero; sin fecha, queda en la ficha del proyecto. No hay una marca aparte
 * que decidir — ver `0033_notas_proyecto.sql`.
 *
 * El proyecto va por CÓDIGO legible y no por uuid, como en el resto de los
 * traductores: es lo que tienen a mano las pantallas.
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;

// No cachea catálogos; se expone para que `refrescar()` trate a todos los
// módulos remotos por igual.
export function olvidarCatalogos() {}

const CAMPOS = [
  'id, texto, fecha_recordatorio, activo, created_at, updated_at',
  'proyecto:proyectos(id_legible)',
].join(', ');

function aFormaLocal(fila) {
  return {
    id: fila.id,
    id_proyecto: fila.proyecto?.id_legible ?? '',
    texto: fila.texto ?? '',
    // Cadena vacía y no null: es lo que espera un `<input type="date">`, y
    // devolver null obliga a cada formulario a traducirlo.
    fecha_recordatorio: fila.fecha_recordatorio ?? '',
    activo: fila.activo,
    creado_en: fila.created_at,
    actualizado_en: fila.updated_at,
  };
}

async function uuidDe(idLegible) {
  const { data, error } = await supabase
    .from('proyectos')
    .select('id')
    .eq('id_legible', idLegible)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No existe el proyecto ${idLegible} en la base.`);
  return data.id;
}

/**
 * Todas las notas vigentes.
 *
 * Se traen enteras y no por proyecto: el panel del tablero necesita los
 * recordatorios de TODOS los proyectos a la vez, y son pocas filas — una nota
 * es algo que alguien escribió a mano, no un registro que se genera solo.
 *
 * Orden: primero las que tienen fecha, de la más próxima a la más lejana;
 * después las sueltas, de la más nueva a la más vieja. Es el orden en que se
 * miran, no el de la tabla.
 */
export async function cargar() {
  const { data, error } = await supabase
    .from('notas_proyecto')
    .select(CAMPOS)
    .eq('activo', true)
    .order('fecha_recordatorio', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(aFormaLocal);
}

async function leer(id) {
  const { data, error } = await supabase.from('notas_proyecto').select(CAMPOS).eq('id', id).single();
  if (error) throw error;
  return aFormaLocal(data);
}

export async function crear(datos) {
  const fila = {
    proyecto_id: await uuidDe(datos.id_proyecto),
    texto: String(datos.texto ?? '').trim(),
    fecha_recordatorio: datos.fecha_recordatorio || null,
  };
  if (!fila.texto) throw new Error('La nota no puede estar vacía.');

  const { data: sesion } = await supabase.auth.getSession();
  if (sesion?.session?.user?.id) fila.creado_por = sesion.session.user.id;

  const { data, error } = await supabase.from('notas_proyecto').insert(fila).select('id').single();
  if (error) throw error;
  // Se relee con la misma consulta que usa la lista, para que lo que queda en
  // pantalla al guardar sea idéntico a lo que se vería al recargar.
  return leer(data.id);
}

export async function actualizar(id, cambios) {
  const fila = {};
  if ('texto' in cambios) {
    fila.texto = String(cambios.texto ?? '').trim();
    if (!fila.texto) throw new Error('La nota no puede estar vacía.');
  }
  // Vaciar la fecha es una operación legítima: convierte el recordatorio en
  // nota suelta. Por eso se distingue «no vino» de «vino vacía».
  if ('fecha_recordatorio' in cambios) fila.fecha_recordatorio = cambios.fecha_recordatorio || null;
  if ('activo' in cambios) fila.activo = cambios.activo;

  const { error } = await supabase.from('notas_proyecto').update(fila).eq('id', id);
  if (error) throw error;
  return leer(id);
}
