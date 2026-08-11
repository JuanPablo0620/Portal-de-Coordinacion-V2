/**
 * Armado de reportes.
 *
 * El contenido del reporte se construye a partir del resultado FILTRADO, no de
 * la base entera: dos combinaciones de filtros distintas producen documentos
 * distintos. `resumenFiltros` devuelve la lista legible que se imprime al pie,
 * para que el PDF diga siempre con qué recorte se generó.
 */
import {
  activos,
  avancePorDimension,
  compromisos as selCompromisos,
  eventos as selEventos,
  gastoPorDimension,
  hoyISO,
  mesas as selMesas,
  monitoreos as selMonitoreos,
  porDimension,
  proyectos as selProyectos,
  seguimientos as selSeguimientos,
  sumarDias,
  trimestreDe,
} from './selectores.js';
import { calcularAlertas, filtrarAlertas, proyectosConAlerta } from './alertas.js';

/* ── Rangos temporales ──────────────────────────────────────────────── */

export const RANGOS = [
  { valor: '', titulo: 'Sin límite temporal' },
  { valor: 'semana', titulo: 'Última semana' },
  { valor: 'mes', titulo: 'Último mes' },
  { valor: 'trimestre', titulo: 'Trimestre en curso' },
  { valor: 'anio', titulo: 'Año en curso' },
  { valor: 'personalizado', titulo: 'Rango personalizado' },
];

/** Traduce el rango elegido a un par de fechas ISO. */
export function resolverRango(filtros, hoy = hoyISO()) {
  const anio = hoy.slice(0, 4);
  switch (filtros.rango) {
    case 'semana':
      return { desde: sumarDias(hoy, -7), hasta: hoy };
    case 'mes':
      return { desde: sumarDias(hoy, -30), hasta: hoy };
    case 'trimestre': {
      const t = trimestreDe(hoy);
      const mesInicio = String((t - 1) * 3 + 1).padStart(2, '0');
      const mesFin = String(t * 3).padStart(2, '0');
      const ultimoDia = new Date(Date.UTC(Number(anio), t * 3, 0)).getUTCDate();
      return { desde: `${anio}-${mesInicio}-01`, hasta: `${anio}-${mesFin}-${ultimoDia}` };
    }
    case 'anio':
      return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
    case 'personalizado':
      return { desde: filtros.desde || '', hasta: filtros.hasta || '' };
    default:
      return { desde: '', hasta: '' };
  }
}

/* ── Bloques disponibles ────────────────────────────────────────────── */

export const BLOQUES = [
  { clave: 'resumen', titulo: 'Resumen numérico', descripcion: 'Contadores del recorte' },
  { clave: 'proyectos', titulo: 'Tabla de proyectos', descripcion: 'Listado con avance y estado' },
  { clave: 'graficos', titulo: 'Gráficos', descripcion: 'Distribución y avance agregado' },
  { clave: 'compromisos', titulo: 'Compromisos', descripcion: 'Listado con estado y vencimiento' },
  { clave: 'alertas', titulo: 'Alertas activas', descripcion: 'Del motor central de alertas' },
  { clave: 'minutas', titulo: 'Minutas de seguimiento', descripcion: 'Texto de lo conversado' },
  { clave: 'temas', titulo: 'Temas de monitoreo', descripcion: 'Con criticidad y acción requerida' },
  { clave: 'mesas', titulo: 'Mesas de trabajo', descripcion: 'Con reuniones y periodicidad' },
  { clave: 'eventos', titulo: 'Eventos', descripcion: 'Con estado de requerimientos' },
];

export const MODULOS_ORIGEN = [
  { valor: 'proyectos', titulo: 'Proyectos' },
  { valor: 'seguimientos', titulo: 'Seguimientos' },
  { valor: 'compromisos', titulo: 'Compromisos' },
  { valor: 'monitoreos', titulo: 'Monitoreos' },
  { valor: 'mesas', titulo: 'Mesas' },
  { valor: 'eventos', titulo: 'Eventos' },
];

/* ── Armado ─────────────────────────────────────────────────────────── */

/**
 * @returns {{ proyectos, compromisos, seguimientos, monitoreos, mesas, eventos,
 *             alertas, agregados, resumen, resumenFiltros }}
 */
export function armarReporte(bd, filtros, hoy = hoyISO()) {
  if (!bd) return vacio();

  const { desde, hasta } = resolverRango(filtros, hoy);
  const alertasTodas = calcularAlertas(bd, hoy);
  const conAlerta = proyectosConAlerta(alertasTodas);

  const filtroProyecto = {
    area: filtros.area,
    programa: filtros.programa,
    eje: filtros.eje,
    tipo: filtros.tipo,
    estado: filtros.estado,
    prioridad: filtros.prioridad,
    responsable: filtros.responsable,
    id_proyecto: filtros.id_proyecto,
    es_obra: filtros.solo_obras || undefined,
    solo_prioritarios: filtros.solo_prioritarios || undefined,
  };

  let proyectosFiltrados = selProyectos(bd, filtroProyecto);
  if (filtros.solo_con_alertas) proyectosFiltrados = proyectosFiltrados.filter((p) => conAlerta.has(p.id_proyecto));

  // El recorte por proyecto se aplica igual aunque el reporte sea de otro
  // módulo: es lo que ata las entidades vinculadas al mismo universo.
  const idsProyecto = new Set(proyectosFiltrados.map((p) => p.id_proyecto));
  // Cuando hay un recorte de proyectos activo, las entidades vinculadas se
  // limitan a esos proyectos; si no, sólo se filtran por área y fecha.
  const hayRecorteProyecto = Boolean(
    filtros.area || filtros.programa || filtros.eje || filtros.tipo || filtros.estado ||
      filtros.prioridad || filtros.responsable || filtros.id_proyecto ||
      filtros.solo_obras || filtros.solo_prioritarios || filtros.solo_con_alertas,
  );

  const enModulo = (nombre) => !filtros.modulo || filtros.modulo === nombre;

  /**
   * El módulo de origen recorta TAMBIÉN los proyectos.
   *
   * Vaciaba compromisos, seguimientos, monitoreos y eventos pero dejaba la tabla
   * de proyectos entera: pedir «sólo mesas» devolvía un informe de mesas con
   * doscientos sesenta proyectos adentro y un resumen que hablaba del sistema
   * completo. Con treinta proyectos no se notaba; con la base cargada, el
   * documento decía otra cosa que la que el usuario pidió.
   */
  const proyectos = enModulo('proyectos') ? proyectosFiltrados : [];

  const dentroDelPeriodo = (fecha) => {
    const f = String(fecha ?? '').slice(0, 10);
    if (!f) return !desde && !hasta;
    return (!desde || f >= desde) && (!hasta || f <= hasta);
  };

  /**
   * Los compromisos del período MÁS la deuda abierta que viene de antes.
   *
   * Filtrando sólo por fecha de vencimiento, un informe semanal contaba cero
   * compromisos vencidos mientras el sistema arrastraba treinta y uno: los que
   * vencieron hace un mes y siguen abiertos caían fuera de la ventana. El bloque
   * de alertas del mismo documento sí los mostraba, así que el informe se
   * contradecía consigo mismo. Un vencimiento impago no deja de existir porque
   * se acorte el período: se arrastra hasta que se cumple.
   */
  const compromisos = enModulo('compromisos')
    ? selCompromisos(bd, { area: filtros.area, responsable: filtros.responsable }, hoy)
        .filter((c) => dentroDelPeriodo(c.fecha_limite) || c.estado_efectivo === 'vencido')
        .filter((c) => !hayRecorteProyecto || !c.id_proyecto || idsProyecto.has(c.id_proyecto))
    : [];

  const seguimientos = enModulo('seguimientos')
    ? selSeguimientos(bd, { area: filtros.area, desde, hasta }).filter(
        (s) => !hayRecorteProyecto || (s.ids_proyecto ?? []).some((id) => idsProyecto.has(id)) || !(s.ids_proyecto ?? []).length,
      )
    : [];

  const monitoreos = enModulo('monitoreos') ? selMonitoreos(bd, { area: filtros.area, desde, hasta }) : [];

  const temas = monitoreos
    .flatMap((m) => m.temas.map((t) => ({ ...t, area: m.area, fecha: m.fecha })))
    .filter((t) => !hayRecorteProyecto || !t.id_proyecto || idsProyecto.has(t.id_proyecto));

  /**
   * Las mesas también respetan el período: se quedan las que sesionaron dentro
   * de la ventana. Antes salían las dieciséis en cualquier recorte, así que un
   * informe de la última semana listaba mesas que no se reunían hacía meses.
   * Una mesa no tiene una fecha propia; la que la ubica en el tiempo es la de
   * sus reuniones.
   */
  const mesas = enModulo('mesas')
    ? selMesas(bd, {}).filter((m) => {
        if (!desde && !hasta) return true;
        return activos(bd.reuniones_mesa).some(
          (r) => r.id_mesa === m.id && dentroDelPeriodo(r.fecha),
        );
      })
    : [];

  const eventos = enModulo('eventos')
    ? selEventos(bd, { area: filtros.area, desde, hasta }).filter(
        (e) => !hayRecorteProyecto || !e.id_proyecto || idsProyecto.has(e.id_proyecto),
      )
    : [];

  const alertas = filtrarAlertas(alertasTodas, { area: filtros.area }).filter(
    (a) => !hayRecorteProyecto || !a.id_proyecto || idsProyecto.has(a.id_proyecto),
  );

  // Los gráficos son de proyectos: si el reporte no es de proyectos, no hay
  // agregado que dibujar. Devolverlos igual pintaba el sistema entero al lado
  // de una tabla de mesas.
  const agregados = enModulo('proyectos')
    ? {
        porArea: porDimension(bd, 'area', filtroProyecto),
        porEje: porDimension(bd, 'eje', filtroProyecto),
        porEstado: porDimension(bd, 'estado', filtroProyecto),
        avancePorArea: avancePorDimension(bd, 'area', filtroProyecto),
        gastoPorArea: gastoPorDimension(bd, 'area', filtroProyecto),
      }
    : { porArea: [], porEje: [], porEstado: [], avancePorArea: [], gastoPorArea: [] };

  const resumen = {
    proyectos: proyectos.length,
    obras: proyectos.filter((p) => p.es_obra).length,
    prioritarios: proyectos.filter((p) => p.prioridad === 'alta').length,
    compromisos: compromisos.length,
    compromisosVencidos: compromisos.filter((c) => c.estado_efectivo === 'vencido').length,
    seguimientos: seguimientos.length,
    monitoreos: monitoreos.length,
    temasCriticos: temas.filter((t) => t.criticidad === 'alta' && !t.resuelto).length,
    eventos: eventos.length,
    mesas: mesas.length,
    alertas: alertas.length,
    montoPlanificado: proyectos.reduce((s, p) => s + (Number(p.monto_planificado) || 0), 0),
    montoEjecutado: proyectos.reduce((s, p) => s + (Number(p.monto_ejecutado) || 0), 0),
  };

  return {
    proyectos,
    compromisos,
    seguimientos,
    monitoreos,
    temas,
    mesas,
    eventos,
    alertas,
    agregados,
    resumen,
    rango: { desde, hasta },
    resumenFiltros: describirFiltros(filtros, { desde, hasta }),
  };
}

function vacio() {
  return {
    proyectos: [], compromisos: [], seguimientos: [], monitoreos: [], temas: [],
    mesas: [], eventos: [], alertas: [], agregados: {}, resumen: {},
    rango: { desde: '', hasta: '' }, resumenFiltros: [],
  };
}

/** Lista legible de los filtros aplicados, para explicitarlos al pie del PDF. */
export function describirFiltros(filtros, rango) {
  const partes = [];
  const agregar = (etiqueta, valor) => valor && partes.push(`${etiqueta}: ${valor}`);

  agregar('Área', filtros.area);
  agregar('Programa', filtros.programa);
  agregar('Eje', filtros.eje);
  agregar('Tipo', filtros.tipo);
  agregar('Estado', filtros.estado);
  agregar('Prioridad', filtros.prioridad);
  agregar('Responsable', filtros.responsable);
  agregar('Proyecto', filtros.id_proyecto);
  agregar('Módulo de origen', MODULOS_ORIGEN.find((m) => m.valor === filtros.modulo)?.titulo);

  if (filtros.rango) {
    const titulo = RANGOS.find((r) => r.valor === filtros.rango)?.titulo ?? filtros.rango;
    const detalle = rango.desde || rango.hasta ? ` (${rango.desde || '…'} a ${rango.hasta || '…'})` : '';
    partes.push(`Período: ${titulo}${detalle}`);
  }

  if (filtros.solo_obras) partes.push('Sólo obras');
  if (filtros.solo_prioritarios) partes.push('Sólo prioritarios');
  if (filtros.solo_con_alertas) partes.push('Sólo con alertas activas');

  return partes.length ? partes : ['Sin filtros aplicados: el reporte abarca todo el sistema'];
}
