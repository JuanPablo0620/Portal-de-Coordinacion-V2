/**
 * Geometría de los trabajos de Bacheo: la frontera entre GeoJSON y Leaflet.
 *
 * En la base van en GeoJSON (`[lng, lat]`), que es el formato que lee cualquier
 * herramienta —QGIS, el Geoportal, un script de Python— sin conversión. El mapa
 * del portal trabaja con `{ lat, lng }`. Mezclar los dos órdenes es el error
 * clásico (el punto aparece en el océano Índico); por eso la conversión vive
 * solo acá.
 */

const aGeo = ({ lat, lng }) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
const aLL = ([lng, lat]) => ({ lat, lng });

export const deLeaflet = Object.freeze({
  punto: (p) => ({ type: 'Point', coordinates: aGeo(p) }),
  lineas: (lineas) =>
    lineas.length === 1
      ? { type: 'LineString', coordinates: lineas[0].map(aGeo) }
      : { type: 'MultiLineString', coordinates: lineas.map((l) => l.map(aGeo)) },
  poligono: (anillo) => {
    const cerrado = [...anillo.map(aGeo)];
    const [a, z] = [cerrado[0], cerrado.at(-1)];
    if (a[0] !== z[0] || a[1] !== z[1]) cerrado.push(a);
    return { type: 'Polygon', coordinates: [cerrado] };
  },
});

/**
 * GeoJSON → la forma que dibuja `MapaLeaflet`.
 * @returns {{ tipo: 'punto'|'linea'|'poligono', puntos: any } | null}
 */
export function aFormaMapa(geometria) {
  if (!geometria) return null;
  const c = geometria.coordinates;
  switch (geometria.type) {
    case 'Point':
      return { tipo: 'punto', puntos: aLL(c) };
    case 'LineString':
      return { tipo: 'linea', puntos: [c.map(aLL)] };
    case 'MultiLineString':
      return { tipo: 'linea', puntos: c.map((l) => l.map(aLL)) };
    case 'Polygon':
      return { tipo: 'poligono', puntos: c.map((anillo) => anillo.map(aLL)) };
    case 'MultiPolygon':
      return { tipo: 'poligono', puntos: c.map((p) => p[0].map(aLL)) };
    default:
      return null;
  }
}

/** Todos los vértices de una geometría, en `{ lat, lng }`: para encuadrar el mapa. */
export function verticesDe(geometria) {
  const forma = aFormaMapa(geometria);
  if (!forma) return [];
  return forma.tipo === 'punto' ? [forma.puntos] : forma.puntos.flat();
}

export function centroDe(puntos) {
  if (!puntos.length) return { lat: 0, lng: 0 };
  return {
    lat: puntos.reduce((s, p) => s + p.lat, 0) / puntos.length,
    lng: puntos.reduce((s, p) => s + p.lng, 0) / puntos.length,
  };
}

/** Envolvente convexa (cadena monótona de Andrew). Devuelve el anillo sin cerrar. */
export function cascoConvexo(puntos) {
  const unicos = [...new Map(puntos.map((p) => [`${p.lat.toFixed(6)},${p.lng.toFixed(6)}`, p])).values()];
  if (unicos.length < 3) return unicos;
  const pts = unicos.sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  const cruz = (o, a, b) => (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
  const inferior = [];
  for (const p of pts) {
    while (inferior.length >= 2 && cruz(inferior.at(-2), inferior.at(-1), p) <= 0) inferior.pop();
    inferior.push(p);
  }
  const superior = [];
  for (const p of [...pts].reverse()) {
    while (superior.length >= 2 && cruz(superior.at(-2), superior.at(-1), p) <= 0) superior.pop();
    superior.push(p);
  }
  return inferior.slice(0, -1).concat(superior.slice(0, -1));
}

/** ¿El punto cae dentro de alguno de los contornos? (par/impar por rayo) */
export function contiene(contornos, { lat, lng }) {
  return contornos.some((anillo) => {
    let dentro = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const a = anillo[i];
      const b = anillo[j];
      if (a.lat > lat !== b.lat > lat && lng < ((b.lng - a.lng) * (lat - a.lat)) / (b.lat - a.lat) + a.lng) {
        dentro = !dentro;
      }
    }
    return dentro;
  });
}
