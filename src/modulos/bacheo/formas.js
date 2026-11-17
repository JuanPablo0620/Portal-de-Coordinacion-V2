/**
 * Trabajos de Bacheo → formas de `MapaLeaflet`.
 *
 * El color es el tipo de trabajo (clase `bacheo-<tipo>`, tokens en
 * `index.css`). El trazo punteado dice «ubicación sin revisar»; atenuado,
 * «no se trabaja el día elegido». Son tres variables visuales distintas a
 * propósito: color, trazo y opacidad no compiten entre sí.
 */
import { aFormaMapa, verticesDe } from '../../datos/bacheo/geometria.js';
import { ETIQUETAS_TIPO } from '../../datos/bacheo/programacion.js';
import { esProvisoria } from '../../datos/bacheo/semana.js';

export function formasDeTrabajos(trabajos, { fecha = '', idClave = 'id' } = {}) {
  const formas = [];
  for (const t of trabajos) {
    const base = aFormaMapa(t.geometria);
    if (!base) continue;
    const fuera = fecha && !t.fechas.includes(fecha);
    const clases = [
      `bacheo-${t.tipo}`,
      base.tipo === 'poligono' ? 'bacheo-area' : '',
      esProvisoria(t.ubicacion) ? 'bacheo-provisoria' : '',
      fuera ? 'bacheo-atenuado' : '',
    ];
    formas.push({
      ...base,
      id: String(t[idClave]),
      clase: clases.filter(Boolean).join(' '),
      titulo: `${t.descripcion} · ${ETIQUETAS_TIPO[t.tipo] ?? t.tipo}`,
      mostrarPuntas: false,
      grosor: base.tipo === 'linea' ? 6 : undefined,
    });
  }
  // Áreas abajo, tramos y esquinas arriba: si no, un cuadrante tapa el clic de
  // la esquina que tiene adentro.
  const peso = { poligono: 0, linea: 1, punto: 2 };
  return formas.sort((a, b) => peso[a.tipo] - peso[b.tipo]);
}

/** Puntos para encuadrar el mapa en un conjunto de trabajos. */
export const encuadreDe = (trabajos) => trabajos.flatMap((t) => verticesDe(t.geometria));
