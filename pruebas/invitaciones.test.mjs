/**
 * Invitaciones a reuniones de mesa: la plantilla, los invitados y los links a
 * Google. Lo que se prueba acá es lo que no se ve hasta que la invitación ya
 * salió: un mail que se perdió al pegar la lista, una hora corrida, un link que
 * no llegó al cuerpo del correo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LARGO_MAXIMO_URL,
  agregarMails,
  armarInvitacion,
  completarVariables,
  cuentaGoogleDe,
  fechaConvocatoria,
  normalizarPlantilla,
  plantillaBase,
  urlGmail,
  urlGoogleCalendar,
  validarInvitacion,
} from '../src/datos/invitaciones.js';

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

test('Google Calendar: hora de reloj con huso aparte, invitados y cuenta', () => {
  const url = urlGoogleCalendar({
    titulo: 'Mesa: reunión',
    cuerpo: 'Hola a todos',
    lugar: '',
    fecha: '2026-10-01',
    hora: '23:30',
    duracionMin: 60,
    invitados: ['ana@x.com', 'luis@y.com'],
    cuenta: 'coordinacion@gmail.com',
  });
  const p = new URL(url).searchParams;
  assert.equal(p.get('action'), 'TEMPLATE');
  // Cruza la medianoche: el fin cae al día siguiente.
  assert.equal(p.get('dates'), '20261001T233000/20261002T003000');
  assert.equal(p.get('ctz'), 'America/Argentina/Buenos_Aires');
  assert.equal(p.get('add'), 'ana@x.com,luis@y.com');
  assert.equal(p.get('authuser'), 'coordinacion@gmail.com');
  assert.equal(p.has('location'), false);
  // Espacios como %20: el «+» no lo decodifican igual todas las pantallas de Google.
  assert.ok(url.includes('Hola%20a%20todos'));
  assert.ok(!url.includes('+'));
});

test('Gmail: destinatarios, asunto y cuerpo; sin cuenta forzada si no es de Google', () => {
  const url = urlGmail({ titulo: 'Asunto', cuerpo: 'Línea 1\nLínea 2', invitados: ['ana@x.com'], cuenta: '' });
  const p = new URL(url).searchParams;
  assert.equal(p.get('view'), 'cm');
  assert.equal(p.get('to'), 'ana@x.com');
  assert.equal(p.get('su'), 'Asunto');
  assert.equal(p.get('body'), 'Línea 1\nLínea 2');
  assert.equal(p.has('authuser'), false);
});

test('la cuenta sólo se fuerza con un mail que seguro es de Google', () => {
  assert.equal(cuentaGoogleDe(' Coordinacion@Gmail.com '), 'coordinacion@gmail.com');
  assert.equal(cuentaGoogleDe('alguien@tresdefebrero.gov.ar'), '');
  assert.equal(cuentaGoogleDe(undefined), '');
});

test('una invitación normal entra holgada en el largo máximo de URL', () => {
  const invitados = Array.from({ length: 30 }, (_, i) => `integrante${i}@tresdefebrero.gov.ar`);
  const { titulo, cuerpo } = armarInvitacion(plantilla({ invitados, url_presentacion: 'https://docs.google.com/p/1' }), {
    nombre: 'Mesa Barrial Norte',
    fecha: '2026-10-01',
  });
  const url = urlGmail({ titulo, cuerpo, invitados, cuenta: '' });
  assert.ok(url.length < LARGO_MAXIMO_URL / 2, `largo ${url.length}`);
});
