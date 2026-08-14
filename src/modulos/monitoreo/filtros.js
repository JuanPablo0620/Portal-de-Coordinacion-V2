/**
 * Filtros del módulo de monitoreo, en un módulo sin dependencias.
 *
 * Los usan `Monitoreo.jsx` —que arma la URL— y `TableroSecretarias.jsx` —que
 * dibuja la tarjeta de filtros de la grilla—. Si vivieran en el primero, el
 * segundo tendría que importarlo, y el primero ya importa al segundo: un ciclo
 * que el chequeo de `npm run verificar` rechaza, con razón.
 */

export const DEFAULTS = {
  tab: 'secretarias',
  area: '',
  periodo: '',
  desde: '',
  hasta: '',
  secretaria: '',
  buscar: '',
  monitoreo: '',
  solo_deuda: false,
  sin_cobertura: false,
  sin_resolver: false,
};

/** Lo que limpia el botón: filtros, nunca la pestaña ni la secretaría abierta. */
export const CLAVES_FILTRO = [
  'area',
  'periodo',
  'desde',
  'hasta',
  'buscar',
  'solo_deuda',
  'sin_cobertura',
  'sin_resolver',
];
