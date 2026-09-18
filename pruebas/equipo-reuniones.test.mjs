import test from 'node:test';
import assert from 'node:assert/strict';
import * as repo from '../src/datos/repositorio.js';
import { bdVacia } from '../src/datos/esquema.js';
import { areasAsignadas } from '../src/datos/selectores.js';
import { filtrarMiSeguimiento, puedeGestionarCompromiso, puedePrepararReunion, responsablesEquipo, temasDeReunionEquipo } from '../src/datos/equipo.js';

const personas = [
  { id: 'p1', nombre: 'Persona Uno', activo: true, recibe_compromisos: true, organiza_secretaria: true },
  { id: 'p2', nombre: 'Persona Dos', activo: true, recibe_compromisos: true, organiza_secretaria: false },
  { id: 'p3', nombre: 'Persona Consulta', activo: true, recibe_compromisos: false, organiza_secretaria: false },
  { id: 'p4', nombre: 'Persona Inactiva', activo: false, recibe_compromisos: true },
];
const compromisoBase = { descripcion: 'Acción de prueba', area: 'Área A', fecha_limite: '2026-10-01', origen_tipo: 'seguimiento', id_origen: 's1', id_responsable: 'p1' };
async function iniciar() {
  await repo.vaciarSistema();
  const bd = await repo.obtenerBD();
  bd.equipo = structuredClone(personas);
  return bd;
}

test('el selector excluye cuentas sin compromisos e inactivas, sin comparar nombres', () => {
  assert.deepEqual(responsablesEquipo({ equipo: personas }).map((p) => p.id).sort(), ['p1', 'p2']);
});

test('Mi seguimiento une áreas y asignaciones sin duplicar ni exigir áreas elegidas', () => {
  const filas = [
    { id: '1', area: 'A', id_responsable: 'p2' },
    { id: '2', area: 'B', id_responsable: 'p1' },
    { id: '3', area: 'A', id_responsable: 'p1' },
    { id: '4', area: 'B', id_responsable: 'p2' },
  ];
  assert.deepEqual(filtrarMiSeguimiento(filas, 'p1', ['A']).map((c) => c.id), ['1', '2', '3']);
  assert.deepEqual(filtrarMiSeguimiento(filas, 'p1', []).map((c) => c.id), ['2', '3']);
  assert.deepEqual(filtrarMiSeguimiento(filas, 'p1', ['A'], 'areas').map((c) => c.id), ['1', '3']);
  assert.deepEqual(filtrarMiSeguimiento(filas, null, []).map((c) => c.id), []);
});

test('las áreas se identifican por cuenta aunque haya dos nombres iguales', () => {
  const bd = { asignaciones_monitoreo: [{ perfil_id: 'p1', usuario: 'Mismo nombre', area: 'A' }, { perfil_id: 'p2', usuario: 'Mismo nombre', area: 'B' }] };
  assert.deepEqual(areasAsignadas(bd, 'Nombre cambiado', 'p1'), ['A']);
});

test('derivar transfiere la bandeja, conserva área, estado y fecha y no agrega una novedad', async () => {
  const bd = await iniciar();
  const c = await repo.crearCompromiso(compromisoBase);
  await repo.actualizarEstadoCompromiso(c.id, { estado: 'en_curso', nuevaActualizacion: 'Avance real' });
  const anteriores = await repo.historialCompromiso(c.id);
  await repo.asignarCompromiso(c.id, 'p2');
  const nuevo = bd.compromisos.find((f) => f.id === c.id);
  assert.equal(nuevo.area, c.area);
  assert.equal(nuevo.fecha_limite, c.fecha_limite);
  assert.equal(nuevo.estado, 'en_curso');
  assert.deepEqual(await repo.historialCompromiso(c.id), anteriores);
  assert.equal(filtrarMiSeguimiento(bd.compromisos, 'p1', [], 'asignados').length, 0);
  assert.equal(filtrarMiSeguimiento(bd.compromisos, 'p2', [], 'asignados').length, 1);
  assert.equal(filtrarMiSeguimiento(bd.compromisos, 'p1', ['Área A']).length, 1);
});

test('un nuevo compromiso requiere responsable habilitado y no se puede derivar a una cuenta de consulta', async () => {
  await iniciar();
  await assert.rejects(repo.crearCompromiso({ ...compromisoBase, id_responsable: null }), /Elegí/);
  const c = await repo.crearCompromiso(compromisoBase);
  for (const id of ['p3', 'p4', 'inexistente', null]) await assert.rejects(repo.asignarCompromiso(c.id, id));
});

test('una novedad sin estado no borra el estado ni la fecha de cumplimiento', async () => {
  await iniciar();
  const c = await repo.crearCompromiso(compromisoBase);
  await repo.actualizarEstadoCompromiso(c.id, { estado: 'cumplido' }, '2026-09-18');
  const actualizado = await repo.actualizarEstadoCompromiso(c.id, { nuevaActualizacion: 'Información posterior' });
  assert.equal(actualizado.estado, 'cumplido');
  assert.equal(actualizado.fecha_cumplimiento, '2026-09-18');
});

test('Secretaría usa selección y temas libres; Dirección incluye todos, cumplidos y sin asignar', async () => {
  const bd = await iniciar();
  const c = await repo.crearCompromiso(compromisoBase);
  await repo.crear('compromisos', { ...compromisoBase, id_responsable: null, estado: 'cumplido' });
  const s = await repo.crearReunionEquipo({ tipo: 'secretaria', fecha: '2026-09-21' });
  const d = await repo.crearReunionEquipo({ tipo: 'direccion', fecha: '2026-09-21' });
  await repo.guardarTemaReunionEquipo({ reunion_id: s.id, compromiso_id: c.id, titulo: c.descripcion, orden: 2 });
  await repo.guardarTemaReunionEquipo({ reunion_id: s.id, titulo: 'Decisión semanal', orden: 1 });
  assert.deepEqual(temasDeReunionEquipo(bd, s).map((t) => t.titulo), ['Decisión semanal', c.descripcion]);
  assert.equal(temasDeReunionEquipo(bd, d).length, 2);
  assert.equal(bd.compromisos.length, 2);
});

test('revisar no cumple; cerrar conserva la lista sin incorporar compromisos futuros', async () => {
  const bd = await iniciar();
  const c = await repo.crearCompromiso(compromisoBase);
  const r = await repo.crearReunionEquipo({ tipo: 'direccion', fecha: '2026-09-21' });
  await repo.guardarTemaReunionEquipo({ reunion_id: r.id, compromiso_id: c.id, titulo: c.descripcion, revisado: true });
  await repo.cerrarReunionEquipo(r.id);
  const cerrada = bd.reuniones_equipo.find((x) => x.id === r.id);
  await repo.crearCompromiso({ ...compromisoBase, descripcion: 'Posterior' });
  assert.equal(temasDeReunionEquipo(bd, cerrada).length, 1);
  assert.equal(bd.compromisos.find((x) => x.id === c.id).estado, 'pendiente');
  await assert.rejects(repo.guardarTemaReunionEquipo({ reunion_id: r.id, titulo: 'Tema tardío' }), /cerrado/);
});

test('el mismo compromiso puede tratarse en ambas reuniones sin duplicarse', async () => {
  const bd = await iniciar();
  const c = await repo.crearCompromiso(compromisoBase);
  for (const tipo of ['direccion', 'secretaria']) {
    const r = await repo.crearReunionEquipo({ tipo, fecha: '2026-09-21' });
    await repo.guardarTemaReunionEquipo({ reunion_id: r.id, compromiso_id: c.id, titulo: c.descripcion });
    await repo.guardarTemaReunionEquipo({ reunion_id: r.id, compromiso_id: c.id, titulo: c.descripcion, revisado: true });
  }
  assert.equal(bd.temas_reunion_equipo.length, 2);
  assert.equal(bd.compromisos.length, 1);
});

test('sólo el organizador prepara Secretaría; recibir permite editar sólo lo propio sin rol general', () => {
  const bd = { ...bdVacia(), equipo: personas };
  assert.equal(puedePrepararReunion(bd, { id: 'p1', rol: 'admin' }, 'secretaria'), true);
  assert.equal(puedePrepararReunion(bd, { id: 'p2', rol: 'admin' }, 'secretaria'), false);
  assert.equal(puedeGestionarCompromiso({ id: 'p2', rol: 'jefe_gabinete' }, { id_responsable: 'p2' }), true);
  assert.equal(puedeGestionarCompromiso({ id: 'p2', rol: 'jefe_gabinete' }, { id_responsable: 'p1' }), false);
});
