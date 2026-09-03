/**
 * Flujos de escritura de punta a punta, contra el repositorio real.
 *
 * Esto es lo que ejecutan los formularios al confirmar. Los tests de
 * selectores prueban la lectura y los de aceptación prueban el set de
 * demostración; acá se prueba lo que pasa cuando el usuario GUARDA.
 *
 * El repositorio corre en Node sin cambios: `almacenamiento.js` atrapa la
 * ausencia de `localStorage` y sigue con la copia en memoria.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as repo from '../src/datos/repositorio.js';
import { calcularAlertas, TIPOS_ALERTA, vencimientosProximos } from '../src/datos/alertas.js';
import { hoyISO } from '../src/datos/tiempo.js';
import {
  compromisos as selCompromisos,
  compromisosEnVentana,
  historialArea,
  historialProyecto,
  proyectoPorId,
  proyectos as selProyectos,
  resumenRequerimientos,
  seguimientos as selSeguimientos,
  serieAvance,
  temasDe,
  ultimaActualizacion,
  ventanaSeguimiento,
  activos,
} from '../src/datos/selectores.js';

/**
 * Las fechas de dominio se fijan para que los cálculos de vencimiento sean
 * deterministas; `creado_en`, en cambio, lo pone el reloj real, así que lo que
 * dependa de él se compara contra `hoyISO()` y no contra la constante.
 */
const HOY = '2026-08-08';
const AYER = '2026-08-07';
const PASADO = '2026-07-01';
const FUTURO = '2026-09-15';

/** Cada test arranca de cero: el repositorio mantiene una única base en memoria. */
async function limpio() {
  await repo.vaciarSistema();
  return repo.obtenerBD();
}

const PROYECTO_BASE = {
  proyecto: 'Repavimentación — Barrio de prueba',
  area: 'Secretaría de Obras',
  id_area: 'ar_r_obras',
  programa: 'Infraestructura urbana',
  eje: 'POA',
  tipo: 'Obra',
  unidad: 'cuadras',
  objetivo: 100,
  avance: 20,
  cantidad: 1,
  estado: 'en ejecución',
  responsable: 'M. Álvarez',
  prioridad: 'alta',
  fecha_carga: HOY,
  fecha_inicio: HOY,
  fecha_fin_prevista: FUTURO,
  es_obra: true,
  monto_planificado: 10_000_000,
  monto_ejecutado: 2_000_000,
};

/* ── Alta de proyecto ───────────────────────────────────────────────── */

test('crear un proyecto le asigna id, lo deja activo y asienta la bitácora', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  const bd = await repo.obtenerBD();

  assert.equal(p.id_proyecto, 'OBR-2026-001');
  assert.equal(p.activo, true);
  assert.equal(p.creado_por, 'Coordinación');
  assert.ok(p.creado_en);

  assert.equal(selProyectos(bd, {}).length, 1);
  assert.equal(proyectoPorId(bd, p.id_proyecto).porcentaje_avance, 20);

  const historial = historialProyecto(bd, p.id_proyecto);
  assert.equal(historial.length, 1);
  assert.equal(historial[0].accion, 'alta');
});

test('el segundo proyecto de la misma área sigue el correlativo', async () => {
  await limpio();
  await repo.crearProyecto(PROYECTO_BASE);
  const segundo = await repo.crearProyecto({ ...PROYECTO_BASE, proyecto: 'Otro' });
  assert.equal(segundo.id_proyecto, 'OBR-2026-002');
});

test('editar un proyecto asienta sólo los campos que cambiaron', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  await repo.actualizarProyecto(p.id_proyecto, { avance: 55, estado: 'en ejecución' });
  const bd = await repo.obtenerBD();

  const edicion = historialProyecto(bd, p.id_proyecto).find((h) => h.accion === 'edicion');
  assert.deepEqual(edicion.cambios, [{ campo: 'avance', antes: 20, despues: 55 }]);
  assert.equal(proyectoPorId(bd, p.id_proyecto).porcentaje_avance, 55);
});

test('una edición que no cambia nada no ensucia la bitácora', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  await repo.actualizarProyecto(p.id_proyecto, { avance: 20 });
  const bd = await repo.obtenerBD();
  assert.equal(historialProyecto(bd, p.id_proyecto).length, 1, 'sólo el asiento de alta');
});

test('la baja es lógica: el proyecto desaparece de los listados pero el historial queda', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  await repo.bajaProyecto(p.id_proyecto);
  const bd = await repo.obtenerBD();

  assert.equal(selProyectos(bd, {}).length, 0);
  assert.equal(proyectoPorId(bd, p.id_proyecto), null);
  assert.equal(bd.proyectos.length, 1, 'el registro no se borra físicamente');
  assert.equal(historialProyecto(bd, p.id_proyecto).at(0).accion, 'baja');
});

/* ── Flujo del módulo 2: seguimiento + compromisos ──────────────────── */

test('cargar un seguimiento crea sus compromisos y actualiza el avance del proyecto', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);

  // Esto es exactamente lo que hace CargarSeguimiento al confirmar
  const seg = await repo.crearSeguimiento({
    ids_proyecto: [p.id_proyecto],
    area: p.area,
    fecha: HOY,
    tipo: 'realizado',
    participantes: 'M. Álvarez, J. Benítez',
    texto_crudo: 'Se ejecutaron 30 cuadras. Benítez va a presentar el informe el 15/09.',
    avances: ['Se ejecutaron 30 cuadras.'],
    problemas: [],
    estado_reportado: 'en ejecución',
  });

  await repo.crearCompromisos([
    {
      origen_tipo: 'seguimiento',
      id_origen: seg.id,
      id_proyecto: p.id_proyecto,
      area: p.area,
      descripcion: 'Presentar el informe',
      responsable: 'J. Benítez',
      fecha_limite: FUTURO,
    },
  ]);

  await repo.actualizarProyecto(p.id_proyecto, { avance: 50 });

  const bd = await repo.obtenerBD();

  // Aparece en la lista general de compromisos
  const lista = selCompromisos(bd, {}, HOY);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].origen_tipo, 'seguimiento');
  assert.equal(lista[0].id_origen, seg.id);
  assert.equal(lista[0].estado_efectivo, 'pendiente');

  // El seguimiento se ve desde el proyecto
  assert.equal(selSeguimientos(bd, { id_proyecto: p.id_proyecto }).length, 1);

  // Y el avance quedó actualizado, con su serie histórica.
  // La fecha del punto sale de la bitácora, que usa el reloj real en hora local.
  assert.equal(proyectoPorId(bd, p.id_proyecto).avance, 50);
  assert.deepEqual(serieAvance(bd, p.id_proyecto), [{ fecha: hoyISO(), avance: 50 }]);
});

test('la bitácora fecha las cargas en hora local, no en UTC', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  const bd = await repo.obtenerBD();
  const asiento = historialProyecto(bd, p.id_proyecto)[0];

  // Con el huso argentino (UTC−3), guardar en UTC adelantaría un día toda carga
  // hecha después de las 21:00. Este test lo detecta a esa hora.
  assert.equal(asiento.creado_en.slice(0, 10), hoyISO());
  assert.ok(!asiento.creado_en.endsWith('Z'), 'no debe llevar sufijo UTC');
});

test('los asientos del mismo milisegundo conservan el orden en que ocurrieron', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  await repo.bajaProyecto(p.id_proyecto);
  const bd = await repo.obtenerBD();

  const historial = historialProyecto(bd, p.id_proyecto);
  assert.equal(historial[0].accion, 'baja', 'lo más reciente primero');
  assert.equal(historial[1].accion, 'alta');
});

test('un compromiso sin origen declarado se rechaza', async () => {
  await limpio();
  await assert.rejects(
    () => repo.crearCompromiso({ descripcion: 'huérfano', fecha_limite: FUTURO }),
    /origen_tipo/,
  );
});

test('marcar cumplido saca el compromiso de las alertas', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  const seg = await repo.crearSeguimiento({ ids_proyecto: [p.id_proyecto], area: p.area, fecha: PASADO, tipo: 'realizado' });
  const c = await repo.crearCompromiso({
    origen_tipo: 'seguimiento', id_origen: seg.id, id_proyecto: p.id_proyecto,
    area: p.area, descripcion: 'Enviar pliego', responsable: 'X', fecha_limite: PASADO,
  });

  let bd = await repo.obtenerBD();
  assert.equal(calcularAlertas(bd, HOY).filter((a) => a.tipo === TIPOS_ALERTA.COMPROMISO_VENCIDO).length, 1);

  await repo.marcarCumplido(c.id, AYER);
  bd = await repo.obtenerBD();

  assert.equal(calcularAlertas(bd, HOY).filter((a) => a.tipo === TIPOS_ALERTA.COMPROMISO_VENCIDO).length, 0);
  assert.equal(selCompromisos(bd, {}, HOY)[0].estado_efectivo, 'cumplido');
});

/* ── Flujo del módulo 3: monitoreo con temas encadenados ────────────── */

test('agregar temas encadenados: cada uno queda, y sólo los que requieren acción generan compromiso', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  const m = await repo.crearMonitoreo({ fecha: HOY, area: p.area });

  const t1 = await repo.agregarTema(m.id, {
    categoria: 'Operativo', descripcion: 'Falta cuadrilla', criticidad: 'alta',
    requiere_accion: true, responsable: 'L. Cardozo', fecha_limite: FUTURO, id_proyecto: p.id_proyecto,
  });
  const t2 = await repo.agregarTema(m.id, {
    categoria: 'Reclamo vecinal', descripcion: 'Reclamos por polvo', criticidad: 'baja',
    requiere_accion: false, id_proyecto: null,
  });
  const t3 = await repo.agregarTema(m.id, {
    categoria: 'Presupuestario', descripcion: 'Falta refuerzo', criticidad: 'media',
    requiere_accion: true, responsable: 'S. Escobar', fecha_limite: FUTURO, id_proyecto: null,
  });

  const bd = await repo.obtenerBD();

  assert.equal(temasDe(bd, m.id).length, 3, 'los tres temas quedan encadenados en el mismo monitoreo');
  assert.ok(t1.compromiso, 'el tema con acción genera compromiso');
  assert.equal(t2.compromiso, null, 'el tema sin acción NO genera compromiso');
  assert.ok(t3.compromiso);

  // El tema guarda el vínculo al compromiso que generó
  assert.equal(temasDe(bd, m.id).find((t) => t.id === t1.tema.id).id_compromiso, t1.compromiso.id);

  // Los compromisos van a la MISMA lista general, con origen monitoreo
  const lista = selCompromisos(bd, {}, HOY);
  assert.equal(lista.length, 2);
  assert.ok(lista.every((c) => c.origen_tipo === 'monitoreo' && c.id_origen === m.id));
});

test('no se puede finalizar un monitoreo sin temas, y sí con al menos uno', async () => {
  await limpio();
  const m = await repo.crearMonitoreo({ fecha: HOY, area: 'Secretaría de Salud' });

  await assert.rejects(() => repo.finalizarMonitoreo(m.id), /sin al menos un tema/);

  await repo.agregarTema(m.id, {
    categoria: 'Operativo', descripcion: 'Un tema', criticidad: 'baja', requiere_accion: false,
  });
  const cerrado = await repo.finalizarMonitoreo(m.id);
  assert.equal(cerrado.cerrado, true);
});

test('un tema crítico sin resolver alerta, y deja de alertar al resolverse', async () => {
  await limpio();
  const m = await repo.crearMonitoreo({ fecha: HOY, area: 'Secretaría de Salud' });
  const { tema } = await repo.agregarTema(m.id, {
    categoria: 'Operativo', descripcion: 'Equipo fuera de servicio', criticidad: 'alta', requiere_accion: false,
  });

  let bd = await repo.obtenerBD();
  assert.equal(calcularAlertas(bd, HOY).filter((a) => a.tipo === TIPOS_ALERTA.TEMA_CRITICO).length, 1);

  await repo.actualizarTema(tema.id, { resuelto: true });
  bd = await repo.obtenerBD();
  assert.equal(calcularAlertas(bd, HOY).filter((a) => a.tipo === TIPOS_ALERTA.TEMA_CRITICO).length, 0);
});

/**
 * Corregir un tema recién transferido es el caso normal, no la excepción: la
 * transferencia PROPONE y el usuario arregla. El compromiso asociado tiene que
 * seguir esa corrección, en los dos sentidos.
 */
test('editar un tema mantiene su compromiso en sincronía', async () => {
  await limpio();
  const m = await repo.crearMonitoreo({ fecha: HOY, area: 'Secretaría de Salud' });

  // Sale de la transferencia sin acción, y al revisarlo se marca que sí la requiere.
  const { tema } = await repo.agregarTema(m.id, {
    categoria: 'Operativo', descripcion: 'Falta el insumo', criticidad: 'media', requiere_accion: false,
  });
  assert.equal(tema.id_compromiso, undefined);

  const conAccion = await repo.actualizarTema(tema.id, {
    requiere_accion: true, responsable: 'M. López', fecha_limite: FUTURO,
  });
  let bd = await repo.obtenerBD();
  let compromiso = bd.compromisos.find((c) => c.id === conAccion.id_compromiso);
  assert.ok(compromiso, 'marcar la acción después crea el compromiso');
  assert.equal(compromiso.responsable, 'M. López');
  assert.equal(compromiso.origen_tipo, 'monitoreo');

  // Corregir el texto del tema corrige también el compromiso.
  await repo.actualizarTema(tema.id, { descripcion: 'Falta el insumo crítico', responsable: 'R. Díaz' });
  bd = await repo.obtenerBD();
  compromiso = bd.compromisos.find((c) => c.id === conAccion.id_compromiso);
  assert.equal(compromiso.descripcion, 'Falta el insumo crítico');
  assert.equal(compromiso.responsable, 'R. Díaz');

  // Desmarcar la acción da de baja el compromiso: no queda vivo por un tema que ya no lo pide.
  const sinAccion = await repo.actualizarTema(tema.id, { requiere_accion: false });
  bd = await repo.obtenerBD();
  assert.equal(sinAccion.id_compromiso, null);
  assert.equal(bd.compromisos.find((c) => c.id === compromiso.id).activo, false);
  assert.equal(selCompromisos(bd, {}).length, 0, 'deja de contar en la lista general');
});

/**
 * "Crear nuevo compromiso" puede llevar una descripción propia, distinta de
 * la del tema — si no se carga, se sigue usando la del tema como antes.
 */
test('el compromiso creado desde un tema usa su propia descripción si se cargó', async () => {
  await limpio();
  const m = await repo.crearMonitoreo({ fecha: HOY, area: 'Secretaría de Salud' });

  const { compromiso: conPropia } = await repo.agregarTema(m.id, {
    categoria: 'Presupuestario', descripcion: 'Falta la partida para pagar al proveedor',
    criticidad: 'media', requiere_accion: true, responsable: 'M. López', fecha_limite: FUTURO,
    descripcion_compromiso: 'Gestionar la partida presupuestaria',
  });
  assert.equal(conPropia.descripcion, 'Gestionar la partida presupuestaria');

  const { compromiso: sinPropia } = await repo.agregarTema(m.id, {
    categoria: 'Presupuestario', descripcion: 'Otro tema sin descripción propia',
    criticidad: 'media', requiere_accion: true, responsable: 'M. López', fecha_limite: FUTURO,
  });
  assert.equal(sinPropia.descripcion, 'Otro tema sin descripción propia');
});

/**
 * `id_compromiso` tiene dos sentidos distintos, y `actualizarTema` tiene que
 * distinguirlos: el compromiso que el tema generó (dueño, se gestiona en
 * sincronía) versus uno que ya existía y el tema sólo referencia (no es
 * dueño, nunca lo toca).
 */
test('un tema vinculado a un compromiso ya existente nunca gestiona su ciclo de vida', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  const m = await repo.crearMonitoreo({ fecha: HOY, area: p.area });
  const seg = await repo.crearSeguimiento({ ids_proyecto: [p.id_proyecto], area: p.area, fecha: PASADO, tipo: 'realizado' });

  // El compromiso existe independientemente del tema: lo crea otro camino
  // (acá, un seguimiento) antes de que el tema lo referencie.
  const existente = await repo.crearCompromiso({
    origen_tipo: 'seguimiento', id_origen: seg.id, id_proyecto: p.id_proyecto,
    area: p.area, descripcion: 'Pagar al proveedor', responsable: 'V. Juárez', fecha_limite: FUTURO,
  });

  const { tema } = await repo.agregarTema(m.id, {
    categoria: 'Operativo', descripcion: 'Sigue sin pagarse', criticidad: 'media',
    requiere_accion: false, id_proyecto: p.id_proyecto,
    id_compromiso: existente.id, compromiso_existente: true,
  });
  assert.equal(tema.id_compromiso, existente.id);

  // Editar el tema (sin tocar el vínculo) no le pisa la descripción al
  // compromiso: no es dueño de él.
  await repo.actualizarTema(tema.id, {
    descripcion: 'Sigue sin pagarse, avisado dos veces',
    id_compromiso: existente.id,
    compromiso_existente: true,
  });
  let bd = await repo.obtenerBD();
  assert.equal(bd.compromisos.find((c) => c.id === existente.id).descripcion, 'Pagar al proveedor');
  assert.equal(bd.compromisos.find((c) => c.id === existente.id).activo, true);

  // Sacar el vínculo tampoco lo toca: el compromiso sigue vivo, sólo deja
  // de estar referenciado por este tema.
  const sinVinculo = await repo.actualizarTema(tema.id, { id_compromiso: null, compromiso_existente: false });
  bd = await repo.obtenerBD();
  assert.equal(sinVinculo.id_compromiso, null);
  assert.equal(bd.compromisos.find((c) => c.id === existente.id).activo, true, 'el compromiso ajeno no se da de baja');
  assert.equal(selCompromisos(bd, {}).length, 1, 'sigue contando en la lista general');
});

test('cambiar de un compromiso propio a uno ya existente da de baja el propio, no el ajeno', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  const m = await repo.crearMonitoreo({ fecha: HOY, area: p.area });
  const seg = await repo.crearSeguimiento({ ids_proyecto: [p.id_proyecto], area: p.area, fecha: PASADO, tipo: 'realizado' });
  const ajeno = await repo.crearCompromiso({
    origen_tipo: 'seguimiento', id_origen: seg.id, id_proyecto: p.id_proyecto,
    area: p.area, descripcion: 'Inspección final', responsable: 'L. Gómez', fecha_limite: FUTURO,
  });

  // `tema` es una foto de ANTES de que agregarTema le asigne el compromiso
  // propio — por eso se usa el `compromiso` que la misma función devuelve
  // aparte, no `tema.id_compromiso`.
  const { tema, compromiso: propio } = await repo.agregarTema(m.id, {
    categoria: 'Operativo', descripcion: 'Falta un insumo', criticidad: 'media',
    requiere_accion: true, responsable: 'M. López', fecha_limite: FUTURO, id_proyecto: p.id_proyecto,
  });
  assert.ok(propio, 'requiere_accion generó su propio compromiso');

  // El mismo tema pasa a apuntar al compromiso ajeno en vez del propio.
  await repo.actualizarTema(tema.id, {
    requiere_accion: false,
    id_compromiso: ajeno.id,
    compromiso_existente: true,
  });
  const bd = await repo.obtenerBD();
  assert.equal(bd.compromisos.find((c) => c.id === propio.id).activo, false, 'el propio, huérfano, se da de baja');
  assert.equal(bd.compromisos.find((c) => c.id === ajeno.id).activo, true, 'el ajeno queda intacto');
});

/**
 * "Actualizar compromiso" (Monitoreo) y el detalle desplegable de
 * Seguimiento comparten este camino: corregir estado y descripción de un
 * compromiso sin pasar por su origen. `fecha_cumplimiento` se administra
 * sola, no la manda quien llama.
 */
test('actualizarEstadoCompromiso estampa y limpia la fecha de cumplimiento sola', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  const m = await repo.crearMonitoreo({ fecha: HOY, area: p.area });
  const c = await repo.crearCompromiso({
    origen_tipo: 'monitoreo', id_origen: m.id, id_proyecto: p.id_proyecto,
    area: p.area, descripcion: 'Elevar el expediente', responsable: 'R. Ferreyra', fecha_limite: FUTURO,
  });
  assert.equal(c.estado, 'pendiente');

  const cumplido = await repo.actualizarEstadoCompromiso(
    c.id, { estado: 'cumplido', descripcion: 'Expediente firmado' }, HOY,
  );
  assert.equal(cumplido.estado, 'cumplido');
  assert.equal(cumplido.descripcion, 'Expediente firmado');
  assert.equal(cumplido.fecha_cumplimiento, HOY);

  // Volver para atrás limpia la fecha: no puede quedar "cumplido el HOY"
  // colgando de un compromiso que ya no lo está.
  const reabierto = await repo.actualizarEstadoCompromiso(
    c.id, { estado: 'en curso', descripcion: 'Expediente firmado' }, HOY,
  );
  assert.equal(reabierto.estado, 'en curso');
  assert.equal(reabierto.fecha_cumplimiento, null);

  // Corregir sólo la descripción, sin tocar el estado, no pisa una fecha de
  // cumplimiento que ya estuviera cargada de antes.
  const conFecha = await repo.actualizarCompromiso(c.id, { fecha_cumplimiento: PASADO });
  assert.equal(conFecha.estado, 'en curso');
  const soloDescripcion = await repo.actualizarEstadoCompromiso(
    c.id, { estado: 'en curso', descripcion: 'Texto corregido' }, HOY,
  );
  assert.equal(soloDescripcion.fecha_cumplimiento, PASADO);
});

/**
 * La ventana de seguimiento de un área —lo que muestra la Parte 2 de la
 * carga de Monitoreo— sale de sus propios seguimientos, nunca de una fecha
 * fija: cada secretaría agenda la suya.
 */
test('ventanaSeguimiento trae el último realizado y el próximo programado del área, cada uno por su cuenta', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  await repo.crearSeguimiento({ ids_proyecto: [p.id_proyecto], area: p.area, fecha: PASADO, tipo: 'realizado' });
  await repo.crearSeguimiento({ ids_proyecto: [p.id_proyecto], area: p.area, fecha: AYER, tipo: 'realizado' });
  await repo.crearSeguimiento({ ids_proyecto: [p.id_proyecto], area: p.area, fecha: FUTURO, tipo: 'programado' });
  // Un "programado" vencido (nunca se marcó realizado) no cuenta como próximo.
  await repo.crearSeguimiento({ ids_proyecto: [p.id_proyecto], area: p.area, fecha: PASADO, tipo: 'programado' });

  const bd = await repo.obtenerBD();
  const ventana = ventanaSeguimiento(bd, p.area, HOY);
  assert.equal(ventana.ultimo.fecha, AYER, 'el último realizado es el más reciente, no cualquiera');
  assert.equal(ventana.proximo.fecha, FUTURO);

  // Otra área, sin seguimientos: los dos lados quedan en null, no en un dato inventado.
  const vacia = ventanaSeguimiento(bd, 'Secretaría de Salud', HOY);
  assert.equal(vacia.ultimo, null);
  assert.equal(vacia.proximo, null);
});

test('compromisosEnVentana filtra por fecha límite, sin límite del lado que falta', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  const m = await repo.crearMonitoreo({ fecha: HOY, area: p.area });
  const antes = await repo.crearCompromiso({
    origen_tipo: 'monitoreo', id_origen: m.id, id_proyecto: p.id_proyecto,
    area: p.area, descripcion: 'Vence antes de la ventana', responsable: 'A', fecha_limite: PASADO,
  });
  const dentro = await repo.crearCompromiso({
    origen_tipo: 'monitoreo', id_origen: m.id, id_proyecto: p.id_proyecto,
    area: p.area, descripcion: 'Vence dentro de la ventana', responsable: 'B', fecha_limite: HOY,
  });
  const despues = await repo.crearCompromiso({
    origen_tipo: 'monitoreo', id_origen: m.id, id_proyecto: p.id_proyecto,
    area: p.area, descripcion: 'Vence después de la ventana', responsable: 'C', fecha_limite: FUTURO,
  });
  const sinFecha = await repo.crearCompromiso({
    origen_tipo: 'monitoreo', id_origen: m.id, id_proyecto: p.id_proyecto,
    area: p.area, descripcion: 'Sin fecha límite', responsable: 'D', fecha_limite: null,
  });

  const bd = await repo.obtenerBD();
  const ventana = { ultimo: { fecha: AYER }, proximo: { fecha: HOY } };
  const ids = compromisosEnVentana(bd, p.id_proyecto, ventana, HOY).map((c) => c.id);
  assert.ok(ids.includes(dentro.id));
  assert.ok(ids.includes(sinFecha.id), 'sin fecha límite no lo excluye ninguna ventana');
  assert.ok(!ids.includes(antes.id));
  assert.ok(!ids.includes(despues.id));

  // Sin ventana de un lado (nunca hubo un seguimiento anterior, por ejemplo),
  // ese lado no filtra nada.
  const sinPiso = compromisosEnVentana(bd, p.id_proyecto, { ultimo: null, proximo: { fecha: HOY } }, HOY).map((c) => c.id);
  assert.ok(sinPiso.includes(antes.id));
  assert.ok(!sinPiso.includes(despues.id));
});

/* ── Flujo del módulo 5: mesa con compromisos ───────────────────────── */

test('los compromisos de una mesa entran a la lista general con origen mesa', async () => {
  await limpio();
  const mesa = await repo.crearMesa({
    nombre: 'Mesa de prueba', tipo: 'barrial', periodicidad: 'mensual', estado: 'activa',
    referente: 'N. Godoy', descripcion: '', proyectos_vinculados: [],
  });
  await repo.crearReunionMesa({ id_mesa: mesa.id, fecha: HOY, asistentes: 'varios', temas: 'x' });
  await repo.crearCompromisos([
    {
      origen_tipo: 'mesa', id_origen: mesa.id, id_proyecto: null,
      area: 'Secretaría de Ambiente y Servicios Públicos', descripcion: 'Relevar luminarias',
      responsable: 'T. Ojeda', fecha_limite: FUTURO,
    },
  ]);

  const bd = await repo.obtenerBD();
  const lista = selCompromisos(bd, { origen_tipo: 'mesa', id_origen: mesa.id }, HOY);
  assert.equal(lista.length, 1);
  assert.equal(selCompromisos(bd, {}, HOY).length, 1, 'es la misma lista, no una paralela');
});

/* ── Flujo del módulo 6: evento y requerimientos ────────────────────── */

test('confirmar requerimientos sube el porcentaje y apaga la alerta del evento', async () => {
  await limpio();
  const evento = await repo.crearEvento({
    nombre: 'Feria de prueba', fecha: '2026-08-11', hora: '10:00', lugar: 'Plaza',
    area_organizadora: 'Secretaría de Capital Humano', tipo: 'Feria', estado: 'confirmado', id_proyecto: null,
  });
  const r1 = await repo.crearRequerimiento({ id_evento: evento.id, item: 'Sonido', cantidad: 1, area_responsable: 'X' });
  await repo.crearRequerimiento({ id_evento: evento.id, item: 'Sillas', cantidad: 50, area_responsable: 'X', estado: 'confirmado' });

  let bd = await repo.obtenerBD();
  assert.deepEqual(resumenRequerimientos(bd, evento.id), { total: 2, confirmados: 1, pendientes: 1, porcentaje: 50 });
  assert.equal(calcularAlertas(bd, HOY).filter((a) => a.tipo === TIPOS_ALERTA.EVENTO_INCOMPLETO).length, 1);

  await repo.actualizarRequerimiento(r1.id, { estado: 'confirmado' });
  bd = await repo.obtenerBD();

  assert.equal(resumenRequerimientos(bd, evento.id).porcentaje, 100);
  assert.equal(calcularAlertas(bd, HOY).filter((a) => a.tipo === TIPOS_ALERTA.EVENTO_INCOMPLETO).length, 0);
});

/* ── Flujo del módulo 4: planificación ──────────────────────────────── */

test('guardar dos veces la planificación del mismo proyecto y año la actualiza, no la duplica', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);

  await repo.guardarPlanificacion({
    id_proyecto: p.id_proyecto, anio: 2026, meta_anual: 100,
    metas_trimestrales: [25, 50, 75, 100], monto_planificado: 10_000_000,
  });
  await repo.guardarPlanificacion({
    id_proyecto: p.id_proyecto, anio: 2026, meta_anual: 120,
    metas_trimestrales: [30, 60, 90, 120], monto_planificado: 12_000_000,
  });

  const bd = await repo.obtenerBD();
  const planes = activos(bd.planificacion_anual).filter((x) => x.id_proyecto === p.id_proyecto);
  assert.equal(planes.length, 1, 'una sola planificación por proyecto y año');
  assert.equal(planes[0].meta_anual, 120);
});

test('los hitos de la planificación alimentan los vencimientos del inicio', async () => {
  await limpio();
  const p = await repo.crearProyecto({ ...PROYECTO_BASE, fecha_fin_prevista: '2026-12-01' });
  await repo.guardarPlanificacion({
    id_proyecto: p.id_proyecto, anio: 2026, meta_anual: 100,
    metas_trimestrales: [25, 50, 75, 100], monto_planificado: 0,
    hitos: [{ id: 'h1', descripcion: 'Certificación intermedia', fecha: '2026-08-14' }],
  });

  const bd = await repo.obtenerBD();
  const v = vencimientosProximos(bd, HOY, 15);
  const hito = v.find((x) => x.clase === 'hito');
  assert.ok(hito, 'el hito debe figurar en los vencimientos');
  assert.equal(hito.titulo, 'Certificación intermedia');
  assert.equal(hito.nivel, 'atencion');
});

/* ── Catálogos, configuración e importación ─────────────────────────── */

test('cambiar el usuario cambia quién firma las cargas siguientes', async () => {
  await limpio();
  await repo.guardarConfig({ usuario: 'M. López' });
  const p = await repo.crearProyecto(PROYECTO_BASE);
  assert.equal(p.creado_por, 'M. López');

  const bd = await repo.obtenerBD();
  assert.equal(historialProyecto(bd, p.id_proyecto)[0].creado_por, 'M. López');
});

test('dar de baja un ítem de catálogo no rompe los registros que ya lo usan', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  let bd = await repo.obtenerBD();

  await repo.guardarCatalogo(
    'tipos',
    bd.catalogos.tipos.map((t) => (t.nombre === 'Obra' ? { ...t, activo: false } : t)),
  );
  bd = await repo.obtenerBD();

  // El proyecto guarda el NOMBRE, no el id: sigue mostrándose bien
  assert.equal(proyectoPorId(bd, p.id_proyecto).tipo, 'Obra');
  assert.equal(selProyectos(bd, { tipo: 'Obra' }).length, 1);
});

test('importar proyectos informa aceptados y rechazados por separado', async () => {
  await limpio();
  const r = await repo.importarProyectos([
    { ...PROYECTO_BASE, proyecto: 'Importado 1' },
    { ...PROYECTO_BASE, proyecto: 'Importado 2' },
  ]);
  assert.equal(r.importados, 2);
  assert.equal(r.errores.length, 0);

  const bd = await repo.obtenerBD();
  assert.equal(selProyectos(bd, {}).length, 2);
});

/* ── Consistencia entre módulos tras una tanda de escritura ─────────── */

test('tras cargar todo a mano, el compromiso vencido aparece en los tres lugares con el mismo atraso', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  const seg = await repo.crearSeguimiento({ ids_proyecto: [p.id_proyecto], area: p.area, fecha: PASADO, tipo: 'realizado' });
  await repo.crearCompromiso({
    origen_tipo: 'seguimiento', id_origen: seg.id, id_proyecto: p.id_proyecto,
    area: p.area, descripcion: 'Elevar el expediente', responsable: 'V. Juárez', fecha_limite: PASADO,
  });

  const bd = await repo.obtenerBD();
  const alerta = calcularAlertas(bd, HOY).find((a) => a.tipo === TIPOS_ALERTA.COMPROMISO_VENCIDO);
  assert.ok(alerta);
  assert.equal(alerta.dias_atraso, 38);

  const enDashboard = vencimientosProximos(bd, HOY, 15).find((v) => v.clase === 'compromiso');
  assert.equal(Math.abs(enDashboard.dias), 38);

  const enArea = historialArea(bd, p.area, HOY).compromisos[0];
  assert.equal(enArea.dias_atraso, 38);
});

test('la última actualización del proyecto se mueve al cargar una entidad vinculada', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO_BASE);
  const bd1 = await repo.obtenerBD();
  const antes = ultimaActualizacion(bd1, p.id_proyecto);

  await new Promise((r) => setTimeout(r, 5));
  await repo.crearSeguimiento({ ids_proyecto: [p.id_proyecto], area: p.area, fecha: HOY, tipo: 'realizado' });

  const bd2 = await repo.obtenerBD();
  assert.ok(ultimaActualizacion(bd2, p.id_proyecto) > antes, 'debe reflejar la carga del seguimiento');
});

test('vaciar el sistema deja todo limpio y vuelve a permitir cargar desde cero', async () => {
  await limpio();
  await repo.crearProyecto(PROYECTO_BASE);
  await repo.vaciarSistema();

  let bd = await repo.obtenerBD();
  assert.equal(bd.proyectos.length, 0);
  assert.equal(bd.historial.length, 0);
  assert.ok(bd.catalogos.areas.length > 0, 'los catálogos siguen disponibles');

  const p = await repo.crearProyecto(PROYECTO_BASE);
  assert.equal(p.id_proyecto, 'OBR-2026-001', 'el correlativo arranca de nuevo');
});

/* ── Escrituras en lote ───────────────────────────────────────────── */

/**
 * Cada operación persiste la base ENTERA. Con dos años de carga eso son dos
 * megabytes y medio por escritura, así que las operaciones en tanda tienen que
 * agrupar: importar doscientas filas no puede costar doscientas escrituras.
 *
 * Lo observable desde afuera es la notificación al store —una por escritura—,
 * y de paso es lo que garantiza que la pantalla no se repinte con una
 * importación a medio hacer.
 */
test('una importación en lote escribe y notifica una sola vez', async () => {
  await repo.vaciarSistema();
  let notificaciones = 0;
  const baja = repo.suscribir(() => {
    notificaciones += 1;
  });

  const filas = Array.from({ length: 25 }, (_, i) => ({
    area: 'Secretaría de Obras',
    proyecto: `Proyecto importado ${i + 1}`,
    estado: 'planificado',
    objetivo: 100,
    avance: 0,
  }));
  const resultado = await repo.importarProyectos(filas);
  baja();

  assert.equal(resultado.importados, 25);
  assert.equal(notificaciones, 1, `se notificó ${notificaciones} veces en lugar de 1`);
  const bd = await repo.obtenerBD();
  assert.equal(bd.proyectos.length, 25, 'el lote tiene que dejar todas las filas guardadas');
  assert.equal(bd.historial.filter((h) => h.entidad === 'proyectos').length, 25, 'faltan asientos de bitácora');
});

test('un tema con acción es una sola escritura, con su compromiso y el vínculo', async () => {
  await repo.vaciarSistema();
  const monitoreo = await repo.crearMonitoreo({ fecha: '2026-08-10', area: 'Secretaría de Salud' });

  let notificaciones = 0;
  const baja = repo.suscribir(() => {
    notificaciones += 1;
  });
  const { tema, compromiso } = await repo.agregarTema(monitoreo.id, {
    descripcion: 'Equipamiento fuera de servicio',
    categoria: 'Operativo',
    criticidad: 'alta',
    requiere_accion: true,
    responsable: 'M. Álvarez',
    fecha_limite: '2026-09-01',
  });
  baja();

  assert.equal(notificaciones, 1, `se notificó ${notificaciones} veces en lugar de 1`);
  assert.ok(compromiso, 'el tema con acción tiene que crear su compromiso');
  const bd = await repo.obtenerBD();
  assert.equal(bd.temas_monitoreo.find((t) => t.id === tema.id).id_compromiso, compromiso.id);
});

test('un lote que falla a mitad conserva lo que alcanzó a entrar', async () => {
  await repo.vaciarSistema();
  const resultado = await repo.importarProyectos([
    { area: 'Secretaría de Salud', proyecto: 'Válido', estado: 'planificado' },
    { area: 'Secretaría de Salud', proyecto: 'También válido', estado: 'planificado' },
  ]);
  assert.equal(resultado.importados, 2);
  const bd = await repo.obtenerBD();
  assert.equal(bd.proyectos.length, 2, 'lo importado tiene que quedar persistido igual');
});
