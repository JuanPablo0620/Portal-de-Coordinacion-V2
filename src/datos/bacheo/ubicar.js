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
import {
  alternativas,
  clasificarDescripcion,
  claveLugar,
  elegirCalle,
  elegirCalleFlexible,
  esDudosa,
  patronesDeBusqueda,
  patronesDeRespaldo,
  sugerirCalle,
} from './nombresCalle.js';
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
/**
 * Nombre oficial de una calle de la planilla: `{ nombre, interpretado, sugerencia }`.
 *
 *  - `nombre`: el oficial, o null si no se encontró.
 *  - `interpretado`: true si hizo falta la vuelta flexible (sobraba una
 *    palabra): se ubica, pero se avisa en la nota.
 *  - `sugerencia`: si no se encontró, el nombre oficial más parecido.
 */
export async function resolverCalle(texto, localidad) {
  const k = `${clave(texto)}|${clave(localidad)}`;
  if (memoNombres.has(k)) return memoNombres.get(k);
  /*
   * Intentos, de más preciso a más amplio:
   *  1. todas las palabras;
   *  2. con la «n» como comodín, por si el nombre oficial tiene «ñ»;
   *  3. cada palabra por separado, por si la planilla trae una palabra que el
   *     nombre oficial no tiene («Martin de Álzaga» / «Álzaga»);
   *  4. el final de la palabra más larga, por si el error está al principio.
   */
  const intentos = [patronesDeBusqueda(texto), patronesDeBusqueda(texto, { comodinEnN: true })];
  if (intentos[0].length > 1) for (const p of intentos[0]) intentos.push([p]);
  intentos.push(patronesDeRespaldo(texto));
  const vistos = [];
  let resultado = null;
  for (const patrones of intentos) {
    if (!patrones.length) continue;
    const candidatos = await callesQueCoinciden(patrones);
    vistos.push(...candidatos);
    const nombre = elegirCalle(texto, candidatos, localidad);
    if (nombre) {
      resultado = { nombre, interpretado: esDudosa(texto, nombre), sugerencia: null };
      break;
    }
  }
  if (!resultado) {
    const flexible = elegirCalleFlexible(texto, vistos, localidad);
    resultado = flexible
      ? { nombre: flexible, interpretado: true, sugerencia: null }
      : { nombre: null, interpretado: false, sugerencia: sugerirCalle(texto, vistos) };
  }
  memoNombres.set(k, resultado);
  return resultado;
}

/** Nombre oficial de una calle de la planilla, o null. Prueba cada alternativa «A / B». */
export async function nombreOficial(texto, localidad) {
  for (const alt of alternativas(texto)) {
    const r = await resolverCalle(alt, localidad);
    if (r.nombre) return r.nombre;
  }
  return null;
}

/** Cruces entre la calle `a` (o sus alternativas) y cualquiera de `otras`. */
async function crucesDe(a, otras) {
  const propias = [a].flat();
  const ajenas = otras.flat();
  const esquinas = (await Promise.all(propias.map((n) => esquinasDeCalle(n)))).flat();
  return esquinas.filter((e) => e.calles.some((c) => ajenas.includes(c) && !propias.includes(c)));
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

/*
 * Cuando algo no se puede ubicar, cada función devuelve `{ motivo, nota }` en
 * vez de null. El motivo concreto («no existe la calle X», «A y B no se
 * cruzan») es lo que permite decirle al área qué corregir en la planilla, en
 * vez de un «no se pudo» que obliga a adivinar.
 *
 * motivo: calle_desconocida | no_se_cruzan | faltan_esquinas | sin_calles | interpretado | error
 */
const falla = (motivo, nota) => ({ motivo, nota });

/**
 * Resuelve los nombres de la planilla. Devuelve, por cada texto, la lista de
 * nombres oficiales (más de uno si viene «A / B»), los que no existen con su
 * sugerencia, y las interpretaciones hechas para avisarlas en la nota.
 */
async function nombresOficiales(textos, localidad) {
  const nombres = [];
  const faltan = [];
  const avisos = [];
  for (const texto of textos) {
    const encontrados = [];
    let sugerencia = null;
    for (const alt of alternativas(texto)) {
      const r = await resolverCalle(alt, localidad);
      if (r.nombre) {
        encontrados.push(r.nombre);
        if (r.interpretado) avisos.push(`Se tomó «${alt}» como «${r.nombre}».`);
      } else sugerencia ??= r.sugerencia;
    }
    nombres.push(encontrados);
    if (!encontrados.length) faltan.push({ texto, sugerencia });
  }
  return { nombres, faltan, avisos };
}
const entreComillas = (lista) => lista.map((f) => `«${f}»`).join(', ');
const describirFaltantes = (faltan) =>
  faltan.map((f) => (f.sugerencia ? `«${f.texto}» (¿${f.sugerencia}?)` : `«${f.texto}»`)).join(', ');
const noExisten = (faltan) =>
  falla('calle_desconocida', `No existe en el callejero oficial: ${describirFaltantes(faltan)}. Revisar cómo está escrito.`);

async function ubicarEsquina({ a, b }, localidad, poligono) {
  const { nombres, faltan, avisos } = await nombresOficiales([a, b], localidad);
  if (faltan.length) return noExisten(faltan);
  const punto = mejorEsquina(await crucesDe(nombres[0], nombres[1]), poligono)?.punto;
  if (!punto) return falla('no_se_cruzan', `«${a}» y «${b}» no se cruzan en el callejero oficial.`);
  return {
    geometria: deLeaflet.punto(punto),
    forma: 'esquina',
    estado: avisos.length ? 'aproximada' : 'automatica',
    motivo: avisos.length ? 'interpretado' : '',
    nota: avisos.join(' '),
  };
}

async function ubicarTramo({ calle, desde, hasta }, localidad, poligono) {
  const { nombres, faltan, avisos } = await nombresOficiales([calle, desde, hasta], localidad);
  if (faltan.length) return noExisten(faltan);
  const [alternativasX, ...limites] = nombres;
  // Para el trazado hace falta UN nombre: el de la calle del tramo que cruza a
  // los límites (si viene «A / B», la que corresponda).
  let nx = alternativasX[0];
  for (const n of alternativasX) {
    if ((await crucesDe(n, limites.flat())).length) {
      nx = n;
      break;
    }
  }
  const extremos = [];
  const aproximados = [];
  for (const [k, nl] of limites.entries()) {
    const lim = [desde, hasta][k];
    const cruce = mejorEsquina(await crucesDe(nx, [nl]), poligono);
    if (cruce) {
      extremos.push(cruce.punto);
      continue;
    }
    // No se cruzan (corre paralela, como Bentivenga con Gaona): la esquina de
    // la calle del tramo más cercana a la otra, si está razonablemente cerca.
    const [deX, deL] = await Promise.all([esquinasDeCalle(nx), Promise.all(nl.map((n) => esquinasDeCalle(n))).then((l) => l.flat())]);
    let mejor = null;
    for (const e of deX) {
      for (const o of deL) {
        const d = metrosEntre(e.punto, o.punto);
        if (!mejor || d < mejor.d) mejor = { punto: e.punto, d };
      }
    }
    if (!mejor || mejor.d > TOPE_APROXIMADO_M) {
      return falla('no_se_cruzan', `«${calle}» y «${lim}» no se cruzan ni pasan cerca en el callejero oficial.`);
    }
    extremos.push(mejor.punto);
    aproximados.push(lim);
  }
  const tramo = await tramoEntre(nx, extremos[0], extremos[1]);
  const aproximado = aproximados.length > 0 || tramo.aproximado || avisos.length > 0;
  const notas = [...avisos];
  if (aproximados.length) {
    notas.push(`${entreComillas(aproximados)} no cruza «${calle}»: el tramo se cortó a la altura del punto más cercano. Confirmar con el área.`);
  } else if (tramo.aproximado) {
    notas.push('El callejero no trajo el trazado de la calle: se dibujó la recta entre las dos esquinas.');
  }
  return {
    geometria: deLeaflet.lineas(tramo.lineas),
    forma: 'tramo',
    estado: aproximado ? 'aproximada' : 'automatica',
    motivo: aproximados.length ? 'no_se_cruzan' : tramo.aproximado ? 'sin_trazado' : avisos.length ? 'interpretado' : '',
    nota: notas.join(' '),
  };
}

async function ubicarArea({ calles }, localidad, poligono) {
  const { nombres: todos, faltan, avisos } = await nombresOficiales(calles, localidad);
  const nombres = todos.filter((n) => n.length);
  if (nombres.length < 3) {
    return faltan.length
      ? noExisten(faltan)
      : falla('sin_calles', 'Un cuadrante necesita al menos tres calles y la planilla nombra menos.');
  }
  const esquinas = (await Promise.all(nombres.map((n) => crucesDe(n, nombres)))).flat();
  // Calles homónimas en otra punta del partido: se descartan las esquinas
  // lejos del grupo.
  const referencia = poligono ? centroDe(poligono.contornos.flat()) : centroDe(esquinas.map((e) => e.punto));
  const cercanas = esquinas.filter((e) => metrosEntre(e.punto, referencia) <= RADIO_CUADRANTE_M * 2);
  const centro = centroDe(cercanas.map((e) => e.punto));
  const validas = cercanas.filter((e) => metrosEntre(e.punto, centro) <= RADIO_CUADRANTE_M);
  const casco = cascoConvexo(validas.map((e) => e.punto));
  // Las calles que no tienen ninguna esquina con las demás son las que no
  // cierran el cuadrante: es lo que hay que corregir en la planilla.
  const sueltas = calles.filter((c, i) => todos[i].length && !validas.some((e) => e.calles.some((n) => todos[i].includes(n))));
  if (casco.length < 3) {
    const partes = [];
    if (sueltas.length) partes.push(`sin esquina con las demás: ${entreComillas(sueltas)}`);
    if (faltan.length) partes.push(`no existe en el callejero: ${describirFaltantes(faltan)}`);
    return falla(
      faltan.length ? 'calle_desconocida' : 'faltan_esquinas',
      `Las calles no se cruzan entre sí lo suficiente para cerrar un área${partes.length ? ` (${partes.join('; ')})` : ''}.`,
    );
  }
  const notas = [...avisos];
  if (faltan.length) notas.push(`No existe en el callejero oficial: ${describirFaltantes(faltan)}.`);
  if (sueltas.length) notas.push(`No cruza a las demás calles del cuadrante: ${entreComillas(sueltas)}.`);
  return {
    geometria: deLeaflet.poligono(casco),
    forma: 'area',
    // Con menos esquinas que calles, el casco corta el área (dos calles
    // opuestas que no se cruzan en el callejero): se marca aproximada. También
    // si alguna calle no existe o no cruza a las demás.
    //
    // Con más esquinas NO alcanza para sospechar: las calles curvas suman
    // vértices y el área sale bien (el Cuadrante 4 de Loma Hermosa da 6 y
    // coincide al 100% con el dibujo del área). Y un cuadrante con la cantidad
    // justa puede estar mal igual (el 10 de Ciudadela da 4 y abarca 104 ha
    // contra 71). Contar vértices no distingue uno de otro; lo que los resuelve
    // es la memoria de lugares revisados, que para los cuadrantes conocidos
    // tiene el dibujo.
    estado: casco.length >= nombres.length && !faltan.length && !sueltas.length && !avisos.length ? 'automatica' : 'aproximada',
    motivo: faltan.length
      ? 'calle_desconocida'
      : sueltas.length || casco.length < nombres.length
        ? 'faltan_esquinas'
        : avisos.length
          ? 'interpretado'
          : '',
    nota: notas.join(' '),
  };
}

/**
 * @param {object} trabajo de `programacion.js`
 * @param {Map<string, object>} lugares memoria de `bacheo_lugares`, por clave
 * @returns {Promise<{ geometria: object|null, forma: string, estado: string, motivo: string, nota: string }>}
 *   `estado`: revisada (memoria) | automatica | aproximada | sin_ubicar
 */
export async function ubicarTrabajo(trabajo, lugares = new Map()) {
  const recordado = lugares.get(claveLugar(trabajo.descripcion, trabajo.localidad));
  if (recordado?.geometria) {
    return { geometria: recordado.geometria, forma: recordado.forma, estado: 'revisada', motivo: '', nota: recordado.nota ?? '' };
  }
  const tipo = clasificarDescripcion(trabajo.descripcion);
  const forma = tipo.forma === 'lugar' ? 'area' : tipo.forma;
  if (tipo.forma === 'lugar') {
    return {
      geometria: null,
      forma,
      estado: 'sin_ubicar',
      motivo: 'sin_calles',
      nota: 'Es un lugar sin calles: hay que marcarlo a mano una vez, y las semanas siguientes se reusa.',
    };
  }
  const poligono = trabajo.localidad ? await poligonoLocalidad(trabajo.localidad) : null;
  let resultado;
  try {
    if (tipo.forma === 'area') resultado = await ubicarArea(tipo, trabajo.localidad, poligono);
    else if (tipo.forma === 'tramo') resultado = await ubicarTramo(tipo, trabajo.localidad, poligono);
    else resultado = await ubicarEsquina(tipo, trabajo.localidad, poligono);
  } catch (error) {
    resultado = falla('error', `El Geoportal no respondió (${error.message}). Probar de nuevo más tarde.`);
  }
  if (resultado.geometria) return { motivo: '', nota: '', ...resultado };
  return { geometria: null, forma, estado: 'sin_ubicar', motivo: resultado.motivo, nota: `${resultado.nota} Hay que marcarlo a mano.` };
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
