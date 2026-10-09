/**
 * Invitaciones a reuniones de mesa: la plantilla, los invitados, el evento de
 * Calendar y el mail. Lo que se prueba acá es lo que no se ve hasta que la
 * invitación ya salió: un mail que se perdió al pegar la lista, una hora
 * corrida, un link que no llegó al cuerpo del correo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLAVE_EVENTOS,
  agregarMails,
  armarInvitacion,
  completarVariables,
  fechaConvocatoria,
  horarioEvento,
  normalizarPlantilla,
  plantillaBase,
  validarInvitacion,
} from '../src/datos/invitaciones.js';
import { mensajeHtml, mensajeMime, validarConvocatoria } from '../src/datos/convocatorias.js';

const plantilla = (cambios = {}) => ({ ...plantillaBase(), invitados: ['ana@x.com'], ...cambios });

test('pegar una lista copiada de un mail: separa, extrae de «Nombre <mail>» y no duplica', () => {
  const { lista, invalidos } = agregarMails(
    ['ana@x.com'],
    'Juan Pérez <Juan.Perez@Tresdefebrero.gov.ar>, ANA@x.com; sin arroba\nluis@y.com',
  );
  assert.deepEqual(lista, ['ana@x.com', 'juan.perez@tresdefebrero.gov.ar', 'luis@y.com']);
  assert.deepEqual(invalidos, ['sin arroba']);
});

test('lo que no es un mail no se agrega ni se pierde', () => {
  const { lista, invalidos } = agregarMails([], 'juan@, pedro');
  assert.deepEqual(lista, []);
  assert.deepEqual(invalidos, ['juan@', 'pedro']);
});

test('una plantilla guardada rota o vieja vuelve a la base en lo que falle', () => {
  assert.deepEqual(normalizarPlantilla(null), plantillaBase());
  assert.equal(normalizarPlantilla({ asunto: 'Viejo' }).titulo_evento, plantillaBase().titulo_evento);
  const n = normalizarPlantilla({ asunto: 'Propio', invitados: ['ok@x.com', 'roto'], hora: '9', duracion_min: 45 });
  assert.equal(n.asunto, 'Propio');
  assert.deepEqual(n.invitados, ['ok@x.com']);
  assert.equal(n.hora, plantillaBase().hora);
  assert.equal(n.duracion_min, 60);
  assert.equal(n.mensaje, plantillaBase().mensaje);
});

test('la fecha de la convocatoria no se corre un día por el huso', () => {
  assert.equal(fechaConvocatoria('2026-10-01'), 'jueves 1 de octubre');
  assert.equal(fechaConvocatoria(''), '');
});

test('las variables se completan y una llave desconocida queda como está', () => {
  assert.equal(completarVariables('{mesa} el {fecha} {otra}', { mesa: 'Mesa X', fecha: 'hoy' }), 'Mesa X el hoy {otra}');
});

test('armar la invitación: asunto y cuerpo completos, con el link', () => {
  const { titulo, cuerpo } = armarInvitacion(plantilla({ url_presentacion: 'https://docs.google.com/p/1' }), {
    nombre: 'Mesa Barrial Norte',
    fecha: '2026-10-01',
  });
  assert.equal(titulo, 'Mesa Barrial Norte: reunión del jueves 1 de octubre');
  assert.match(cuerpo, /próxima reunión de Mesa Barrial Norte, el jueves 1 de octubre a las 10:00/);
  assert.match(cuerpo, /https:\/\/docs\.google\.com\/p\/1/);
});

test('si el mensaje no usa {link}, el link de la presentación va igual al pie', () => {
  const { cuerpo } = armarInvitacion(
    plantilla({ mensaje: 'Nos vemos.', url_presentacion: 'https://docs.google.com/p/1' }),
    { nombre: 'Mesa', fecha: '2026-10-01' },
  );
  assert.equal(cuerpo, 'Nos vemos.\n\nPresentación: https://docs.google.com/p/1');
});

test('validar: faltantes, fecha pasada y {link} sin presentación', () => {
  const errores = validarInvitacion(plantilla({ invitados: [], asunto: ' ' }), '2026-09-01', '2026-09-28');
  assert.deepEqual(Object.keys(errores).sort(), ['asunto', 'fecha', 'invitados', 'url_presentacion']);
  assert.equal(errores.fecha, 'La fecha ya pasó.');

  const completa = plantilla({ url_presentacion: 'https://docs.google.com/p/1' });
  assert.deepEqual(validarInvitacion(completa, '2026-10-01', '2026-09-28'), {});
  assert.ok(validarInvitacion({ ...completa, url_presentacion: 'docs.google.com/p/1' }, '2026-10-01').url_presentacion);
});

test('Calendar: hora de reloj con huso aparte, y el fin cruza la medianoche', () => {
  assert.deepEqual(horarioEvento('2026-10-01', '23:30', 60), {
    start: { dateTime: '2026-10-01T23:30:00', timeZone: 'America/Argentina/Buenos_Aires' },
    end: { dateTime: '2026-10-02T00:30:00', timeZone: 'America/Argentina/Buenos_Aires' },
  });
});

test('la agenda de eventos arranca con la convocatoria de JP, con negritas y su título', () => {
  const base = normalizarPlantilla(null, CLAVE_EVENTOS);
  assert.equal(base.titulo_evento, 'Reunión Mesa Eventos');
  const { titulo, cuerpo, tituloEvento } = armarInvitacion(base, { nombre: 'Agenda de eventos', fecha: '2026-10-07' });
  assert.equal(titulo, 'Mesa Eventos | 07/10');
  assert.equal(tituloEvento, 'Reunión Mesa Eventos');
  assert.match(cuerpo, /Los convocamos el día \*\*miércoles 07\/10\*\* a las \*\*15:00hs\*\*\./);
  assert.match(cuerpo, /presencial en la \*\*Sala de Reuniones de la Privada\*\*/);
  assert.match(mensajeHtml(cuerpo, ''), /<strong>Les pedimos que confirmen su asistencia vía calendar<\/strong>/);
  // Una mesa común sigue con su plantilla genérica.
  assert.equal(normalizarPlantilla(null, 'mesa-1').titulo_evento, 'Reunión {mesa}');
});

test('el mail de invitación sale sin adjunto y con los invitados como destinatarios', () => {
  const datos = {
    tipo: 'invitacion', fecha: '2026-10-07', destinatarios: 'ana@x.com, luis@y.com',
    asunto: 'Mesa Eventos | 07/10', mensaje: 'Hola **a todos**', presentacion: '', firma: '<div>Firma</div>',
  };
  assert.equal(validarConvocatoria(datos, null).length, 2);
  const mime = mensajeMime(datos, null, 'equipo@x.com', 'limite_inv');
  assert.doesNotMatch(mime, /application\/pdf/);
  assert.match(mime, /To: ana@x\.com,\r\n luis@y\.com/);
  assert.ok(mime.trimEnd().endsWith('--limite_inv--'));
  assert.throws(() => validarConvocatoria(datos, { bytes: new Uint8Array([1]) }), /adjunto/);
});
