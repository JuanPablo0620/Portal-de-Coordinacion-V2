import test from 'node:test';
import assert from 'node:assert/strict';
import { compararConCalendar, fechaHoraDelEvento, seguimientoDesdeCalendar } from '../src/datos/sincronizarCalendar.js';

const HOY = '2026-11-26';
const areas = [
  { nombre: 'Coordinación', activo: true },
  { nombre: 'Secretaría de Obras', activo: true },
  { nombre: 'Secretaría de Capital Humano', activo: true },
  { nombre: 'Secretaría de Trabajo y Producción', activo: true },
  { nombre: 'Secretaría de Salud', activo: false },
];
// Calendar en hora argentina (-03:00), como lo devuelve con timeZone pedido.
const evento = (id, titulo, fecha, hora = '10:00') => ({ id, summary: titulo, start: { dateTime: `${fecha}T${hora}:00-03:00` }, htmlLink: `https://calendar.example.test/${id}` });
const agendado = (id, area, fecha, hora = '10:00', extra = {}) => ({ id, area, fecha, hora, tipo: 'programado', activo: true, ...extra });
const comparar = (eventos, seguimientos) => compararConCalendar({ eventos, seguimientos, areas, hoy: HOY });

test('fecha y hora argentinas aunque Calendar devuelva UTC', () => {
  assert.deepEqual(fechaHoraDelEvento({ start: { dateTime: '2026-12-02T01:30:00Z' } }), { fecha: '2026-12-01', hora: '22:30' });
  assert.equal(fechaHoraDelEvento({ start: { date: '2026-12-01' } }), null);
});

test('mismo día y hora: coincide y no propone nada', () => {
  const r = comparar([evento('e1', 'Seguimiento Obras', '2026-12-02')], [agendado('s1', 'Secretaría de Obras', '2026-12-02')]);
  assert.equal(r.coinciden.length, 1);
  assert.deepEqual([r.reprogramar.length, r.agendar.length, r.sinEvento.length], [0, 0, 0]);
});

test('mismo día con otra hora, o sin hora en el portal: corrige la hora', () => {
  const r = comparar(
    [evento('e1', 'Seguimiento Obras', '2026-12-02', '11:30'), evento('e2', 'SEGUIMIENTO CAPITAL HUMANO', '2026-12-03', '09:00')],
    [agendado('s1', 'Secretaría de Obras', '2026-12-02'), agendado('s2', 'Secretaría de Capital Humano', '2026-12-03', '')],
  );
  assert.deepEqual(r.reprogramar.map((x) => [x.seguimiento.id, x.fecha, x.hora]), [['s1', '2026-12-02', '11:30'], ['s2', '2026-12-03', '09:00']]);
});

test('una reunión movida unos días es una reprogramación, no una baja y un alta', () => {
  const r = comparar([evento('e1', ' Seguimiento - Trabajo y  Producción ', '2026-12-04')], [agendado('s1', 'Secretaría de Trabajo y Producción', '2026-12-01')]);
  assert.deepEqual(r.reprogramar.map((x) => [x.seguimiento.id, x.fecha]), [['s1', '2026-12-04']]);
  assert.deepEqual([r.agendar.length, r.sinEvento.length], [0, 0]);
});

test('empareja por cercanía cuando un área tiene varias reuniones', () => {
  const r = comparar(
    [evento('e1', 'Seguimiento Obras', '2026-12-03'), evento('e2', 'Seguimiento Obras', '2026-12-18')],
    [agendado('s1', 'Secretaría de Obras', '2026-12-02'), agendado('s2', 'Secretaría de Obras', '2026-12-16')],
  );
  assert.deepEqual(r.reprogramar.map((x) => [x.seguimiento.id, x.fecha]), [['s1', '2026-12-03'], ['s2', '2026-12-18']]);
});

test('lejos en el tiempo no se empareja: se agenda lo nuevo y lo viejo queda sin evento', () => {
  const r = comparar([evento('e1', 'Seguimiento Obras', '2027-01-20')], [agendado('s1', 'Secretaría de Obras', '2026-12-01')]);
  assert.deepEqual(r.agendar.map((x) => [x.area, x.fecha]), [['Secretaría de Obras', '2027-01-20']]);
  assert.deepEqual(r.sinEvento.map((x) => x.seguimiento.id), ['s1']);
});

test('nunca toca un realizado y no vuelve a agendar su reunión', () => {
  const r = comparar(
    [evento('e1', 'Seguimiento Obras', HOY, '15:00')],
    [agendado('s1', 'Secretaría de Obras', HOY, '10:00', { tipo: 'realizado' }), agendado('s2', 'Secretaría de Obras', HOY)],
  );
  assert.equal(r.coinciden[0].seguimiento.id, 's1');
  assert.equal(r.reprogramar.length, 0);
  assert.equal(r.agendar.length, 0);
  // El agendado del mismo día que ya se cargó como realizado es un duplicado.
  assert.deepEqual(r.sinEvento.map((x) => x.seguimiento.id), ['s2']);
});

test('ignora lo pasado, lo dado de baja y lo que queda fuera de la ventana', () => {
  const r = comparar(
    [evento('e1', 'Seguimiento Obras', '2026-11-20'), evento('e2', 'Seguimiento Obras', '2027-06-01')],
    [agendado('s1', 'Secretaría de Obras', '2026-11-20'), agendado('s2', 'Secretaría de Obras', '2026-12-10', '10:00', { activo: false }), agendado('s3', 'Secretaría de Obras', '2027-06-01')],
  );
  assert.deepEqual([r.coinciden.length, r.reprogramar.length, r.agendar.length, r.sinEvento.length], [0, 0, 0, 0]);
});

test('un título sin secretaría única no se adivina', () => {
  const r = comparar([evento('e1', 'SG - SEGUIMIENTO', '2026-12-01'), evento('e2', 'Seguimiento Salud', '2026-12-02')], []);
  assert.deepEqual(r.sinArea.map((x) => x.titulo), ['SG - SEGUIMIENTO', 'Seguimiento Salud']);
  assert.equal(r.agendar.length, 0);
});

test('dos eventos del mismo día para la misma secretaría se agendan una sola vez', () => {
  const r = comparar([evento('e1', 'Seguimiento Obras', '2026-12-01'), evento('e2', 'Seguimiento Obras Públicas', '2026-12-01', '12:00')], []);
  assert.equal(r.agendar.length, 1);
});

test('el alta desde Calendar tiene la forma de «Agendar seguimiento»', () => {
  assert.deepEqual(seguimientoDesdeCalendar({ area: 'Secretaría de Obras', fecha: '2026-12-01', hora: '10:00', evento: {} }), {
    area: 'Secretaría de Obras', fecha: '2026-12-01', hora: '10:00', ids_proyecto: [], tipo: 'programado',
    texto_crudo: '', resumen: '', avances: [], problemas: [], estado_reportado: '',
  });
});
