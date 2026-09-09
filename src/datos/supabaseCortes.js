/**
 * Cortes de calle contra Supabase.
 *
 * El módulo de Mapa es posterior a `0001_esquema.sql` y era el único de los
 * cuatro sin migrar que ni siquiera tenía tabla: la crea
 * `0016_cortes_de_calle.sql`.
 *
 * El costo de que viviera en el navegador era concreto: si alguien marcaba el
 * corte de una avenida para un evento del sábado, nadie más lo veía. Es
 * información que existe justamente para coordinarse entre áreas.
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';
import { tramosDe } from './cortes.js';

export const activo = () => supabaseConfigurado;

let cache = null;

async function catalogos() {
  if (cache) return cache;
  const { data, error } = await supabase.from('areas').select('id, nombre, nombre_formal');
  if (error) throw error;

  const areas = new Map();
  for (const a of data) {
    areas.set(a.nombre, a.id);
    if (a.nombre_formal) areas.set(a.nombre_formal, a.id);
  }
  cache = { areas };
  return cache;
}

export function olvidarCatalogos() {
  cache = null;
}

const oNulo = (v) => (v === '' || v === undefined ? null : v);

/** Postgres devuelve `HH:MM:SS`; el campo de hora del formulario espera `HH:MM`. */
const soloHoraMinuto = (h) => (h ? String(h).slice(0, 5) : '');

/* ── Traducción ─────────────────────────────────────────────────────── */

const CAMPOS = [
  'id, motivo, detalle_motivo, estado, alcance',
  'vigencia_desde, vigencia_hasta, hora_desde, hora_hasta',
  'dias_semana, fechas_excluidas, tramos, cuadras, observaciones',
  'activo, created_at',
  'evento_id',
  'area:areas(nombre, nombre_formal)',
].join(', ');

function aFormaLocal(fila) {
  return {
    id: fila.id,
    id_evento: fila.evento_id ?? null,
    area_solicitante: fila.area?.nombre_formal ?? fila.area?.nombre ?? '',
    motivo: fila.motivo ?? '',
    detalle_motivo: fila.detalle_motivo ?? '',
    estado: fila.estado ?? 'previsto',
    alcance: fila.alcance ?? 'total',
    vigencia_desde: fila.vigencia_desde ?? '',
    vigencia_hasta: fila.vigencia_hasta ?? '',
    hora_desde: soloHoraMinuto(fila.hora_desde),
    hora_hasta: soloHoraMinuto(fila.hora_hasta),
    dias_semana: fila.dias_semana ?? [],
    fechas_excluidas: fila.fechas_excluidas ?? [],
    tramos: fila.tramos ?? [],
    cuadras: fila.cuadras ?? [],
    observaciones: fila.observaciones ?? '',
    activo: fila.activo,
    creado_en: fila.created_at,
  };
}

async function aFilaBase(datos, cat) {
  const fila = {};

  if ('id_evento' in datos) fila.evento_id = oNulo(datos.id_evento);
  if ('motivo' in datos) fila.motivo = oNulo(datos.motivo);
  if ('detalle_motivo' in datos) fila.detalle_motivo = oNulo(datos.detalle_motivo);
  if ('estado' in datos) fila.estado = datos.estado;
  if ('alcance' in datos) fila.alcance = datos.alcance;
  if ('vigencia_desde' in datos) fila.vigencia_desde = oNulo(datos.vigencia_desde);
  if ('vigencia_hasta' in datos) fila.vigencia_hasta = oNulo(datos.vigencia_hasta);
  if ('hora_desde' in datos) fila.hora_desde = oNulo(datos.hora_desde);
  if ('hora_hasta' in datos) fila.hora_hasta = oNulo(datos.hora_hasta);
  if ('dias_semana' in datos) fila.dias_semana = datos.dias_semana ?? [];
  if ('fechas_excluidas' in datos) fila.fechas_excluidas = datos.fechas_excluidas ?? [];
  if ('cuadras' in datos) fila.cuadras = datos.cuadras ?? [];
  if ('observaciones' in datos) fila.observaciones = oNulo(datos.observaciones);
  if ('activo' in datos) fila.activo = datos.activo;

  /*
   * Los cortes viejos guardaban su única calle en campos sueltos (`calle`,
   * `esquina_desde`, …) y los nuevos usan `tramos`. La tabla guarda una sola
   * forma —la nueva— y la vieja se normaliza acá con la misma función que ya
   * usa la pantalla, en vez de arrastrar los dos modelos a la base.
   */
  if ('tramos' in datos || 'calle' in datos) {
    fila.tramos = tramosDe(datos);
  }

  if ('area_solicitante' in datos) {
    const nombre = datos.area_solicitante;
    const id = nombre ? cat.areas.get(nombre) : null;
    if (nombre && !id) {
      throw new Error(`El área «${nombre}» no existe en el catálogo de la base.`);
    }
    fila.area_solicitante_id = id;
  }

  return fila;
}

/* ── Superficie pública ─────────────────────────────────────────────── */

export async function cargar() {
  const { data, error } = await supabase
    .from('cortes')
    .select(CAMPOS)
    .order('vigencia_desde', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data.map(aFormaLocal);
}

async function leerUno(id) {
  const { data, error } = await supabase.from('cortes').select(CAMPOS).eq('id', id).single();
  if (error) throw error;
  return aFormaLocal(data);
}

export async function crear(datos) {
  const cat = await catalogos();
  const fila = await aFilaBase(datos, cat);

  const { data: sesion } = await supabase.auth.getSession();
  if (sesion?.session?.user?.id) fila.creado_por = sesion.session.user.id;

  const { data, error } = await supabase.from('cortes').insert(fila).select('id').single();
  if (error) throw error;
  return leerUno(data.id);
}

export async function actualizar(id, cambios) {
  const cat = await catalogos();
  const fila = await aFilaBase(cambios, cat);
  fila.updated_at = new Date().toISOString();

  const { error } = await supabase.from('cortes').update(fila).eq('id', id);
  if (error) throw error;
  return leerUno(id);
}
