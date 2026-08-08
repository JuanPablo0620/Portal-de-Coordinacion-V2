/**
 * Filtros persistentes en la URL.
 *
 * Regla del sistema: los filtros aplicados se mantienen al navegar dentro de un
 * módulo y se reflejan en la URL, de modo que una vista filtrada se comparte
 * pegando el enlace.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * @param {object} defaults valores por defecto; los que coinciden no se escriben
 *   en la URL, para que quede corta y legible.
 */
export function useFiltrosUrl(defaults = {}) {
  const [params, setParams] = useSearchParams();

  const filtros = useMemo(() => {
    const resultado = { ...defaults };
    for (const [clave, valor] of params.entries()) {
      // Los booleanos viajan como "1"/"0" para no ensuciar la URL.
      if (typeof defaults[clave] === 'boolean') resultado[clave] = valor === '1';
      else resultado[clave] = valor;
    }
    return resultado;
    // `defaults` es un literal nuevo en cada render; se serializa para comparar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, JSON.stringify(defaults)]);

  const setFiltros = useCallback(
    (cambios) => {
      setParams(
        (previos) => {
          const nuevos = new URLSearchParams(previos);
          for (const [clave, valor] of Object.entries(cambios)) {
            const esVacio = valor === '' || valor === null || valor === undefined;
            const esDefault = defaults[clave] !== undefined && valor === defaults[clave];
            if (esVacio || esDefault) nuevos.delete(clave);
            else if (typeof valor === 'boolean') nuevos.set(clave, valor ? '1' : '0');
            else nuevos.set(clave, String(valor));
          }
          return nuevos;
        },
        { replace: true },
      );
    },
    [setParams, defaults],
  );

  const limpiar = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);

  return [filtros, setFiltros, limpiar];
}

/** Cuenta los filtros efectivamente aplicados, para mostrarlo en la interfaz. */
export function contarFiltros(filtros, defaults = {}) {
  return Object.entries(filtros).filter(([clave, valor]) => {
    if (valor === '' || valor === null || valor === undefined || valor === false) return false;
    return valor !== defaults[clave];
  }).length;
}
