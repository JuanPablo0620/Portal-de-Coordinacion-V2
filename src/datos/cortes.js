/**
 * ─────────────────────────────────────────────────────────────────────
 * CORTES DE CALLE — parte pura: vigencia, texto y filtrado.
 *
 * Un corte tiene una calle, una geometría y una VIGENCIA, y la vigencia es lo
 * que hace útil al módulo: la pregunta que contesta el mapa no es "qué cortes
 * hay cargados" sino "qué está cortado hoy y qué se corta el sábado".
 *
 * Los seis campos de vigencia cubren los tres casos reales sin una tabla de
 * repeticiones aparte ni una fila por fecha:
 *
 *   · corte de un día      → `vigencia_desde` = `vigencia_hasta`, con horas
 *   · obra de varios días  → rango de fechas, sin `dias_semana` ni horas
 *   · feria de los domingos → rango largo + `dias_semana: [0]` + horas
 *   · el domingo que no hay → esa fecha en `fechas_excluidas`
 *
 * `vigente` NO se guarda. Es una cuenta contra el reloj, igual que `alerta` en
 * los compromisos (ver la nota de `ESTADOS_COMPROMISO` en catalogos.js): nadie
 * va a entrar al sistema a marcar que pasó la medianoche. Lo que se guarda es
 * si alguien lo levantó o lo suspendió.
 * ─────────────────────────────────────────────────────────────────────
 */
import { hoyISO } from './tiempo.js';

/** Día de la semana de una fecha ISO. 0 = domingo, como `Date.getDay()`.
 *
 *  Se calcula en UTC a propósito: `new Date('2026-09-13').getDay()` interpreta
 *  la cadena como medianoche UTC y la traduce a la zona local, así que en
 *  Argentina (UTC-3) devuelve el día ANTERIOR. */
export function diaSemanaDe(fechaISO) {
  const [anio, mes, dia] = String(fechaISO).split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

export const NOMBRE_DIA = Object.freeze([
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
]);

export const DIA_CORTO = Object.freeze(['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']);

/* ── Ocurrencia ─────────────────────────────────────────────────────── */

/** ¿El corte corta ese día? Es la pregunta base de todo el módulo. */
export function ocurreEn(corte, fechaISO) {
  if (!corte || corte.activo === false) return false;
  if (corte.estado === 'suspendido') return false;
  if (!corte.vigencia_desde || fechaISO < corte.vigencia_desde) return false;
  if (corte.vigencia_hasta && fechaISO > corte.vigencia_hasta) return false;
  if (corte.fechas_excluidas?.includes(fechaISO)) return false;
  const dias = corte.dias_semana;
  if (Array.isArray(dias) && dias.length && !dias.includes(diaSemanaDe(fechaISO))) return false;
  return true;
}

/** ¿Alguna ocurrencia del corte cae dentro del rango? Rango sin `hasta` = abierto. */
export function ocurreEnRango(corte, desde, hasta) {
  if (!corte || corte.activo === false) return false;
  if (!desde && !hasta) return corte.estado !== 'suspendido';

  const inicio = desde || corte.vigencia_desde;
  // Un corte sin fecha de fin es abierto: si el rango arranca después de que
  // empezó, sigue contando. Es justo el caso que hay que ver en el mapa.
  const fin = hasta || corte.vigencia_hasta || corte.vigencia_desde;
  if (corte.vigencia_hasta && corte.vigencia_hasta < inicio) return false;
  if (corte.vigencia_desde > fin) return false;

  const dias = corte.dias_semana;
  const tieneExcepciones = Boolean(corte.fechas_excluidas?.length);
  // Sin restricción de días ni excepciones, el solapamiento de rangos ya
  // alcanza. Con ellas hay que recorrer día por día, pero el recorrido está
  // acotado por el propio rango de la consulta.
  if ((!Array.isArray(dias) || !dias.length) && !tieneExcepciones) {
    return corte.estado !== 'suspendido';
  }
  const tope = fin < inicio ? inicio : fin;
  for (let fecha = maxFecha(inicio, corte.vigencia_desde); fecha <= tope; fecha = diaSiguiente(fecha)) {
    if (ocurreEn(corte, fecha)) return true;
  }
  return false;
}

const maxFecha = (a, b) => (a > b ? a : b);

function diaSiguiente(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia + 1));
  return d.toISOString().slice(0, 10);
}

/* ── Estado derivado ────────────────────────────────────────────────── */

/**
 * Cómo está el corte HOY. Cuatro valores, tres de ellos calculados:
 *
 *   · `suspendido` / `levantado` — los dos que sí se guardan
 *   · `vigente`    — hoy hay corte
 *   · `programado` — todavía no empezó, o es recurrente y hoy no toca
 *   · `finalizado` — se le pasó la fecha de fin
 */
export function estadoCorte(corte, hoy = hoyISO()) {
  if (!corte) return 'finalizado';
  if (corte.estado === 'suspendido') return 'suspendido';
  if (corte.estado === 'levantado') return 'levantado';
  if (ocurreEn(corte, hoy)) return 'vigente';
  if (corte.vigencia_hasta && corte.vigencia_hasta < hoy) return 'finalizado';
  if (corte.vigencia_desde > hoy) return 'programado';
  // Dentro del rango pero hoy no toca: una feria dominical un martes.
  return 'programado';
}

/** Nivel del semáforo del sistema para cada estado. Rojo = está cortado ahora. */
export const NIVEL_ESTADO_CORTE = Object.freeze({
  vigente: 'vencido',
  programado: 'proximo',
  finalizado: 'sindato',
  levantado: 'enregla',
  suspendido: 'sindato',
});

export const TEXTO_ESTADO_CORTE = Object.freeze({
  vigente: 'Cortado hoy',
  programado: 'Programado',
  finalizado: 'Finalizado',
  levantado: 'Levantado',
  suspendido: 'Suspendido',
});

/** Un corte abierto sin fecha de fin: el que desordena la agenda si nadie lo cierra. */
export function sinFechaDeFin(corte) {
  return Boolean(corte) && !corte.vigencia_hasta && corte.estado !== 'levantado' && corte.estado !== 'suspendido';
}

/* ── Lectura ────────────────────────────────────────────────────────── */

export function cortes(bd) {
  return (bd?.cortes ?? []).filter((c) => c.activo !== false);
}

/** Cortes con alguna ocurrencia en el rango, ordenados por inicio. */
export function cortesEnRango(bd, desde, hasta) {
  return cortes(bd)
    .filter((c) => ocurreEnRango(c, desde, hasta))
    .sort((a, b) => (a.vigencia_desde ?? '').localeCompare(b.vigencia_desde ?? ''));
}

/** Cortes de un evento. */
export function cortesDeEvento(bd, idEvento) {
  return cortes(bd).filter((c) => c.id_evento === idEvento);
}

/* ── Geometría guardada ─────────────────────────────────────────────── */

/**
 * Polilíneas del corte, en el `{ lat, lng }` que consume Leaflet.
 *
 * Se guarda así —y no como GeoJSON— porque es el formato que usa el resto del
 * sistema para coordenadas (`latitud`/`longitud` en proyectos) y porque se lee
 * sin traducir al mirar el JSON de la base. Al pasar a Postgres se convierte a
 * GeoJSON en la migración; el `[lon, lat]` de GeoJSON vive sólo en geoportal.js.
 */
export function lineasDeCorte(corte) {
  const lineas = corte?.geometria?.lineas;
  return Array.isArray(lineas) ? lineas : [];
}

export function puntoDeCorte(corte) {
  const punto = corte?.geometria?.punto;
  if (punto) return punto;
  const primera = lineasDeCorte(corte)[0];
  return primera?.[0] ?? null;
}

/** Todos los vértices, para encuadrar el mapa. */
export function verticesDe(corte) {
  if (corte?.forma === 'punto') {
    const punto = puntoDeCorte(corte);
    return punto ? [punto] : [];
  }
  return lineasDeCorte(corte).flat();
}

/* ── Texto ──────────────────────────────────────────────────────────── */

/**
 * Los tramos del corte, normalizados.
 *
 * Un corte se arma seleccionando cuadras en el mapa, y esas cuadras se agrupan
 * por calle: cerrar la vuelta de una manzana son cuatro tramos, uno por calle.
 * Los cortes cargados antes de la selección por cuadras tienen un solo tramo
 * en campos sueltos (`calle`, `esquina_desde`, `esquina_hasta`), así que se
 * arman al vuelo para que todo lo que lee un corte vea siempre lo mismo.
 */
export function tramosDe(corte) {
  if (Array.isArray(corte?.tramos) && corte.tramos.length) return corte.tramos;
  if (!corte?.calle) return [];
  return [
    {
      calle: corte.calle,
      esquina_desde: corte.esquina_desde ?? '',
      esquina_hasta: corte.esquina_hasta ?? '',
      localidad: corte.localidad ?? '',
      sentido: corte.sentido ?? '',
    },
  ];
}

/** "Av. San Martín entre Lavalle y Hornos" — un tramo dicho en voz alta. */
export function descripcionTramo(tramo) {
  if (!tramo) return '';
  const calle = tramo.calle || 'Sin calle';
  if (tramo.esquina_desde && tramo.esquina_hasta) {
    return `${calle} entre ${tramo.esquina_desde} y ${tramo.esquina_hasta}`;
  }
  // Sin esquinas resueltas queda la altura, que es la otra forma en que el
  // municipio nombra un lugar: «Fischetti al 500».
  const [min] = tramo.alturas ?? [];
  if (Number.isFinite(min)) return `${calle} al ${Math.floor(min / 100) * 100}`;
  if (tramo.esquina_desde) return `${calle} y ${tramo.esquina_desde}`;
  return calle;
}

/** El corte entero dicho en voz alta. Varios tramos se separan con punto y coma. */
export function ubicacionDe(corte) {
  if (!corte) return '';
  const tramos = tramosDe(corte);
  if (!tramos.length) {
    return corte.forma === 'punto' && corte.calle ? corte.calle : '';
  }
  if (corte.forma === 'punto' && tramos.length === 1) {
    const { calle, esquina_desde: cruce } = tramos[0];
    return cruce ? `${calle} y ${cruce}` : calle;
  }
  return tramos.map(descripcionTramo).join('; ');
}

/** Cuántas cuadras abarca el corte. */
export function cuadrasDe(corte) {
  return Array.isArray(corte?.cuadras) ? corte.cuadras.length : 0;
}

const hhmm = (hora) => (hora ? hora.slice(0, 5) : '');

/** Fecha ISO como dd/mm. El año se agrega sólo si no es el corriente. */
function fechaCorta(iso, hoy = hoyISO()) {
  if (!iso) return '';
  const [anio, mes, dia] = iso.split('-');
  return anio === hoy.slice(0, 4) ? `${dia}/${mes}` : `${dia}/${mes}/${anio}`;
}

/** "Domingos de 08:00 a 14:00, hasta el 31/12" — la vigencia en una línea. */
export function vigenciaDe(corte, hoy = hoyISO()) {
  if (!corte?.vigencia_desde) return 'Sin vigencia cargada';
  const partes = [];
  const dias = corte.dias_semana;
  const repite = Array.isArray(dias) && dias.length > 0;

  if (repite) {
    const nombres = [...dias].sort().map((d) => `${NOMBRE_DIA[d]}s`);
    partes.push(nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`);
  } else if (corte.vigencia_hasta && corte.vigencia_hasta !== corte.vigencia_desde) {
    partes.push(`Del ${fechaCorta(corte.vigencia_desde, hoy)} al ${fechaCorta(corte.vigencia_hasta, hoy)}`);
  } else {
    partes.push(fechaCorta(corte.vigencia_desde, hoy));
  }

  if (corte.hora_desde) {
    partes.push(corte.hora_hasta ? `de ${hhmm(corte.hora_desde)} a ${hhmm(corte.hora_hasta)}` : `desde ${hhmm(corte.hora_desde)}`);
  }
  if (repite) {
    partes.push(
      corte.vigencia_hasta
        ? `hasta el ${fechaCorta(corte.vigencia_hasta, hoy)}`
        : `desde el ${fechaCorta(corte.vigencia_desde, hoy)}, sin fecha de fin`,
    );
  } else if (!corte.vigencia_hasta) {
    partes.push('sin fecha de levantamiento');
  }
  return partes.join(' ');
}

/**
 * El aviso listo para pegar en un mail o un WhatsApp.
 *
 * Es la parte que el jefe pidió como "avisarle a otras áreas": mientras no haya
 * notificaciones dentro del portal, el sistema redacta y la persona envía.
 */
export function textoAviso(corte, contexto = []) {
  const lineas = [`Corte de calle — ${ubicacionDe(corte)}${corte.localidad ? ` (${corte.localidad})` : ''}.`];
  lineas.push(`${vigenciaDe(corte)}. ${textoAlcance(corte)}.`);
  if (corte.motivo) lineas.push(`Motivo: ${textoMotivo(corte)}.`);
  if (corte.area_solicitante) lineas.push(`Solicitado por: ${corte.area_solicitante}.`);
  const afectados = contexto.filter((c) => c.cantidad > 0);
  if (afectados.length) {
    lineas.push('');
    lineas.push('Puede afectar:');
    for (const capa of afectados) {
      lineas.push(`- ${capa.titulo}: ${capa.etiquetas.slice(0, 6).join(', ')}${capa.etiquetas.length > 6 ? ', entre otros' : ''}.`);
    }
  }
  if (corte.observaciones) {
    lineas.push('');
    lineas.push(corte.observaciones);
  }
  return lineas.join('\n');
}

export const TEXTO_MOTIVO = Object.freeze({
  evento: 'Evento',
  obra: 'Obra',
  operativo: 'Operativo',
  externo: 'Informado por un tercero',
  otro: 'Otro',
});

/** El motivo como se muestra. Guardado va en minúscula, que es el valor. */
export function textoMotivo(corte) {
  const base = TEXTO_MOTIVO[corte?.motivo] ?? corte?.motivo ?? 'Sin motivo';
  return corte?.detalle_motivo ? `${base} — ${corte.detalle_motivo}` : base;
}

export const TEXTO_ALCANCE = Object.freeze({
  total: 'Corte total',
  media_calzada: 'Corte de media calzada',
  desvio: 'Desvío de tránsito',
});

export function textoAlcance(corte) {
  return TEXTO_ALCANCE[corte?.alcance] ?? 'Corte';
}
