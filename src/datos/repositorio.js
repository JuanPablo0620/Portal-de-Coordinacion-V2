/**
 * ─────────────────────────────────────────────────────────────────────
 * CAPA DE ACCESO A DATOS — superficie pública única del sistema.
 *
 * Ningún componente accede al almacenamiento ni muta la base directamente:
 * todo pasa por acá. Todas las funciones son `async` desde el día uno aunque
 * hoy resuelvan sincrónicamente, para que migrar a una API real sea reemplazar
 * el cuerpo de cada función por un `fetch` sin tocar un solo componente.
 * ─────────────────────────────────────────────────────────────────────
 */
import { leerBD, escribirBD, limpiar } from './almacenamiento.js';
import { bdVacia, normalizarBD, claveDe } from './esquema.js';
import { crearAsiento, diffCampos } from './bitacora.js';
import { nuevoId, generarIdProyecto } from './ids.js';

/* ── Estado interno ─────────────────────────────────────────────────── */

let bdActual = null;
const suscriptores = new Set();

function notificar() {
  for (const fn of suscriptores) fn(bdActual);
}

/** Suscribe al store a los cambios de la base. Devuelve la función de baja. */
export function suscribir(fn) {
  suscriptores.add(fn);
  return () => suscriptores.delete(fn);
}

/**
 * Profundidad de lote. Ver `enLote()`.
 *
 * Es un contador y no un booleano porque los lotes se anidan: `agregarTema()`
 * abre el suyo y por dentro llama a `crearCompromiso()`, que abriría otro.
 */
let profundidadLote = 0;

async function persistir() {
  // Dentro de un lote no se escribe: la escritura completa la hace `enLote()`
  // al cerrar. La copia en memoria ya está actualizada, así que las operaciones
  // siguientes del lote leen lo que dejaron las anteriores.
  if (profundidadLote > 0) return bdActual;
  escribirBD(bdActual);
  notificar();
  return bdActual;
}

/**
 * Agrupa varias operaciones en UNA sola escritura y UNA sola notificación.
 *
 * Cada operación persiste la base entera: con dos años de carga eso es
 * serializar dos megabytes y medio y volver a escribirlos, unas decenas de
 * milisegundos. Da igual para un cambio suelto, pero las operaciones del
 * sistema que escriben en tanda —importar una planilla de doscientas filas,
 * guardar una minuta con sus compromisos, cargar un monitoreo con sus temas—
 * lo pagaban una vez POR FILA, y la importación de un CSV real dejaba la
 * interfaz congelada varios segundos.
 *
 * También arregla un problema de coherencia: sin lote, cada fila notificaba al
 * store y la pantalla se repintaba con una importación a medio hacer.
 *
 * Si algo falla, se persiste igual lo que haya alcanzado a hacerse: las altas
 * en lote informan fila por fila qué entró y qué no, y descartar en silencio lo
 * que sí entró sería peor que guardarlo.
 */
export async function enLote(fn) {
  profundidadLote += 1;
  try {
    return await fn();
  } finally {
    profundidadLote -= 1;
    if (profundidadLote === 0) await persistir();
  }
}

/* ── Ciclo de vida ──────────────────────────────────────────────────── */

export async function hidratar() {
  bdActual = normalizarBD(leerBD());
  return bdActual;
}

export async function obtenerBD() {
  if (!bdActual) await hidratar();
  return bdActual;
}

/* ── Operaciones genéricas ──────────────────────────────────────────── */

/**
 * Alta. Estampa trazabilidad, marca el registro como activo y deja el asiento
 * de bitácora correspondiente.
 */
export async function crear(entidad, datos, { id_proyecto = null } = {}) {
  const bd = await obtenerBD();
  const clave = claveDe(entidad);
  const registro = {
    [clave]: datos[clave] ?? nuevoId(entidad.slice(0, 3)),
    ...datos,
    activo: true,
    creado_por: bd.config.usuario,
    creado_en: new Date().toISOString(),
  };
  bd[entidad] = [...bd[entidad], registro];
  bd.historial = [
    ...bd.historial,
    crearAsiento({
      entidad,
      id_entidad: registro[clave],
      accion: 'alta',
      cambios: [],
      usuario: bd.config.usuario,
      id_proyecto: id_proyecto ?? registro.id_proyecto ?? null,
    }),
  ];
  await persistir();
  return registro;
}

/** Edición. Sólo deja asiento si algún campo cambió realmente. */
export async function actualizar(entidad, id, cambios, { id_proyecto = null } = {}) {
  const bd = await obtenerBD();
  const clave = claveDe(entidad);
  const previo = bd[entidad].find((r) => r[clave] === id);
  if (!previo) throw new Error(`No existe ${entidad} con ${clave} = ${id}`);

  const nuevo = { ...previo, ...cambios };
  bd[entidad] = bd[entidad].map((r) => (r[clave] === id ? nuevo : r));

  const diff = diffCampos(previo, nuevo);
  if (diff.length) {
    bd.historial = [
      ...bd.historial,
      crearAsiento({
        entidad,
        id_entidad: id,
        accion: cambios.activo === false ? 'baja' : 'edicion',
        cambios: diff,
        usuario: bd.config.usuario,
        id_proyecto: id_proyecto ?? previo.id_proyecto ?? null,
      }),
    ];
  }
  await persistir();
  return nuevo;
}

/** Baja lógica. El borrado físico no existe en el sistema. */
export async function bajaLogica(entidad, id) {
  return actualizar(entidad, id, { activo: false });
}

/* ── Configuración y catálogos ──────────────────────────────────────── */

export async function guardarConfig(cambios) {
  const bd = await obtenerBD();
  bd.config = { ...bd.config, ...cambios };
  return persistir();
}

export async function guardarCatalogo(nombre, items) {
  const bd = await obtenerBD();
  bd.catalogos = { ...bd.catalogos, [nombre]: items };
  return persistir();
}

/* ── Proyectos ──────────────────────────────────────────────────────── */

export async function crearProyecto(datos) {
  const bd = await obtenerBD();
  const id_proyecto = datos.id_proyecto || generarIdProyecto(bd, datos.id_area, datos.fecha_carga);
  return crear('proyectos', { ...datos, id_proyecto }, { id_proyecto });
}

export async function actualizarProyecto(id, cambios) {
  return actualizar('proyectos', id, cambios, { id_proyecto: id });
}

export async function bajaProyecto(id) {
  return actualizar('proyectos', id, { activo: false }, { id_proyecto: id });
}

/* ── Seguimientos ───────────────────────────────────────────────────── */

export async function crearSeguimiento(datos) {
  // Un seguimiento puede abarcar varios proyectos; el asiento se ancla al
  // primero para que el historial del proyecto lo capture.
  return crear('seguimientos', datos, { id_proyecto: datos.ids_proyecto?.[0] ?? null });
}

export async function actualizarSeguimiento(id, cambios) {
  return actualizar('seguimientos', id, cambios);
}

/* ── Compromisos ────────────────────────────────────────────────────── */

/**
 * Todo compromiso nace de algún lado: un seguimiento, un tema de monitoreo o
 * una mesa. Exigirlo acá evita compromisos huérfanos, que romperían el link
 * al registro de origen que muestran las alertas.
 */
export async function crearCompromiso(datos) {
  if (!datos.origen_tipo || !datos.id_origen) {
    throw new Error('Un compromiso requiere origen_tipo e id_origen');
  }
  return crear(
    'compromisos',
    { estado: 'pendiente', fecha_cumplimiento: null, ...datos },
    { id_proyecto: datos.id_proyecto ?? null },
  );
}

export async function crearCompromisos(lista) {
  return enLote(async () => {
    const creados = [];
    for (const datos of lista) creados.push(await crearCompromiso(datos));
    return creados;
  });
}

export async function actualizarCompromiso(id, cambios) {
  return actualizar('compromisos', id, cambios);
}

export async function marcarCumplido(id, fecha) {
  return actualizarCompromiso(id, { estado: 'cumplido', fecha_cumplimiento: fecha });
}

/* ── Monitoreos ─────────────────────────────────────────────────────── */

export async function crearMonitoreo(datos) {
  return crear('monitoreos', { cerrado: false, ...datos });
}

/**
 * Agrega un tema al monitoreo y, si requiere acción, crea además el compromiso
 * correspondiente. Es el único camino: así ningún tema con acción queda sin su
 * compromiso en la lista general.
 */
export async function agregarTema(idMonitoreo, tema) {
  const bd = await obtenerBD();
  const monitoreo = bd.monitoreos.find((m) => m.id === idMonitoreo);
  if (!monitoreo) throw new Error(`No existe el monitoreo ${idMonitoreo}`);

  // Un tema con acción son tres operaciones —el tema, su compromiso y el
  // vínculo entre los dos— que para el usuario son un solo acto de carga.
  return enLote(async () => {
    const registro = await crear(
      'temas_monitoreo',
      { id_monitoreo: idMonitoreo, resuelto: false, ...tema },
      { id_proyecto: tema.id_proyecto ?? null },
    );

    let compromiso = null;
    if (tema.requiere_accion) {
      compromiso = await crearCompromiso({
        origen_tipo: 'monitoreo',
        id_origen: idMonitoreo,
        id_proyecto: tema.id_proyecto ?? null,
        area: monitoreo.area,
        descripcion: tema.descripcion,
        responsable: tema.responsable,
        fecha_limite: tema.fecha_limite,
      });
      await actualizar('temas_monitoreo', registro.id, { id_compromiso: compromiso.id });
    }
    return { tema: registro, compromiso };
  });
}

export async function actualizarTema(id, cambios) {
  return actualizar('temas_monitoreo', id, cambios);
}

/** Validación §8.6: no se puede cerrar un monitoreo sin al menos un tema. */
export async function finalizarMonitoreo(id) {
  const bd = await obtenerBD();
  const temas = bd.temas_monitoreo.filter((t) => t.id_monitoreo === id && t.activo !== false);
  if (!temas.length) throw new Error('No se puede finalizar un monitoreo sin al menos un tema');
  return actualizar('monitoreos', id, { cerrado: true });
}

/* ── Mesas ──────────────────────────────────────────────────────────── */

export async function crearMesa(datos) {
  return crear('mesas', { proyectos_vinculados: [], ...datos });
}

export async function actualizarMesa(id, cambios) {
  return actualizar('mesas', id, cambios);
}

export async function crearReunionMesa(datos) {
  return crear('reuniones_mesa', datos);
}

/* ── Eventos ────────────────────────────────────────────────────────── */

export async function crearEvento(datos) {
  return crear('eventos', datos, { id_proyecto: datos.id_proyecto ?? null });
}

export async function actualizarEvento(id, cambios) {
  return actualizar('eventos', id, cambios);
}

export async function crearRequerimiento(datos) {
  return crear('requerimientos_evento', { estado: 'solicitado', ...datos });
}

export async function actualizarRequerimiento(id, cambios) {
  return actualizar('requerimientos_evento', id, cambios);
}

/* ── Planificación ──────────────────────────────────────────────────── */

/** Una planificación por proyecto y año: si ya existe, se actualiza. */
export async function guardarPlanificacion(datos) {
  const bd = await obtenerBD();
  const existente = bd.planificacion_anual.find(
    (p) => p.id_proyecto === datos.id_proyecto && p.anio === datos.anio && p.activo !== false,
  );
  if (existente) return actualizar('planificacion_anual', existente.id, datos, { id_proyecto: datos.id_proyecto });
  return crear('planificacion_anual', { hitos: [], ...datos }, { id_proyecto: datos.id_proyecto });
}

export async function actualizarPlanificacion(id, cambios) {
  return actualizar('planificacion_anual', id, cambios);
}

/* ── Reportes guardados ─────────────────────────────────────────────── */

export async function guardarReporte(nombre, filtros, bloques) {
  return crear('reportes_guardados', { nombre, filtros, bloques });
}

export async function borrarReporte(id) {
  return bajaLogica('reportes_guardados', id);
}

/* ── Importación masiva ─────────────────────────────────────────────── */

/**
 * Alta en lote. Devuelve el detalle por fila para que la interfaz muestre qué
 * se importó y qué se rechazó, en lugar de un total opaco.
 */
export async function importarProyectos(filas) {
  return enLote(async () => {
    const resultado = { importados: 0, errores: [] };
    for (const [indice, fila] of filas.entries()) {
      try {
        await crearProyecto(fila);
        resultado.importados += 1;
      } catch (error) {
        resultado.errores.push({ fila: indice + 1, motivo: error.message });
      }
    }
    return resultado;
  });
}

export async function importarPlanificacion(filas) {
  return enLote(async () => {
    const resultado = { importados: 0, errores: [] };
    for (const [indice, fila] of filas.entries()) {
      try {
        await guardarPlanificacion(fila);
        resultado.importados += 1;
      } catch (error) {
        resultado.errores.push({ fila: indice + 1, motivo: error.message });
      }
    }
    return resultado;
  });
}

/* ── Datos del sistema ──────────────────────────────────────────────── */

/**
 * El generador se importa dinámicamente: es código voluminoso que sólo hace
 * falta al apretar el botón, así que no viaja en el bundle inicial.
 */
export async function cargarDemo(hoyISO) {
  const { generarDemo } = await import('./demo.js');
  bdActual = generarDemo(hoyISO);
  return persistir();
}

/**
 * Base a escala real: el mismo sistema con dos años de carga encima. Sirve para
 * probar tablas, filtros, tableros e impresión con el volumen que van a tener,
 * no con treinta registros. Se importa dinámicamente por el mismo motivo que el
 * set de demostración.
 */
export async function cargarBaseCompleta(hoyISO) {
  const { generarBaseCompleta } = await import('./base-completa.js');
  bdActual = generarBaseCompleta(hoyISO);
  return persistir();
}

export async function vaciarSistema() {
  limpiar();
  bdActual = bdVacia();
  return persistir();
}
