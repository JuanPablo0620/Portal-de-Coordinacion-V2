/**
 * ─────────────────────────────────────────────────────────────────────
 * GEOPORTAL MUNICIPAL — cartografía oficial de Tres de Febrero.
 *
 * `https://geoportal.tresdefebrero.gob.ar/` corre GeoNode sobre GeoServer y
 * publica 56 capas del partido sin autenticación. De acá sale la precisión de
 * los cortes de calle: en vez de dibujarlos a mano, se eligen la calle y las
 * dos esquinas de la lista OFICIAL —3.885 intersecciones, cada una con el
 * nombre de las dos calles que la forman— y el tramo se arma con los segmentos
 * reales del callejero.
 *
 * ── Se consulta por WFS DESDE EL NAVEGADOR, pero a través de un proxy de
 * mismo origen, no directo. El geoportal manda DOS veces el header
 * `access-control-allow-origin: *` —lo agregan GeoServer y el nginx que tiene
 * delante— y el navegador rechaza la respuesta justamente por eso: «contains
 * multiple values '*, *', but only one is allowed». Con `curl` no se nota,
 * porque es una regla del navegador y no del servidor; se descubrió recién al
 * probar el módulo en Chrome.
 *
 * Por eso las consultas van a `/geo/...`, que reescriben el proxy de Vite en
 * desarrollo y el rewrite de `vercel.json` en producción. Al ser mismo origen
 * no hay CORS que chequear y el header duplicado deja de importar. Si algún día
 * el geoportal corrige el header, esto sigue funcionando igual.
 *
 * Las TESELAS del WMS, en cambio, van directo: son `<img>`, no `fetch`, y las
 * imágenes no pasan por el chequeo de CORS. Así el proxy no carga con el
 * tráfico de mapas, que es el pesado.
 *
 * ── Dos trampas de coordenadas, que son la fuente de todo bug en este archivo:
 *
 *  1. La RESPUESTA es GeoJSON, y GeoJSON es `[longitud, latitud]`.
 *  2. El FILTRO CQL usa el orden del CRS declarado, y EPSG:4326 es
 *     `lat lon` — o sea `POINT(lat lon)`, al revés que la respuesta.
 *     Con `POINT(lon lat)` la consulta no falla: devuelve cero resultados,
 *     que es peor.
 *
 * Todo lo que sale de este módulo hacia el resto del sistema está ya en
 * `{ lat, lng }`, el orden de Leaflet. La conversión vive acá y en ningún otro
 * lado.
 *
 * ── El geoportal es de otra dirección y puede caerse. Ninguna función de acá
 * lanza: devuelven vacío y el módulo de mapa sigue andando con lo que el corte
 * ya tiene guardado (sus propias coordenadas y el texto de las calles), que es
 * justamente por qué se guardan duplicados.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ruta de datos: pasa por el proxy de mismo origen (ver la cabecera). */
const OWS = import.meta.env?.VITE_GEOPORTAL_OWS ?? '/geo/gs/ows';

/** Ruta de teselas: directa, porque las imágenes no pasan por CORS. */
const OWS_DIRECTO =
  import.meta.env?.VITE_GEOPORTAL_WMS ?? 'https://geoportal.tresdefebrero.gob.ar/gs/ows';

/** Capa de líneas de calle: un registro por cuadra, con altura y sentido. */
const CAPA_CALLEJERO = 'geonode:callejero_normalizado';
/** Capa de esquinas: un punto por intersección, con las dos calles. */
const CAPA_ESQUINAS = 'geonode:intersecciones_callejero';

/** Capa base opcional del mapa, servida por WMS. */
export const WMS_OWS = OWS_DIRECTO;
export const WMS_CAPA_BASE = 'geonode:callejero_base';

/**
 * Capas que responden "a quién hay que avisar". El campo de geometría cambia
 * entre capas (`geometry` en unas, `the_geom` en otras) y el nombre del atributo
 * legible también: no hay convención, hay que declararlo capa por capa.
 */
export const CAPAS_CONTEXTO = Object.freeze([
  {
    clave: 'colectivos',
    titulo: 'Recorridos de colectivo',
    capa: 'geonode:Recorridos_de_colectivos_DPE_OD',
    geom: 'geometry',
    campos: ['LINEA', 'RAMAL'],
    // Una línea aparece una vez por ramal y sentido: sin agrupar, una avenida
    // devuelve cuarenta y tres filas que son ocho líneas.
    etiqueta: (p) => {
      const numero = String(p.LINEA ?? '').replace(/^0+/, '').trim();
      // Hay recorridos cargados sin número. Un «Línea s/d» en el aviso no le
      // sirve a nadie: es ruido con forma de dato.
      return numero ? `Línea ${numero}` : null;
    },
    area: 'Movilidad y Transporte',
  },
  {
    clave: 'escuelas',
    titulo: 'Puertas de escuela',
    capa: 'geonode:Puertas_Escolares',
    geom: 'the_geom',
    campos: ['ESCUELA'],
    etiqueta: (p) => p.ESCUELA || null,
    area: 'Capital Humano',
  },
  {
    clave: 'salud',
    titulo: 'Centros de salud',
    capa: 'geonode:centros_de_atencion_primaria',
    geom: 'the_geom',
    campos: ['DEPENDENCI', 'DIRECCION'],
    etiqueta: (p) => p.DEPENDENCI || null,
    area: 'Salud',
  },
  {
    clave: 'pesado',
    titulo: 'Red de tránsito pesado',
    capa: 'geonode:RED_DE_TRANSITO_PESADO',
    geom: 'the_geom',
    campos: ['NOMBRE'],
    etiqueta: (p) => p.NOMBRE || null,
    area: 'Movilidad y Transporte',
  },
  {
    clave: 'comisarias',
    titulo: 'Comisarías y destacamentos',
    capa: 'geonode:Comisarias_3F',
    geom: 'geometry',
    campos: ['Comisarias'],
    etiqueta: (p) => p.Comisarias || null,
    area: 'Seguridad',
  },
]);

/* ── Transporte ─────────────────────────────────────────────────────── */

const MILISEGUNDOS_LIMITE = 9000;

/**
 * Caché de proceso. El callejero no cambia mientras alguien carga un corte, y
 * las mismas consultas se repiten muchísimo: elegir una calle vuelve a pedir
 * sus esquinas cada vez que el formulario re-renderiza.
 */
const cache = new Map();

/** Última falla de red, para que la interfaz pueda decir que el servicio no responde. */
let ultimoError = null;
export const errorGeoportal = () => ultimoError;

async function wfs(capa, { filtro, campos, limite = 500, geom } = {}) {
  const parametros = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    typeNames: capa,
    count: String(limite),
  });
  // `propertyName` recorta la respuesta, pero si se omite la geometría el
  // servicio la deja fuera y las features vuelven sin `geometry`.
  if (campos?.length) parametros.set('propertyName', [...campos, geom ?? 'geometry'].join(','));
  if (filtro) parametros.set('CQL_FILTER', filtro);

  const url = `${OWS}?${parametros}`;
  if (cache.has(url)) return cache.get(url);

  try {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), MILISEGUNDOS_LIMITE);
    const respuesta = await fetch(url, { signal: control.signal });
    clearTimeout(reloj);
    if (!respuesta.ok) throw new Error(`El geoportal respondió ${respuesta.status}`);
    const datos = await respuesta.json();
    const features = Array.isArray(datos?.features) ? datos.features : [];
    cache.set(url, features);
    ultimoError = null;
    return features;
  } catch (error) {
    ultimoError = error.name === 'AbortError' ? new Error('El geoportal tardó demasiado en responder.') : error;
    return [];
  }
}

/** Escapa una comilla simple para meter un nombre propio dentro de un filtro CQL. */
const cql = (texto) => String(texto).replace(/'/g, "''");

/**
 * Localidad como nombre propio.
 *
 * El callejero las carga con mayúsculas inconsistentes —«caseros norte» conviviendo
 * con «Santos Lugares»— y esto termina impreso en un aviso que se manda a otra
 * secretaría. Se corrige la presentación, no el dato de origen.
 */
function nombrePropio(texto) {
  if (!texto) return '';
  return String(texto)
    .toLocaleLowerCase('es')
    .split(/\s+/)
    .map((palabra) => (palabra.length > 2 ? palabra[0].toLocaleUpperCase('es') + palabra.slice(1) : palabra))
    .join(' ');
}

/* ── Geometría ──────────────────────────────────────────────────────── */

/** GeoJSON `[lon, lat]` → `{ lat, lng }` de Leaflet. Ver la cabecera. */
const aLatLng = ([lng, lat]) => ({ lat, lng });

/**
 * Aplana cualquier geometría de línea a un array de polilíneas.
 * El callejero publica `MultiLineString`, pero una capa puede traer `LineString`.
 */
function lineasDe(geometria) {
  if (!geometria) return [];
  if (geometria.type === 'LineString') return [geometria.coordinates.map(aLatLng)];
  if (geometria.type === 'MultiLineString') return geometria.coordinates.map((l) => l.map(aLatLng));
  return [];
}

/** Metros entre dos puntos. Equirectangular con corrección por latitud: a esta
 *  escala —un partido de doce kilómetros— el error es despreciable. */
export function metrosEntre(a, b) {
  const RADIO = 6371000;
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.round(Math.sqrt(x * x + y * y) * RADIO);
}

/** Largo total de una lista de polilíneas, en metros. */
export function largoDe(lineas = []) {
  let total = 0;
  for (const linea of lineas) {
    for (let i = 1; i < linea.length; i += 1) total += metrosEntre(linea[i - 1], linea[i]);
  }
  return total;
}

/* ── Cuadras: la unidad con la que se arma un corte ─────────────────── */

/**
 * Las cuadras visibles en el mapa, para poder seleccionarlas con el cursor.
 *
 * El callejero publica **una fila por cuadra** —con su nombre de calle, el
 * rango de alturas y el sentido de circulación—, así que la unidad que el
 * municipio ya usa para describir una calle es exactamente la que se hace
 * clickeable. No hay que inventar ninguna división propia.
 *
 * Se pide sólo lo que entra en pantalla: el partido tiene 6.787 cuadras y
 * traerlas todas sería un par de megabytes para dibujar veinte. `BBOX` va en
 * orden `lat lon`, igual que `POINT` — ver la cabecera del archivo.
 *
 * @param {object} area  `{ norte, sur, este, oeste }` en grados.
 */
export async function cuadrasEn({ norte, sur, este, oeste }, { limite = 700 } = {}) {
  const features = await wfs(CAPA_CALLEJERO, {
    filtro: `BBOX(geometry, ${sur}, ${oeste}, ${norte}, ${este})`,
    campos: ['nombre_cal', 'alt_min_norm', 'alt_max_norm', 'localidad', 'sen_circ_v'],
    limite,
  });
  return features
    .map((f) => {
      const p = f.properties ?? {};
      const lineas = lineasDe(f.geometry);
      if (!p.nombre_cal || !lineas.length) return null;
      return {
        fid: p.fid,
        calle: p.nombre_cal,
        localidad: nombrePropio(p.localidad),
        sentido: p.sen_circ_v ?? '',
        alturas: [p.alt_min_norm ?? null, p.alt_max_norm ?? null],
        lineas,
      };
    })
    .filter(Boolean);
}

/** Los dos puntos más separados de un conjunto de polilíneas: las puntas del tramo. */
export function extremosDe(lineas = []) {
  const puntos = lineas.flat();
  if (puntos.length < 2) return puntos.length ? [puntos[0], puntos[0]] : [];
  let mejor = [puntos[0], puntos[1]];
  let mayor = -1;
  // Cuadrático a propósito: son las puntas de un puñado de cuadras, nunca más
  // de unas decenas de puntos. Un algoritmo de envolvente convexa acá sería
  // más código para el mismo resultado.
  for (let i = 0; i < puntos.length; i += 1) {
    for (let j = i + 1; j < puntos.length; j += 1) {
      const distancia = metrosEntre(puntos[i], puntos[j]);
      if (distancia > mayor) {
        mayor = distancia;
        mejor = [puntos[i], puntos[j]];
      }
    }
  }
  return mejor;
}

/**
 * Con qué calles cruza cada punta de un tramo.
 *
 * Es lo que convierte «tres cuadras seleccionadas de Fischetti» en «Fischetti
 * entre Baldini y Sabattini», que es como se dice un corte en voz alta y como
 * hay que escribirlo en el aviso. Se busca la esquina oficial más cercana a
 * cada punta, exigiendo que sea una esquina DE esa calle: sin ese filtro, la
 * punta de un tramo largo puede caer más cerca de un cruce de la calle de al
 * lado.
 */
export async function esquinasDeTramo(calle, [puntaA, puntaB] = []) {
  if (!calle || !puntaA || !puntaB) return { desde: '', hasta: '' };

  const buscar = async (punta) => {
    const features = await wfs(CAPA_ESQUINAS, {
      filtro: `DWITHIN(geometry, POINT(${punta.lat} ${punta.lng}), 90, meters) AND (nombre_cal='${cql(
        calle,
      )}' OR nombre_cal_2='${cql(calle)}')`,
      limite: 20,
    });
    const candidatas = features.filter((f) => f.geometry?.coordinates).map((f) => esquinaDe(f, calle));
    if (!candidatas.length) return '';
    let mejor = '';
    let menor = Infinity;
    for (const esquina of candidatas) {
      const distancia = metrosEntre(punta, esquina.punto);
      if (distancia < menor) {
        menor = distancia;
        mejor = esquina.cruce;
      }
    }
    return mejor;
  };

  const [desde, hasta] = await Promise.all([buscar(puntaA), buscar(puntaB)]);
  return { desde, hasta };
}

/* ── Calles y esquinas ──────────────────────────────────────────────── */

/**
 * Nombres de calle que coinciden con lo tipeado, para el autocompletado.
 *
 * Devuelve nombres ÚNICOS: el callejero tiene una fila por cuadra, así que una
 * avenida larga aparece cien veces con el mismo nombre.
 */
export async function buscarCalles(texto, { limite = 12 } = {}) {
  const busqueda = texto.trim();
  if (busqueda.length < 3) return [];
  const features = await wfs(CAPA_CALLEJERO, {
    filtro: `nombre_cal ILIKE '%${cql(busqueda)}%'`,
    campos: ['nombre_cal', 'localidad'],
    limite: 800,
  });
  const porNombre = new Map();
  for (const f of features) {
    const nombre = f.properties?.nombre_cal;
    if (!nombre) continue;
    if (!porNombre.has(nombre)) porNombre.set(nombre, new Set());
    if (f.properties.localidad) porNombre.get(nombre).add(nombrePropio(f.properties.localidad));
  }
  return [...porNombre.entries()]
    .map(([nombre, localidades]) => ({ nombre, localidades: [...localidades].sort() }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limite);
}

/** Una esquina, ya normalizada: dónde está y con qué calle cruza. */
const esquinaDe = (f, calle) => {
  const p = f.properties ?? {};
  const a = p.nombre_cal ?? '';
  const b = p.nombre_cal_2 ?? '';
  // La capa no dice cuál de las dos es "la calle" y cuál "la transversal": eso
  // depende de qué calle se eligió, así que el cruce es la otra.
  const cruce = calle && a === calle ? b : a === calle ? b : a;
  return {
    fid: p.fid,
    calles: [a, b],
    cruce: cruce || b || a,
    punto: aLatLng(f.geometry.coordinates),
  };
};

/** Todas las esquinas de una calle, ordenadas para que la lista sea recorrible. */
export async function esquinasDeCalle(calle) {
  if (!calle) return [];
  const nombre = cql(calle);
  const features = await wfs(CAPA_ESQUINAS, {
    filtro: `nombre_cal='${nombre}' OR nombre_cal_2='${nombre}'`,
    limite: 400,
  });
  const esquinas = features.filter((f) => f.geometry?.coordinates).map((f) => esquinaDe(f, calle));
  if (esquinas.length < 2) return esquinas;
  // Se ordenan a lo largo de la calle, no alfabéticamente: la lista tiene que
  // leerse como se recorre la cuadra. Se proyecta cada esquina sobre el eje que
  // más varía —una calle norte-sur ordena por latitud, una este-oeste por
  // longitud— que es exacto para una calle recta y razonable para el resto.
  const lats = esquinas.map((e) => e.punto.lat);
  const lngs = esquinas.map((e) => e.punto.lng);
  const rangoLat = Math.max(...lats) - Math.min(...lats);
  const rangoLng = Math.max(...lngs) - Math.min(...lngs);
  const eje = rangoLat >= rangoLng ? 'lat' : 'lng';
  return esquinas.sort((a, b) => a.punto[eje] - b.punto[eje]);
}

/**
 * La esquina oficial más cercana a un punto del mapa. Es el "imán" del modo
 * dibujo: se hace clic más o menos donde va el corte y el corte queda en la
 * intersección real, con los nombres bien escritos.
 */
export async function esquinaMasCercana({ lat, lng }, { radio = 200 } = {}) {
  const features = await wfs(CAPA_ESQUINAS, {
    // Ojo: POINT(lat lon), ver la cabecera del archivo.
    filtro: `DWITHIN(geometry, POINT(${lat} ${lng}), ${radio}, meters)`,
    limite: 40,
  });
  const candidatas = features.filter((f) => f.geometry?.coordinates).map((f) => esquinaDe(f, null));
  if (!candidatas.length) return null;
  let mejor = null;
  let mejorDistancia = Infinity;
  for (const esquina of candidatas) {
    const distancia = metrosEntre({ lat, lng }, esquina.punto);
    if (distancia < mejorDistancia) {
      mejor = esquina;
      mejorDistancia = distancia;
    }
  }
  return { ...mejor, distancia: mejorDistancia };
}

/**
 * El tramo de calle entre dos esquinas, siguiendo el trazado real.
 *
 * Se piden los segmentos de esa calle y se conservan los que caen dentro del
 * rectángulo que forman las dos esquinas. Es una aproximación deliberada: la
 * alternativa exacta —recorrer el grafo de la calle de una esquina a la otra—
 * no cambia el dibujo en una cuadrícula y sí agrega bastante código.
 *
 * Sin segmentos (calle mal escrita, servicio caído, dos esquinas de calles
 * distintas) devuelve la recta entre los dos puntos, marcada con `aproximado`
 * para que la interfaz pueda decirlo.
 */
export async function tramoEntre(calle, esquinaA, esquinaB) {
  const recta = { lineas: [[esquinaA, esquinaB]], aproximado: true };
  if (!calle) return recta;

  const features = await wfs(CAPA_CALLEJERO, {
    filtro: `nombre_cal='${cql(calle)}'`,
    campos: ['nombre_cal', 'sen_circ_v', 'localidad'],
    limite: 400,
  });
  if (!features.length) return recta;

  // Margen de veinte metros: sin él, un segmento que arranca exactamente en la
  // esquina puede quedar afuera por el redondeo de la coordenada.
  const margen = 0.0002;
  const minLat = Math.min(esquinaA.lat, esquinaB.lat) - margen;
  const maxLat = Math.max(esquinaA.lat, esquinaB.lat) + margen;
  const minLng = Math.min(esquinaA.lng, esquinaB.lng) - margen;
  const maxLng = Math.max(esquinaA.lng, esquinaB.lng) + margen;
  const dentro = (p) => p.lat >= minLat && p.lat <= maxLat && p.lng >= minLng && p.lng <= maxLng;

  const lineas = [];
  let sentido = null;
  let localidad = null;
  for (const f of features) {
    for (const linea of lineasDe(f.geometry)) {
      // Basta con que el segmento esté contenido: uno que sale del rectángulo es
      // de otra cuadra de la misma calle.
      if (linea.length && linea.every(dentro)) {
        lineas.push(linea);
        sentido = sentido ?? f.properties?.sen_circ_v ?? null;
        localidad = localidad ?? nombrePropio(f.properties?.localidad) ?? null;
      }
    }
  }
  if (!lineas.length) return recta;
  return { lineas, aproximado: false, sentido, localidad };
}

/** Localidad que le corresponde a un punto, según el callejero. */
export async function localidadDe({ lat, lng }) {
  const features = await wfs(CAPA_CALLEJERO, {
    filtro: `DWITHIN(geometry, POINT(${lat} ${lng}), 150, meters)`,
    campos: ['localidad'],
    limite: 5,
  });
  return nombrePropio(features.find((f) => f.properties?.localidad)?.properties?.localidad);
}

/* ── Contexto: a quién hay que avisar ───────────────────────────────── */

/**
 * Qué hay alrededor de un corte, capa por capa.
 *
 * Consulta desde el punto medio del corte con un radio que crece con el largo
 * del tramo: un corte de una cuadra afecta su cuadra, uno de diez afecta más.
 */
export async function contextoDe(lineas, { radio } = {}) {
  const puntos = lineas.flat();
  if (!puntos.length) return [];
  const centro = {
    lat: puntos.reduce((s, p) => s + p.lat, 0) / puntos.length,
    lng: puntos.reduce((s, p) => s + p.lng, 0) / puntos.length,
  };
  const alcance = radio ?? Math.min(600, Math.max(150, Math.round(largoDe(lineas) / 2) + 120));

  const resultados = await Promise.all(
    CAPAS_CONTEXTO.map(async (capa) => {
      const features = await wfs(capa.capa, {
        filtro: `DWITHIN(${capa.geom}, POINT(${centro.lat} ${centro.lng}), ${alcance}, meters)`,
        campos: capa.campos,
        limite: 120,
        geom: capa.geom,
      });
      const etiquetas = [...new Set(features.map((f) => capa.etiqueta(f.properties ?? {})).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, 'es', { numeric: true }),
      );
      return { ...capa, etiquetas, cantidad: etiquetas.length };
    }),
  );
  return resultados.filter((r) => r.cantidad > 0);
}
