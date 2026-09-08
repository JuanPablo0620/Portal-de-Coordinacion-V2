/**
 * Store en memoria.
 *
 * Es una CACHÉ de la base, no su fuente de verdad: se hidrata desde el
 * repositorio al arrancar y se refresca cuando el repositorio notifica un
 * cambio. Los componentes leen de acá y escriben llamando al repositorio.
 */
import { create } from 'zustand';
import * as repo from '../datos/repositorio.js';
import { areasAsignadas } from '../datos/selectores.js';
import { useSesion } from './sesion.js';

export const useTienda = create((set, get) => ({
  bd: null,
  cargando: true,

  async iniciar() {
    if (get().bd) return;
    const bd = await repo.hidratar();
    // La copia superficial es lo que dispara el re-render: el repositorio muta
    // la base en su lugar, así que sin `{...}` React no vería el cambio.
    repo.suscribir((nueva) => set({ bd: { ...nueva } }));
    set({ bd: { ...bd }, cargando: false });
  },
}));

export const useBD = () => useTienda((e) => e.bd);
export const useCargando = () => useTienda((e) => e.cargando);
export const useCatalogos = () => useTienda((e) => e.bd?.catalogos ?? {});

/**
 * Quién está usando el portal.
 *
 * La fuente pasó a ser la sesión de Supabase. `config.usuario` queda como
 * respaldo para la base local que se haya cargado antes de que existiera el
 * login — es exactamente el reemplazo de fuente que anticipaba el texto de
 * Configuración («cuando se incorpore el acceso por usuario, se reemplaza la
 * fuente de este dato y nada más cambia»).
 */
export const useUsuario = () => {
  // Los dos hooks se llaman siempre, sin cortocircuito: `a() ?? b()` saltearía
  // el segundo cuando el primero tiene valor, y React exige que la cantidad de
  // hooks por render no cambie nunca.
  const deLaSesion = useSesion((e) => e.perfil?.nombre);
  const deLaBaseLocal = useTienda((e) => e.bd?.config?.usuario);
  return deLaSesion ?? deLaBaseLocal ?? 'Coordinación';
};

/**
 * Alinea la base local con la identidad real, una sola vez por cambio de nombre.
 *
 * Hacen falta dos cosas, y ninguna es cosmética:
 *
 *  1. `repositorio.js` estampa `bd.config.usuario` en `creado_por` y en la
 *     bitácora, leyéndolo directo de la base local. Sincronizarlo acá hace que
 *     esos tres lugares registren el nombre real sin tocar el repositorio.
 *
 *  2. Las áreas de «Mis áreas» están guardadas contra el nombre viejo de texto
 *     libre. Sin mudarlas, quien tenía tres secretarías elegidas abre el portal
 *     y las ve vacías, como si hubiera perdido la configuración.
 */
export async function sincronizarUsuario(nombreReal) {
  const bd = useTienda.getState().bd;
  if (!bd || !nombreReal) return;

  const anterior = bd.config?.usuario;
  if (anterior === nombreReal) return;

  if (anterior) {
    const areas = areasAsignadas(bd, anterior);
    if (areas.length) {
      await repo.guardarAsignacionesMonitoreo(nombreReal, areas);
      await repo.guardarAsignacionesMonitoreo(anterior, []);
    }
  }

  await repo.guardarConfig({ usuario: nombreReal });
}

/**
 * Acciones de escritura. Se reexporta el repositorio entero para que los
 * componentes no tengan que importarlo directamente y quede un único punto de
 * entrada de escritura desde la UI.
 */
export const acciones = repo;
