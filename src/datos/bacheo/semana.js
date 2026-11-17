/**
 * Lógica de la pantalla de Bacheo: cómo se agrupa, filtra y publica una semana.
 *
 * El panel va por LOCALIDAD y no por cuadrilla, a pedido de Coordinación: la
 * pregunta que llega es «¿qué se hace esta semana en Caseros?», no «¿qué hace
 * la cuadrilla 2?». La cuadrilla queda como dato de cada trabajo.
 */
import { claveLugar } from './nombresCalle.js';

export const ESTADOS_UBICACION = Object.freeze({
  revisada: 'Revisada',
  manual: 'Marcada a mano',
  automatica: 'Automática, sin revisar',
  aproximada: 'Aproximada',
  sin_ubicar: 'Sin ubicar',
});

/** Ubicaciones que se dibujan punteadas: todavía no las miró nadie. */
export const esProvisoria = (ubicacion) => ubicacion === 'automatica' || ubicacion === 'aproximada';

/** Lunes a viernes de la semana (o el rango real si arranca después). */
export function diasDeSemana({ desde, hasta }) {
  const dias = [];
  const d = new Date(`${desde}T12:00:00Z`);
  const fin = new Date(`${hasta}T12:00:00Z`);
  while (d <= fin) {
    const dia = d.getUTCDay();
    if (dia >= 1 && dia <= 5) dias.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dias;
}

const NOMBRES_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const LETRAS_DIA = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export const nombreDia = (iso) => NOMBRES_DIA[new Date(`${iso}T12:00:00Z`).getUTCDay()];
export const letraDia = (iso) => LETRAS_DIA[new Date(`${iso}T12:00:00Z`).getUTCDay()];
export const diaYMes = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** «16/11 al 20/11» */
export const rotuloSemana = (s) => `${diaYMes(s.desde)} al ${diaYMes(s.hasta)}`;

/** ¿El trabajo pasa los filtros? `fecha` vacía = toda la semana. */
export function pasaFiltros(trabajo, { fecha = '', tipos = null } = {}) {
  if (tipos && !tipos.has(trabajo.tipo)) return false;
  if (fecha && !trabajo.fechas.includes(fecha)) return false;
  return true;
}

/**
 * Trabajos agrupados por localidad oficial, en orden alfabético; los que no
 * tienen localidad, al final.
 * @returns {{ localidad: string, trabajos: object[], m2: number }[]}
 */
export function agruparPorLocalidad(trabajos) {
  const grupos = new Map();
  for (const t of trabajos) {
    const loc = t.localidad || 'Sin localidad';
    if (!grupos.has(loc)) grupos.set(loc, []);
    grupos.get(loc).push(t);
  }
  const sinLoc = (loc) => (loc === 'Sin localidad' ? 1 : 0);
  return [...grupos]
    .sort(([a], [b]) => sinLoc(a) - sinLoc(b) || a.localeCompare(b, 'es'))
    .map(([localidad, lista]) => ({
      localidad,
      trabajos: lista.sort((a, b) => (a.fechas[0] ?? '').localeCompare(b.fechas[0] ?? '') || a.orden - b.orden),
      m2: lista.reduce((s, t) => s + (Number(t.m2) || 0), 0),
    }));
}

/** Números de la semana para la franja de arriba. */
export function resumenSemana(trabajos) {
  return {
    trabajos: trabajos.length,
    localidades: new Set(trabajos.map((t) => t.localidad).filter(Boolean)).size,
    m2Hormigon: trabajos.filter((t) => t.tipo === 'hormigon').reduce((s, t) => s + (Number(t.m2) || 0), 0),
    sinUbicar: trabajos.filter((t) => !t.geometria).length,
    provisorios: trabajos.filter((t) => t.geometria && esProvisoria(t.ubicacion)).length,
  };
}

/** Texto corto de los días de un trabajo de hormigón: «Mar 17: Desmonte 9 h · Mié 18: Hormigón 9 h» */
export function textoTareas(tareas = []) {
  return tareas.map((t) => `${nombreDia(t.fecha)} ${t.fecha.slice(8, 10)}: ${t.tarea}${t.hora ? ` ${t.hora}` : ''}`).join(' · ');
}

/**
 * Lo que se manda a `publicar_semana_bacheo`. Pasan a la memoria de lugares
 * los trabajos que una persona marcó o confirmó en esta carga (`recordar`):
 * lo automático no, porque se vuelve a calcular igual la semana que viene y
 * guardarlo como «revisado» sería mentir.
 */
export function armarPublicacion({ semana, trabajos, archivos }) {
  const filas = trabajos.map((t, i) => ({
    orden: i,
    cuadrilla: t.cuadrilla,
    tipo: t.tipo,
    descripcion: t.descripcion,
    localidad: t.localidad,
    localidad_planilla: t.localidad_planilla,
    fechas: t.fechas,
    tareas: t.tareas ?? [],
    m2: t.m2 ?? null,
    novedades: t.novedades ?? [],
    geometria: t.geometria ?? null,
    forma: t.forma ?? 'area',
    ubicacion: t.geometria ? t.ubicacion : 'sin_ubicar',
    nota: t.nota ?? '',
  }));
  const vistas = new Set();
  const lugares = [];
  for (const t of trabajos) {
    if (!t.recordar || !t.geometria) continue;
    const clave = claveLugar(t.descripcion, t.localidad);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    lugares.push({
      clave,
      descripcion: t.descripcion,
      localidad: t.localidad,
      geometria: t.geometria,
      forma: t.forma,
      nota: t.nota ?? '',
      origen: t.ubicacion === 'manual' ? 'manual' : 'confirmada',
    });
  }
  return {
    semana: {
      lunes: semana.lunes,
      desde: semana.desde,
      hasta: semana.hasta,
      archivos: archivos.map((a) => ({ tipo: a.tipo, nombre: a.nombre })),
      novedades: semana.novedades ?? [],
    },
    trabajos: filas,
    lugares,
  };
}
