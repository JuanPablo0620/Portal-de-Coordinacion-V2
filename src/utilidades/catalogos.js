/**
 * Lectura de catálogos para los selectores de formulario.
 *
 * Los catálogos administrables guardan `{ id, nombre }`, pero los registros
 * guardan el NOMBRE, no el id: así un reporte exportado a CSV se lee sin tener
 * que resolver ids, y una baja de catálogo no deja registros apuntando al vacío.
 */
import { useMemo } from 'react';
import { useCatalogos } from '../estado/tienda.js';

/** Opciones `{ valor, titulo }` de un catálogo administrable, sólo activas. */
export function useOpciones(nombreCatalogo) {
  const catalogos = useCatalogos();
  return useMemo(() => {
    const items = catalogos[nombreCatalogo] ?? [];
    return items.filter((i) => i.activo !== false).map((i) => ({ valor: i.nombre, titulo: i.nombre, ...i }));
  }, [catalogos, nombreCatalogo]);
}

/**
 * Programas de una secretaría, para los selectores que dependen del área.
 *
 * Cada programa pertenece a UNA secretaría —está en el glosario de la
 * Dirección— así que ofrecer los sesenta y uno cuando ya se eligió el área es
 * ofrecer sesenta opciones que van a dar vacío o, peor, colgar el proyecto de
 * la secretaría equivocada.
 *
 * Sin área elegida se devuelven todos: es el estado «Todas» del filtro.
 */
export function useOpcionesPrograma(area) {
  const todos = useOpciones('programas');
  return useMemo(() => (area ? todos.filter((o) => o.area === area) : todos), [todos, area]);
}

/** Área que sólo corresponde al rol organizador de un evento. Mientras el
 * catálogo remoto se actualiza, se agrega sin convertirla en área de proyecto. */
export function conSecretariaGeneral(opciones) {
  if (opciones.some((opcion) => opcion.valor === 'Secretaría General')) return opciones;
  return [...opciones, { valor: 'Secretaría General', titulo: 'Secretaría General' }];
}

/** Ítems crudos de un catálogo (incluye `prefijo`, `es_obra`, etc.). */
export function useItems(nombreCatalogo) {
  const catalogos = useCatalogos();
  return useMemo(
    () => (catalogos[nombreCatalogo] ?? []).filter((i) => i.activo !== false),
    [catalogos, nombreCatalogo],
  );
}
