/**
 * Derivación pura sobre la base.
 *
 * Ninguna función de acá lee el store ni el almacenamiento: reciben `bd` y
 * devuelven valores nuevos. `hoy` siempre entra como parámetro —nunca se lee
 * del reloj adentro— porque es lo que hace verificables los vencimientos.
 */
import {
  DIAS_PERIODICIDAD,
  ESTADOS_ACTIVOS,
  ESTADOS_INTERNACIONAL_ABIERTOS,
  ESTADOS_INTERNACIONAL_CON_PLAZO,
  UMBRALES,
} from './catalogos.js';
import { masRecientePrimero, redactarAsiento } from './bitacora.js';
import { hoyISO } from './tiempo.js';

const MS_DIA = 86_400_000;

/**
 * Semáforo de días restantes: rojo vencido · naranja ≤3 · amarillo ≤15 · verde.
 *
 * Vive acá y no en los componentes porque lo usan las tres capas —el motor de
 * alertas, las tablas y los tableros—, y tres copias de la misma escala son
 * tres oportunidades de que una se desincronice.
 */
export function nivelPorDias(dias) {
  if (dias === null || dias === undefined) return 'sindato';
  if (dias < 0) return 'vencido';
  if (dias <= 3) return 'proximo';
  if (dias <= 15) return 'atencion';
  return 'enregla';
}

/* ── Fechas ─────────────────────────────────────────────────────────── */

// Se reexporta para no romper los muchos módulos que ya la importan de acá.
export { hoyISO };

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

/**
 * Última actualización de TODOS los proyectos, en un solo recorrido de la
 * bitácora.
 *
 * `ultimaActualizacion()` recorre el historial entero por cada proyecto: con
 * trescientos proyectos y cinco mil asientos —el volumen de un par de años de
 * uso— eso son un millón y medio de comparaciones cada vez que se lista la
 * tabla. Quien necesita el dato de muchos proyectos a la vez arma el índice una
 * sola vez; la función de un proyecto solo se conserva para las fichas.
 */
export function mapaUltimaActualizacion(bd) {
  const mapa = new Map();
  for (const asiento of bd.historial ?? []) {
    if (!asiento.id_proyecto) continue;
    const previo = mapa.get(asiento.id_proyecto);
    if (previo === undefined || asiento.creado_en > previo) mapa.set(asiento.id_proyecto, asiento.creado_en);
  }
  return mapa;
}

/** Proyectos activos con los campos derivados ya calculados. */
export function proyectos(bd, filtros = {}) {
  const { texto, ...resto } = filtros;
  const ultimas = mapaUltimaActualizacion(bd);
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
      (resto.solo_estrategicos ? p.estrategico === true : true) &&
      coincide(resto.prioridad_estrategica, p.prioridad_estrategica) &&
      coincide(resto.motivo_estrategico, p.motivo_estrategico) &&
      dentroDelRango(p.fecha_carga, resto.desde, resto.hasta) &&
      (!texto || `${p.proyecto} ${p.id_proyecto} ${p.responsable ?? ''}`.toLowerCase().includes(texto.toLowerCase())),
    )
    .map((p) => ({
      ...p,
      porcentaje_avance: porcentajeAvance(p),
      ultima_actualizacion: ultimas.get(p.id_proyecto) ?? null,
    }));
}

export function proyectoPorId(bd, id) {
  const p = activos(bd.proyectos).find((x) => x.id_proyecto === id);
  if (!p) return null;
  return { ...p, porcentaje_avance: porcentajeAvance(p), ultima_actualizacion: ultimaActualizacion(bd, id) };
}

/* ── Obras ──────────────────────────────────────────────────────────── */

/**
 * Una obra está ubicada cuando tiene LAS DOS coordenadas y son números. Media
 * coordenada no dibuja un punto, y un `0` heredado de un campo vacío lo
 * dibujaría en el golfo de Guinea.
 */
export function tieneUbicacion(p) {
  const lat = Number(p?.latitud);
  const lon = Number(p?.longitud);
  if (p?.latitud === null || p?.latitud === undefined || p?.latitud === '') return false;
  if (p?.longitud === null || p?.longitud === undefined || p?.longitud === '') return false;
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/**
 * Las obras, con lo que hace falta para mirarlas como obras y no como
 * proyectos: dónde están, cuánto les queda y qué semáforo les corresponde.
 *
 * El semáforo NO es el del estado: una obra finalizada está en regla aunque su
 * fin previsto haya pasado, y una obra suspendida no tiene reloj. Lo que se
 * mira es el plazo de las que siguen abiertas, que es lo que hace falta
 * priorizar en el mapa.
 */
export function obras(bd, filtros = {}, hoy = hoyISO()) {
  const { zona, solo_ubicadas, solo_sin_ubicar, ...resto } = filtros;
  return proyectos(bd, { ...resto, es_obra: true })
    .filter((p) => coincide(zona, p.zona))
    .map((p) => {
      const dias_al_fin = diasHasta(p.fecha_fin_prevista, hoy);
      const ubicada = tieneUbicacion(p);
      return {
        ...p,
        zona: p.zona || '',
        dias_al_fin,
        ubicada,
        latitud: ubicada ? Number(p.latitud) : null,
        longitud: ubicada ? Number(p.longitud) : null,
        nivel:
          p.estado === 'finalizado'
            ? 'enregla'
            : !esProyectoActivo(p)
              ? 'sindato'
              : nivelPorDias(dias_al_fin),
      };
    })
    .filter((o) => (solo_ubicadas ? o.ubicada : true) && (solo_sin_ubicar ? !o.ubicada : true))
    .sort(
      (a, b) =>
        ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel] ||
        String(a.proyecto).localeCompare(String(b.proyecto), 'es'),
    );
}

/**
 * Las cifras del tablero de obras, calculadas SOBRE LA MISMA LISTA que se ve.
 * Recalcularlas desde la base dejaría los contadores hablando de un universo
 * distinto del que muestra la tabla en cuanto hubiera un filtro puesto.
 */
export function resumenObras(lista = []) {
  const porEstado = {};
  let planificado = 0;
  let ejecutado = 0;
  let objetivo = 0;
  let avance = 0;

  for (const o of lista) {
    porEstado[o.estado] = (porEstado[o.estado] ?? 0) + 1;
    planificado += Number(o.monto_planificado) || 0;
    ejecutado += Number(o.monto_ejecutado) || 0;
    objetivo += Number(o.objetivo) || 0;
    avance += Number(o.avance) || 0;
  }

  const activas = lista.filter(esProyectoActivo);
  return {
    total: lista.length,
    activas: activas.length,
    en_ejecucion: porEstado['en ejecución'] ?? 0,
    demoradas: porEstado.demorado ?? 0,
    planificadas: porEstado.planificado ?? 0,
    finalizadas: porEstado.finalizado ?? 0,
    suspendidas: porEstado.suspendido ?? 0,
    // Vencida es la activa que ya pasó su fin previsto: la finalizada tarde no
    // es un problema pendiente, y contarla acá inflaría el número que actúa.
    vencidas: activas.filter((o) => o.dias_al_fin !== null && o.dias_al_fin < 0).length,
    por_vencer: activas.filter(
      (o) => o.dias_al_fin !== null && o.dias_al_fin >= 0 && o.dias_al_fin <= UMBRALES.DIAS_POR_VENCER,
    ).length,
    sin_ubicar: lista.filter((o) => !o.ubicada).length,
    ubicadas: lista.filter((o) => o.ubicada).length,
    avance_promedio: objetivo ? Math.min(Math.round((avance / objetivo) * 100), 100) : 0,
    monto_planificado: planificado,
    monto_ejecutado: ejecutado,
    ejecucion: planificado ? Math.round((ejecutado / planificado) * 100) : 0,
    por_estado: porEstado,
  };
}

/**
 * Desagregado por zona sobre la lista que se está viendo. Las obras sin zona
 * cargada se agrupan bajo un rótulo explícito en lugar de desaparecer: son
 * justamente las que hay que completar.
 */
export function obrasPorZona(lista = []) {
  const grupos = new Map();
  for (const o of lista) {
    const clave = o.zona || 'Sin zona cargada';
    if (!grupos.has(clave)) {
      grupos.set(clave, { zona: clave, total: 0, activas: 0, vencidas: 0, ubicadas: 0, objetivo: 0, avance: 0, monto: 0 });
    }
    const g = grupos.get(clave);
    g.total += 1;
    if (esProyectoActivo(o)) {
      g.activas += 1;
      if (o.dias_al_fin !== null && o.dias_al_fin < 0) g.vencidas += 1;
    }
    if (o.ubicada) g.ubicadas += 1;
    g.objetivo += Number(o.objetivo) || 0;
    g.avance += Number(o.avance) || 0;
    g.monto += Number(o.monto_planificado) || 0;
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, porcentaje_avance: g.objetivo ? Math.min(Math.round((g.avance / g.objetivo) * 100), 100) : 0 }))
    .sort((a, b) => b.vencidas - a.vencidas || b.total - a.total || a.zona.localeCompare(b.zona, 'es'));
}

/** Zonas con al menos una obra cargada, para el selector de filtros. */
export function zonasDeObras(bd) {
  const zonas = new Set();
  for (const p of activos(bd?.proyectos)) {
    if (p.es_obra && p.zona) zonas.add(p.zona);
  }
  return [...zonas].sort((a, b) => a.localeCompare(b, 'es'));
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

/**
 * Índice temas por monitoreo, armado UNA vez por llamada.
 *
 * Filtrar la colección de temas dentro del `map` de monitoreos la recorría
 * entera por cada fila: con un año de carga real —miles de temas y cientos de
 * monitoreos— eso es el cuello de botella del tablero, que llama a este selector
 * una vez por secretaría.
 */
function agruparTemas(bd) {
  const mapa = new Map();
  for (const t of activos(bd.temas_monitoreo)) {
    if (!mapa.has(t.id_monitoreo)) mapa.set(t.id_monitoreo, []);
    mapa.get(t.id_monitoreo).push(t);
  }
  return mapa;
}

export function monitoreos(bd, filtros = {}) {
  const porMonitoreo = agruparTemas(bd);
  return activos(bd.monitoreos)
    .filter((m) => coincide(filtros.area, m.area) && dentroDelRango(m.fecha, filtros.desde, filtros.hasta))
    .map((m) => {
      const temas = porMonitoreo.get(m.id) ?? [];
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

function criticidadMaxima(temas) {
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

/* ── Tablero por secretaría ─────────────────────────────────────────── */

const ETIQUETAS_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Cantidad de meses que muestra la mini-serie de cada tarjeta de secretaría. */
const MESES_TABLERO = 6;

/**
 * Los últimos `cantidad` meses terminando en el de `hastaISO`, como 'AAAA-MM'.
 * Se calcula con aritmética sobre año y mes —no con `Date`— para que no dependa
 * del huso del navegador, igual que el resto de las fechas del sistema.
 */
export function mesesHasta(hastaISO, cantidad = MESES_TABLERO) {
  const anio = Number(String(hastaISO).slice(0, 4));
  const mes = Number(String(hastaISO).slice(5, 7));
  if (!anio || !mes) return [];
  const salida = [];
  for (let i = cantidad - 1; i >= 0; i -= 1) {
    const indice = anio * 12 + (mes - 1) - i;
    salida.push(`${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`);
  }
  return salida;
}

export function etiquetaMes(mes) {
  const [anio, numeroMes] = String(mes).split('-');
  return `${ETIQUETAS_MES[Number(numeroMes) - 1] ?? '—'} ${String(anio).slice(2)}`;
}

/**
 * Nombres de todas las secretarías: las del catálogo MÁS las que aparezcan en
 * los datos. La unión evita que un área dada de baja del catálogo —o cargada
 * por importación con otro nombre— se lleve sus registros a un lugar invisible.
 */
export function nombresAreas(bd) {
  const nombres = new Set(activos(bd.catalogos?.areas ?? []).map((a) => a.nombre));
  for (const coleccion of ['proyectos', 'monitoreos', 'seguimientos', 'compromisos']) {
    for (const registro of activos(bd[coleccion])) {
      if (registro.area) nombres.add(registro.area);
    }
  }
  return [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Orden de presentación: primero las secretarías que necesitan intervención. */
const ORDEN_NIVEL = { vencido: 0, proximo: 1, atencion: 2, sindato: 3, enregla: 4 };

/**
 * Semáforo de una secretaría. La escala es de gestión, no estética: lo que
 * manda es el compromiso incumplido, después el tema crítico abierto, después
 * la falta de cobertura. Verde significa «monitoreada y sin deuda», no
 * «sin datos».
 */
export function nivelSecretaria(r) {
  if (r.compromisos.vencidos > 0) return 'vencido';
  if (r.temas.alta_sin_resolver > 0) return 'proximo';
  if (r.ultimo_monitoreo === null) return 'sindato';
  if (r.dias_sin_monitoreo > UMBRALES.DIAS_SIN_MONITOREO) return 'atencion';
  if (r.compromisos.por_vencer > 0 || r.temas.sin_resolver > 0) return 'atencion';
  return 'enregla';
}

/** Temas de monitoreo de una secretaría, con la fecha y el área de su monitoreo. */
export function temasDeArea(bd, area, filtros = {}) {
  return monitoreos(bd, { ...filtros, area })
    .flatMap((m) => m.temas.map((t) => ({ ...t, fecha: m.fecha, area: m.area, id_monitoreo: m.id })))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

/**
 * Tablero de una secretaría.
 *
 * El período (`desde`/`hasta`) acota lo que se CONTABILIZA —monitoreos, temas,
 * seguimientos—, pero no los compromisos ni los proyectos: esos son estado
 * vigente, y recortarlos por fecha escondería justo el compromiso vencido que
 * hay que ver. Por el mismo motivo `ultimo_monitoreo` se mide sobre toda la
 * historia y no sobre la ventana.
 */
export function resumenSecretaria(bd, area, filtros = {}, hoy = hoyISO()) {
  const { desde, hasta } = filtros;

  // El histórico se calcula UNA vez y la ventana sale de filtrarlo: pedir dos
  // veces el selector de monitoreos era pagar dos veces el recorrido de temas.
  const historicos = monitoreos(bd, { area });
  const listaMonitoreos = historicos.filter((m) => dentroDelRango(m.fecha, desde, hasta));
  const listaTemas = listaMonitoreos.flatMap((m) => m.temas.map((t) => ({ ...t, fecha: m.fecha })));
  const listaSeguimientos = seguimientos(bd, { area, desde, hasta });
  const listaCompromisos = compromisos(bd, { area }, hoy);
  const listaProyectos = proyectos(bd, { area });

  const ultimoMonitoreo = historicos[0]?.fecha ?? null;

  const porCriticidad = { alta: 0, media: 0, baja: 0 };
  const categorias = new Map();
  let sinResolver = 0;
  let altaSinResolver = 0;
  let accionesPendientes = 0;
  for (const t of listaTemas) {
    if (porCriticidad[t.criticidad] !== undefined) porCriticidad[t.criticidad] += 1;
    if (!t.resuelto) {
      sinResolver += 1;
      if (t.criticidad === 'alta') altaSinResolver += 1;
      if (t.requiere_accion) accionesPendientes += 1;
    }
    const categoria = t.categoria || 'Sin categoría';
    categorias.set(categoria, (categorias.get(categoria) ?? 0) + 1);
  }

  /**
   * La serie mensual se cuenta sobre el HISTÓRICO, no sobre la ventana. Contarla
   * sobre la ventana dibujaba en cero los meses que el filtro dejaba afuera, y
   * un cero es exactamente lo que este tablero usa para decir «sin cobertura»:
   * el filtro terminaba fabricando la señal que el panel existe para detectar.
   */
  const serie = mesesHasta(hasta || hoy).map((mes) => {
    const delMes = historicos.filter((m) => String(m.fecha).slice(0, 7) === mes);
    return {
      mes,
      etiqueta: etiquetaMes(mes),
      monitoreos: delMes.length,
      temas: delMes.reduce((s, m) => s + m.temas.length, 0),
    };
  });

  const objetivo = listaProyectos.reduce((s, p) => s + (Number(p.objetivo) || 0), 0);
  const avance = listaProyectos.reduce((s, p) => s + (Number(p.avance) || 0), 0);
  const planificado = listaProyectos.reduce((s, p) => s + (Number(p.monto_planificado) || 0), 0);
  const ejecutado = listaProyectos.reduce((s, p) => s + (Number(p.monto_ejecutado) || 0), 0);

  const resumen = {
    area,
    monitoreos: listaMonitoreos.length,
    ultimo_monitoreo: ultimoMonitoreo,
    dias_sin_monitoreo: ultimoMonitoreo ? Math.abs(diasHasta(ultimoMonitoreo, hoy)) : null,
    seguimientos: listaSeguimientos.length,
    ultimo_seguimiento: listaSeguimientos[0]?.fecha ?? null,
    proximo_seguimiento: proximoSeguimiento(bd, area, hoy),
    temas: {
      total: listaTemas.length,
      sin_resolver: sinResolver,
      alta_sin_resolver: altaSinResolver,
      acciones_pendientes: accionesPendientes,
      ...porCriticidad,
    },
    compromisos: {
      total: listaCompromisos.length,
      vencidos: listaCompromisos.filter((c) => c.estado_efectivo === 'vencido').length,
      cumplidos: listaCompromisos.filter((c) => c.estado_efectivo === 'cumplido').length,
      por_vencer: listaCompromisos.filter(
        (c) =>
          c.estado_efectivo !== 'cumplido' &&
          c.dias_restantes !== null &&
          c.dias_restantes >= 0 &&
          c.dias_restantes <= UMBRALES.DIAS_POR_VENCER,
      ).length,
    },
    proyectos: {
      total: listaProyectos.length,
      activos: listaProyectos.filter(esProyectoActivo).length,
      porcentaje_avance: objetivo ? Math.min(Math.round((avance / objetivo) * 100), 100) : 0,
    },
    presupuesto: {
      planificado,
      ejecutado,
      porcentaje: planificado ? Math.round((ejecutado / planificado) * 100) : 0,
      desvio: planificado ? Math.round((ejecutado / planificado) * 100) - 100 : 0,
    },
    criticidad_maxima: criticidadMaxima(listaTemas),
    categorias: [...categorias.entries()]
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es')),
    serie,
    comparativo: compararConPeriodoPrevio(historicos, listaMonitoreos, listaTemas.length, desde, hasta, hoy),
  };
  resumen.nivel = nivelSecretaria(resumen);
  return resumen;
}

/** Próximo seguimiento agendado del área; null si no hay ninguno por delante. */
function proximoSeguimiento(bd, area, hoy) {
  return (
    seguimientos(bd, { area, tipo: 'programado' })
      .filter((s) => String(s.fecha).slice(0, 10) >= hoy)
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))[0] ?? null
  );
}

/**
 * Variación contra la ventana inmediatamente anterior, del mismo largo.
 *
 * Sólo se calcula si hay un `desde`: sin ventana explícita no existe un
 * «período anterior» comparable, y un delta contra un rango inventado diría
 * que algo mejoró o empeoró sin que nadie pueda verificarlo. Se cuenta sobre
 * `historicos`, que ya está en memoria, así que no agrega recorridos.
 */
function compararConPeriodoPrevio(historicos, listaMonitoreos, temasActuales, desde, hasta, hoy) {
  if (!desde) return null;
  const fin = hasta || hoy;
  const largo = diasHasta(fin, desde);
  if (largo === null || largo < 0) return null;

  const previoHasta = sumarDias(desde, -1);
  const previoDesde = sumarDias(previoHasta, -largo);
  const previos = historicos.filter((m) => dentroDelRango(m.fecha, previoDesde, previoHasta));
  const temasPrevios = previos.reduce((s, m) => s + m.temas.length, 0);

  return {
    desde: previoDesde,
    hasta: previoHasta,
    monitoreos: previos.length,
    temas: temasPrevios,
    delta_monitoreos: listaMonitoreos.length - previos.length,
    delta_temas: temasActuales - temasPrevios,
  };
}

/** Una tarjeta por secretaría, ordenadas por urgencia y después por nombre. */
export function resumenSecretarias(bd, filtros = {}, hoy = hoyISO()) {
  return nombresAreas(bd)
    .map((area) => resumenSecretaria(bd, area, filtros, hoy))
    .sort(
      (a, b) => ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel] || a.area.localeCompare(b.area, 'es'),
    );
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
  return [...(bd.historial ?? [])].sort(masRecientePrimero).slice(0, n);
}

export function historialProyecto(bd, idProyecto) {
  return (bd.historial ?? []).filter((h) => h.id_proyecto === idProyecto).sort(masRecientePrimero);
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

/* ── Historial unificado de un proyecto ─────────────────────────────── */

/**
 * Capas del historial de un proyecto.
 *
 * El historial de un proyecto SE COMPONE de su monitoreo y su seguimiento: esas
 * dos capas son la sustancia. Los compromisos y los cambios de ficha se suman
 * como contexto —de dónde salió cada obligación y qué campo se tocó cuándo—, y
 * cada capa se puede apagar sin tocar las demás.
 */
export const CAPAS_HISTORIAL = Object.freeze([
  { clave: 'monitoreo', titulo: 'Monitoreo', color: 'var(--color-capa-monitoreo)' },
  { clave: 'seguimiento', titulo: 'Seguimiento', color: 'var(--color-capa-seguimiento)' },
  { clave: 'compromiso', titulo: 'Compromisos', color: 'var(--color-capa-vencimiento)' },
  { clave: 'hito', titulo: 'Hitos planificados', color: 'var(--color-capa-hito)' },
  { clave: 'mesa', titulo: 'Mesas', color: 'var(--color-capa-mesa)' },
  { clave: 'evento', titulo: 'Eventos', color: 'var(--color-capa-evento)' },
  { clave: 'cambio', titulo: 'Cambios de ficha', color: 'var(--color-capa-cambio)' },
]);

/**
 * Línea de tiempo única de un proyecto, del más reciente al más antiguo.
 *
 * Cada ítem sale ya normalizado —misma forma para las cuatro capas— para que la
 * vista sea una sola lista y el CSV una sola tabla, en lugar de cuatro paneles
 * que el usuario tiene que cruzar a ojo.
 */
export function historialUnificado(bd, idProyecto, capas = {}, hoy = hoyISO()) {
  const incluir = (capa) => capas[capa] !== false;
  const items = [];

  if (incluir('monitoreo')) {
    const porId = new Map(activos(bd.monitoreos).map((m) => [m.id, m]));
    for (const t of activos(bd.temas_monitoreo)) {
      if (t.id_proyecto !== idProyecto) continue;
      const m = porId.get(t.id_monitoreo);
      items.push({
        clave: `tema_${t.id}`,
        capa: 'monitoreo',
        fecha: String(m?.fecha ?? t.creado_en ?? '').slice(0, 10),
        momento: t.creado_en ?? null,
        titulo: t.descripcion,
        detalle: [t.categoria, t.criticidad ? `criticidad ${t.criticidad}` : null]
          .filter(Boolean)
          .join(' · '),
        extra: [m?.area, t.responsable].filter(Boolean).join(' · '),
        estado: t.resuelto ? 'resuelto' : 'sin resolver',
        nivel: t.resuelto ? 'enregla' : t.criticidad === 'alta' ? 'vencido' : 'atencion',
        ruta: m ? `/monitoreo?tab=ultimos&monitoreo=${m.id}` : '/monitoreo',
      });
    }
  }

  if (incluir('seguimiento')) {
    for (const s of seguimientos(bd, { id_proyecto: idProyecto })) {
      items.push({
        clave: `seg_${s.id}`,
        capa: 'seguimiento',
        fecha: String(s.fecha).slice(0, 10),
        momento: s.creado_en ?? null,
        titulo: s.tipo === 'programado' ? 'Seguimiento agendado' : 'Seguimiento realizado',
        detalle: s.resumen || s.temas || '',
        extra: [s.area, s.participantes].filter(Boolean).join(' · '),
        estado: s.tipo,
        nivel: s.tipo === 'programado' ? 'sindato' : 'enregla',
        ruta: `/seguimiento?tab=calendario&vista=lista&seguimiento=${s.id}`,
      });
    }
  }

  if (incluir('compromiso')) {
    for (const c of compromisos(bd, { id_proyecto: idProyecto }, hoy)) {
      items.push({
        clave: `com_${c.id}`,
        capa: 'compromiso',
        fecha: String(c.fecha_limite ?? '').slice(0, 10),
        momento: c.creado_en ?? null,
        titulo: c.descripcion,
        detalle: `origen: ${c.origen_tipo}`,
        extra: [c.area, c.responsable].filter(Boolean).join(' · '),
        estado: c.estado_efectivo === 'vencido' ? `vencido · ${c.dias_atraso} d` : c.estado_efectivo,
        nivel: c.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(c.dias_restantes),
        ruta: `/seguimiento?tab=compromisos&compromiso=${c.id}`,
      });
    }
  }

  if (incluir('hito')) {
    for (const plan of activos(bd.planificacion_anual)) {
      if (plan.id_proyecto !== idProyecto) continue;
      for (const hito of plan.hitos ?? []) {
        items.push({
          clave: `hito_${plan.id}_${hito.id}`,
          capa: 'hito',
          fecha: String(hito.fecha ?? '').slice(0, 10),
          momento: null,
          titulo: hito.descripcion,
          detalle: `Hito planificado para ${plan.anio}`,
          extra: '',
          estado: hito.fecha ? textoDeHito(diasHasta(hito.fecha, hoy)) : 'sin fecha',
          nivel: nivelPorDias(diasHasta(hito.fecha, hoy)),
          ruta: `/planificacion?tab=carga&proyecto=${idProyecto}`,
        });
      }
    }
  }

  if (incluir('mesa')) {
    for (const mesa of activos(bd.mesas)) {
      if (!(mesa.proyectos_vinculados ?? []).includes(idProyecto)) continue;
      for (const r of reunionesDe(bd, mesa.id)) {
        items.push({
          clave: `reu_${r.id}`,
          capa: 'mesa',
          fecha: String(r.fecha).slice(0, 10),
          momento: r.creado_en ?? null,
          titulo: `Reunión de la mesa ${mesa.nombre}`,
          detalle: r.temas || r.resumen || '',
          extra: [mesa.tipo, r.asistentes].filter(Boolean).join(' · '),
          estado: mesa.tipo,
          nivel: 'sindato',
          ruta: `/mesas?mesa=${mesa.id}`,
        });
      }
    }
  }

  if (incluir('evento')) {
    for (const e of activos(bd.eventos)) {
      if (e.id_proyecto !== idProyecto) continue;
      items.push({
        clave: `eve_${e.id}`,
        capa: 'evento',
        fecha: String(e.fecha ?? '').slice(0, 10),
        momento: e.creado_en ?? null,
        titulo: e.nombre,
        detalle: [e.tipo, e.lugar].filter(Boolean).join(' · '),
        extra: e.area_organizadora ?? '',
        estado: e.estado,
        nivel: e.estado === 'realizado' ? 'enregla' : e.estado === 'suspendido' ? 'vencido' : 'sindato',
        ruta: `/eventos?evento=${e.id}`,
      });
    }
  }

  if (incluir('cambio')) {
    // Sólo los asientos de la ficha del proyecto: los de entidades vinculadas
    // (un compromiso creado, un tema cargado) ya vienen en su propia capa, y
    // dejarlos también acá mostraba el mismo hecho dos veces en la misma lista.
    for (const h of historialProyecto(bd, idProyecto).filter((a) => a.entidad === 'proyectos')) {
      items.push({
        clave: `bit_${h.id}`,
        capa: 'cambio',
        fecha: String(h.creado_en).slice(0, 10),
        momento: h.creado_en,
        titulo: redactarAsiento(h),
        detalle: '',
        extra: '',
        estado: h.accion,
        nivel: 'sindato',
        cambios: h.cambios ?? [],
        ruta: null,
      });
    }
  }

  // Empate por día resuelto con el instante de carga: dos asientos del mismo
  // día tienen que salir en el orden en que ocurrieron, no en el de la colección.
  return items.sort(
    (a, b) =>
      String(b.fecha).localeCompare(String(a.fecha)) ||
      String(b.momento ?? '').localeCompare(String(a.momento ?? '')),
  );
}

/** «cumplido», «vence en 5 d», «vencido hace 12 d» para un hito planificado. */
function textoDeHito(dias) {
  if (dias === null) return 'sin fecha';
  if (dias < 0) return `pasó hace ${Math.abs(dias)} d`;
  if (dias === 0) return 'es hoy';
  return `en ${dias} d`;
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

/* ── Proyectos estratégicos ─────────────────────────────────────────── */

/**
 * Semáforo de la cartera estratégica.
 *
 * No es el mismo que el de la cartera general, y esa es la razón de que el
 * módulo exista: un proyecto estratégico se pone en amarillo a los quince días
 * sin novedades, la mitad que cualquier otro. Si el umbral fuera el mismo,
 * declararlo estratégico no cambiaría nada de lo que se ve.
 */
export function nivelEstrategico(r) {
  if (r.estado === 'finalizado') return 'enregla';
  if (!esProyectoActivo(r)) return 'sindato';
  if (r.compromisos_vencidos > 0) return 'vencido';
  if (r.dias_al_fin !== null && r.dias_al_fin < 0) return 'vencido';
  if (r.temas_criticos > 0) return 'proximo';
  if (r.dias_sin_novedad !== null && r.dias_sin_novedad > UMBRALES.DIAS_ESTRATEGICO_SIN_NOVEDAD) return 'proximo';
  if (r.dias_al_fin !== null && r.dias_al_fin <= 30) return 'atencion';
  return 'enregla';
}

/**
 * La cartera estratégica con todo lo que hace falta para decidir sobre ella:
 * compromisos abiertos y vencidos, temas críticos y días sin novedad.
 *
 * Los índices se arman una vez por llamada. Preguntar por proyecto recorría
 * las tres colecciones enteras por fila, y la cartera estratégica es
 * justamente la pantalla que se deja abierta.
 */
export function proyectosEstrategicos(bd, filtros = {}, hoy = hoyISO()) {
  const porProyecto = new Map();
  for (const c of activos(bd.compromisos)) {
    if (!c.id_proyecto) continue;
    if (!porProyecto.has(c.id_proyecto)) porProyecto.set(c.id_proyecto, []);
    porProyecto.get(c.id_proyecto).push(c);
  }
  const temasPorProyecto = new Map();
  for (const t of activos(bd.temas_monitoreo)) {
    if (!t.id_proyecto) continue;
    if (!temasPorProyecto.has(t.id_proyecto)) temasPorProyecto.set(t.id_proyecto, []);
    temasPorProyecto.get(t.id_proyecto).push(t);
  }

  return proyectos(bd, { ...filtros, solo_estrategicos: true })
    .map((p) => {
      const compromisos = porProyecto.get(p.id_proyecto) ?? [];
      const derivado = {
        ...p,
        dias_sin_novedad: p.ultima_actualizacion
          ? Math.abs(diasHasta(p.ultima_actualizacion.slice(0, 10), hoy))
          : null,
        dias_al_fin: diasHasta(p.fecha_fin_prevista, hoy),
        compromisos_abiertos: compromisos.filter((c) => estadoCompromiso(c, hoy) !== 'cumplido').length,
        compromisos_vencidos: compromisos.filter((c) => estadoCompromiso(c, hoy) === 'vencido').length,
        temas_criticos: (temasPorProyecto.get(p.id_proyecto) ?? []).filter(
          (t) => t.criticidad === 'alta' && !t.resuelto,
        ).length,
      };
      return { ...derivado, nivel_estrategico: nivelEstrategico(derivado) };
    })
    .sort(
      (a, b) =>
        ORDEN_NIVEL[a.nivel_estrategico] - ORDEN_NIVEL[b.nivel_estrategico] ||
        String(a.proyecto).localeCompare(String(b.proyecto), 'es'),
    );
}

/** Las cifras del tablero estratégico, calculadas sobre la misma lista que se ve. */
export function resumenEstrategico(bd, filtros = {}, hoy = hoyISO()) {
  const cartera = proyectosEstrategicos(bd, filtros, hoy);
  const porNivel = {};
  const porPrioridad = {};
  const porMotivo = new Map();
  let planificado = 0;
  let ejecutado = 0;
  let objetivo = 0;
  let avance = 0;

  for (const p of cartera) {
    porNivel[p.nivel_estrategico] = (porNivel[p.nivel_estrategico] ?? 0) + 1;
    const prio = p.prioridad_estrategica || 'sin definir';
    porPrioridad[prio] = (porPrioridad[prio] ?? 0) + 1;
    const motivo = p.motivo_estrategico || 'Sin motivo declarado';
    porMotivo.set(motivo, (porMotivo.get(motivo) ?? 0) + 1);
    planificado += Number(p.monto_planificado) || 0;
    ejecutado += Number(p.monto_ejecutado) || 0;
    objetivo += Number(p.objetivo) || 0;
    avance += Number(p.avance) || 0;
  }

  const enRiesgo = cartera.filter((p) => ['vencido', 'proximo'].includes(p.nivel_estrategico));

  return {
    total: cartera.length,
    activos: cartera.filter(esProyectoActivo).length,
    finalizados: cartera.filter((p) => p.estado === 'finalizado').length,
    en_riesgo: enRiesgo.length,
    // Sólo sobre los activos: un proyecto terminado hace ocho meses no tiene por
    // qué tener novedades, y contarlo acá inflaba el número que dispara la acción.
    sin_novedad: cartera.filter(
      (p) =>
        esProyectoActivo(p) &&
        p.dias_sin_novedad !== null &&
        p.dias_sin_novedad > UMBRALES.DIAS_ESTRATEGICO_SIN_NOVEDAD,
    ).length,
    compromisos_vencidos: cartera.reduce((s, p) => s + p.compromisos_vencidos, 0),
    compromisos_abiertos: cartera.reduce((s, p) => s + p.compromisos_abiertos, 0),
    temas_criticos: cartera.reduce((s, p) => s + p.temas_criticos, 0),
    avance_promedio: objetivo ? Math.min(Math.round((avance / objetivo) * 100), 100) : 0,
    monto_planificado: planificado,
    monto_ejecutado: ejecutado,
    ejecucion: planificado ? Math.round((ejecutado / planificado) * 100) : 0,
    por_nivel: porNivel,
    por_prioridad: porPrioridad,
    por_motivo: [...porMotivo.entries()]
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad),
  };
}

/**
 * Lo que el sistema ya sabe que MERECE mirarse como estratégico y todavía no
 * está declarado.
 *
 * Sale de donde aparecen los problemas de verdad: un tema de monitoreo crítico
 * sin resolver y un seguimiento que informó trabas. Se agrupa por proyecto —un
 * proyecto con cuatro señales es un candidato más fuerte que uno con una— y se
 * excluye lo que ya es estratégico, que no hace falta promover de nuevo.
 */
export function candidatosEstrategicos(bd, filtros = {}, hoy = hoyISO()) {
  const yaEstrategicos = new Set(
    activos(bd.proyectos).filter((p) => p.estrategico).map((p) => p.id_proyecto),
  );
  const proyectosPorId = new Map(activos(bd.proyectos).map((p) => [p.id_proyecto, p]));
  const monitoreosPorId = new Map(activos(bd.monitoreos).map((m) => [m.id, m]));
  const senales = [];

  for (const t of activos(bd.temas_monitoreo)) {
    if (t.criticidad !== 'alta' || t.resuelto) continue;
    if (t.id_proyecto && yaEstrategicos.has(t.id_proyecto)) continue;
    const m = monitoreosPorId.get(t.id_monitoreo);
    senales.push({
      origen_tipo: 'monitoreo',
      id_origen: t.id,
      id_proyecto: t.id_proyecto || null,
      area: m?.area ?? '',
      fecha: m?.fecha ?? null,
      titulo: t.descripcion,
      detalle: `Tema crítico sin resolver${t.categoria ? ` · ${t.categoria}` : ''}`,
      ruta: `/monitoreo?tab=ultimos&monitoreo=${t.id_monitoreo}`,
    });
  }

  for (const s of activos(bd.seguimientos)) {
    if (!(s.problemas?.length)) continue;
    for (const id of s.ids_proyecto ?? []) {
      if (yaEstrategicos.has(id)) continue;
      senales.push({
        origen_tipo: 'seguimiento',
        id_origen: s.id,
        id_proyecto: id,
        area: s.area ?? '',
        fecha: s.fecha ?? null,
        titulo: s.problemas[0],
        detalle: `${s.problemas.length} problema(s) informados en el seguimiento`,
        ruta: `/seguimiento?vista=lista&seguimiento=${s.id}`,
      });
    }
  }

  const grupos = new Map();
  for (const senal of senales) {
    if (!coincide(filtros.area, senal.area)) continue;
    if (!coincide(filtros.origen_tipo, senal.origen_tipo)) continue;
    if (!dentroDelRango(senal.fecha, filtros.desde, filtros.hasta)) continue;

    // Sin proyecto vinculado cada señal es su propio candidato: no hay con qué
    // agruparla, y perderla sería perder justo el tema que nadie está mirando.
    const clave = senal.id_proyecto ?? `${senal.origen_tipo}:${senal.id_origen}`;
    const previo = grupos.get(clave);
    if (!previo) {
      const p = senal.id_proyecto ? proyectosPorId.get(senal.id_proyecto) : null;
      grupos.set(clave, {
        clave,
        ...senal,
        proyecto: p?.proyecto ?? null,
        estado_proyecto: p?.estado ?? null,
        prioridad: p?.prioridad ?? null,
        senales: 1,
        origenes: [senal.origen_tipo],
      });
      continue;
    }
    previo.senales += 1;
    if (!previo.origenes.includes(senal.origen_tipo)) previo.origenes.push(senal.origen_tipo);
    // Se conserva la señal más reciente como cara visible del candidato.
    if (String(senal.fecha ?? '') > String(previo.fecha ?? '')) {
      Object.assign(previo, {
        origen_tipo: senal.origen_tipo,
        id_origen: senal.id_origen,
        titulo: senal.titulo,
        detalle: senal.detalle,
        fecha: senal.fecha,
        ruta: senal.ruta,
      });
    }
  }

  return [...grupos.values()].sort(
    (a, b) => b.senales - a.senales || String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')),
  );
}

/* ── Posicionamiento internacional ──────────────────────────────────── */

/**
 * Semáforo de una acción internacional.
 *
 * Sólo lo que todavía no se presentó tiene reloj: ahí el plazo es todo, porque
 * una convocatoria que cierra no se reabre. Una vez presentada, la fecha ya no
 * dice nada del riesgo y el semáforo pasa a leer el estado.
 */
export function nivelAccionInternacional(a) {
  if (ESTADOS_INTERNACIONAL_CON_PLAZO.includes(a.estado) && a.fecha_limite) {
    return nivelPorDias(a.dias_al_cierre);
  }
  if (a.estado === 'vigente') return 'enregla';
  if (a.estado === 'presentada') return 'atencion';
  return 'sindato';
}

export function accionesInternacionales(bd, filtros = {}, hoy = hoyISO()) {
  const { texto, ods, ...resto } = filtros;
  return activos(bd.acciones_internacionales)
    .map((a) => {
      const derivada = {
        ...a,
        ods: a.ods ?? [],
        ids_proyecto: a.ids_proyecto ?? [],
        abierta: ESTADOS_INTERNACIONAL_ABIERTOS.includes(a.estado),
        dias_al_cierre: diasHasta(a.fecha_limite, hoy),
      };
      return { ...derivada, nivel: nivelAccionInternacional(derivada) };
    })
    .filter((a) =>
      coincide(resto.tipo, a.tipo) &&
      coincide(resto.organismo, a.organismo) &&
      coincide(resto.pais, a.pais) &&
      coincide(resto.estado, a.estado) &&
      coincide(resto.alcance, a.alcance) &&
      coincide(resto.area, a.area) &&
      (resto.solo_abiertas ? a.abierta : true) &&
      (resto.id_proyecto ? a.ids_proyecto.includes(resto.id_proyecto) : true) &&
      (ods ? a.ods.includes(Number(ods)) : true) &&
      dentroDelRango(a.fecha_inicio, resto.desde, resto.hasta) &&
      (!texto ||
        `${a.nombre} ${a.organismo ?? ''} ${a.pais ?? ''} ${a.descripcion ?? ''}`
          .toLowerCase()
          .includes(texto.toLowerCase())),
    )
    .sort(
      (a, b) =>
        ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel] ||
        String(a.fecha_limite ?? '9999').localeCompare(String(b.fecha_limite ?? '9999')),
    );
}

/** Cantidad de acciones por dimensión. `ods` es multivaluado y se cuenta una vez por objetivo. */
export function accionesPorDimension(bd, campo, filtros = {}, hoy = hoyISO()) {
  const cuenta = new Map();
  for (const a of accionesInternacionales(bd, filtros, hoy)) {
    const valores = campo === 'ods' ? a.ods.map((n) => `ODS ${n}`) : [a[campo] || 'Sin definir'];
    for (const v of valores.length ? valores : ['Sin definir']) {
      cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
    }
  }
  return [...cuenta.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

/**
 * Las cifras del tablero de posicionamiento.
 *
 * `tasa_exito` se calcula sólo sobre lo RESUELTO —vigente, cerrada o no
 * prosperó—: contar las que siguen en trámite como fracasos daría un número
 * que baja cada vez que se carga una oportunidad nueva, que es exactamente al
 * revés de lo que hay que incentivar.
 */
export function resumenPosicionamiento(bd, filtros = {}, hoy = hoyISO()) {
  const lista = accionesInternacionales(bd, filtros, hoy);
  const porEstado = {};
  let financiamientoObtenido = 0;
  let financiamientoEnGestion = 0;

  for (const a of lista) {
    porEstado[a.estado] = (porEstado[a.estado] ?? 0) + 1;
    const monto = Number(a.financiamiento_usd) || 0;
    if (a.estado === 'vigente' || a.estado === 'cerrada') financiamientoObtenido += monto;
    else if (a.abierta) financiamientoEnGestion += monto;
  }

  const prosperaron = (porEstado.vigente ?? 0) + (porEstado.cerrada ?? 0);
  const resueltas = prosperaron + (porEstado['no prosperó'] ?? 0);

  return {
    total: lista.length,
    abiertas: lista.filter((a) => a.abierta).length,
    vigentes: porEstado.vigente ?? 0,
    presentadas: porEstado.presentada ?? 0,
    no_prosperaron: porEstado['no prosperó'] ?? 0,
    tasa_exito: resueltas ? Math.round((prosperaron / resueltas) * 100) : null,
    financiamiento_obtenido: financiamientoObtenido,
    financiamiento_en_gestion: financiamientoEnGestion,
    organismos: new Set(lista.map((a) => a.organismo).filter(Boolean)).size,
    paises: new Set(lista.map((a) => a.pais).filter(Boolean)).size,
    ods_cubiertos: new Set(lista.flatMap((a) => a.ods)).size,
    proyectos_vinculados: new Set(lista.flatMap((a) => a.ids_proyecto)).size,
    por_estado: porEstado,
    proximos_cierres: lista
      .filter((a) => a.dias_al_cierre !== null && ESTADOS_INTERNACIONAL_CON_PLAZO.includes(a.estado))
      .sort((a, b) => a.dias_al_cierre - b.dias_al_cierre),
  };
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
    // El índice se arma una vez: buscar la mesa dentro del bucle recorría la
    // colección entera por cada reunión del mes.
    const mesasPorId = new Map(activos(bd.mesas).map((m) => [m.id, m]));
    for (const r of activos(bd.reuniones_mesa)) {
      if (!enRango(r.fecha)) continue;
      const mesa = mesasPorId.get(r.id_mesa);
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
