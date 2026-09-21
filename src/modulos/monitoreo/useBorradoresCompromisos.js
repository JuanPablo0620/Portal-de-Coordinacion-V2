import { useCallback, useEffect, useState } from 'react';
import { acciones } from '../../estado/tienda.js';

const leer = (id) => (id ? acciones.leerBorradoresCompromisos(id) : {});

/**
 * Borradores de compromisos de UN monitoreo, persistidos en el navegador.
 *
 * Se escribe en cada cambio (no al cerrar el formulario) para que cerrar la
 * pestaña o que se corte internet a mitad de la reunión no pierda lo cargado.
 * Ver `guardarBorradoresCompromisos` en el repositorio.
 *
 * `monitoreoId` puede ser null: la pantalla llama al hook antes de crear el
 * monitoreo (paso 1). El estado guarda de qué id son sus borradores, para que
 * al aparecer el id se carguen los suyos en vez de pisarlos con el `{}` de
 * cuando todavía no había ninguno.
 */
export function useBorradoresCompromisos(monitoreoId) {
  const [estado, setEstado] = useState({ id: monitoreoId, borradores: leer(monitoreoId) });

  if (estado.id !== monitoreoId) setEstado({ id: monitoreoId, borradores: leer(monitoreoId) });

  useEffect(() => {
    if (monitoreoId && estado.id === monitoreoId) {
      acciones.guardarBorradoresCompromisos(monitoreoId, estado.borradores);
    }
  }, [monitoreoId, estado]);

  const editar = useCallback(
    (idCompromiso, parcial) =>
      setEstado((e) => ({
        ...e,
        borradores: { ...e.borradores, [idCompromiso]: { ...e.borradores[idCompromiso], ...parcial } },
      })),
    [],
  );

  const descartar = useCallback(
    (idCompromiso) =>
      setEstado((e) => {
        const { [idCompromiso]: _, ...resto } = e.borradores;
        return { ...e, borradores: resto };
      }),
    [],
  );

  return { borradores: estado.borradores, editar, descartar };
}
