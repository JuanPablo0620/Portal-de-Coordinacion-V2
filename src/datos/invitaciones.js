/**
 * Invitaciones a una reunión de mesa: la plantilla, el evento de Calendar y el
 * texto de la convocatoria.
 *
 * Desde el 09/10/2026 el portal crea el evento en el Calendar de quien convoca
 * (Google manda la invitación a los invitados en ese momento) y prepara la
 * convocatoria como borrador de Gmail, con la misma conexión OAuth que las
 * convocatorias de seguimiento (`googleConvocatorias.js`). Antes abría Calendar
 * y Gmail en otra pestaña con links precargados, para no pedir permisos
 * sensibles; esa razón dejó de valer cuando el portal pasó a pedirlos igual.
 */

export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

/**
 * La agenda de eventos no es una mesa (ver `Mesas.jsx`), pero también convoca
 * reuniones: su plantilla se guarda con esta clave en lugar de un id de mesa.
 */
export const CLAVE_EVENTOS = 'eventos';

export const DURACIONES = [
  { valor: '30', titulo: '30 minutos' },
  { valor: '60', titulo: '1 hora' },
  { valor: '90', titulo: '1 hora y media' },
  { valor: '120', titulo: '2 horas' },
];

/**
 * Lo que se puede escribir entre llaves en el asunto, el mensaje y el título
 * del evento. `{fecha}` es «miércoles 7 de octubre»; `{fecha_corta}`,
 * «miércoles 07/10»; `{dia}`, «07/10».
 */
export const VARIABLES = ['mesa', 'fecha', 'fecha_corta', 'dia', 'hora', 'lugar', 'link'];

/**
 * La plantilla con la que arranca una mesa que todavía no tiene una propia.
 * La de la agenda de eventos reproduce la convocatoria que JP manda a mano
 * (09/10/2026), con sus negritas: `**texto**` sale en negrita en el mail.
 */
export function plantillaBase(clave) {
  if (clave === CLAVE_EVENTOS) {
    return {
      titulo_evento: 'Reunión Mesa Eventos',
      asunto: 'Mesa Eventos | {dia}',
      mensaje:
        '¡Buenas tardes a todos!\n\n' +
        'Espero que se encuentren muy bien.\n\n' +
        'Los convocamos el día **{fecha_corta}** a las **{hora}hs**. ' +
        'La modalidad de la misma será presencial en la **{lugar}**.\n\n' +
        '**Les pedimos que confirmen su asistencia vía calendar**\n\n' +
        'Desde ya, muchas gracias.',
      invitados: [],
      url_presentacion: '',
      hora: '15:00',
      duracion_min: 60,
      lugar: 'Sala de Reuniones de la Privada',
    };
  }
  return {
    titulo_evento: 'Reunión {mesa}',
    asunto: '{mesa}: reunión del {fecha}',
    mensaje:
      'Hola, ¿cómo están?\n\n' +
      'Los convocamos a la próxima reunión de {mesa}, el {fecha} a las {hora}.\n\n' +
      'Les compartimos la presentación para que cada área complete su parte antes del encuentro:\n' +
      '{link}\n\n' +
      'Saludos.',
    invitados: [],
    url_presentacion: '',
    hora: '10:00',
    duracion_min: 60,
    lugar: '',
  };
}

/**
 * Completa lo que falte con la base y descarta lo que no tenga la forma
 * esperada. Lo guardado viene del navegador y puede ser de una versión
 * anterior del formulario: mejor una plantilla por defecto que un modal roto.
 */
export function normalizarPlantilla(guardada, clave) {
  const base = plantillaBase(clave);
  if (!guardada || typeof guardada !== 'object') return base;
  const texto = (v, porDefecto) => (typeof v === 'string' ? v : porDefecto);
  const duracion = Number(guardada.duracion_min);
  return {
    titulo_evento: texto(guardada.titulo_evento, base.titulo_evento),
    asunto: texto(guardada.asunto, base.asunto),
    mensaje: texto(guardada.mensaje, base.mensaje),
    invitados: Array.isArray(guardada.invitados) ? guardada.invitados.filter(esMailValido) : base.invitados,
    url_presentacion: texto(guardada.url_presentacion, base.url_presentacion),
    hora: /^\d{2}:\d{2}$/.test(guardada.hora ?? '') ? guardada.hora : base.hora,
    // Sólo las del selector: otra duración dejaría el campo en blanco.
    duracion_min: DURACIONES.some((d) => Number(d.valor) === duracion) ? duracion : base.duracion_min,
    lugar: texto(guardada.lugar, base.lugar),
  };
}

/* ── Invitados ──────────────────────────────────────────────────────── */

const MAIL = /[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[^\s@,;<>"'()]+/g;

export const esMailValido = (texto) => {
  const limpio = String(texto ?? '').trim();
  return limpio !== '' && (limpio.match(MAIL) ?? [])[0] === limpio;
};

/**
 * Agrega a la lista lo que se escribió o se pegó.
 *
 * Acepta lo que sale de copiar destinatarios de un mail o una columna de una
 * planilla: separados por coma, punto y coma o salto de línea, y con el formato
 * «Nombre <mail>». Cada tramo que no trae un mail se devuelve en `invalidos`
 * para mostrarlo en el campo, en vez de descartarlo en silencio. Los mails se
 * guardan en minúscula para que el mismo invitado no quede dos veces.
 */
export function agregarMails(lista, texto) {
  const nueva = [...lista];
  const invalidos = [];
  for (const tramo of String(texto ?? '').split(/[,;\n]+/)) {
    const limpio = tramo.trim();
    if (!limpio) continue;
    const encontrados = limpio.match(MAIL);
    if (!encontrados) {
      invalidos.push(limpio);
      continue;
    }
    for (const mail of encontrados.map((m) => m.toLowerCase())) {
      if (!nueva.includes(mail)) nueva.push(mail);
    }
  }
  return { lista: nueva, invalidos };
}

/* ── Texto de la invitación ─────────────────────────────────────────── */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * «jueves 2 de octubre». Sin año: una convocatoria es para las próximas
 * semanas. El día de la semana se calcula en UTC a propósito —con el huso local,
 * un ISO sin hora cae en el día anterior (ver `fecha()` en `formato.js`)—.
 */
export function fechaConvocatoria(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return `${dia} ${d} de ${MESES[m - 1]}`;
}

/** «07/10» y «miércoles 07/10», como los escribe el equipo en asunto y cuerpo. */
export function diaMes(iso) {
  if (!iso) return '';
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
}

export function fechaCorta(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${diaMes(iso)}`;
}

export function completarVariables(texto, valores) {
  return String(texto ?? '').replace(/\{(\w+)\}/g, (entero, clave) =>
    VARIABLES.includes(clave) ? (valores[clave] ?? '') : entero,
  );
}

/**
 * Título y cuerpo listos para mandar.
 *
 * Si el mensaje no usa `{link}` pero hay presentación cargada, el link va al
 * pie igual: es lo que las áreas necesitan de la convocatoria, y borrar la
 * variable al retocar el texto no debería dejarlas sin él.
 */
export function armarInvitacion(plantilla, { nombre, fecha }) {
  const link = plantilla.url_presentacion.trim();
  const valores = {
    mesa: nombre, fecha: fechaConvocatoria(fecha), fecha_corta: fechaCorta(fecha), dia: diaMes(fecha),
    hora: plantilla.hora, lugar: plantilla.lugar.trim(), link,
  };
  let cuerpo = completarVariables(plantilla.mensaje, valores).replace(/\n{3,}/g, '\n\n').trim();
  if (link && !cuerpo.includes(link)) cuerpo += `\n\nPresentación: ${link}`;
  return {
    titulo: completarVariables(plantilla.asunto, valores).trim(),
    cuerpo,
    tituloEvento: completarVariables(plantilla.titulo_evento, valores).trim(),
  };
}

/** Qué le falta a la invitación para poder abrirla. `{}` si está completa. */
export function validarInvitacion(plantilla, fecha, hoy) {
  const errores = {};
  if (!fecha) errores.fecha = 'Indicá la fecha de la reunión.';
  else if (hoy && fecha < hoy) errores.fecha = 'La fecha ya pasó.';
  if (!/^\d{2}:\d{2}$/.test(plantilla.hora)) errores.hora = 'Indicá la hora.';
  if (!plantilla.invitados.length) errores.invitados = 'Agregá al menos un invitado.';
  if (!plantilla.asunto.trim()) errores.asunto = 'El asunto no puede quedar vacío.';
  if (!plantilla.titulo_evento.trim()) errores.titulo_evento = 'El evento necesita un título.';
  const link = plantilla.url_presentacion.trim();
  if (link && !/^https?:\/\/\S+$/.test(link)) {
    errores.url_presentacion = 'Tiene que ser un link completo, que empiece con https://';
  } else if (!link && /\{link\}/.test(plantilla.mensaje)) {
    errores.url_presentacion = 'El mensaje incluye {link}: cargá el link de la presentación o sacalo del texto.';
  }
  return errores;
}

/* ── Evento de Calendar ─────────────────────────────────────────────── */

/**
 * Inicio y fin en hora de reloj con el huso aparte, como los acepta la API de
 * Calendar. La cuenta se hace en UTC sólo para que sumar la duración cruce bien
 * la medianoche; ningún valor se convierte de zona.
 */
export function horarioEvento(fechaISO, hora, duracionMin) {
  const [a, m, d] = fechaISO.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const dos = (n) => String(n).padStart(2, '0');
  const sello = (minutos) => {
    const t = new Date(Date.UTC(a, m - 1, d, h, mi + minutos));
    return `${t.getUTCFullYear()}-${dos(t.getUTCMonth() + 1)}-${dos(t.getUTCDate())}T${dos(t.getUTCHours())}:${dos(t.getUTCMinutes())}:00`;
  };
  return {
    start: { dateTime: sello(0), timeZone: ZONA_HORARIA },
    end: { dateTime: sello(Number(duracionMin)), timeZone: ZONA_HORARIA },
  };
}
