/**
 * La bitácora, leída de `auditoria`.
 *
 * Era la última cosa del portal que vivía solo en el navegador: cada persona
 * veía el registro de lo que había hecho en SU máquina, y nada de lo que
 * hicieron los demás.
 *
 * No hizo falta migrarla como colección. `0017_auditoria.sql` ya puso un
 * trigger que registra quién cambió qué en quince tablas, del lado del
 * servidor. El dato estaba: lo que faltaba era que el portal lo leyera en vez
 * de su copia local. Migrar `historial` habría sido guardar dos veces lo mismo.
 *
 * Este módulo traduce esas filas a la forma de asiento que ya esperan
 * `redactarAsiento()` y las pantallas de historial.
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;

export function olvidarCatalogos() {}

/**
 * Cuántos asientos se traen.
 *
 * La auditoría crece con cada cambio de cualquier tabla y no tiene techo. Las
 * pantallas muestran los últimos movimientos, no el registro completo desde el
 * día uno: traerlo entero sería descargar cada vez más para mostrar siempre lo
 * mismo. Para auditar de verdad —«¿quién tocó esto en marzo?»— está el SQL
 * Editor, que es la herramienta adecuada y no tiene este límite.
 */
const TOPE = 500;

/** Nombre de tabla → entidad del portal, para que `redactarAsiento` la nombre. */
const ENTIDAD = {
  proyectos: 'proyectos',
  compromisos: 'compromisos',
  eventos: 'eventos',
  requerimientos_evento: 'requerimientos_evento',
  monitoreos: 'monitoreos',
  temas_monitoreo: 'temas_monitoreo',
  seguimientos: 'seguimientos',
  mesas: 'mesas',
  reuniones_mesa: 'reuniones_mesa',
  proyectos_posicionamiento: 'proyectos_posicionamiento',
  cortes: 'cortes',
};

/** `insert | update | delete` de Postgres → el vocabulario del portal. */
const ACCION = { insert: 'alta', update: 'edicion', delete: 'baja' };

/**
 * Los campos que valen la pena en el detalle de un cambio.
 *
 * La auditoría guarda la fila entera antes y después, así que el diff crudo
 * incluye `updated_at` —que cambia siempre— y las claves foráneas, que son
 * uuid y no le dicen nada a nadie. Se listan los legibles y se ignora el resto:
 * mejor un detalle corto y cierto que uno largo e ilegible.
 */
const CAMPOS_LEGIBLES = new Set([
  'nombre', 'descripcion', 'responsable', 'prioridad', 'estado', 'estado_general',
  'fecha_inicio', 'fecha_fin_proyectada', 'fecha_limite', 'fecha_cumplimiento',
  'monto_planificado', 'monto_ejecutado', 'zona', 'observaciones', 'activo',
  'es_obra', 'es_estrategico', 'cerrado', 'motivo', 'alcance', 'referente',
]);

function diferencias(antes, despues) {
  if (!antes || !despues) return [];
  const cambios = [];
  for (const campo of Object.keys(despues)) {
    if (!CAMPOS_LEGIBLES.has(campo)) continue;
    if (JSON.stringify(antes[campo]) === JSON.stringify(despues[campo])) continue;
    cambios.push({ campo, antes: antes[campo], despues: despues[campo] });
  }
  return cambios;
}

/**
 * @param proyectosPorUuid  Mapa uuid → código legible. La auditoría guarda el
 *   uuid de la fila, y las pantallas de historial filtran por el código visible
 *   del proyecto. Sin esto, el historial de un proyecto saldría siempre vacío.
 */
export async function cargar(proyectosPorUuid = new Map()) {
  const { data, error } = await supabase
    .from('auditoria')
    .select('id, tabla, registro_id, accion, ts, datos_antes, datos_despues, autor:perfiles(nombre)')
    .order('ts', { ascending: false })
    .limit(TOPE);

  // La auditoría solo la lee `admin`, por decisión de 0017. Para el resto no es
  // un error: es que no le corresponde verla, y la pantalla sigue funcionando
  // sin la capa de cambios.
  if (error) {
    if (error.code === '42501' || error.code === 'PGRST301') return [];
    throw error;
  }

  return data.map((f) => {
    const fila = f.datos_despues ?? f.datos_antes ?? {};
    // De qué proyecto habla el asiento: si la fila ES un proyecto, su propio
    // id; si es algo que cuelga de uno (un compromiso, un tema), su `proyecto_id`.
    const uuidProyecto = f.tabla === 'proyectos' ? f.registro_id : fila.proyecto_id;

    return {
      id: f.id,
      entidad: ENTIDAD[f.tabla] ?? f.tabla,
      id_entidad: f.registro_id,
      accion: ACCION[f.accion] ?? f.accion,
      cambios: diferencias(f.datos_antes, f.datos_despues),
      id_proyecto: proyectosPorUuid.get(uuidProyecto) ?? null,
      creado_por: f.autor?.nombre ?? 'el sistema',
      creado_en: f.ts,
    };
  });
}
