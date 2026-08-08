/**
 * Derivación pura sobre la base.
 *
 * Ninguna función de acá lee el store ni el almacenamiento: reciben `bd` y
 * devuelven valores nuevos. `hoy` siempre entra como parámetro —nunca se lee
 * del reloj adentro— porque es lo que hace verificables los vencimientos.
 */
import { ESTADOS_ACTIVOS, DIAS_PERIODICIDAD } from './catalogos.js';

const MS_DIA = 86_400_000;

/* ── Fechas ─────────────────────────────────────────────────────────── */

/** Fecha de hoy en ISO corto, en hora local. */
export function hoyISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Días calendario entre `hoy` y `fechaISO`. Negativo si ya pasó.
 * Se comparan a medianoche UTC para que el resultado no dependa de la hora ni
 * del huso del navegador.
 */
export function diasHasta(fechaISO, hoy) {
  if (!fechaISO) return null;
  const a = Date.parse(String(fechaISO).slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse(String(hoy).slice(0, 10) + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / MS_DIA);
}

export function trimestreDe(fechaISO) {
  const mes = Number(String(fechaISO).slice(5, 7));
  return Math.floor((mes - 1) / 3) + 1;
}

export function sumarDias(fechaISO, dias) {
  const base = Date.parse(String(fechaISO).slice(0, 10) + 'T00:00:00Z');
  return new Date(base + dias * MS_DIA).toISOString().slice(0, 10);
}

/* ── Base ───────────────────────────────────────────────────────────── */

/** Filtra las bajas lógicas. Todo selector arranca por acá. */
export function activos(coleccion = []) {
  return (coleccion ?? []).filter((r) => r?.activo !== false);
}

/** Compara un valor de filtro contra el del registro, ignorando filtros vacíos. */
function coincide(valorFiltro, valorRegistro) {
  if (valorFiltro === undefined || valorFiltro === null || valorFiltro === '') return true;
  if (Array.isArray(valorFiltro)) return !valorFiltro.length || valorFiltro.includes(valorRegistro);
  if (typeof valorFiltro === 'boolean') return Boolean(valorRegistro) === valorFiltro;
  return String(valorRegistro ?? '') === String(valorFiltro);
}

function dentroDelRango(fecha, desde, hasta) {
  if (!fecha) return !desde && !hasta;
  const f = String(fecha).slice(0, 10);
  if (desde && f < desde) return false;
  if (hasta && f > hasta) return false;
  return true;
}

/* ── Proyectos ──────────────────────────────────────────────────────── */

export function porcentajeAvance(p) {
  const objetivo = Number(p?.objetivo) || 0;
  if (!objetivo) return 0;
  return Math.min(Math.round(((Number(p?.avance) || 0) / objetivo) * 100), 100);
}

export function esProyectoActivo(p) {
  return ESTADOS_ACTIVOS.includes(p.estado);
}

/**
 * Última actualización de un proyecto: el asiento de bitácora más reciente que
 * lo toca, sea directamente o a través de una entidad vinculada.
 */
export function ultimaActualizacion(bd, idProyecto) {
  let maxima = null;
  for (const asiento of bd.historial ?? []) {
    if (asiento.id_proyecto !== idProyecto) continue;
    if (!maxima || asiento.creado_en > maxima) maxima = asiento.creado_en;
  }
  return maxima;
}

/** Proyectos activos con los campos derivados ya calculados. */
export function proyectos(bd, filtros = {}) {
  const { texto, ...resto } = filtros;
  return activos(bd.proyectos)
    .filter((p) =>
      coincide(resto.area, p.area) &&
      coincide(resto.programa, p.programa) &&
      coincide(resto.eje, p.eje) &&
      coincide(resto.tipo, p.tipo) &&
      coincide(resto.estado, p.estado) &&
      coincide(resto.prioridad, p.prioridad) &&
      coincide(resto.responsable, p.responsable) &&
      coincide(resto.id_proyecto, p.id_proyecto) &&
      (resto.es_obra ? p.es_obra === true : true) &&
      (resto.solo_activos ? esProyectoActivo(p) : true) &&
      (resto.solo_prioritarios ? p.prioridad === 'alta' : true) &&
      dentroDelRango(p.fecha_carga, resto.desde, resto.hasta) &&
      (!texto || `${p.proyecto} ${p.id_proyecto} ${p.responsable ?? ''}`.toLowerCase().includes(texto.toLowerCase())),
    )
    .map((p) => ({
      ...p,
      porcentaje_avance: porcentajeAvance(p),
      ultima_actualizacion: ultimaActualizacion(bd, p.id_proyecto),
    }));
}

export function proyectoPorId(bd, id) {
  const p = activos(bd.proyectos).find((x) => x.id_proyecto === id);
  if (!p) return null;
  return { ...p, porcentaje_avance: porcentajeAvance(p), ultima_actualizacion: ultimaActualizacion(bd, id) };
}

/** Mapa id → nombre, para mostrar el nombre del proyecto sin recorrer la colección. */
export function mapaProyectos(bd) {
  const mapa = new Map();
  for (const p of activos(bd.proyectos)) mapa.set(p.id_proyecto, p);
  return mapa;
}

/* ── Compromisos ────────────────────────────────────────────────────── */

/**
 * `vencido` es DERIVADO, no persistido: sin backend no hay proceso que lo marque
 * al cambiar el día, así que guardarlo garantizaría datos desactualizados.
 */
export function estadoCompromiso(c, hoy) {
  if (c.estado === 'cumplido') return 'cumplido';
  const dias = diasHasta(c.fecha_limite, hoy);
  if (dias !== null && dias < 0) return 'vencido';
  return c.estado;
}

export function compromisos(bd, filtros = {}, hoy = hoyISO()) {
  return activos(bd.compromisos)
    .map((c) => {
      const estado_efectivo = estadoCompromiso(c, hoy);
      const dias = diasHasta(c.fecha_limite, hoy);
      return {
        ...c,
        estado_efectivo,
        dias_restantes: dias,
        dias_atraso: estado_efectivo === 'vencido' ? Math.abs(dias) : 0,
      };
    })
    .filter((c) =>
      coincide(filtros.area, c.area) &&
      coincide(filtros.responsable, c.responsable) &&
      coincide(filtros.estado, c.estado_efectivo) &&
      coincide(filtros.origen_tipo, c.origen_tipo) &&
      coincide(filtros.id_proyecto, c.id_proyecto) &&
      coincide(filtros.id_origen, c.id_origen) &&
      dentroDelRango(c.fecha_limite, filtros.desde, filtros.hasta) &&
      (filtros.solo_vigentes ? c.estado_efectivo !== 'cumplido' : true),
    )
    .sort((a, b) => String(a.fecha_limite ?? '9999').localeCompare(String(b.fecha_limite ?? '9999')));
}

/* ── Seguimientos y monitoreos ──────────────────────────────────────── */

export function seguimientos(bd, filtros = {}) {
  return activos(bd.seguimientos)
    .filter((s) =>
      coincide(filtros.area, s.area) &&
      coincide(filtros.tipo, s.tipo) &&
      (filtros.id_proyecto ? (s.ids_proyecto ?? []).includes(filtros.id_proyecto) : true) &&
      dentroDelRango(s.fecha, filtros.desde, filtros.hasta),
    )
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

export function monitoreos(bd, filtros = {}) {
  return activos(bd.monitoreos)
    .filter((m) => coincide(filtros.area, m.area) && dentroDelRango(m.fecha, filtros.desde, filtros.hasta))
    .map((m) => {
      const temas = temasDe(bd, m.id);
      return {
        ...m,
        cantidad_temas: temas.length,
        criticidad_maxima: criticidadMaxima(temas),
        temas,
      };
    })
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

export function temasDe(bd, idMonitoreo) {
  return activos(bd.temas_monitoreo).filter((t) => t.id_monitoreo === idMonitoreo);
}

export function criticidadMaxima(temas) {
  if (temas.some((t) => t.criticidad === 'alta')) return 'alta';
  if (temas.some((t) => t.criticidad === 'media')) return 'media';
  if (temas.length) return 'baja';
  return null;
}

/**
 * Cobertura de monitoreo por área. Las áreas SIN monitoreos aparecen en cero:
 * el propósito declarado del panel es detectar áreas sin cobertura, y omitirlas
 * las escondería justo cuando importan.
 */
export function monitoreosPorArea(bd, filtros = {}) {
  const cuenta = new Map();
  for (const area of activos(bd.catalogos?.areas ?? [])) cuenta.set(area.nombre, 0);
  for (const m of monitoreos(bd, filtros)) {
    cuenta.set(m.area, (cuenta.get(m.area) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([area, cantidad]) => ({ area, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.area.localeCompare(b.area));
}

/* ── Mesas ──────────────────────────────────────────────────────────── */

export function mesas(bd, filtros = {}) {
  return activos(bd.mesas)
    .filter((m) => coincide(filtros.tipo, m.tipo) && coincide(filtros.estado, m.estado))
    .map((m) => {
      const reuniones = reunionesDe(bd, m.id);
      return {
        ...m,
        cantidad_reuniones: reuniones.length,
        ultima_reunion: reuniones[0]?.fecha ?? null,
      };
    });
}

export function reunionesDe(bd, idMesa) {
  return activos(bd.reuniones_mesa)
    .filter((r) => r.id_mesa === idMesa)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

/** Mesas activas cuya última reunión excede la periodicidad declarada. */
export function mesasSinReunion(bd, hoy = hoyISO()) {
  return mesas(bd, {})
    .filter((m) => m.estado === 'activa')
    .map((m) => {
      const limite = DIAS_PERIODICIDAD[m.periodicidad] ?? null;
      const dias = m.ultima_reunion ? Math.abs(diasHasta(m.ultima_reunion, hoy)) : null;
      return { ...m, dias_sin_reunion: dias, limite_periodicidad: limite };
    })
    .filter((m) => m.limite_periodicidad && m.dias_sin_reunion !== null && m.dias_sin_reunion > m.limite_periodicidad);
}

/* ── Eventos ────────────────────────────────────────────────────────── */

export function eventos(bd, filtros = {}) {
  return activos(bd.eventos)
    .filter((e) =>
      coincide(filtros.area, e.area_organizadora) &&
      coincide(filtros.tipo, e.tipo) &&
      coincide(filtros.estado, e.estado) &&
      dentroDelRango(e.fecha, filtros.desde, filtros.hasta),
    )
    .map((e) => ({ ...e, requerimientos: resumenRequerimientos(bd, e.id) }))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

export function requerimientosDe(bd, idEvento) {
  return activos(bd.requerimientos_evento).filter((r) => r.id_evento === idEvento);
}

export function resumenRequerimientos(bd, idEvento) {
  const reqs = requerimientosDe(bd, idEvento);
  const confirmados = reqs.filter((r) => r.estado === 'confirmado' || r.estado === 'entregado').length;
  return {
    total: reqs.length,
    confirmados,
    pendientes: reqs.length - confirmados,
    porcentaje: reqs.length ? Math.round((confirmados / reqs.length) * 100) : 0,
  };
}

/* ── Bitácora ───────────────────────────────────────────────────────── */

export function feedBitacora(bd, n = 10) {
  return [...(bd.historial ?? [])]
    .sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)))
    .slice(0, n);
}

export function historialDe(bd, entidad, idEntidad) {
  return (bd.historial ?? [])
    .filter((h) => h.entidad === entidad && h.id_entidad === idEntidad)
    .sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)));
}

export function historialProyecto(bd, idProyecto) {
  return (bd.historial ?? [])
    .filter((h) => h.id_proyecto === idProyecto)
    .sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)));
}

/** Línea de tiempo completa de un área: seguimientos, compromisos y proyectos. */
export function historialArea(bd, area, hoy = hoyISO()) {
  return {
    seguimientos: seguimientos(bd, { area }),
    compromisos: compromisos(bd, { area }, hoy),
    proyectos: proyectos(bd, { area }),
    monitoreos: monitoreos(bd, { area }),
  };
}

/** Serie de avance de un proyecto a lo largo del tiempo, leída de la bitácora. */
export function serieAvance(bd, idProyecto) {
  const puntos = [];
  for (const h of historialProyecto(bd, idProyecto).reverse()) {
    const cambio = (h.cambios ?? []).find((c) => c.campo === 'avance');
    if (cambio) puntos.push({ fecha: h.creado_en.slice(0, 10), avance: Number(cambio.despues) || 0 });
  }
  return puntos;
}

/* ── Planificación y agregados ──────────────────────────────────────── */

export function planificacionDe(bd, idProyecto, anio) {
  return (
    activos(bd.planificacion_anual).find(
      (p) => p.id_proyecto === idProyecto && Number(p.anio) === Number(anio),
    ) ?? null
  );
}

/** Cantidad de proyectos agrupados por una dimensión (área, eje, tipo, estado). */
export function porDimension(bd, campo, filtros = {}) {
  const cuenta = new Map();
  for (const p of proyectos(bd, filtros)) {
    const clave = p[campo] || 'Sin definir';
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

/** Avance agregado planificado vs. ejecutado por dimensión. */
export function avancePorDimension(bd, campo, filtros = {}) {
  const acumulado = new Map();
  for (const p of proyectos(bd, filtros)) {
    const clave = p[campo] || 'Sin definir';
    const actual = acumulado.get(clave) ?? { nombre: clave, objetivo: 0, avance: 0, proyectos: 0 };
    actual.objetivo += Number(p.objetivo) || 0;
    actual.avance += Number(p.avance) || 0;
    actual.proyectos += 1;
    acumulado.set(clave, actual);
  }
  return [...acumulado.values()]
    .map((a) => ({ ...a, porcentaje: a.objetivo ? Math.min(Math.round((a.avance / a.objetivo) * 100), 100) : 0 }))
    .sort((a, b) => b.objetivo - a.objetivo);
}

/** Distribución del gasto planificado y ejecutado por dimensión. */
export function gastoPorDimension(bd, campo, filtros = {}) {
  const acumulado = new Map();
  for (const p of proyectos(bd, filtros)) {
    const clave = p[campo] || 'Sin definir';
    const actual = acumulado.get(clave) ?? { nombre: clave, planificado: 0, ejecutado: 0 };
    actual.planificado += Number(p.monto_planificado) || 0;
    actual.ejecutado += Number(p.monto_ejecutado) || 0;
    acumulado.set(clave, actual);
  }
  return [...acumulado.values()]
    .map((a) => ({
      ...a,
      ejecucion: a.planificado ? Math.round((a.ejecutado / a.planificado) * 100) : 0,
      desvio: a.planificado ? Math.round((a.ejecutado / a.planificado) * 100) - 100 : 0,
    }))
    .sort((a, b) => b.planificado - a.planificado);
}

export function ejecucionPresupuestaria(bd, filtros = {}) {
  let planificado = 0;
  let ejecutado = 0;
  for (const p of proyectos(bd, filtros)) {
    planificado += Number(p.monto_planificado) || 0;
    ejecutado += Number(p.monto_ejecutado) || 0;
  }
  return {
    planificado,
    ejecutado,
    porcentaje: planificado ? Math.round((ejecutado / planificado) * 100) : 0,
    desvio: planificado ? Math.round((ejecutado / planificado) * 100) - 100 : 0,
  };
}

/**
 * Desvío de cada proyecto respecto de su meta al trimestre en curso.
 * Sólo entran los proyectos con planificación cargada para ese año: comparar
 * contra una meta inexistente daría un ranking inventado.
 */
export function desvioTrimestral(bd, anio, trimestre, filtros = {}) {
  const resultado = [];
  for (const p of proyectos(bd, filtros)) {
    const plan = planificacionDe(bd, p.id_proyecto, anio);
    if (!plan) continue;
    const meta = Number(plan.metas_trimestrales?.[trimestre - 1]) || 0;
    if (!meta) continue;
    const real = Number(p.avance) || 0;
    const cumplimiento = Math.round((real / meta) * 100);
    resultado.push({
      id_proyecto: p.id_proyecto,
      proyecto: p.proyecto,
      area: p.area,
      eje: p.eje,
      meta,
      real,
      cumplimiento,
      desvio: real - meta,
    });
  }
  return resultado.sort((a, b) => a.cumplimiento - b.cumplimiento);
}

/** Semáforo del comparativo planificado vs. real. */
export function nivelCumplimiento(porcentaje) {
  if (porcentaje >= 95) return 'enregla';
  if (porcentaje >= 80) return 'atencion';
  if (porcentaje >= 60) return 'proximo';
  return 'vencido';
}

/* ── Calendario unificado ───────────────────────────────────────────── */

export const CAPAS_CALENDARIO = Object.freeze([
  { clave: 'seguimientos', titulo: 'Seguimientos', color: 'var(--color-capa-seguimiento)' },
  { clave: 'eventos', titulo: 'Eventos', color: 'var(--color-capa-evento)' },
  { clave: 'mesas', titulo: 'Reuniones de mesa', color: 'var(--color-capa-mesa)' },
  { clave: 'vencimientos', titulo: 'Vencimientos', color: 'var(--color-capa-vencimiento)' },
]);

/**
 * Items del calendario en el rango pedido, ya unificados en una sola forma.
 * `capas` es un objeto `{ seguimientos: true, ... }`.
 */
export function itemsCalendario(bd, capas, desde, hasta) {
  const items = [];
  const enRango = (f) => f && String(f).slice(0, 10) >= desde && String(f).slice(0, 10) <= hasta;

  if (capas.seguimientos !== false) {
    for (const s of activos(bd.seguimientos)) {
      if (!enRango(s.fecha)) continue;
      items.push({
        fecha: s.fecha.slice(0, 10),
        capa: 'seguimientos',
        titulo: `${s.tipo === 'programado' ? 'Seguimiento' : 'Seguimiento realizado'} · ${s.area}`,
        detalle: s.hora ?? '',
        ruta: `/seguimiento?vista=lista&seguimiento=${s.id}`,
      });
    }
  }
  if (capas.eventos !== false) {
    for (const e of activos(bd.eventos)) {
      if (!enRango(e.fecha)) continue;
      items.push({
        fecha: e.fecha.slice(0, 10),
        capa: 'eventos',
        titulo: e.nombre,
        detalle: [e.hora, e.lugar].filter(Boolean).join(' · '),
        ruta: `/eventos?evento=${e.id}`,
      });
    }
  }
  if (capas.mesas !== false) {
    for (const r of activos(bd.reuniones_mesa)) {
      if (!enRango(r.fecha)) continue;
      const mesa = activos(bd.mesas).find((m) => m.id === r.id_mesa);
      items.push({
        fecha: r.fecha.slice(0, 10),
        capa: 'mesas',
        titulo: mesa ? `Mesa ${mesa.nombre}` : 'Reunión de mesa',
        detalle: '',
        ruta: mesa ? `/mesas?mesa=${mesa.id}` : '/mesas',
      });
    }
  }
  if (capas.vencimientos !== false) {
    for (const c of activos(bd.compromisos)) {
      if (!enRango(c.fecha_limite) || c.estado === 'cumplido') continue;
      items.push({
        fecha: c.fecha_limite.slice(0, 10),
        capa: 'vencimientos',
        titulo: c.descripcion,
        detalle: c.responsable ?? '',
        ruta: `/seguimiento?tab=compromisos&compromiso=${c.id}`,
      });
    }
    for (const p of activos(bd.proyectos)) {
      if (!enRango(p.fecha_fin_prevista) || p.estado === 'finalizado') continue;
      items.push({
        fecha: p.fecha_fin_prevista.slice(0, 10),
        capa: 'vencimientos',
        titulo: `Fin previsto · ${p.proyecto}`,
        detalle: p.area,
        ruta: `/proyectos/${p.id_proyecto}`,
      });
    }
  }
  return items.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
