/**
 * Doble del store, sólo para la prueba de humo.
 *
 * Por qué existe: al renderizar en Node, Zustand entrega a
 * `useSyncExternalStore` el estado INICIAL de la tienda, no el actual —
 * correcto para hidratar sin desajustes, pero significa que ningún dato
 * inyectado desde afuera llega a los componentes, y todas las rutas
 * devolverían la pantalla de carga.
 *
 * Este doble expone la MISMA superficie pública que `src/estado/tienda.js` y
 * lee de una variable común, así que el render en Node ve los datos reales. Se
 * sustituye por alias de Vite durante la compilación de la prueba; el código de
 * la aplicación no se modifica ni se entera.
 */
import * as repo from '../../src/datos/repositorio.js';

let base = null;

/** Lo usa la entrada de la prueba para elegir el escenario a renderizar. */
export function establecerBD(bd) {
  base = bd;
}

export const useBD = () => base;
export const useCargando = () => false;
export const useUsuario = () => base?.config?.usuario ?? 'Coordinación';
export const useCatalogos = () => base?.catalogos ?? {};

export const useTienda = (selector) => {
  const estado = { bd: base, cargando: false, iniciar: () => {} };
  return selector ? selector(estado) : estado;
};

useTienda.getState = () => ({ bd: base, cargando: false, iniciar: () => {} });
useTienda.setState = () => {};

export const acciones = repo;
