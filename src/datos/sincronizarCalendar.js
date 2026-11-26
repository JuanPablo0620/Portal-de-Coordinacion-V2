/**
 * Corregir la agenda de seguimientos contra Google Calendar.
 *
 * Las reuniones de seguimiento las crea en Calendar la secretaria de cada
 * área, y se mueven ahí: el portal se enteraba sólo si alguien cargaba el
 * cambio a mano. Esto compara las dos agendas y PROPONE las correcciones; nada
 * se escribe hasta que la persona las revisa y las aplica.
 *
 * El portal no guarda el id del evento de Calendar, así que el cruce es por
 * secretaría (deducida del título) y fecha:
 *
 *  1. Mismo día y misma secretaría → es la misma reunión. Si cambió la hora,
 *     se propone corregirla.
 *  2. Lo que queda de cada lado se empareja por cercanía, hasta
 *     `MAX_DIAS_REPROGRAMACION`: una reunión agendada para el 25 que en
 *     Calendar quedó para el 27 es una reprogramación, no una baja y un alta.
 *  3. Lo que sobra en Calendar se propone agendar; lo que sobra en el portal
 *     se marca como «sin evento», y su baja viene destildada: puede ser una
 *     reunión a la que quien sincroniza no está invitado.
 *
 * Los seguimientos ya realizados no se tocan nunca: sólo absorben el evento
 * de su mismo día para que no se proponga agendarlo otra vez.
 */
import { coincidenciaUnica, moverFecha } from './convocatorias.js';

export const DIAS_SINCRONIZADOS = 90;
export const MAX_DIAS_REPROGRAMACION = 21;
const ZONA = 'America/Argentina/Buenos_Aires';

/** Fecha y hora argentinas del evento, aunque Calendar lo devuelva en otro huso. */
export function fechaHoraDelEvento(evento) {
  const instante = new Date(evento?.start?.dateTime ?? '');
  if (Number.isNaN(instante.getTime())) return null;
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instante);
  const valor = (tipo) => partes.find((p) => p.type === tipo)?.value;
  return { fecha: `${valor('year')}-${valor('month')}-${valor('day')}`, hora: `${valor('hour')}:${valor('minute')}` };
}

const diasEntre = (a, b) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);

/**
 * Las áreas contra las que se lee un título: las secretarías activas, más
 * cualquier otra que ya tenga seguimientos (para no perder un área que no se
 * llame «Secretaría de…»).
 */
function areasCandidatas(areas, seguimientos) {
  const conSeguimiento = new Set(seguimientos.map((s) => s.area));
  return areas.filter((a) => a.activo !== false && (/^secretar[ií]a/i.test(a.nombre ?? '') || conSeguimiento.has(a.nombre)));
}

/**
 * @param {object} p
 * @param {object[]} p.eventos       Eventos de Calendar con «seguimiento» en el título, ya sin cancelados.
 * @param {object[]} p.seguimientos  `bd.seguimientos`.
 * @param {object[]} p.areas         Catálogo de áreas (`bd.catalogos.areas`).
 * @param {string}   p.hoy           AAAA-MM-DD.
 * @param {number}  [p.dias]         Largo de la ventana revisada.
 */
export function compararConCalendar({ eventos, seguimientos, areas, hoy, dias = DIAS_SINCRONIZADOS }) {
  const fin = moverFecha(hoy, dias);
  const enVentana = (fecha) => fecha >= hoy && fecha < fin;
  const vigentes = seguimientos.filter((s) => s.activo !== false && enVentana(s.fecha ?? ''));
  const candidatas = areasCandidatas(areas, seguimientos);

  const sinArea = [];
  const porArea = new Map();
  const grupo = (area) => {
    if (!porArea.has(area)) porArea.set(area, { calendar: [], portal: [] });
    return porArea.get(area);
  };

  for (const evento of eventos) {
    const cuando = fechaHoraDelEvento(evento);
    if (!cuando || !enVentana(cuando.fecha)) continue;
    const titulo = (evento.summary ?? '').trim();
    const area = coincidenciaUnica(titulo, candidatas, (a) => a.nombre)?.nombre;
    if (!area) { sinArea.push({ id: evento.id, titulo, ...cuando }); continue; }
    const { calendar } = grupo(area);
    // Dos eventos del mismo día para la misma secretaría son la misma reunión
    // cargada dos veces: agendar los dos duplicaría el seguimiento.
    if (calendar.some((c) => c.fecha === cuando.fecha)) continue;
    calendar.push({ id: evento.id, titulo, enlace: evento.htmlLink ?? '', ...cuando });
  }
  for (const s of vigentes) grupo(s.area).portal.push(s);

  const coinciden = [];
  const reprogramar = [];
  const agendar = [];
  const sinEvento = [];

  for (const [area, { calendar, portal }] of porArea) {
    const libresCal = new Set(calendar);
    const libresPortal = new Set(portal);
    const emparejar = (evento, seguimiento) => {
      libresCal.delete(evento);
      libresPortal.delete(seguimiento);
      const igual = seguimiento.fecha === evento.fecha && (seguimiento.hora ?? '') === evento.hora;
      if (igual || seguimiento.tipo !== 'programado') coinciden.push({ area, seguimiento, evento });
      else reprogramar.push({ area, seguimiento, evento, fecha: evento.fecha, hora: evento.hora });
    };

    // 1. Mismo día. Un realizado gana sobre un agendado del mismo día: es la
    //    reunión que ya ocurrió, y el agendado sobrante queda como duplicado.
    for (const evento of calendar) {
      const mismoDia = portal.filter((s) => libresPortal.has(s) && s.fecha === evento.fecha)
        .sort((a, b) => (a.tipo === 'programado') - (b.tipo === 'programado'));
      if (mismoDia[0]) emparejar(evento, mismoDia[0]);
    }

    // 2. Reprogramaciones: el par más cercano primero, sólo entre agendados.
    const pares = [];
    for (const evento of libresCal) {
      for (const s of libresPortal) {
        if (s.tipo !== 'programado') continue;
        const distancia = Math.abs(diasEntre(evento.fecha, s.fecha));
        if (distancia <= MAX_DIAS_REPROGRAMACION) pares.push({ evento, s, distancia });
      }
    }
    pares.sort((a, b) => a.distancia - b.distancia || a.evento.fecha.localeCompare(b.evento.fecha));
    for (const { evento, s } of pares) {
      if (libresCal.has(evento) && libresPortal.has(s)) emparejar(evento, s);
    }

    // 3. Lo que sobra.
    for (const evento of libresCal) agendar.push({ area, evento, fecha: evento.fecha, hora: evento.hora });
    for (const s of libresPortal) if (s.tipo === 'programado') sinEvento.push({ area, seguimiento: s });
  }

  const porFecha = (a, b) => String(a.fecha ?? a.seguimiento?.fecha).localeCompare(String(b.fecha ?? b.seguimiento?.fecha));
  return {
    desde: hoy,
    hasta: moverFecha(fin, -1),
    coinciden,
    reprogramar: reprogramar.sort(porFecha),
    agendar: agendar.sort(porFecha),
    sinEvento: sinEvento.sort(porFecha),
    sinArea: sinArea.sort(porFecha),
  };
}

/** El alta de un seguimiento agendado desde Calendar, con la misma forma que «Agendar seguimiento». */
export function seguimientoDesdeCalendar({ area, fecha, hora }) {
  return {
    area, fecha, hora,
    ids_proyecto: [],
    tipo: 'programado',
    texto_crudo: '',
    resumen: '',
    avances: [],
    problemas: [],
    estado_reportado: '',
  };
}
