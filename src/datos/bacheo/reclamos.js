/**
 * Reclamos de bacheo: leerlos del My Maps del área y cruzarlos con la
 * programación.
 *
 * La fuente es el My Maps «Obras Públicas - Caseros y Ciudadela - solo baches»
 * que le pasaron a JP (20/11/2026), el mismo que usaba el mapa de bacheo de
 * afuera del portal. Se lee en vivo y no se copia a Supabase: el área lo sigue
 * editando y una copia quedaría vieja sin que nadie se entere. Google sirve el
 * KML con `Access-Control-Allow-Origin: *`, así que no hace falta proxy.
 *
 * El id del mapa va en `VITE_MYMAPS_RECLAMOS_BACHEO` y no en el código porque
 * el repositorio es público y el historial no se borra.
 *
 * El cruce reproduce el de `actualizar_mapa_bacheo.py` (el mapa de afuera),
 * que a su vez reproduce el de la maqueta de Tomás del 02/11. Si se cambian los
 * metros, el portal y el mapa de afuera dejan de dar lo mismo:
 *  - «Con trabajo»: dentro del cuadrante, a 15 m o menos del tramo o a 25 m o
 *    menos de la esquina.
 *  - «Cerca, verificar»: hasta 50 m más allá de eso. Un reclamo ubicado por
 *    «calle, sin altura» puede caer a 40 m del bache real.
 *
 * Este archivo es lógica pura (sin DOM): el KML se lee con expresiones
 * regulares y no con DOMParser para que las pruebas corran en Node.
 */
import { aFormaMapa, contiene } from './geometria.js';

/** Metros que cuentan como «con trabajo», según la forma del trabajo. */
export const METROS_CON_TRABAJO = Object.freeze({ poligono: 0, linea: 15, punto: 25 });
/** Metros de tolerancia extra para «cerca, verificar». */
export const METROS_CERCA = 50;

export const ESTADOS_RECLAMO = Object.freeze({
  con_trabajo: 'Con trabajo programado',
  cerca: 'Cerca, a verificar',
  sin_trabajo: 'Sin trabajo en el período',
});

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function texto(crudo = '') {
  const sinCdata = crudo.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return sinCdata
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTIDADES[e])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();
}

const etiqueta = (bloque, nombre) => {
  const m = bloque.match(new RegExp(`<${nombre}>([\\s\\S]*?)</${nombre}>`));
  return m ? texto(m[1]) : '';
};

/**
 * KML del My Maps → reclamos. Solo los puntos: si alguien dibuja una línea o
 * un área en el mapa, no es un reclamo y se descarta.
 *
 * Los campos son los de la tabla del My Maps («Reclamo», «Ubicación»,
 * «Localidad», «Precisión», «Reclamos en el mismo punto», «N° de reporte»,
 * «Nota»). Si una columna cambia de nombre, el reclamo igual aparece con lo
 * que haya: el nombre del punto hace de ubicación.
 */
export function leerKmlReclamos(kml) {
  const reclamos = [];
  for (const [, bloque] of kml.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
    const punto = bloque.match(/<Point>[\s\S]*?<coordinates>\s*([-\d.]+)\s*,\s*([-\d.]+)/);
    if (!punto) continue;
    const lng = Number(punto[1]);
    const lat = Number(punto[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const datos = {};
    for (const [, nombre, cuerpo] of bloque.matchAll(/<Data name="([^"]*)">([\s\S]*?)<\/Data>/g)) {
      datos[texto(nombre).normalize('NFC').toLowerCase()] = etiqueta(cuerpo, 'value');
    }
    const nombre = etiqueta(bloque, 'name');
    const cantidad = Math.round(Number(datos['reclamos en el mismo punto']));
    reclamos.push({
      id: `reclamo-${reclamos.length + 1}`,
      ubicacion: datos['ubicación'] || nombre,
      localidad: datos.localidad ?? '',
      reclamo: datos.reclamo ?? '',
      reporte: datos['n° de reporte'] ?? '',
      precision: datos['precisión'] ?? '',
      nota: datos.nota ?? '',
      cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
      lat,
      lng,
    });
  }
  return reclamos;
}

/* Grados → metros con una proyección plana centrada en el partido. A esta
   escala (10 km) el error es de centímetros; es la misma que usa el script de
   Python, para que los dos den igual. */
const KX = 111320 * Math.cos((-34.6 * Math.PI) / 180);
const KY = 110540;
const aMetros = ({ lat, lng }) => ({ x: lng * KX, y: lat * KY });

function distanciaASegmento(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;
  const t = largo2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanciaALineas(p, lineas) {
  let minima = Infinity;
  for (const linea of lineas) {
    const m = linea.map(aMetros);
    if (m.length === 1) minima = Math.min(minima, Math.hypot(p.x - m[0].x, p.y - m[0].y));
    for (let i = 1; i < m.length; i++) minima = Math.min(minima, distanciaASegmento(p, m[i - 1], m[i]));
  }
  return minima;
}

/** Distancia en metros del reclamo a la forma del trabajo (0 si cae adentro de un área). */
export function distanciaATrabajo(reclamo, geometria) {
  const forma = aFormaMapa(geometria);
  if (!forma) return null;
  const p = aMetros(reclamo);
  if (forma.tipo === 'punto') {
    const q = aMetros(forma.puntos);
    return { forma: 'punto', metros: Math.hypot(p.x - q.x, p.y - q.y) };
  }
  if (forma.tipo === 'poligono') {
    if (contiene(forma.puntos, reclamo)) return { forma: 'poligono', metros: 0 };
    return { forma: 'poligono', metros: distanciaALineas(p, forma.puntos) };
  }
  return { forma: 'linea', metros: distanciaALineas(p, forma.puntos) };
}

/**
 * Cada reclamo con su estado y los trabajos que lo alcanzan, del más firme al
 * más dudoso. Los trabajos sin ubicar no cruzan con nada.
 *
 * @returns {Array<object & { estado: string, trabajos: Array<{ id, estado, metros }> }>}
 */
export function cruzarReclamos(reclamos, trabajos) {
  return reclamos.map((r) => {
    const alcanzan = [];
    for (const t of trabajos) {
      const d = distanciaATrabajo(r, t.geometria);
      if (!d) continue;
      const tope = METROS_CON_TRABAJO[d.forma];
      if (d.metros <= tope) alcanzan.push({ id: t.id, estado: 'con_trabajo', metros: Math.round(d.metros) });
      else if (d.metros <= tope + METROS_CERCA) alcanzan.push({ id: t.id, estado: 'cerca', metros: Math.round(d.metros) });
    }
    alcanzan.sort((a, b) => (a.estado === b.estado ? a.metros - b.metros : a.estado === 'con_trabajo' ? -1 : 1));
    return { ...r, estado: alcanzan[0]?.estado ?? 'sin_trabajo', trabajos: alcanzan };
  });
}

/** Cuántos reclamos (sumando los que comparten punto) hay en cada estado. */
export function resumenReclamos(cruzados) {
  const resumen = { total: 0, con_trabajo: 0, cerca: 0, sin_trabajo: 0 };
  for (const r of cruzados) {
    resumen.total += r.cantidad;
    resumen[r.estado] += r.cantidad;
  }
  return resumen;
}

/**
 * Por trabajo: cuántos reclamos le caen encima y cuántos cerca. Un reclamo que
 * alcanza a dos trabajos (una esquina dentro de un cuadrante) cuenta en los dos:
 * la pregunta del panel es «¿este trabajo atiende reclamos?».
 */
export function reclamosPorTrabajo(cruzados) {
  const porTrabajo = new Map();
  for (const r of cruzados) {
    for (const t of r.trabajos) {
      const cuenta = porTrabajo.get(t.id) ?? { con_trabajo: 0, cerca: 0 };
      cuenta[t.estado] += r.cantidad;
      porTrabajo.set(t.id, cuenta);
    }
  }
  return porTrabajo;
}
