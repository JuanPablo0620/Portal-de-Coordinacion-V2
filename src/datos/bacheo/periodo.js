/**
 * Períodos de la vista de Bacheo: una semana, un mes o un trimestre.
 *
 * La programación se publica por semana, pero la pregunta de la jefatura
 * también es «¿qué se hizo en octubre?» o «¿qué se hizo en el trimestre?»
 * (para el informe trimestral). Un mes o un trimestre se arma juntando las
 * semanas que lo tocan y quedándose solo con los días que caen adentro: la
 * semana del 27/04 al 01/05 aporta cuatro días a abril y uno a mayo.
 *
 * Al juntar semanas, el mismo lugar se repite: el «Cuadrante 9» de Caseros
 * está en la planilla once semanas seguidas. Mostrarlo once veces taparía el
 * mapa con once polígonos iguales y llenaría el panel de copias, así que en un
 * período largo se consolida por lugar y tipo de trabajo (`consolidarPeriodo`).
 * En la vista de una semana no se consolida nada: se ve la planilla tal cual.
 *
 * Un período es `{ tipo, valor }`:
 *   - semana:    `valor` = el lunes, «2026-11-16»
 *   - mes:       «2026-11»
 *   - trimestre: «2026-T4»
 */
import { claveLugar } from './nombresCalle.js';
import { diaYMes } from './semana.js';

export const TIPOS_PERIODO = Object.freeze(['semana', 'mes', 'trimestre']);

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const dos = (n) => String(n).padStart(2, '0');
const iso = (d) => d.toISOString().slice(0, 10);
const fechaUTC = (s) => new Date(`${s}T12:00:00Z`);

export function sumarDias(s, n) {
  const d = fechaUTC(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

/** Lunes de la semana de una fecha ISO. */
export function lunesDeFecha(s) {
  const d = fechaUTC(s);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return iso(d);
}

/** Último día del mes (0-11). */
const ultimoDia = (anio, mes) => new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();

/** `{ desde, hasta }` ISO, ambos incluidos. */
export function rangoPeriodo({ tipo, valor }) {
  if (tipo === 'semana') return { desde: valor, hasta: sumarDias(valor, 6) };
  if (tipo === 'mes') {
    const [anio, mes] = valor.split('-').map(Number);
    return { desde: `${valor}-01`, hasta: `${valor}-${dos(ultimoDia(anio, mes - 1))}` };
  }
  const [anio, t] = valor.split('-T').map(Number);
  const primerMes = (t - 1) * 3;
  return {
    desde: `${anio}-${dos(primerMes + 1)}-01`,
    hasta: `${anio}-${dos(primerMes + 3)}-${dos(ultimoDia(anio, primerMes + 2))}`,
  };
}

/** El mes y el trimestre de una fecha ISO, como valores de período. */
export const mesDe = (s) => s.slice(0, 7);
export const trimestreDe = (s) => `${s.slice(0, 4)}-T${Math.floor((Number(s.slice(5, 7)) - 1) / 3) + 1}`;

const NOMBRE_TRIMESTRE = ['1.er', '2.º', '3.er', '4.º'];
const MESES_TRIMESTRE = ['ene–mar', 'abr–jun', 'jul–sep', 'oct–dic'];

export const nombreTrimestre = (t) => `${NOMBRE_TRIMESTRE[t - 1]} trimestre`;
export const mesesDelTrimestre = (t) => MESES_TRIMESTRE[t - 1];

/** «Semana 16/11 al 20/11», «Noviembre 2026», «4.º trimestre 2026». */
export function rotuloPeriodo(periodo, semanas = []) {
  const { tipo, valor } = periodo;
  if (tipo === 'semana') {
    const s = semanas.find((x) => x.lunes === valor);
    return `Semana ${diaYMes(s?.desde ?? valor)} al ${diaYMes(s?.hasta ?? sumarDias(valor, 4))}`;
  }
  if (tipo === 'mes') return `${MESES[Number(valor.slice(5, 7)) - 1]} ${valor.slice(0, 4)}`;
  return `${nombreTrimestre(Number(valor.slice(-1)))} ${valor.slice(0, 4)}`;
}

/** Semanas publicadas que tocan el período, de la más vieja a la más nueva. */
export function semanasDelPeriodo(semanas, periodo) {
  if (periodo.tipo === 'semana') return semanas.filter((s) => s.lunes === periodo.valor);
  const { desde, hasta } = rangoPeriodo(periodo);
  return semanas
    .filter((s) => s.desde <= hasta && s.hasta >= desde)
    .sort((a, b) => a.lunes.localeCompare(b.lunes));
}

/**
 * Lunes del período que no tienen programación publicada. Solo semanas que
 * empiezan adentro del período y no después de `hoy`: no tiene sentido avisar
 * que «falta» la semana que viene.
 */
export function semanasFaltantes(semanas, periodo, hoy) {
  if (periodo.tipo === 'semana') return [];
  const { desde, hasta } = rangoPeriodo(periodo);
  const hay = new Set(semanas.map((s) => s.lunes));
  const faltan = [];
  for (let l = lunesDeFecha(desde); l <= hasta && l <= hoy; l = sumarDias(l, 7)) {
    // Una semana que arranca el mes anterior cuenta solo si su viernes cae adentro.
    if (sumarDias(l, 4) < desde) continue;
    if (!hay.has(l)) faltan.push(l);
  }
  return faltan;
}

/** Período más reciente con programación, para abrir la pantalla. */
export const periodoInicial = (semanas) => (semanas[0] ? { tipo: 'semana', valor: semanas[0].lunes } : null);

/**
 * Período anterior (`-1`) o siguiente (`+1`) del mismo tipo que tenga alguna
 * semana publicada; `null` si no hay. Saltea los huecos (las semanas de
 * febrero que no llegaron) en vez de mostrar una pantalla vacía.
 */
export function periodoVecino(semanas, periodo, paso) {
  const valores = [...new Set(semanas.map((s) => valorDe(periodo.tipo, s)))].sort();
  const i = valores.indexOf(periodo.valor);
  const candidato = i === -1
    ? (paso > 0 ? valores.find((v) => v > periodo.valor) : valores.filter((v) => v < periodo.valor).pop())
    : valores[i + paso];
  return candidato ? { tipo: periodo.tipo, valor: candidato } : null;
}

/** El valor de período que le toca a una semana (por su lunes). */
export function valorDe(tipo, semana) {
  if (tipo === 'semana') return semana.lunes;
  return tipo === 'mes' ? mesDe(semana.lunes) : trimestreDe(semana.lunes);
}

/** Cuántas semanas publicadas tocan cada mes o trimestre de un año. */
export function conteoPorPeriodo(semanas, tipo, anio) {
  const total = tipo === 'mes' ? 12 : 4;
  return Array.from({ length: total }, (_, i) => {
    const valor = tipo === 'mes' ? `${anio}-${dos(i + 1)}` : `${anio}-T${i + 1}`;
    return { valor, numero: i + 1, semanas: semanasDelPeriodo(semanas, { tipo, valor }).length };
  });
}

/**
 * Filas del mini calendario de un mes: una por semana, de lunes a domingo.
 * @returns {{ lunes: string, dias: { fecha: string, delMes: boolean }[] }[]}
 */
export function filasDelMes(anio, mes) {
  const primero = `${anio}-${dos(mes + 1)}-01`;
  const ultimo = `${anio}-${dos(mes + 1)}-${dos(ultimoDia(anio, mes))}`;
  const filas = [];
  for (let l = lunesDeFecha(primero); l <= ultimo; l = sumarDias(l, 7)) {
    filas.push({
      lunes: l,
      dias: Array.from({ length: 7 }, (_, i) => {
        const fecha = sumarDias(l, i);
        return { fecha, delMes: fecha.slice(0, 7) === primero.slice(0, 7) };
      }),
    });
  }
  return filas;
}

/** Período a partir de los parámetros de la URL (`?semana=`, `?mes=`, `?trimestre=`). */
export function periodoDeParametros(parametros) {
  const semana = parametros.get('semana');
  if (semana && /^\d{4}-\d{2}-\d{2}$/.test(semana)) return { tipo: 'semana', valor: lunesDeFecha(semana) };
  const mes = parametros.get('mes');
  if (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return { tipo: 'mes', valor: mes };
  const trimestre = parametros.get('trimestre');
  if (trimestre && /^\d{4}-T[1-4]$/.test(trimestre)) return { tipo: 'trimestre', valor: trimestre };
  return null;
}

/* ── Consolidación de un período largo ──────────────────────────────── */

/** Cuál ubicación gana si el mismo lugar vino con varias: la más revisada. */
const PESO_UBICACION = { revisada: 0, manual: 1, automatica: 2, aproximada: 3, sin_ubicar: 4 };

/**
 * Junta los trabajos de varias semanas en uno por lugar y tipo.
 *
 * - Las fechas se recortan al período y se unen.
 * - La geometría es la de la mejor ubicación que tuvo ese lugar (una semana
 *   revisada a mano vale para todas).
 * - Los m² de hormigón NO se suman entre semanas: cuando una obra sigue de una
 *   semana a la otra, la planilla repite el mismo total (Gral. Hornos y
 *   W. de Tata, 459 m², el 25/05 y el 01/06). Se toma el mayor.
 *
 * @param {{ semana: object, trabajos: object[] }[]} porSemana
 * @param {{ desde: string, hasta: string }} rango
 */
export function consolidarPeriodo(porSemana, { desde, hasta }) {
  const lugares = new Map();
  for (const { semana, trabajos } of porSemana) {
    for (const t of trabajos) {
      const fechas = t.fechas.filter((f) => f >= desde && f <= hasta);
      if (!fechas.length) continue;
      const clave = `${claveLugar(t.descripcion, t.localidad)}|${t.tipo}`;
      const ubicacion = t.geometria ? t.ubicacion : 'sin_ubicar';
      const previo = lugares.get(clave);
      if (!previo) {
        lugares.set(clave, {
          ...t,
          id: clave,
          ubicacion,
          fechas,
          semanas: [semana.lunes],
          cuadrillas: [t.cuadrilla],
          m2: t.m2 ?? null,
          tareas: (t.tareas ?? []).filter((x) => x.fecha >= desde && x.fecha <= hasta),
          novedades: (t.novedades ?? []).filter((x) => x.fecha >= desde && x.fecha <= hasta),
        });
        continue;
      }
      if (PESO_UBICACION[ubicacion] < PESO_UBICACION[previo.ubicacion]) {
        Object.assign(previo, { geometria: t.geometria, forma: t.forma, ubicacion, nota: t.nota });
      }
      previo.fechas = [...new Set([...previo.fechas, ...fechas])].sort();
      if (!previo.semanas.includes(semana.lunes)) previo.semanas.push(semana.lunes);
      if (!previo.cuadrillas.includes(t.cuadrilla)) previo.cuadrillas.push(t.cuadrilla);
      if (t.m2 != null) previo.m2 = Math.max(Number(previo.m2) || 0, Number(t.m2));
      previo.tareas.push(...(t.tareas ?? []).filter((x) => x.fecha >= desde && x.fecha <= hasta));
      previo.novedades.push(...(t.novedades ?? []).filter((x) => x.fecha >= desde && x.fecha <= hasta));
    }
  }
  return [...lugares.values()].map((t, orden) => ({ ...t, orden, cuadrilla: t.cuadrillas.join(' · ') }));
}

/**
 * Novedades de las semanas del período (feriados, lluvia), sin las vacías:
 * algunas planillas traen un «-» en la fila de novedades de cada día.
 */
export function novedadesDelPeriodo(semanas, { desde, hasta }) {
  return semanas
    .flatMap((s) => s.novedades ?? [])
    .filter((n) => n.fecha >= desde && n.fecha <= hasta && esNovedadReal(n.texto))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export const esNovedadReal = (texto) => String(texto ?? '').replace(/[-–\s]/g, '') !== '';
