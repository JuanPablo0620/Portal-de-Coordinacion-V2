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

/** Ítems crudos de un catálogo (incluye `prefijo`, `es_obra`, etc.). */
export function useItems(nombreCatalogo) {
  const catalogos = useCatalogos();
  return useMemo(
    () => (catalogos[nombreCatalogo] ?? []).filter((i) => i.activo !== false),
    [catalogos, nombreCatalogo],
  );
}

/** Busca el ítem de catálogo por nombre. Devuelve null si ya no existe. */
export function itemPorNombre(items, nombre) {
  return items.find((i) => i.nombre === nombre) ?? null;
}
