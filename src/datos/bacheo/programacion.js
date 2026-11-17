/**
 * De la tabla de una «Programación semanal» a los trabajos de la semana.
 *
 * `tablaProgramacion.js` devuelve celdas; acá se les da significado: qué es un
 * trabajo, de qué tipo, qué días, y qué texto de la grilla NO es un trabajo
 * (feriados, lluvia). El vocabulario sale de leer los 38 PDF de junio a
 * noviembre de 2026; un valor nuevo no rompe la carga: se informa como aviso
 * para que quien carga lo vea y decida.
 *
 * Asfalto: una fila puede tener dos tipos de trabajo en días distintos
 * (reconstrucción el miércoles y pintura el viernes en la misma cuadra). Se
 * separa en un trabajo por tipo, porque en el mapa son dos capas distintas y en
 * la planilla del área, dos tareas distintas.
 *
 * Hormigón: un trabajo por fila, con sus tareas por día (desmonte, hormigón y
 * hora). Los m² se guardan por trabajo y el total se calcula: el «M2 TOTALES»
 * de la planilla no es confiable (el del 16/11 sumaba solo tres de las cinco
 * filas).
 */
import { clave } from './tablaProgramacion.js';

/** Celda de la grilla de asfalto → tipo de trabajo. */
export const TIPOS_ASFALTO = Object.freeze({
  'ASFALTO CALIENTE': 'caliente',
  'ASFALTO FRIO': 'frio',
  'SELLADO DE JUNTAS': 'sellado',
  'RECONSTRUCCION DE CORDONES': 'reconstruccion',
  'PINTURA DE CORDONES': 'pintura',
  'COLOCACION DE ELEMENTOS VIALES': 'viales',
  'TAREAS DE LIMPIEZA': 'limpieza',
  'TAREAS DE MANTENIMIENTO': 'mantenimiento',
});

/** Rótulo para mostrar de cada tipo, en el orden en que se listan. */
export const ETIQUETAS_TIPO = Object.freeze({
  caliente: 'Asfalto caliente',
  frio: 'Asfalto frío',
  sellado: 'Sellado de juntas',
  reconstruccion: 'Reconstrucción de cordones',
  pintura: 'Pintura de cordones',
  viales: 'Elementos viales',
  limpieza: 'Tareas de limpieza',
  mantenimiento: 'Tareas de mantenimiento',
  hormigon: 'Hormigón',
});

/*
 * Localidades oficiales del partido, como las nombra el Geoportal. La planilla
 * las escribe de varias maneras («Caseros Sur», «EL Libertador», «Ciudad
 * Jardin», «Altos de Podesta») y el panel agrupa por localidad: sin
 * normalizar, la misma localidad aparecería tres veces.
 */
export const LOCALIDADES = Object.freeze([
  'Caseros',
  'Churruca',
  'Ciudad Jardín Lomas del Palomar',
  'Ciudadela',
  'El Libertador',
  'José Ingenieros',
  'Loma Hermosa',
  'Martín Coronado',
  'Once de Septiembre',
  'Pablo Podestá',
  'Remedios de Escalada de San Martín',
  'Sáenz Peña',
  'Santos Lugares',
  'Villa Bosch',
  'Villa Raffo',
]);

/** Nombres de la planilla que no empiezan como el oficial. */
const ALIAS_LOCALIDAD = Object.freeze({
  'ALTOS DE PODESTA': 'Pablo Podestá',
  'CIUDAD JARDIN': 'Ciudad Jardín Lomas del Palomar',
  'CASEROS SUR': 'Caseros',
  'CASEROS NORTE': 'Caseros',
  '11 DE SEPTIEMBRE': 'Once de Septiembre',
  'REMEDIOS DE ESCALADA': 'Remedios de Escalada de San Martín',
});

/** @returns {string} la localidad oficial, o '' si no se reconoce. */
export function localidadOficial(texto) {
  const k = clave(texto);
  if (!k) return '';
  if (ALIAS_LOCALIDAD[k]) return ALIAS_LOCALIDAD[k];
  return LOCALIDADES.find((l) => clave(l) === k) ?? LOCALIDADES.find((l) => clave(l).startsWith(k)) ?? '';
}

/**
 * «LUN 16/11» → fecha ISO. La planilla no trae el año: se toma el que deja la
 * fecha más cerca de `hoy`, que es cuando se sube el PDF. Así una semana del
 * 29/12 subida el 2 de enero queda en diciembre del año anterior.
 */
export function fechaDeEncabezado(rotulo, hoy) {
  const m = clave(rotulo).match(/^([A-Z]+)\s+(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const [, , dia, mes] = m;
  const base = new Date(`${hoy}T12:00:00`);
  let mejor = null;
  for (const anio of [base.getFullYear() - 1, base.getFullYear(), base.getFullYear() + 1]) {
    const f = new Date(Date.UTC(anio, Number(mes) - 1, Number(dia), 12));
    if (!mejor || Math.abs(f - base) < Math.abs(mejor - base)) mejor = f;
  }
  return mejor.toISOString().slice(0, 10);
}

const esLluvia = (k) => /\bLLUVIA\b/.test(k);

/** «DESMONTE 9HS / HORMIGON 12HS» → [{ tarea: 'Desmonte', hora: '9 h' }, …] */
export function tareasHormigon(celda) {
  const k = clave(celda);
  const tareas = [];
  for (const m of k.matchAll(/(DESMONTE|HORMIGON(?:\s+(?:RICO|POBRE))?)\s*(\d{1,2})?\s*(?:HS)?/g)) {
    const nombre = m[1] === 'DESMONTE' ? 'Desmonte' : m[1].replace('HORMIGON', 'Hormigón').replace(/\b(RICO|POBRE)\b/, (p) => p.toLowerCase());
    tareas.push({ tarea: nombre, hora: m[2] ? `${Number(m[2])} h` : '' });
  }
  return tareas;
}

/**
 * @param {{ tipo: 'asfalto'|'hormigon', encabezado: string[], filas: string[][] }} tabla
 * @param {string} hoy fecha ISO
 * @returns {{
 *   tipo: 'asfalto'|'hormigon',
 *   fechas: string[],
 *   trabajos: object[],
 *   novedades: { fecha: string, texto: string }[],
 *   avisos: string[],
 * }}
 *   `novedades`: feriados y otros textos de la grilla que valen para el día
 *   entero. `avisos`: lo que no se pudo interpretar, para mostrarlo al cargar.
 */
export function trabajosDesdeTabla(tabla, hoy) {
  const enc = tabla.encabezado.map(clave);
  const iDir = enc.indexOf('DIRECCION');
  const iLoc = enc.indexOf('LOCALIDAD');
  const iM2 = enc.findIndex((h) => h.includes('M2'));
  const iCuadrilla = tabla.tipo === 'asfalto' && enc[0] === '' ? 0 : -1;
  const columnasDia = tabla.encabezado
    .map((rotulo, i) => ({ i, fecha: fechaDeEncabezado(rotulo, hoy) }))
    .filter((c) => c.fecha);

  const trabajos = [];
  const avisos = [];
  const novedadesPorDia = new Map();

  tabla.filas.forEach((fila, nFila) => {
    const base = {
      cuadrilla: iCuadrilla >= 0 ? cuadrillaLinda(fila[iCuadrilla]) : 'Hormigón',
      descripcion: fila[iDir].replace(/\bAv\s+\./g, 'Av.'),
      localidad_planilla: iLoc >= 0 ? fila[iLoc] : '',
      localidad: iLoc >= 0 ? localidadOficial(fila[iLoc]) : '',
      orden: nFila,
    };
    const porTipo = new Map();
    const tareas = [];
    const novedades = [];

    for (const { i, fecha } of columnasDia) {
      const celda = fila[i];
      if (!celda) continue;
      const k = clave(celda);
      if (tabla.tipo === 'asfalto' && TIPOS_ASFALTO[k]) {
        const tipo = TIPOS_ASFALTO[k];
        if (!porTipo.has(tipo)) porTipo.set(tipo, []);
        porTipo.get(tipo).push(fecha);
      } else if (tabla.tipo === 'hormigon' && tareasHormigon(celda).length) {
        for (const t of tareasHormigon(celda)) tareas.push({ fecha, ...t });
      } else if (esLluvia(k)) {
        novedades.push({ fecha, texto: 'Lluvia' });
      } else {
        // Feriados: la celda está combinada en vertical y sus pedazos caen en
        // filas al azar. Se juntan por día y valen para la semana entera.
        if (!novedadesPorDia.has(fecha)) novedadesPorDia.set(fecha, []);
        novedadesPorDia.get(fecha).push(celda);
      }
    }

    if (tabla.tipo === 'asfalto') {
      if (porTipo.size === 0 && novedades.length === 0) {
        avisos.push(`«${base.descripcion}» no tiene ningún día con trabajo.`);
      }
      for (const [tipo, fechas] of porTipo) {
        trabajos.push({ ...base, tipo, fechas, tareas: [], m2: null, novedades });
      }
    } else {
      const m2 = iM2 >= 0 ? Number(String(fila[iM2]).replace(',', '.')) : NaN;
      trabajos.push({
        ...base,
        tipo: 'hormigon',
        fechas: [...new Set(tareas.map((t) => t.fecha))],
        tareas,
        m2: Number.isFinite(m2) ? m2 : null,
        novedades,
      });
      if (!tareas.length) avisos.push(`«${base.descripcion}» no tiene ningún día con tareas.`);
    }
    if (!base.localidad) {
      avisos.push(
        base.localidad_planilla
          ? `«${base.descripcion}»: no se reconoce la localidad «${base.localidad_planilla}».`
          : `«${base.descripcion}» no tiene localidad.`,
      );
    }
  });

  return {
    tipo: tabla.tipo,
    fechas: columnasDia.map((c) => c.fecha),
    trabajos,
    novedades: [...novedadesPorDia].map(([fecha, partes]) => ({ fecha, texto: limpiarNovedad(partes) })),
    avisos,
  };
}

/** «CUADRILLA 3 (ASF + BREA + RECONSTRUCCIÓN) VILLA BOSCH» → «Cuadrilla 3 (Asf + Brea + Reconstrucción) Villa Bosch» */
export function cuadrillaLinda(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .replace(/(^|[\s(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
    .replace(/\bS\.u\./, 'S.U.')
    .trim();
}

function limpiarNovedad(partes) {
  const texto = partes.join(' ').replace(/\s+/g, ' ').trim();
  return texto.charAt(0) + texto.slice(1).toLowerCase();
}

/**
 * Junta los dos PDF de una semana. Si no son de la misma semana, es un error de
 * carga, no algo que se pueda «arreglar» eligiendo una.
 *
 * @returns {{ desde: string, hasta: string, trabajos: object[], novedades: object[], avisos: string[] }}
 */
export function unirProgramaciones(programaciones) {
  const conTrabajos = programaciones.filter(Boolean);
  if (!conTrabajos.length) throw new Error('No hay ninguna programación para cargar.');
  const fechas = [...new Set(conTrabajos.flatMap((p) => p.fechas))].sort();
  const lunes = conTrabajos.map((p) => lunesDe(p.fechas[0]));
  if (new Set(lunes).size > 1) {
    throw new Error(`Los PDF son de semanas distintas (${lunes.join(' y ')}): subí los de la misma semana.`);
  }
  // El mismo feriado viene en los dos PDF, escrito distinto («Día de la
  // independencia» / «Dia de la independencia»): uno por día, el más largo.
  const porDia = new Map();
  for (const n of conTrabajos.flatMap((p) => p.novedades)) {
    if (!porDia.has(n.fecha) || n.texto.length > porDia.get(n.fecha).texto.length) porDia.set(n.fecha, n);
  }
  const novedades = [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return {
    lunes: lunes[0],
    desde: fechas[0],
    hasta: fechas[fechas.length - 1],
    trabajos: conTrabajos.flatMap((p) => p.trabajos),
    novedades,
    avisos: conTrabajos.flatMap((p) => p.avisos),
  };
}

/** Lunes de la semana de una fecha ISO (una semana que arranca martes por feriado sigue siendo la de ese lunes). */
export function lunesDe(fechaISO) {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  const desde = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - desde);
  return d.toISOString().slice(0, 10);
}
