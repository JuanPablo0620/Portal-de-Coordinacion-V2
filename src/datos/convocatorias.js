/**
 * Convocatoria de Seguimiento: reglas independientes de Google y de la UI.
 * Los destinatarios salen del evento elegido, nunca del texto «participantes»
 * del portal. La fecha de entrega se propone para el día anterior y se revisa.
 */
import { agregarMails } from './invitaciones.js';

export const MIME_CARPETA = 'application/vnd.google-apps.folder';
export const MIME_DOC = 'application/vnd.google-apps.document';
export const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MIME_PPT = 'application/vnd.google-apps.presentation';
export const MIME_PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const MAX_PDF = 8 * 1024 * 1024;
const ZONA = 'America/Argentina/Buenos_Aires';

export const normalizarNombre = (texto = '') => String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function validarFecha(fecha) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '') &&
    !Number.isNaN(Date.parse(fecha)) && new Date(`${fecha}T12:00:00Z`).toISOString().slice(0, 10) === fecha;
}

export function moverFecha(fecha, dias) {
  if (!validarFecha(fecha)) throw new Error('La fecha de la reunión no es válida.');
  const dia = new Date(`${fecha}T12:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + dias);
  return dia.toISOString().slice(0, 10);
}

export function fechaCorta(fecha) {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
}

export function fechaConDia(fecha) {
  const dia = new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: 'UTC' })
    .format(new Date(`${fecha}T12:00:00Z`));
  return `${dia} ${fechaCorta(fecha)}`;
}

/** Calendar puede devolver UTC u otro huso: el mail siempre usa la hora local. */
export function datosDelEvento(evento) {
  if (evento.status === 'cancelled') throw new Error('La reunión fue cancelada en Calendar.');
  if (!evento.start?.dateTime) throw new Error('Elegí una reunión con horario, no un evento de día completo.');
  if (evento.attendeesOmitted) throw new Error('Calendar no permite ver todos los invitados de esta reunión.');
  const instante = new Date(evento.start.dateTime);
  if (Number.isNaN(instante.getTime())) throw new Error('Calendar no devolvió una fecha válida.');
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instante);
  const valor = (tipo) => partes.find((p) => p.type === tipo)?.value;
  const invitados = (evento.attendees ?? []).filter((p) => !p.resource).map((p) => p.email);
  const { lista, invalidos } = agregarMails([], invitados.join(', '));
  if (invalidos.length) throw new Error('Hay un invitado sin una dirección de correo válida en Calendar.');
  return {
    fecha: `${valor('year')}-${valor('month')}-${valor('day')}`,
    hora: `${valor('hour')}:${valor('minute')}`,
    lugar: evento.location ?? '',
    destinatarios: lista.join(', '),
  };
}

/** Se acepta una URL de Google Drive/Docs o el ID, nunca una URL arbitraria. */
export function idDeDrive(valor) {
  const texto = String(valor ?? '').trim();
  if (/^[\w-]{10,200}$/.test(texto)) return texto;
  let url;
  try { url = new URL(texto); } catch { throw new Error('Pegá el enlace de la carpeta de Drive.'); }
  if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname)) {
    throw new Error('El enlace debe ser de Google Drive.');
  }
  const id = url.pathname.match(/\/(?:folders|d)\/([\w-]+)/)?.[1] ?? url.searchParams.get('id');
  if (!id || !/^[\w-]{10,200}$/.test(id)) throw new Error('El enlace no identifica una carpeta de Drive.');
  return id;
}

export function siguienteNumero(archivos) {
  return String(Math.max(0, ...archivos.map((a) => Number(a.name.match(/^(\d+)\./)?.[1] ?? 0))) + 1).padStart(2, '0');
}

export function nombrePresentacion(archivos, area, fecha, plantilla) {
  const extension = plantilla.mimeType === MIME_PPTX ? '.pptx' : '';
  return `${siguienteNumero(archivos)}. Seguimiento ${area} ${fechaCorta(fecha)}${extension}`;
}

/** Se ordena por fecha de reunión en el nombre, nunca por última edición. */
export function fechaDelArchivo(archivo, anio) {
  const partes = archivo.name.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (!partes) return '';
  const fecha = `${partes[3] ?? anio}-${partes[2].padStart(2, '0')}-${partes[1].padStart(2, '0')}`;
  return validarFecha(fecha) ? fecha : '';
}

export function materialesSugeridos(presentaciones, compromisos, fecha) {
  const anio = fecha.slice(0, 4);
  const anteriores = compromisos.filter((a) => {
    const dia = fechaDelArchivo(a, anio);
    return dia && dia < fecha;
  }).sort((a, b) => fechaDelArchivo(b, anio).localeCompare(fechaDelArchivo(a, anio)));
  const ultimaFecha = anteriores[0] && fechaDelArchivo(anteriores[0], anio);
  const ultimos = anteriores.filter((a) => fechaDelArchivo(a, anio) === ultimaFecha);
  const actuales = presentaciones.filter((a) => fechaDelArchivo(a, anio) === fecha);
  const templates = presentaciones.filter((a) => /template|plantilla/.test(normalizarNombre(a.name)));
  return {
    presentacion: actuales.length === 1 ? actuales[0].id : '',
    compromiso: ultimos.length === 1 ? ultimos[0].id : '',
    plantilla: templates.length === 1 ? templates[0].id : '',
  };
}

export function textoConvocatoria({ area, fecha, hora, lugar, modalidad, entrega, firma }) {
  return {
    asunto: `Convocatoria | Reunión de seguimiento ${area} ${fechaCorta(fecha)}`,
    mensaje: `¡¡Buenos días a todos!!\n\n` +
      `Los convocamos el día **${fechaConDia(fecha)} a las ${hora} hs** a la **Reunión de Seguimiento de ${area}**. ` +
      `La modalidad de la misma será **${modalidad} en ${lugar}**.\n` +
      `Les pedimos que nos envíen la presentación el **${fechaConDia(entrega)}** así contamos con el tiempo suficiente para adecuar el formato, realizar consultas y mostrarles la versión final de ser necesario.\n` +
      `En este mail les adjunto los compromisos de la reunión pasada y les comparto la presentación:\n` +
      `[PPT | Seguimiento ${fechaCorta(fecha)}]\n\n` +
      `Cualquier duda, estoy a disposición.\n\n${firma}`,
  };
}

/**
 * El mensaje se edita como texto plano con dos marcas: **texto** va en negrita
 * y [texto] es el enlace a la presentación. No es un editor enriquecido ni
 * Markdown completo a propósito: el único enlace legítimo de la convocatoria es
 * la PPT, así que un corchete no puede apuntar a otra URL aunque se edite el texto.
 */
export function segmentosMensaje(mensaje = '') {
  return String(mensaje).split(/(\*\*[^*\n]+\*\*|\[[^\]\n]+\])/).filter(Boolean).map((parte) => {
    if (/^\*\*[^*\n]+\*\*$/.test(parte)) return { tipo: 'negrita', texto: parte.slice(2, -2) };
    if (/^\[[^\]\n]+\]$/.test(parte)) return { tipo: 'enlace', texto: parte.slice(1, -1) };
    return { tipo: 'texto', texto: parte };
  });
}

const escaparHtml = (texto) => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function mensajeHtml(mensaje, presentacion) {
  const cuerpo = segmentosMensaje(mensaje).map(({ tipo, texto }) => {
    if (tipo === 'negrita') return `<strong>${escaparHtml(texto)}</strong>`;
    if (tipo === 'enlace') return `<a href="${escaparHtml(presentacion)}">${escaparHtml(texto)}</a>`;
    return escaparHtml(texto);
  }).join('').replace(/\r?\n/g, '<br>\r\n');
  return `<div dir="ltr">${cuerpo}</div>`;
}

/** Versión sin formato para clientes que no muestran HTML: el enlace va escrito. */
export function mensajePlano(mensaje, presentacion) {
  return segmentosMensaje(mensaje).map(({ tipo, texto }) => (tipo === 'enlace' ? `${texto}\n${presentacion}` : texto)).join('');
}

export function validarConvocatoria(datos, pdf) {
  if (!validarFecha(datos.fecha) || !validarFecha(datos.entrega) || datos.entrega > datos.fecha) {
    throw new Error('Revisá la fecha de reunión y la fecha de entrega de la presentación.');
  }
  if (!datos.area?.trim() || !datos.lugar?.trim() || !datos.modalidad?.trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(datos.hora ?? '')) {
    throw new Error('Completá secretaría, hora, modalidad y lugar de la reunión.');
  }
  const { lista, invalidos } = agregarMails([], datos.destinatarios ?? '');
  if (!lista.length || invalidos.length || lista.length > 200 || /(?:^|[\r\n])\s*(?:to|cc|bcc|from|subject):/i.test(datos.destinatarios)) {
    throw new Error('Revisá los destinatarios: deben ser correos válidos (hasta 200).');
  }
  if (!datos.asunto?.trim() || /[\r\n]/.test(datos.asunto) || datos.asunto.length > 500) throw new Error('Revisá el asunto del mail.');
  if (!datos.mensaje?.trim() || datos.mensaje.length > 50000) throw new Error('Revisá el mensaje del mail.');
  if (!segmentosMensaje(datos.mensaje).some((s) => s.tipo === 'enlace')) {
    throw new Error('El mensaje debe incluir el enlace a la presentación: escribí el texto del enlace entre corchetes.');
  }
  let url;
  try { url = new URL(datos.presentacion); } catch { throw new Error('Falta el enlace de la presentación.'); }
  if (url.protocol !== 'https:' || !['docs.google.com', 'drive.google.com'].includes(url.hostname)) throw new Error('La presentación debe tener un enlace de Google Drive.');
  validarPDF(pdf);
  return lista;
}

export function validarPDF(pdf) {
  if (!(pdf?.bytes instanceof Uint8Array) || !pdf.bytes.length || pdf.bytes.length > MAX_PDF ||
      new TextDecoder().decode(pdf.bytes.slice(0, 5)) !== '%PDF-') {
    throw new Error('Adjuntá un PDF válido de compromisos, de hasta 8 MB.');
  }
}

export function aBase64(bytes) {
  let binario = '';
  for (let inicio = 0; inicio < bytes.length; inicio += 8192) {
    binario += String.fromCharCode(...bytes.subarray(inicio, inicio + 8192));
  }
  return btoa(binario);
}

const codificarTexto = (texto) => aBase64(new TextEncoder().encode(texto));
const lineasBase64 = (texto) => texto.match(/.{1,76}/g)?.join('\r\n') ?? '';

/** MIME real: preserva acentos y PDF, y evita inyección de cabeceras. */
export function mensajeMime(datos, pdf, remitente, limite = `convocatoria_${crypto.randomUUID()}`) {
  const destinatarios = validarConvocatoria(datos, pdf);
  const { lista, invalidos } = agregarMails([], remitente);
  if (lista.length !== 1 || invalidos.length || /[\r\n]/.test(remitente)) throw new Error('No se pudo verificar la cuenta de Gmail.');
  const nombre = String(pdf.nombre ?? 'Compromisos.pdf').replace(/[\r\n"\\]/g, '_').slice(0, 180);
  const asunto = [...datos.asunto].reduce((grupos, letra) => {
    const ultimo = grupos.length - 1;
    if (new TextEncoder().encode(grupos[ultimo] + letra).length > 42) grupos.push(letra);
    else grupos[ultimo] += letra;
    return grupos;
  }, ['']).map((parte) => `=?UTF-8?B?${codificarTexto(parte)}?=`).join('\r\n ');
  // HTML para la negrita y el enlace; el texto plano queda de respaldo.
  const alternativa = `alt_${limite}`;
  return [
    `From: ${lista[0]}`, `To: ${destinatarios.join(',\r\n ')}`, `Subject: ${asunto}`,
    'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${limite}"`, '',
    `--${limite}`, `Content-Type: multipart/alternative; boundary="${alternativa}"`, '',
    `--${alternativa}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    lineasBase64(codificarTexto(mensajePlano(datos.mensaje, datos.presentacion))), '',
    `--${alternativa}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    lineasBase64(codificarTexto(mensajeHtml(datos.mensaje, datos.presentacion))), '', `--${alternativa}--`, '',
    `--${limite}`, 'Content-Type: application/pdf',
    'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="Compromisos.pdf"; filename*=UTF-8''${encodeURIComponent(nombre).replace(/'/g, '%27')}`, '',
    lineasBase64(aBase64(pdf.bytes)), '', `--${limite}--`, '',
  ].join('\r\n');
}

export function rawGmail(mime) {
  return codificarTexto(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
