/**
 * Geometría del mapa de obras: encuadre, proyección y barra de escala.
 *
 * Vive separada del componente por el mismo motivo que `rangoPeriodo.js`: es
 * lógica pura y se prueba sin montar nada. Que dos obras a un kilómetro se
 * dibujen a la distancia correcta es una afirmación verificable, y acá se
 * verifica.
 */

export const ANCHO = 1000;
export const ALTO = 620;

/** Grados de latitud a kilómetros. Constante suficiente para la barra de escala. */
export const KM_POR_GRADO = 111.32;

/** Extensión mínima del encuadre, en grados: con una obra sola, no hay «zoom infinito». */
const EXTENSION_MINIMA = 0.012;

/** Margen alrededor de los puntos, para que ninguno quede pegado al borde. */
const MARGEN = 1.18;

/**
 * Encuadre y funciones de proyección para el conjunto de puntos.
 *
 * Proyección equirectangular con corrección por coseno de la latitud: a esta
 * latitud y en un partido de doce kilómetros, el error contra una proyección
 * conforme es de centímetros en pantalla.
 *
 * El encuadre se AGRANDA hasta la proporción del lienzo, nunca se comprime el
 * otro eje: con una escala por eje, un conjunto más ancho que alto se vería
 * cuadrado y las distancias del plano mentirían.
 *
 * Devuelve `null` sin puntos: la vista muestra el estado vacío.
 */
export function encuadrar(puntos = []) {
  if (!puntos.length) return null;

  const lats = puntos.map((p) => p.latitud);
  const lons = puntos.map((p) => p.longitud);
  const latMedia = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lonMedia = (Math.min(...lons) + Math.max(...lons)) / 2;
  const k = Math.cos((latMedia * Math.PI) / 180);

  // Extensión en unidades comparables entre sí (grados de latitud).
  let alto = Math.max(Math.max(...lats) - Math.min(...lats), EXTENSION_MINIMA) * MARGEN;
  let ancho = Math.max((Math.max(...lons) - Math.min(...lons)) * k, EXTENSION_MINIMA) * MARGEN;

  const proporcion = ANCHO / ALTO;
  if (ancho / alto > proporcion) alto = ancho / proporcion;
  else ancho = alto * proporcion;

  const lat0 = latMedia - alto / 2;
  const lat1 = latMedia + alto / 2;
  const lon0 = lonMedia - ancho / (2 * k);
  const lon1 = lonMedia + ancho / (2 * k);

  return {
    x: (lon) => ((lon - lon0) / (lon1 - lon0)) * ANCHO,
    y: (lat) => ALTO - ((lat - lat0) / (lat1 - lat0)) * ALTO,
    /** Grados de latitud que abarca el alto del lienzo, para la barra de escala. */
    gradosAlto: alto,
    limites: { lat0, lat1, lon0, lon1 },
  };
}

/** Distancia redonda cuya barra mide entre 120 y 320 px de los 1000 del lienzo. */
export function escalaDe(gradosAlto) {
  const pxPorKm = ALTO / (gradosAlto * KM_POR_GRADO);
  const candidatas = [0.25, 0.5, 1, 2, 5, 10, 20];
  const km =
    candidatas.find((c) => c * pxPorKm >= 120 && c * pxPorKm <= 320) ??
    candidatas.find((c) => c * pxPorKm >= 120) ??
    candidatas[candidatas.length - 1];
  return { km, px: km * pxPorKm };
}
