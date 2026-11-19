/**
 * Trabajos de Bacheo → formas de `MapaLeaflet`.
 *
 * El color es el tipo de trabajo (clase `bacheo-<tipo>`, tokens en
 * `index.css`). El trazo punteado dice «ubicación sin revisar»; atenuado,
 * «no se trabaja el día (o la semana) elegido». Son tres variables visuales distintas a
 * propósito: color, trazo y opacidad no compiten entre sí.
 */
import { useEffect, useState } from 'react';
import { aFormaMapa, verticesDe } from '../../datos/bacheo/geometria.js';
import { limitePartido } from '../../datos/geoportal.js';
import { ETIQUETAS_TIPO } from '../../datos/bacheo/programacion.js';
import { enFoco, esProvisoria } from '../../datos/bacheo/semana.js';

export function formasDeTrabajos(trabajos, { fecha = '', foco = null, idClave = 'id' } = {}) {
  const formas = [];
  for (const t of trabajos) {
    const base = aFormaMapa(t.geometria);
    if (!base) continue;
    const fuera = (fecha && !t.fechas.includes(fecha)) || (foco && !enFoco(t, foco));
    const clases = [
      'bacheo-trabajo',
      `bacheo-${t.tipo}`,
      base.tipo === 'poligono' ? 'bacheo-area' : '',
      base.tipo === 'punto' ? 'bacheo-punto' : '',
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

/**
 * El contorno oficial del partido (Geoportal), una vez por montaje. Mientras
 * no llega, o si el Geoportal no responde, el mapa se ve igual pero sin
 * cortina: no es un error que haya que mostrar.
 */
export function useLimitePartido() {
  const [limite, setLimite] = useState([]);
  useEffect(() => {
    let vigente = true;
    limitePartido().then((contornos) => vigente && setLimite(contornos));
    return () => {
      vigente = false;
    };
  }, []);
  return limite;
}

/**
 * Lo mismo que el mapa de cortes: una cortina blanca sobre todo lo que queda
 * fuera de Tres de Febrero y el borde del partido en navy. Va primero en la
 * lista para quedar debajo de los trabajos.
 */
export function formasDelPartido(limite) {
  if (!limite.length) return [];
  return [
    { id: null, tipo: 'mascara', puntos: limite, clase: 'corte-fuera-partido', interactiva: false },
    {
      id: null,
      tipo: 'linea',
      puntos: limite,
      clase: 'corte-limite-partido',
      grosor: 3,
      mostrarPuntas: false,
      interactiva: false,
    },
  ];
}
