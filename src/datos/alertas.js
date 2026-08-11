/**
 * ─────────────────────────────────────────────────────────────────────
 * MOTOR DE ALERTAS — fuente única del sistema.
 *
 * El dashboard, el panel de monitoreo y los reportes consumen `calcularAlertas`
 * y NO recalculan vencimientos por su cuenta. De ahí sale, sin esfuerzo extra,
 * que un compromiso vencido aparezca simultáneamente en los tres lugares con
 * los mismos días de atraso.
 *
 * Si hace falta una alerta nueva, se agrega acá y aparece sola en los tres.
 * ─────────────────────────────────────────────────────────────────────
 */
import {
  activos,
  diasHasta,
  estadoCompromiso,
  hoyISO,
  mapaUltimaActualizacion,
  mesasSinReunion,
  nivelPorDias,
  resumenRequerimientos,
} from './selectores.js';
import { ESTADOS_ACTIVOS, UMBRALES } from './catalogos.js';

// Los umbrales viven en `catalogos.js` para que los lean también los selectores
// sin abrir un ciclo; se reexportan acá porque es de donde los importa la UI.
export { UMBRALES };

export const TIPOS_ALERTA = Object.freeze({
  COMPROMISO_VENCIDO: 'compromiso_vencido',
  COMPROMISO_POR_VENCER: 'compromiso_por_vencer',
  PROYECTO_VENCIDO: 'proyecto_vencido',
  PROYECTO_SIN_ACTUALIZAR: 'proyecto_sin_actualizar',
  TEMA_CRITICO: 'tema_critico',
  EVENTO_INCOMPLETO: 'evento_incompleto',
  MESA_SIN_REUNION: 'mesa_sin_reunion',
});

/** Rótulos y orden de presentación de cada grupo del panel de alertas. */
export const ETIQUETAS_ALERTA = Object.freeze({
  [TIPOS_ALERTA.COMPROMISO_VENCIDO]: 'Compromisos vencidos',
  [TIPOS_ALERTA.COMPROMISO_POR_VENCER]: 'Compromisos que vencen en ≤ 7 días',
  [TIPOS_ALERTA.PROYECTO_VENCIDO]: 'Proyectos con fin previsto vencido',
  [TIPOS_ALERTA.PROYECTO_SIN_ACTUALIZAR]: 'Proyectos sin actualizar hace más de 30 días',
  [TIPOS_ALERTA.TEMA_CRITICO]: 'Temas de criticidad alta sin resolver',
  [TIPOS_ALERTA.EVENTO_INCOMPLETO]: 'Eventos con requerimientos sin confirmar',
  [TIPOS_ALERTA.MESA_SIN_REUNION]: 'Mesas sin reunión en su período',
});

export const ORDEN_TIPOS = Object.freeze([
  TIPOS_ALERTA.COMPROMISO_VENCIDO,
  TIPOS_ALERTA.COMPROMISO_POR_VENCER,
  TIPOS_ALERTA.PROYECTO_VENCIDO,
  TIPOS_ALERTA.PROYECTO_SIN_ACTUALIZAR,
  TIPOS_ALERTA.TEMA_CRITICO,
  TIPOS_ALERTA.EVENTO_INCOMPLETO,
  TIPOS_ALERTA.MESA_SIN_REUNION,
]);

const PESO_SEVERIDAD = { critica: 0, alta: 1, media: 2 };

/** Severidad de la alerta → nivel del semáforo. Una sola tabla para todas las vistas. */
const NIVEL_POR_SEVERIDAD = { critica: 'vencido', alta: 'proximo', media: 'atencion' };

export function nivelPorSeveridad(severidad) {
  return NIVEL_POR_SEVERIDAD[severidad] ?? 'sindato';
}

/* ── Reglas ─────────────────────────────────────────────────────────── */

function compromisosVencidos(bd, hoy) {
  return activos(bd.compromisos)
    .filter((c) => estadoCompromiso(c, hoy) === 'vencido')
    .map((c) => ({
      id: `al_cv_${c.id}`,
      tipo: TIPOS_ALERTA.COMPROMISO_VENCIDO,
      severidad: 'critica',
      titulo: c.descripcion,
      detalle: 'Compromiso vencido sin cumplimiento registrado',
      area: c.area ?? null,
      id_proyecto: c.id_proyecto ?? null,
      responsable: c.responsable ?? null,
      fecha: c.fecha_limite,
      dias_atraso: Math.abs(diasHasta(c.fecha_limite, hoy)),
      id_origen: c.id,
      ruta_origen: `/seguimiento?tab=compromisos&compromiso=${c.id}`,
    }));
}

function compromisosPorVencer(bd, hoy) {
  return activos(bd.compromisos)
    .filter((c) => {
      if (estadoCompromiso(c, hoy) === 'cumplido') return false;
      const dias = diasHasta(c.fecha_limite, hoy);
      return dias !== null && dias >= 0 && dias <= UMBRALES.DIAS_POR_VENCER;
    })
    .map((c) => ({
      id: `al_cp_${c.id}`,
      tipo: TIPOS_ALERTA.COMPROMISO_POR_VENCER,
      severidad: 'alta',
      titulo: c.descripcion,
      detalle: `Vence en ${diasHasta(c.fecha_limite, hoy)} día(s)`,
      area: c.area ?? null,
      id_proyecto: c.id_proyecto ?? null,
      responsable: c.responsable ?? null,
      fecha: c.fecha_limite,
      dias_atraso: 0,
      dias_restantes: diasHasta(c.fecha_limite, hoy),
      id_origen: c.id,
      ruta_origen: `/seguimiento?tab=compromisos&compromiso=${c.id}`,
    }));
}

function proyectosVencidos(bd, hoy) {
  return activos(bd.proyectos)
    .filter((p) => {
      if (!ESTADOS_ACTIVOS.includes(p.estado)) return false;
      const dias = diasHasta(p.fecha_fin_prevista, hoy);
      return dias !== null && dias < 0;
    })
    .map((p) => ({
      id: `al_pv_${p.id_proyecto}`,
      tipo: TIPOS_ALERTA.PROYECTO_VENCIDO,
      severidad: 'alta',
      titulo: p.proyecto,
      detalle: `Fin previsto superado, estado «${p.estado}»`,
      area: p.area ?? null,
      id_proyecto: p.id_proyecto,
      responsable: p.responsable ?? null,
      fecha: p.fecha_fin_prevista,
      dias_atraso: Math.abs(diasHasta(p.fecha_fin_prevista, hoy)),
      id_origen: p.id_proyecto,
      ruta_origen: `/proyectos/${p.id_proyecto}`,
    }));
}

function proyectosSinActualizar(bd, hoy) {
  // El índice se arma una vez para todos los proyectos: preguntar por cada uno
  // recorría la bitácora entera tantas veces como proyectos activos hubiera.
  const ultimas = mapaUltimaActualizacion(bd);
  return activos(bd.proyectos)
    .filter((p) => ESTADOS_ACTIVOS.includes(p.estado))
    .map((p) => {
      const ultima = ultimas.get(p.id_proyecto) ?? null;
      const dias = ultima ? Math.abs(diasHasta(ultima.slice(0, 10), hoy)) : null;
      return { p, ultima, dias };
    })
    .filter(({ dias }) => dias !== null && dias > UMBRALES.DIAS_SIN_ACTUALIZAR)
    .map(({ p, ultima, dias }) => ({
      id: `al_ps_${p.id_proyecto}`,
      tipo: TIPOS_ALERTA.PROYECTO_SIN_ACTUALIZAR,
      severidad: 'media',
      titulo: p.proyecto,
      detalle: `Sin novedades hace ${dias} días`,
      area: p.area ?? null,
      id_proyecto: p.id_proyecto,
      responsable: p.responsable ?? null,
      fecha: ultima ? ultima.slice(0, 10) : null,
      dias_atraso: dias,
      id_origen: p.id_proyecto,
      ruta_origen: `/proyectos/${p.id_proyecto}`,
    }));
}

function temasCriticos(bd, hoy) {
  const monitoreos = new Map(activos(bd.monitoreos).map((m) => [m.id, m]));
  return activos(bd.temas_monitoreo)
    .filter((t) => t.criticidad === 'alta' && !t.resuelto)
    .map((t) => {
      const m = monitoreos.get(t.id_monitoreo);
      const dias = m ? Math.abs(diasHasta(m.fecha, hoy)) : 0;
      return {
        id: `al_tc_${t.id}`,
        tipo: TIPOS_ALERTA.TEMA_CRITICO,
        severidad: 'alta',
        titulo: t.descripcion,
        detalle: `Criticidad alta sin resolver${t.categoria ? ` · ${t.categoria}` : ''}`,
        area: m?.area ?? null,
        id_proyecto: t.id_proyecto ?? null,
        responsable: t.responsable || null,
        fecha: m?.fecha ?? null,
        dias_atraso: dias,
        id_origen: t.id,
        ruta_origen: `/monitoreo?tab=ultimos&monitoreo=${t.id_monitoreo}`,
      };
    });
}

function eventosIncompletos(bd, hoy) {
  return activos(bd.eventos)
    .filter((e) => {
      if (e.estado === 'realizado' || e.estado === 'suspendido') return false;
      const dias = diasHasta(e.fecha, hoy);
      if (dias === null || dias < 0 || dias > UMBRALES.DIAS_EVENTO) return false;
      return resumenRequerimientos(bd, e.id).pendientes > 0;
    })
    .map((e) => {
      const resumen = resumenRequerimientos(bd, e.id);
      const dias = diasHasta(e.fecha, hoy);
      return {
        id: `al_ev_${e.id}`,
        tipo: TIPOS_ALERTA.EVENTO_INCOMPLETO,
        severidad: 'alta',
        titulo: e.nombre,
        detalle: `${resumen.pendientes} de ${resumen.total} requerimientos sin confirmar, a ${dias} día(s) del evento`,
        area: e.area_organizadora ?? null,
        id_proyecto: e.id_proyecto ?? null,
        responsable: null,
        fecha: e.fecha,
        dias_atraso: 0,
        dias_restantes: dias,
        id_origen: e.id,
        ruta_origen: `/eventos?tab=checklist&evento=${e.id}`,
      };
    });
}

function mesasAtrasadas(bd, hoy) {
  return mesasSinReunion(bd, hoy).map((m) => ({
    id: `al_ms_${m.id}`,
    tipo: TIPOS_ALERTA.MESA_SIN_REUNION,
    severidad: 'media',
    titulo: `Mesa ${m.nombre}`,
    detalle: `Periodicidad ${m.periodicidad}: ${m.dias_sin_reunion} días sin reunión`,
    area: null,
    id_proyecto: null,
    responsable: m.referente ?? null,
    fecha: m.ultima_reunion,
    dias_atraso: m.dias_sin_reunion - m.limite_periodicidad,
    id_origen: m.id,
    ruta_origen: `/mesas?mesa=${m.id}`,
  }));
}

/* ── API pública ────────────────────────────────────────────────────── */

export function calcularAlertas(bd, hoy = hoyISO()) {
  if (!bd) return [];
  return [
    ...compromisosVencidos(bd, hoy),
    ...compromisosPorVencer(bd, hoy),
    ...proyectosVencidos(bd, hoy),
    ...proyectosSinActualizar(bd, hoy),
    ...temasCriticos(bd, hoy),
    ...eventosIncompletos(bd, hoy),
    ...mesasAtrasadas(bd, hoy),
  ].sort(
    (a, b) =>
      PESO_SEVERIDAD[a.severidad] - PESO_SEVERIDAD[b.severidad] ||
      (b.dias_atraso ?? 0) - (a.dias_atraso ?? 0) ||
      String(a.titulo).localeCompare(String(b.titulo), 'es'),
  );
}

/** Agrupa por tipo, conservando el orden interno. */
export function alertasPorTipo(alertas) {
  const grupos = {};
  for (const tipo of ORDEN_TIPOS) grupos[tipo] = [];
  for (const a of alertas) (grupos[a.tipo] ??= []).push(a);
  return grupos;
}

/** Filtra alertas por área o proyecto, para el historial de área y los reportes. */
export function filtrarAlertas(alertas, { area, id_proyecto } = {}) {
  return alertas.filter(
    (a) => (!area || a.area === area) && (!id_proyecto || a.id_proyecto === id_proyecto),
  );
}

/** Proyectos que tienen al menos una alerta activa (filtro «sólo con alertas»). */
export function proyectosConAlerta(alertas) {
  return new Set(alertas.map((a) => a.id_proyecto).filter(Boolean));
}

/**
 * Vencimientos del dashboard: compromisos, hitos de planificación y fechas de
 * fin previstas dentro de la ventana, más los ya vencidos —que son los
 * urgentes—. Ordenados por fecha ascendente.
 */
export function vencimientosProximos(bd, hoy = hoyISO(), dias = UMBRALES.DIAS_VENCIMIENTOS_DASHBOARD) {
  if (!bd) return [];
  const items = [];
  const enVentana = (fecha) => {
    const d = diasHasta(fecha, hoy);
    return d !== null && d <= dias;
  };

  for (const c of activos(bd.compromisos)) {
    if (c.estado === 'cumplido' || !enVentana(c.fecha_limite)) continue;
    items.push({
      clase: 'compromiso',
      titulo: c.descripcion,
      detalle: [c.area, c.responsable].filter(Boolean).join(' · '),
      fecha: c.fecha_limite,
      dias: diasHasta(c.fecha_limite, hoy),
      id_proyecto: c.id_proyecto ?? null,
      ruta: `/seguimiento?tab=compromisos&compromiso=${c.id}`,
    });
  }

  for (const p of activos(bd.proyectos)) {
    if (!ESTADOS_ACTIVOS.includes(p.estado) || !enVentana(p.fecha_fin_prevista)) continue;
    items.push({
      clase: 'fin previsto',
      titulo: p.proyecto,
      detalle: p.area,
      fecha: p.fecha_fin_prevista,
      dias: diasHasta(p.fecha_fin_prevista, hoy),
      id_proyecto: p.id_proyecto,
      ruta: `/proyectos/${p.id_proyecto}`,
    });
  }

  const nombreProyecto = new Map(activos(bd.proyectos).map((p) => [p.id_proyecto, p]));
  for (const plan of activos(bd.planificacion_anual)) {
    for (const hito of plan.hitos ?? []) {
      if (!enVentana(hito.fecha)) continue;
      const p = nombreProyecto.get(plan.id_proyecto);
      if (p && !ESTADOS_ACTIVOS.includes(p.estado)) continue;
      items.push({
        clase: 'hito',
        titulo: hito.descripcion,
        detalle: p ? p.proyecto : plan.id_proyecto,
        fecha: hito.fecha,
        dias: diasHasta(hito.fecha, hoy),
        id_proyecto: plan.id_proyecto,
        ruta: `/proyectos/${plan.id_proyecto}`,
      });
    }
  }

  return items
    .map((i) => ({ ...i, nivel: nivelPorDias(i.dias) }))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

/**
 * Semáforo del dashboard. Es la misma escala de días que usan las tablas y los
 * tableros: se reexporta con el nombre histórico en lugar de recalcularla, para
 * que un cambio de umbral no deje dos semáforos discrepando.
 */
export { nivelPorDias as nivelPorVencimiento };
