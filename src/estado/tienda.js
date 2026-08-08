/**
 * Store en memoria.
 *
 * Es una CACHÉ de la base, no su fuente de verdad: se hidrata desde el
 * repositorio al arrancar y se refresca cuando el repositorio notifica un
 * cambio. Los componentes leen de acá y escriben llamando al repositorio.
 */
import { create } from 'zustand';
import * as repo from '../datos/repositorio.js';

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
export const useUsuario = () => useTienda((e) => e.bd?.config?.usuario ?? 'Coordinación');
export const useCatalogos = () => useTienda((e) => e.bd?.catalogos ?? {});

/**
 * Acciones de escritura. Se reexporta el repositorio entero para que los
 * componentes no tengan que importarlo directamente y quede un único punto de
 * entrada de escritura desde la UI.
 */
export const acciones = repo;
