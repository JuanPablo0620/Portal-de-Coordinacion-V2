/**
 * Ubica en el mapa los trabajos de una programación de Bacheo.
 *
 * Es la versión del portal de `analisis/mapas-seguridad-bacheo/actualizar_mapa_bacheo.py`
 * (workspace de Coordinación), que se usó para la semana del 16/11/2026. El
 * orden de intento es el mismo:
 *
 *  1. Si el lugar ya se ubicó y revisó otra semana (`bacheo_lugares`), se reusa
 *     esa geometría. Los cuadrantes se repiten mucho: en noviembre, 10 de 22
 *     trabajos estaban en lugares de la semana anterior.
 *  2. Si no, se resuelve contra el callejero oficial: cuadrante → polígono con
 *     las esquinas de sus calles; tramo → calle entre dos esquinas; esquina →
 *     punto.
 *  3. Lo que no cierra queda «sin ubicar» para marcarlo a mano. Nunca se
 *     inventa una ubicación: una aproximada se marca como tal y lo dice.
 *
 * Las geometrías se guardan en GeoJSON (`[lng, lat]`), que es lo que entiende
 * cualquier herramienta que lea la base después. Leaflet usa `{ lat, lng }`: la
 * conversión está en `geometria.js` y solo ahí.
 */
import {
  callesQueCoinciden,
  esquinasDeCalle,
  localidadesDelPartido,
  metrosEntre,
  tramoEntre,
} from '../geoportal.js';
import { clasificarDescripcion, claveLugar, elegirCalle, patronesDeBusqueda } from './nombresCalle.js';
import { centroDe, cascoConvexo, contiene, deLeaflet } from './geometria.js';
import { clave } from './tablaProgramacion.js';

/** Si el extremo de un tramo no cruza la calle (corre paralela), hasta dónde se
 * acepta cortar el tramo «a la altura» de la otra. */
const TOPE_APROXIMADO_M = 150;

/** Una esquina repetida de un cuadrante más lejos que esto del resto es de otra
 * parte del partido (calles homónimas). */
const RADIO_CUADRANTE_M = 1500;

let localidades = null;
async function poligonoLocalidad(nombre) {
  if (!localidades) localidades = await localidadesDelPartido();
  const k = clave(nombre);
  return localidades.find((l) => clave(l.nombre) === k) ?? localidades.find((l) => k && clave(l.nombre).startsWith(k)) ?? null;
}

const memoNombres = new Map();
/** Nombre oficial de una calle de la planilla, o null. */
export async function nombreOficial(texto, localidad) {
  const k = `${clave(texto)}|${clave(localidad)}`;
  if (memoNombres.has(k)) return memoNombres.get(k);
  /*
   * Tres intentos, de más preciso a más amplio:
   *  1. todas las palabras;
   *  2. con la «n» como comodín, por si el nombre oficial tiene «ñ»;
   *  3. solo la palabra más larga, por si la planilla trae una palabra que el
   *     nombre oficial no tiene.
   */
  const intentos = [patronesDeBusqueda(texto), patronesDeBusqueda(texto, { comodinEnN: true })];
  const larga = [...intentos[0]].sort((a, b) => b.length - a.length)[0];
  if (intentos[0].length > 1 && larga) intentos.push([larga]);
  let nombre = null;
  for (const patrones of intentos) {
    if (!patrones.length) continue;
    nombre = elegirCalle(texto, await callesQueCoinciden(patrones), localidad);
    if (nombre) break;
  }
  memoNombres.set(k, nombre);
  return nombre;
}

/** Cruces entre la calle `a` y cualquiera de `otras` (nombres oficiales). */
async function crucesDe(a, otras) {
  const esquinas = await esquinasDeCalle(a);
  return esquinas.filter((e) => e.calles.some((c) => otras.includes(c) && c !== a));
}

/** De varias esquinas candidatas, la que cae en la localidad o más cerca de ella. */
function mejorEsquina(esquinas, poligono) {
  if (!esquinas.length) return null;
  if (!poligono) return esquinas[0];
  const adentro = esquinas.filter((e) => contiene(poligono.contornos, e.punto));
  if (adentro.length) return adentro[0];
  const centro = centroDe(poligono.contornos.flat());
  return [...esquinas].sort((x, y) => metrosEntre(x.punto, centro) - metrosEntre(y.punto, centro))[0];
}

async function ubicarEsquina({ a, b }, localidad, poligono) {
  const [na, nb] = await Promise.all([nombreOficial(a, localidad), nombreOficial(b, localidad)]);
  if (!na || !nb) return null;
  const punto = mejorEsquina(await crucesDe(na, [nb]), poligono)?.punto;
  return punto ? { geometria: deLeaflet.punto(punto), forma: 'esquina', estado: 'automatica' } : null;
}

async function ubicarTramo({ calle, desde, hasta }, localidad, poligono) {
  const nx = await nombreOficial(calle, localidad);
  if (!nx) return null;
  const extremos = [];
  const aproximados = [];
  for (const lim of [desde, hasta]) {
    const nl = await nombreOficial(lim, localidad);
    if (!nl) return null;
    const cruce = mejorEsquina(await crucesDe(nx, [nl]), poligono);
    if (cruce) {
      extremos.push(cruce.punto);
      continue;
    }
    // No se cruzan (corre paralela, como Bentivenga con Gaona): la esquina de
    // la calle del tramo más cercana a la otra, si está razonablemente cerca.
    const [deX, deL] = await Promise.all([esquinasDeCalle(nx), esquinasDeCalle(nl)]);
    let mejor = null;
    for (const e of deX) {
      for (const o of deL) {
        const d = metrosEntre(e.punto, o.punto);
        if (!mejor || d < mejor.d) mejor = { punto: e.punto, d };
      }
    }
    if (!mejor || mejor.d > TOPE_APROXIMADO_M) return null;
    extremos.push(mejor.punto);
    aproximados.push(lim);
  }
  const tramo = await tramoEntre(nx, extremos[0], extremos[1]);
  const aproximado = aproximados.length > 0 || tramo.aproximado;
  return {
    geometria: deLeaflet.lineas(tramo.lineas),
    forma: 'tramo',
    estado: aproximado ? 'aproximada' : 'automatica',
    nota: aproximados.length
      ? `${aproximados.join(' y ')} no cruza ${calle}: el tramo se cortó a la altura del punto más cercano. Confirmar con el área.`
      : tramo.aproximado
        ? 'El callejero no trajo el trazado de la calle: se dibujó la recta entre las dos esquinas.'
        : '',
  };
}

async function ubicarArea({ calles }, localidad, poligono) {
  const nombres = (await Promise.all(calles.map((c) => nombreOficial(c, localidad)))).filter(Boolean);
  if (nombres.length < 3) return null;
  const esquinas = (await Promise.all(nombres.map((n) => crucesDe(n, nombres)))).flat();
  // Calles homónimas en otra punta del partido: se descartan las esquinas
  // lejos del grupo.
  const referencia = poligono ? centroDe(poligono.contornos.flat()) : centroDe(esquinas.map((e) => e.punto));
  const cercanas = esquinas.filter((e) => metrosEntre(e.punto, referencia) <= RADIO_CUADRANTE_M * 2);
  const centro = centroDe(cercanas.map((e) => e.punto));
  const puntos = cercanas.map((e) => e.punto).filter((p) => metrosEntre(p, centro) <= RADIO_CUADRANTE_M);
  const casco = cascoConvexo(puntos);
  if (casco.length < 3) return null;
  return {
    geometria: deLeaflet.poligono(casco),
    forma: 'area',
    // Con menos esquinas que calles, el casco corta el área (dos calles
    // opuestas que no se cruzan en el callejero): se marca aproximada.
    //
    // Con más NO alcanza para sospechar: las calles curvas suman vértices y el
    // área sale bien (el Cuadrante 4 de Loma Hermosa da 6 y coincide al 100%
    // con el dibujo del área). Y un cuadrante con la cantidad justa puede estar
    // mal igual (el 10 de Ciudadela da 4 y abarca 104 ha contra 71). Contar
    // vértices no distingue uno de otro; lo que los resuelve es la memoria de
    // lugares revisados, que para los cuadrantes conocidos tiene el dibujo.
    estado: casco.length >= nombres.length ? 'automatica' : 'aproximada',
    nota:
      nombres.length < calles.length
        ? `No se encontró en el callejero: ${calles.filter((_, i) => !nombres[i]).join(', ')}.`
        : '',
  };
}

/**
 * @param {object} trabajo de `programacion.js`
 * @param {Map<string, object>} lugares memoria de `bacheo_lugares`, por clave
 * @returns {Promise<{ geometria: object|null, forma: string, estado: string, nota: string }>}
 *   `estado`: revisada (memoria) | automatica | aproximada | sin_ubicar
 */
export async function ubicarTrabajo(trabajo, lugares = new Map()) {
  const recordado = lugares.get(claveLugar(trabajo.descripcion, trabajo.localidad));
  if (recordado?.geometria) {
    return { geometria: recordado.geometria, forma: recordado.forma, estado: 'revisada', nota: recordado.nota ?? '' };
  }
  const tipo = clasificarDescripcion(trabajo.descripcion);
  const poligono = trabajo.localidad ? await poligonoLocalidad(trabajo.localidad) : null;
  let resultado = null;
  try {
    if (tipo.forma === 'area') resultado = await ubicarArea(tipo, trabajo.localidad, poligono);
    else if (tipo.forma === 'tramo') resultado = await ubicarTramo(tipo, trabajo.localidad, poligono);
    else if (tipo.forma === 'esquina') resultado = await ubicarEsquina(tipo, trabajo.localidad, poligono);
  } catch {
    resultado = null;
  }
  if (resultado?.geometria) return { nota: '', ...resultado };
  return {
    geometria: null,
    forma: tipo.forma === 'lugar' ? 'area' : tipo.forma,
    estado: 'sin_ubicar',
    nota:
      tipo.forma === 'lugar'
        ? 'Es un lugar sin calles: hay que marcarlo a mano una vez, y las semanas siguientes se reusa.'
        : 'No se pudo ubicar con el callejero: hay que marcarlo a mano.',
  };
}

/** Ubica todos, de a uno: el Geoportal no tolera ráfagas grandes de pedidos. */
export async function ubicarTodos(trabajos, lugares, alAvanzar) {
  const salida = [];
  for (const [i, t] of trabajos.entries()) {
    salida.push({ ...t, ubicacion: await ubicarTrabajo(t, lugares) });
    alAvanzar?.(i + 1, trabajos.length);
  }
  return salida;
}
