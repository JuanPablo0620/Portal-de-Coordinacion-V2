/**
 * Invitaciones a una reunión de mesa: la plantilla y los links a Google.
 *
 * El portal NO manda nada por su cuenta. Arma una URL de Google Calendar o de
 * Gmail con todo precargado y la abre en otra pestaña: como el navegador ya
 * tiene iniciada la sesión de Google de cada persona, el evento o el correo
 * salen de SU cuenta, y el último clic —«Guardar» o «Enviar»— lo da ella en
 * la pantalla de Google.
 *
 * Se eligió así y no la API de Google con OAuth porque `calendar.events` y
 * `gmail.send` son permisos que Google clasifica como sensibles: pedirlos
 * obliga a pasar su verificación o a quedarse en modo prueba, con los usuarios
 * cargados a mano y el cartel de «app no verificada». El costo es que el
 * portal no se entera de si la invitación efectivamente salió. Estas URLs
 * tampoco son una API documentada —son estables hace años, pero Google no las
 * garantiza—; si algún día se rompen o hace falta saber que se mandó, lo que
 * cambia es sólo la salida (`urlGoogleCalendar`, `urlGmail`): la plantilla y
 * el modal se reusan.
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
 * Por encima de este largo Google responde «414 URI too long» en vez de abrir
 * el borrador, y el usuario ve una página de error que no explica nada. Se
 * corta antes, con un mensaje que dice qué acortar.
 */
export const LARGO_MAXIMO_URL = 8000;

/** Lo que se puede escribir entre llaves en el asunto y el mensaje. */
export const VARIABLES = ['mesa', 'fecha', 'hora', 'lugar', 'link'];

/** La plantilla con la que arranca una mesa que todavía no tiene una propia. */
export function plantillaBase() {
  return {
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
export function normalizarPlantilla(guardada) {
  const base = plantillaBase();
  if (!guardada || typeof guardada !== 'object') return base;
  const texto = (v, porDefecto) => (typeof v === 'string' ? v : porDefecto);
  const duracion = Number(guardada.duracion_min);
  return {
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
  const valores = { mesa: nombre, fecha: fechaConvocatoria(fecha), hora: plantilla.hora, lugar: plantilla.lugar.trim(), link };
  let cuerpo = completarVariables(plantilla.mensaje, valores).replace(/\n{3,}/g, '\n\n').trim();
  if (link && !cuerpo.includes(link)) cuerpo += `\n\nPresentación: ${link}`;
  return { titulo: completarVariables(plantilla.asunto, valores).trim(), cuerpo };
}

/** Qué le falta a la invitación para poder abrirla. `{}` si está completa. */
export function validarInvitacion(plantilla, fecha, hoy) {
  const errores = {};
  if (!fecha) errores.fecha = 'Indicá la fecha de la reunión.';
  else if (hoy && fecha < hoy) errores.fecha = 'La fecha ya pasó.';
  if (!/^\d{2}:\d{2}$/.test(plantilla.hora)) errores.hora = 'Indicá la hora.';
  if (!plantilla.invitados.length) errores.invitados = 'Agregá al menos un invitado.';
  if (!plantilla.asunto.trim()) errores.asunto = 'El asunto no puede quedar vacío.';
  const link = plantilla.url_presentacion.trim();
  if (link && !/^https?:\/\/\S+$/.test(link)) {
    errores.url_presentacion = 'Tiene que ser un link completo, que empiece con https://';
  } else if (!link && /\{link\}/.test(plantilla.mensaje)) {
    errores.url_presentacion = 'El mensaje incluye {link}: cargá el link de la presentación o sacalo del texto.';
  }
  return errores;
}

/* ── Links a Google ─────────────────────────────────────────────────── */

/**
 * La cuenta con la que se abre Google, para quien tiene varias iniciadas en el
 * navegador. Sólo se fuerza cuando el mail del portal ES una cuenta de Google
 * seguro: con un mail institucional que no lo es, Google pediría iniciar sesión
 * con él en lugar de usar la cuenta que la persona ya tiene abierta.
 */
export function cuentaGoogleDe(email) {
  const limpio = String(email ?? '').trim().toLowerCase();
  return /@(gmail|googlemail)\.com$/.test(limpio) ? limpio : '';
}

/**
 * `encodeURIComponent` y no `URLSearchParams`: este último codifica los espacios
 * como «+», y no todas las pantallas de Google lo decodifican igual.
 */
const consulta = (pares) =>
  pares
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

/**
 * «AAAAMMDDTHHMMSS» en hora de reloj, sin huso: el huso va aparte en `ctz`.
 * La cuenta se hace en UTC sólo para que sumar la duración cruce bien la
 * medianoche; ningún valor se convierte de zona.
 */
function selloCalendar(fechaISO, hora, sumarMinutos = 0) {
  const [a, m, d] = fechaISO.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d, h, mi + sumarMinutos));
  const dos = (n) => String(n).padStart(2, '0');
  return (
    `${t.getUTCFullYear()}${dos(t.getUTCMonth() + 1)}${dos(t.getUTCDate())}` +
    `T${dos(t.getUTCHours())}${dos(t.getUTCMinutes())}00`
  );
}

export function urlGoogleCalendar({ titulo, cuerpo, lugar, fecha, hora, duracionMin, invitados, cuenta }) {
  return (
    'https://calendar.google.com/calendar/render?' +
    consulta([
      ['action', 'TEMPLATE'],
      ['text', titulo],
      ['dates', `${selloCalendar(fecha, hora)}/${selloCalendar(fecha, hora, duracionMin)}`],
      ['ctz', ZONA_HORARIA],
      ['details', cuerpo],
      ['location', lugar],
      ['add', invitados.join(',')],
      ['authuser', cuenta],
    ])
  );
}

export function urlGmail({ titulo, cuerpo, invitados, cuenta }) {
  return (
    'https://mail.google.com/mail/?' +
    consulta([
      ['view', 'cm'],
      ['fs', '1'],
      ['to', invitados.join(',')],
      ['su', titulo],
      ['body', cuerpo],
      ['authuser', cuenta],
    ])
  );
}
