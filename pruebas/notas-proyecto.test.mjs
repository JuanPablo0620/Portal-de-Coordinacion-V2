/**
 * Notas y recordatorios de proyecto.
 *
 * Lo que define al módulo es que la FECHA sea lo único que separa una nota de
 * un recordatorio. No hay una marca aparte que pueda quedar desalineada: si
 * tiene fecha, reclama atención y sube al tablero; si no, es consulta. Estas
 * pruebas cuidan esa regla y el orden en que se miran.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as repo from '../src/datos/repositorio.js';
import { notasDeProyecto, recordatoriosEstrategicos } from '../src/datos/selectores.js';

const HOY = '2026-09-14';

const PROYECTO = {
  proyecto: 'Obra de prueba',
  area: 'Secretaría de Obras',
  id_area: 'ar_r_obras',
  tipo: 'Obra',
  estado: 'en ejecución',
  fecha_carga: HOY,
  prioridad: 'alta',
};

async function conProyecto() {
  await repo.vaciarSistema();
  return repo.crearProyecto(PROYECTO);
}

test('una nota sin fecha no es un recordatorio', async () => {
  const p = await conProyecto();
  await repo.crearNota({ id_proyecto: p.id_proyecto, texto: 'Las fotos están en Drive' });
  await repo.marcarEstrategico(p.id_proyecto, { descripcion_estrategica: 'Alto impacto' });

  const bd = await repo.obtenerBD();
  assert.equal(notasDeProyecto(bd, p.id_proyecto).length, 1);
  assert.deepEqual(recordatoriosEstrategicos(bd, {}, HOY), []);
});

test('una nota con fecha sube al panel del tablero', async () => {
  const p = await conProyecto();
  await repo.marcarEstrategico(p.id_proyecto, { descripcion_estrategica: 'Alto impacto' });
  await repo.crearNota({
    id_proyecto: p.id_proyecto,
    texto: 'Reclamar a Vialidad',
    fecha_recordatorio: '2026-09-24',
  });

  const bd = await repo.obtenerBD();
  const [r] = recordatoriosEstrategicos(bd, {}, HOY);
  assert.equal(r.texto, 'Reclamar a Vialidad');
  assert.equal(r.proyecto, 'Obra de prueba');
  assert.equal(r.dias_restantes, 10);
  // La misma escala que los compromisos: entre 4 y 15 días es "atención".
  assert.equal(r.nivel, 'atencion');
});

test('el recordatorio vencido se distingue del que tiene tiempo', async () => {
  const p = await conProyecto();
  await repo.marcarEstrategico(p.id_proyecto, { descripcion_estrategica: 'Alto impacto' });
  await repo.crearNota({ id_proyecto: p.id_proyecto, texto: 'Ya pasó', fecha_recordatorio: '2026-09-12' });
  await repo.crearNota({ id_proyecto: p.id_proyecto, texto: 'Falta mucho', fecha_recordatorio: '2026-11-30' });

  const bd = await repo.obtenerBD();
  const rs = recordatoriosEstrategicos(bd, {}, HOY);
  // Ordenados por fecha: lo vencido primero, que es lo que hay que ver.
  assert.deepEqual(rs.map((r) => r.texto), ['Ya pasó', 'Falta mucho']);
  assert.equal(rs[0].nivel, 'vencido');
  assert.equal(rs[1].nivel, 'enregla');
});

test('sacarle la fecha a un recordatorio lo devuelve a ser una nota', async () => {
  const p = await conProyecto();
  await repo.marcarEstrategico(p.id_proyecto, { descripcion_estrategica: 'Alto impacto' });
  const nota = await repo.crearNota({
    id_proyecto: p.id_proyecto,
    texto: 'Con fecha',
    fecha_recordatorio: '2026-09-24',
  });

  await repo.actualizarNota(nota.id, { fecha_recordatorio: '' });

  const bd = await repo.obtenerBD();
  assert.deepEqual(recordatoriosEstrategicos(bd, {}, HOY), []);
  assert.equal(notasDeProyecto(bd, p.id_proyecto).length, 1);
});

test('los recordatorios de un proyecto que salió de la cartera dejan de aparecer', async () => {
  const p = await conProyecto();
  await repo.marcarEstrategico(p.id_proyecto, { descripcion_estrategica: 'Alto impacto' });
  await repo.crearNota({
    id_proyecto: p.id_proyecto,
    texto: 'Reclamar a Vialidad',
    fecha_recordatorio: '2026-09-24',
  });

  await repo.quitarEstrategico(p.id_proyecto);

  const bd = await repo.obtenerBD();
  assert.deepEqual(recordatoriosEstrategicos(bd, {}, HOY), []);
  // La nota no se borró: sigue en la ficha del proyecto.
  assert.equal(notasDeProyecto(bd, p.id_proyecto).length, 1);
});

test('una nota dada de baja deja de listarse', async () => {
  const p = await conProyecto();
  const nota = await repo.crearNota({ id_proyecto: p.id_proyecto, texto: 'Se cargó por error' });

  await repo.bajaNota(nota.id);

  const bd = await repo.obtenerBD();
  assert.deepEqual(notasDeProyecto(bd, p.id_proyecto), []);
});

test('los recordatorios van antes que las notas sueltas en la ficha', async () => {
  const p = await conProyecto();
  await repo.crearNota({ id_proyecto: p.id_proyecto, texto: 'Nota suelta' });
  await repo.crearNota({
    id_proyecto: p.id_proyecto,
    texto: 'Con fecha lejana',
    fecha_recordatorio: '2026-12-01',
  });

  const bd = await repo.obtenerBD();
  assert.deepEqual(
    notasDeProyecto(bd, p.id_proyecto).map((n) => n.texto),
    ['Con fecha lejana', 'Nota suelta'],
  );
});
