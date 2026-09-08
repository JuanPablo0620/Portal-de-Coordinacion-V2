/**
 * ─────────────────────────────────────────────────────────────────────
 * DE CUADRAS SELECCIONADAS A TRAMOS DE CORTE.
 *
 * El usuario elige cuadras con el cursor —una por clic, las que haga falta— y
 * de ahí tiene que salir algo que se pueda leer en voz alta y mandar por
 * WhatsApp. La traducción tiene dos pasos:
 *
 *  1. **Agrupar por calle.** Cerrar la vuelta de una manzana son cuatro
 *     tramos, uno por calle, no cuatro cortes sueltos.
 *  2. **Ponerle esquinas a cada grupo.** Tres cuadras de Fischetti no son
 *     «tres cuadras de Fischetti»: son «Fischetti entre Baldini y Sabattini».
 *     Las esquinas se buscan en el callejero oficial contra las dos puntas del
 *     grupo (ver `esquinasDeTramo` en geoportal.js).
 *
 * La parte de agrupar es pura y está probada; la de resolver esquinas depende
 * del geoportal y degrada sin romper: si el servicio no contesta, el tramo se
 * describe por altura («Fischetti al 500»), que es la otra forma en que el
 * municipio nombra un lugar.
 * ─────────────────────────────────────────────────────────────────────
 */
import { esquinasDeTramo, extremosDe } from '../../datos/geoportal.js';

/** Agrupa las cuadras elegidas por calle. Puro: no consulta nada. */
export function agruparPorCalle(cuadras = []) {
  const porCalle = new Map();
  for (const cuadra of cuadras) {
    if (!cuadra?.calle) continue;
    if (!porCalle.has(cuadra.calle)) porCalle.set(cuadra.calle, []);
    porCalle.get(cuadra.calle).push(cuadra);
  }

  return [...porCalle.entries()].map(([calle, lista]) => {
    const alturas = lista.flatMap((c) => c.alturas ?? []).filter((n) => Number.isFinite(n));
    return {
      calle,
      // La localidad y el sentido son de la calle, no de cada cuadra: alcanza
      // con el primero que los tenga.
      localidad: lista.find((c) => c.localidad)?.localidad ?? '',
      sentido: lista.find((c) => c.sentido)?.sentido ?? '',
      alturas: alturas.length ? [Math.min(...alturas), Math.max(...alturas)] : [],
      fids: lista.map((c) => c.fid),
      lineas: lista.flatMap((c) => c.lineas ?? []),
      esquina_desde: '',
      esquina_hasta: '',
    };
  });
}

/** Todas las polilíneas de las cuadras elegidas, para guardar y para dibujar. */
export function geometriaDe(cuadras = []) {
  return { lineas: cuadras.flatMap((c) => c.lineas ?? []) };
}

/**
 * Los tramos ya con nombre completo. Una consulta al geoportal por punta de
 * tramo; las calles se resuelven en paralelo porque no dependen entre sí.
 */
export async function resolverTramos(cuadras = []) {
  const tramos = agruparPorCalle(cuadras);
  return Promise.all(
    tramos.map(async (tramo) => {
      const { desde, hasta } = await esquinasDeTramo(tramo.calle, extremosDe(tramo.lineas));
      // Dos puntas que resuelven a la misma esquina significa que el tramo es
      // tan corto que ambas caen en el mismo cruce: mejor dejar una sola.
      return { ...tramo, esquina_desde: desde, esquina_hasta: desde === hasta ? '' : hasta };
    }),
  );
}

/**
 * Los campos del corte que se derivan de la selección.
 *
 * `calle`, `esquina_desde` y `esquina_hasta` se guardan además sueltos, con el
 * primer tramo: son los que usan el resto del sistema y los cortes cargados
 * antes de que existiera la selección por cuadras.
 */
export function datosDeSeleccion(cuadras = [], tramos = null) {
  const grupos = tramos ?? agruparPorCalle(cuadras);
  const primero = grupos[0] ?? {};
  return {
    forma: 'tramo',
    cuadras,
    tramos: grupos,
    geometria: geometriaDe(cuadras),
    calle: primero.calle ?? '',
    esquina_desde: primero.esquina_desde ?? '',
    esquina_hasta: primero.esquina_hasta ?? '',
    localidad: primero.localidad ?? '',
    sentido: primero.sentido ?? '',
    trazado_aproximado: false,
  };
}
