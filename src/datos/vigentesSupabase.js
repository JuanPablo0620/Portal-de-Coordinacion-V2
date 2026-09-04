/**
 * Lectura de proyectos y compromisos VIGENTES directo de Supabase.
 *
 * Es la primera pantalla que lee de la base real en vez del almacenamiento del navegador —
 * ver el porqué del alcance acotado en `supabaseClient.js`.
 *
 * A propósito NO se reimplementa `estadoCompromiso()` / `nivelPorDias()` acá:
 * son funciones puras de `selectores.js` que ya conocen la regla del ciclo de
 * vida (ver `docs/ciclo-de-vida-del-compromiso.md`) y no les importa de dónde
 * salió el dato — toman `{ estado, fecha_limite }` y hoy, nada más. Una fila
 * de Supabase tiene esos mismos dos campos con el mismo nombre, así que se
 * usan tal cual. Si el día de mañana el resto del sistema migra a Supabase,
 * esta es la prueba de que la lógica de negocio no hay que reescribirla.
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';
import { diasHasta, estadoCompromiso, hoyISO } from './selectores.js';

/**
 * @returns {Promise<{ proyectos: object[], compromisos: object[] }>}
 * @throws si Supabase no está configurado o la lectura falla — el llamador
 *   decide cómo mostrarlo (ver `VigentesSupabase.jsx`).
 */
export async function leerVigentesDeSupabase() {
  if (!supabaseConfigurado) {
    throw new Error(
      'Supabase no está configurado en este navegador — faltan VITE_SUPABASE_URL / ' +
        'VITE_SUPABASE_ANON_KEY en .env.local (ver .env.example).',
    );
  }

  const hoy = hoyISO();

  const [proyectosResp, compromisosResp] = await Promise.all([
    supabase
      .from('proyectos')
      .select('id, nombre, es_obra, estado_general, programa:programas(nombre, area:areas(nombre)), eje:ejes(nombre)')
      .order('nombre'),
    supabase
      .from('compromisos')
      .select('id, descripcion, responsable, estado, fecha_limite, area:areas(nombre)')
      .eq('activo', true)
      .order('fecha_limite', { nullsFirst: false }),
  ]);

  if (proyectosResp.error) throw proyectosResp.error;
  if (compromisosResp.error) throw compromisosResp.error;

  const proyectos = proyectosResp.data
    .filter((p) => p.estado_general !== 'finalizado')
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      area: p.programa?.area?.nombre ?? '',
      programa: p.programa?.nombre ?? '',
      eje: p.eje?.nombre ?? '',
      es_obra: p.es_obra,
    }));

  const compromisos = compromisosResp.data.map((c) => {
    const estado_efectivo = estadoCompromiso(c, hoy);
    const dias = diasHasta(c.fecha_limite, hoy);
    return {
      id: c.id,
      descripcion: c.descripcion,
      responsable: c.responsable,
      area: c.area?.nombre ?? '',
      fecha_limite: c.fecha_limite,
      estado_efectivo,
      dias_restantes: dias,
      dias_atraso: estado_efectivo === 'alerta' ? Math.abs(dias) : 0,
    };
  });

  return { proyectos, compromisos };
}
