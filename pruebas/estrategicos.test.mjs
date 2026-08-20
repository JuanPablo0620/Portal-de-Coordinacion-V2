/**
 * Cartera estratégica: el campo, el semáforo propio y la promoción desde
 * monitoreo y seguimiento.
 *
 * Lo que se prueba acá es la razón de ser del módulo: que declarar un proyecto
 * estratégico CAMBIE lo que el sistema vigila. Si el semáforo y las alertas
 * fueran los mismos que los de la cartera general, el campo sería una etiqueta.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as repo from '../src/datos/repositorio.js';
import { TIPOS_ALERTA, calcularAlertas } from '../src/datos/alertas.js';
import {
  candidatosEstrategicos,
  nivelEstrategico,
  proyectosEstrategicos,
  resumenEstrategico,
} from '../src/datos/selectores.js';

const HOY = '2026-08-08';

async function limpio() {
  await repo.vaciarSistema();
  return repo.obtenerBD();
}

const PROYECTO = {
  proyecto: 'Obra de prueba',
  area: 'Secretaría de Obras',
  id_area: 'ar_r_obras',
  tipo: 'Obra',
  unidad: 'm²',
  objetivo: 100,
  avance: 40,
  estado: 'en ejecución',
  fecha_carga: HOY,
  fecha_inicio: HOY,
  fecha_fin_prevista: '2026-12-31',
  es_obra: true,
  monto_planificado: 1_000_000,
  monto_ejecutado: 400_000,
};

/** Corre todos los asientos del proyecto a `dias` atrás, para fabricar silencio. */
async function silenciar(idProyecto, dias) {
  const bd = await repo.obtenerBD();
  const viejo = `${new Date(Date.parse(`${HOY}T00:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10)}T10:00:00.000`;
  for (const h of bd.historial) {
    if (h.id_proyecto === idProyecto) h.creado_en = viejo;
  }
}

/* ── El campo ─────────────────────────────────────────────────────── */

test('marcar estratégico no duplica el proyecto: lo marca en la base maestra', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO);
  await repo.marcarEstrategico(p.id_proyecto, {
    prioridad_estrategica: 'alta',
    motivo_estrategico: 'Alto impacto vecinal',
    responsable_politico: 'M. López',
  });

  const bd = await repo.obtenerBD();
  assert.equal(bd.proyectos.length, 1, 'no se crea un registro paralelo');

  const cartera = proyectosEstrategicos(bd, {}, HOY);
  assert.equal(cartera.length, 1);
  assert.equal(cartera[0].motivo_estrategico, 'Alto impacto vecinal');
  assert.equal(cartera[0].origen_estrategico, 'base');
});

test('sacarlo de la cartera conserva por qué estuvo', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO);
  await repo.marcarEstrategico(p.id_proyecto, { motivo_estrategico: 'Riesgo alto si se atrasa' });
  await repo.quitarEstrategico(p.id_proyecto);

  const bd = await repo.obtenerBD();
  assert.equal(proyectosEstrategicos(bd, {}, HOY).length, 0, 'deja de contar en la cartera');
  const guardado = bd.proyectos[0];
  assert.equal(guardado.estrategico, false);
  assert.equal(guardado.motivo_estrategico, 'Riesgo alto si se atrasa', 'el motivo no se borra');
});

/* ── El semáforo propio ───────────────────────────────────────────── */

test('el semáforo estratégico se pone en amarillo a los 15 días, no a los 30', () => {
  const base = {
    estado: 'en ejecución',
    compromisos_vencidos: 0,
    temas_criticos: 0,
    dias_al_fin: 200,
  };
  assert.equal(nivelEstrategico({ ...base, dias_sin_novedad: 10 }), 'enregla');
  assert.equal(nivelEstrategico({ ...base, dias_sin_novedad: 20 }), 'proximo');
  assert.equal(nivelEstrategico({ ...base, dias_sin_novedad: 3, compromisos_vencidos: 1 }), 'vencido');
  assert.equal(nivelEstrategico({ ...base, dias_sin_novedad: 3, temas_criticos: 2 }), 'proximo');
  assert.equal(nivelEstrategico({ ...base, dias_sin_novedad: 3, dias_al_fin: 12 }), 'atencion');
  assert.equal(nivelEstrategico({ ...base, dias_sin_novedad: 3, dias_al_fin: -1 }), 'vencido');
  assert.equal(nivelEstrategico({ ...base, estado: 'finalizado', dias_sin_novedad: 400 }), 'enregla');
});

test('un estratégico callado alerta a los 20 días; el mismo proyecto sin declarar, no', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO);
  await silenciar(p.id_proyecto, 20);

  let bd = await repo.obtenerBD();
  const soloEstrategica = (lista) => lista.filter((a) => a.tipo === TIPOS_ALERTA.ESTRATEGICO_SIN_NOVEDAD);
  assert.equal(soloEstrategica(calcularAlertas(bd, HOY)).length, 0, 'todavía no es estratégico');

  await repo.marcarEstrategico(p.id_proyecto, { motivo_estrategico: 'Compromiso público de gestión' });
  await silenciar(p.id_proyecto, 20);
  bd = await repo.obtenerBD();
  assert.equal(soloEstrategica(calcularAlertas(bd, HOY)).length, 1);
});

test('pasados los 30 días alerta la regla general y no las dos a la vez', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO);
  await repo.marcarEstrategico(p.id_proyecto, { motivo_estrategico: 'Alto impacto vecinal' });
  await silenciar(p.id_proyecto, 60);

  const bd = await repo.obtenerBD();
  const tipos = calcularAlertas(bd, HOY).map((a) => a.tipo);
  assert.ok(tipos.includes(TIPOS_ALERTA.PROYECTO_SIN_ACTUALIZAR));
  assert.ok(
    !tipos.includes(TIPOS_ALERTA.ESTRATEGICO_SIN_NOVEDAD),
    'el mismo proyecto no puede aparecer dos veces en el panel',
  );
});

/* ── Promoción desde monitoreo y seguimiento ──────────────────────── */

test('promover desde un tema de monitoreo deja el rastro del origen', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO);
  const m = await repo.crearMonitoreo({ fecha: HOY, area: PROYECTO.area });
  const { tema } = await repo.agregarTema(m.id, {
    categoria: 'Operativo',
    descripcion: 'El frente está parado hace tres semanas',
    criticidad: 'alta',
    requiere_accion: false,
    id_proyecto: p.id_proyecto,
  });

  await repo.promoverAEstrategico({
    origen_tipo: 'monitoreo',
    id_origen: tema.id,
    id_proyecto: p.id_proyecto,
    motivo_estrategico: 'Riesgo alto si se atrasa',
    prioridad_estrategica: 'alta',
  });

  const bd = await repo.obtenerBD();
  const [enCartera] = proyectosEstrategicos(bd, {}, HOY);
  assert.equal(enCartera.origen_estrategico, 'monitoreo');
  assert.equal(enCartera.id_origen_estrategico, tema.id);
});

test('si el tema no tiene proyecto, la promoción da de alta uno en la base maestra', async () => {
  await limpio();
  const m = await repo.crearMonitoreo({ fecha: HOY, area: PROYECTO.area });
  const { tema } = await repo.agregarTema(m.id, {
    categoria: 'Operativo',
    descripcion: 'Hace falta un plan integral para el sector',
    criticidad: 'alta',
    requiere_accion: false,
  });

  const creado = await repo.promoverAEstrategico({
    origen_tipo: 'monitoreo',
    id_origen: tema.id,
    proyecto: { ...PROYECTO, proyecto: 'Plan integral del sector' },
    motivo_estrategico: 'Innovación institucional',
  });

  const bd = await repo.obtenerBD();
  assert.equal(bd.proyectos.length, 1, 'entra por el alta normal de la base maestra');
  assert.equal(creado.estrategico, true);
  assert.equal(creado.origen_estrategico, 'monitoreo');
  assert.ok(creado.id_proyecto.startsWith('OBR-'), 'recibe un id canónico como cualquier proyecto');
});

test('la promoción exige saber de dónde salió', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO);
  await assert.rejects(
    () => repo.promoverAEstrategico({ id_proyecto: p.id_proyecto }),
    /origen_tipo e id_origen/,
  );
  await assert.rejects(
    () => repo.promoverAEstrategico({ origen_tipo: 'monitoreo', id_origen: 'x' }),
    /proyecto a promover/,
  );
});

/* ── Candidatos ───────────────────────────────────────────────────── */

test('los candidatos se agrupan por proyecto y suman señales', async () => {
  await limpio();
  const p = await repo.crearProyecto(PROYECTO);
  const m = await repo.crearMonitoreo({ fecha: HOY, area: PROYECTO.area });
  for (const descripcion of ['Primera traba', 'Segunda traba']) {
    await repo.agregarTema(m.id, {
      categoria: 'Operativo',
      descripcion,
      criticidad: 'alta',
      requiere_accion: false,
      id_proyecto: p.id_proyecto,
    });
  }
  await repo.crearSeguimiento({
    ids_proyecto: [p.id_proyecto],
    area: PROYECTO.area,
    fecha: HOY,
    tipo: 'realizado',
    avances: [],
    problemas: ['Falta la conformidad del área técnica.'],
  });

  let bd = await repo.obtenerBD();
  const candidatos = candidatosEstrategicos(bd, {}, HOY);
  assert.equal(candidatos.length, 1, 'tres señales del mismo proyecto son UN candidato');
  assert.equal(candidatos[0].senales, 3);
  assert.deepEqual([...candidatos[0].origenes].sort(), ['monitoreo', 'seguimiento']);

  // Una vez promovido deja de proponerse: no se promueve dos veces lo mismo.
  await repo.marcarEstrategico(p.id_proyecto, { motivo_estrategico: 'Alto impacto vecinal' });
  bd = await repo.obtenerBD();
  assert.equal(candidatosEstrategicos(bd, {}, HOY).length, 0);
});

test('un tema crítico sin proyecto vinculado igual se propone', async () => {
  await limpio();
  const m = await repo.crearMonitoreo({ fecha: HOY, area: PROYECTO.area });
  await repo.agregarTema(m.id, {
    categoria: 'Reclamo vecinal',
    descripcion: 'Reclamos repetidos por el estado del playón',
    criticidad: 'alta',
    requiere_accion: false,
  });

  const bd = await repo.obtenerBD();
  const [candidato] = candidatosEstrategicos(bd, {}, HOY);
  assert.ok(candidato, 'sin proyecto no hay con qué agrupar, pero no se pierde');
  assert.equal(candidato.id_proyecto, null);
});

/* ── Resumen ──────────────────────────────────────────────────────── */

test('el resumen no cuenta como silencio a los proyectos ya finalizados', async () => {
  await limpio();
  const activo = await repo.crearProyecto(PROYECTO);
  const terminado = await repo.crearProyecto({ ...PROYECTO, proyecto: 'Obra terminada', estado: 'finalizado' });
  for (const p of [activo, terminado]) {
    await repo.marcarEstrategico(p.id_proyecto, { motivo_estrategico: 'Alto impacto vecinal' });
    await silenciar(p.id_proyecto, 40);
  }

  const bd = await repo.obtenerBD();
  const resumen = resumenEstrategico(bd, {}, HOY);
  assert.equal(resumen.total, 2);
  assert.equal(resumen.finalizados, 1);
  assert.equal(resumen.sin_novedad, 1, 'sólo el activo cuenta como silencio');
});
