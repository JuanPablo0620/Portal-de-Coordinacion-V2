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
import { hoyISO } from './tiempo.js';

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

/* ── Asignación de áreas por persona ─────────────────────────────────── */

/**
 * Reemplaza, de una sola vez, qué áreas monitorea `usuario`. No es un alta ni
 * una baja incremental a propósito: la pantalla es un check-list con un solo
 * botón «Guardar», así que lo natural es mandar la lista completa deseada y
 * pisar la anterior — igual que `guardarCatalogo`. Sin login real, `usuario`
 * es el nombre libre de `config.usuario`; no lleva bitácora porque es
 * preferencia de quien usa el sistema, no dato de gestión institucional.
 */
export async function guardarAsignacionesMonitoreo(usuario, areas) {
  const bd = await obtenerBD();
  const deOtros = (bd.asignaciones_monitoreo ?? []).filter((a) => a.usuario !== usuario);
  const propias = areas.map((area) => ({ usuario, area }));
  bd.asignaciones_monitoreo = [...deOtros, ...propias];
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

/* ── Datos reales de Posicionamiento (no sintéticos) ──────────────────── */

/**
 * Da de alta, como proyectos reales, los proyectos del eje Posicionamiento
 * relevados de Coordinacion_db (ver `datos/posicionamiento-real.js`).
 *
 * A diferencia de `cargarDemo`/`cargarBaseCompleta`, esta acción es ADITIVA:
 * no reemplaza nada de lo que ya está cargado, y es idempotente — si un
 * proyecto con ese nombre ya existe en el programa Posicionamiento, no lo
 * duplica. Así, la página de Posicionamiento muestra un módulo por cada
 * proyecto real EN VEZ de una lista fija: lee `proyectos` como cualquier
 * otra pantalla del sistema.
 *
 * También asegura que existan los catálogos que estos proyectos necesitan
 * (área Coordinación, programa y eje Posicionamiento): si antes se cargó
 * demo o base completa, esos catálogos se reemplazaron enteros y hay que
 * agregarlos de nuevo.
 */
export async function cargarProyectosPosicionamientoReales() {
  const { PROYECTOS_POSICIONAMIENTO_REAL } = await import('./posicionamiento-real.js');
  const bd = await obtenerBD();

  const area = await asegurarCatalogo('areas', {
    id: 'ar_coord',
    nombre: 'Coordinación',
    prefijo: 'COR',
    activo: true,
  });
  const programa = await asegurarCatalogo('programas', {
    id: 'pr_posic',
    nombre: 'Posicionamiento',
    activo: true,
  });
  const eje = await asegurarCatalogo('ejes', { id: 'ej_posic', nombre: 'Posicionamiento', activo: true });

  const yaCargados = new Set(
    (bd.proyectos ?? [])
      .filter((p) => p.activo !== false && p.programa === 'Posicionamiento')
      .map((p) => p.proyecto),
  );

  let creados = 0;
  for (const real of PROYECTOS_POSICIONAMIENTO_REAL) {
    if (yaCargados.has(real.nombre)) continue;
    await crearProyecto({
      proyecto: real.nombre,
      area: area.nombre,
      id_area: area.id,
      programa: programa.nombre,
      eje: eje.nombre,
      // Ninguno de los cinco tipos del catálogo describe posicionamiento;
      // "Gestión interna" es el más cercano.
      tipo: 'Gestión interna',
      // "pendiente" no es un estado del catálogo (ESTADOS_ACTIVOS no lo
      // reconoce): se mapea a "planificado" para que cuente como activo en
      // los agregados. La palabra real queda intacta en observaciones.
      estado: real.estadoReal === 'pendiente' ? 'planificado' : real.estadoReal,
      observaciones:
        real.comentario +
        (real.sinMaestro ? ' [Sin fila en "Estado de proyectos": a confirmar.]' : ''),
      fecha_carga: real.fechaActualizacion,
    });
    creados += 1;
  }

  return creados;
}

/** Agrega un ítem a un catálogo si no existe ya uno con el mismo nombre. */
async function asegurarCatalogo(nombreCatalogo, item) {
  const bd = await obtenerBD();
  const items = bd.catalogos?.[nombreCatalogo] ?? [];
  const existente = items.find((i) => i.nombre === item.nombre);
  if (existente) return existente;
  await guardarCatalogo(nombreCatalogo, [...items, item]);
  return item;
}

/** Genera un id de catálogo estable a partir de un nombre real, sin acentos ni espacios. */
function idDesdeNombre(prefijo, nombre) {
  const SIN_ACENTOS = /[̀-ͯ]/g; // marcas diacríticas tras normalize('NFD')
  const slug = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(SIN_ACENTOS, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `${prefijo}_${slug}`;
}

/**
 * Traduce el `Estado` tal como está escrito en un `_db` real al vocabulario
 * cerrado del catálogo (`ESTADOS_PROYECTO`). Nunca inventa silenciosamente: si
 * el valor real no es uno de los cinco estados o no está cargado, devuelve una
 * `nota` con el valor original para que quede en observaciones.
 */
function mapearEstado(estadoCrudo) {
  const CANONICOS = new Set(['planificado', 'en ejecución', 'demorado', 'finalizado', 'suspendido']);
  const normalizado = (estadoCrudo ?? '').trim().toLowerCase();
  if (CANONICOS.has(normalizado)) return { estado: normalizado, nota: null };

  const EQUIVALENCIAS = {
    pendiente: 'planificado',
    programado: 'planificado',
    alerta: 'demorado',
    'crítico': 'demorado',
    critico: 'demorado',
    'por debajo del objetivo': 'demorado',
  };
  if (EQUIVALENCIAS[normalizado]) {
    return { estado: EQUIVALENCIAS[normalizado], nota: `Estado real en el sheet: "${estadoCrudo}".` };
  }
  return {
    estado: 'planificado',
    nota: estadoCrudo
      ? `Estado no interpretable en el sheet ("${estadoCrudo}") — revisar con el área.`
      : 'Estado no cargado en el sheet — revisar con el área.',
  };
}

/* ── Datos reales de las siete secretarías (no sintéticos) ─────────────── */

/**
 * Da de alta, como proyectos reales, los relevados de la pestaña "Estado de
 * proyectos" de cada `_db` (ver `datos/proyectos-reales-secretarias.js`).
 *
 * Mismo patrón que `cargarProyectosPosicionamientoReales()`: aditivo (no
 * reemplaza nada) e idempotente (no duplica si el proyecto ya está cargado
 * para esa área+programa+proyecto). Asegura primero los catálogos de área que
 * necesita cada secretaría, y de paso da de alta cualquier programa real que
 * aparezca en los datos y todavía no exista en el catálogo — así la interfaz
 * queda programada para leer lo que haya, no una lista fija de programas
 * elegidos de antemano.
 *
 * El eje se fija en "Puntual" para todos: la pestaña maestra no trae esa
 * columna (ver nota en `proyectos-reales-secretarias.js`).
 */
async function cargarListaDeSecretarias(secretarias, ejePorDefecto) {
  const resumen = {};
  await enLote(async () => {
    for (const secretaria of secretarias) {
      const bd = await obtenerBD();
      const area = await asegurarCatalogo('areas', { ...secretaria.area, activo: true });

      // El tipo es uno solo por secretaría, así que se resuelve una vez.
      const tipo = (bd.catalogos?.tipos ?? []).find((t) => t.nombre === secretaria.tipoDefault);
      const esObra = Boolean(tipo?.es_obra);

      const yaCargados = new Set(
        (bd.proyectos ?? [])
          .filter((p) => p.activo !== false && p.area === area.nombre)
          .map((p) => `${p.programa}||${p.proyecto}`),
      );

      let creados = 0;
      for (const real of secretaria.datos) {
        const clave = `${real.programa}||${real.proyecto}`;
        if (yaCargados.has(clave)) continue;
        // Sin esto, dos filas iguales dentro de la MISMA lista entrarían las
        // dos: `yaCargados` se arma una sola vez, antes del bucle.
        yaCargados.add(clave);

        const programa = await asegurarCatalogo('programas', {
          id: idDesdeNombre('pr', real.programa),
          nombre: real.programa,
          activo: true,
        });
        // El eje del dato manda cuando existe; el por defecto es para las
        // fuentes que no traen la columna.
        const eje = await asegurarCatalogo('ejes', {
          id: idDesdeNombre('ej', real.eje ?? ejePorDefecto),
          nombre: real.eje ?? ejePorDefecto,
          activo: true,
        });
        const { estado, nota } = mapearEstado(real.estado);

        await crearProyecto({
          proyecto: real.proyecto,
          area: area.nombre,
          id_area: area.id,
          programa: programa.nombre,
          eje: eje.nombre,
          tipo: secretaria.tipoDefault,
          // `es_obra` NO se deduce solo del tipo en ningún lado: el importador
          // por CSV lo calcula al validar, pero este loader no pasaba por ahí y
          // dejaba el campo en false. Resultado: los proyectos de Obras existían
          // pero no aparecían ni en el módulo de Obras ni en el mapa, porque los
          // dos filtran por `es_obra`.
          es_obra: esObra,
          estado,
          observaciones: [real.comentarios, nota].filter(Boolean).join(' '),
          fecha_carga: real.fechaActualizacion,
        });
        creados += 1;
      }
      resumen[area.nombre] = (resumen[area.nombre] ?? 0) + creados;
    }
  });

  return resumen;
}

export async function cargarProyectosRealesSecretarias() {
  const { SECRETARIAS_REALES } = await import('./proyectos-reales-secretarias.js');
  return cargarListaDeSecretarias(SECRETARIAS_REALES, 'Puntual');
}

/**
 * Da de alta los proyectos VALIDADOS de la pestaña "1. Cualitativo" (ver
 * `datos/proyectos-validados-cualitativo.js`).
 *
 * Es la otra mitad de los datos reales, y la de mejor calidad: a diferencia de
 * los del maestro, cada uno fue revisado uno por uno contra la lista oficial de
 * programas, y trae su `eje` real en vez del "Puntual" de aproximación.
 *
 * Mismo contrato que el otro loader: aditivo e idempotente. Si un proyecto ya
 * entró por el maestro con el mismo programa y nombre, no se duplica — y el que
 * quedó es el del maestro, con su eje aproximado. Por eso conviene correr este
 * PRIMERO, que es lo que hace `cargarTodosLosProyectosReales()`.
 */
export async function cargarProyectosValidadosCualitativo() {
  const { SECRETARIAS_VALIDADAS } = await import('./proyectos-validados-cualitativo.js');
  return cargarListaDeSecretarias(SECRETARIAS_VALIDADAS, 'POA');
}

/** Carga de un saque los datos reales de Posicionamiento y de las siete secretarías. */
export async function cargarTodosLosProyectosReales() {
  const creadosPosicionamiento = await cargarProyectosPosicionamientoReales();
  // Los validados van primero a propósito: traen el eje real, así que si un
  // proyecto está en las dos fuentes conviene que gane esta.
  const resumenValidados = await cargarProyectosValidadosCualitativo();
  const resumenSecretarias = await cargarProyectosRealesSecretarias();
  const resumen = { Posicionamiento: creadosPosicionamiento };
  for (const [area, n] of [...Object.entries(resumenValidados), ...Object.entries(resumenSecretarias)]) {
    resumen[area] = (resumen[area] ?? 0) + n;
  }
  return resumen;
}

/* ── Proyectos estratégicos ─────────────────────────────────────────── */

/**
 * Marca un proyecto como estratégico.
 *
 * No es una entidad aparte sino un campo de la base maestra, y eso es
 * deliberado: un proyecto estratégico es el MISMO proyecto que ya siguen
 * seguimiento, monitoreo y planificación, mirado con otra prioridad. Duplicarlo
 * en una colección propia obligaría a mantener dos avances que se iban a
 * despegar en la primera carga.
 */
export async function marcarEstrategico(idProyecto, datos = {}) {
  return actualizarProyecto(idProyecto, {
    estrategico: true,
    prioridad_estrategica: datos.prioridad_estrategica ?? 'alta',
    motivo_estrategico: datos.motivo_estrategico ?? '',
    responsable_politico: datos.responsable_politico ?? '',
    compromiso_publico: datos.compromiso_publico ?? '',
    fecha_compromiso: datos.fecha_compromiso || null,
    origen_estrategico: datos.origen_estrategico ?? 'base',
    id_origen_estrategico: datos.id_origen_estrategico ?? null,
    fecha_marcado_estrategico: datos.fecha_marcado_estrategico ?? hoyISO(),
  });
}

/**
 * Saca un proyecto de la cartera estratégica sin borrar por qué estuvo ahí:
 * los campos quedan y la bitácora guarda el cambio, así que el historial
 * sigue pudiendo explicar por qué durante seis meses fue prioritario.
 */
export async function quitarEstrategico(idProyecto) {
  return actualizarProyecto(idProyecto, { estrategico: false });
}

/**
 * Promoción a estratégico desde monitoreo o seguimiento.
 *
 * Es el camino que pidió el área: lo estratégico casi nunca nace declarado, se
 * descubre cuando un tema se repite o un seguimiento enciende una luz. O el
 * proyecto ya existe en la base maestra y se marca, o hace falta darlo de alta
 * —y entonces se crea con el mismo alta de siempre, para que entre a la base
 * maestra como cualquier otro y no por una puerta lateral—.
 */
export async function promoverAEstrategico({ origen_tipo, id_origen, id_proyecto, proyecto, ...estrategico }) {
  if (!origen_tipo || !id_origen) {
    throw new Error('Una promoción a estratégico requiere origen_tipo e id_origen');
  }
  if (!id_proyecto && !proyecto) {
    throw new Error('Indicá el proyecto a promover o los datos del proyecto nuevo');
  }

  return enLote(async () => {
    const id = id_proyecto ?? (await crearProyecto(proyecto)).id_proyecto;
    return marcarEstrategico(id, {
      ...estrategico,
      origen_estrategico: origen_tipo,
      id_origen_estrategico: id_origen,
    });
  });
}

/* ── Posicionamiento ────────────────────────────────────────────────── */

/**
 * Alta de un proyecto de posicionamiento.
 *
 * Colección propia y no un proyecto de la base maestra: un hermanamiento o una
 * postulación a un fondo no tienen objetivo, unidad ni avance físico, y
 * forzarlos a ese molde llenaba la base maestra de proyectos con campos vacíos.
 * El vínculo a un proyecto es opcional y va en un solo sentido.
 */
export async function crearProyectoPosicionamiento(datos) {
  return crear(
    'proyectos_posicionamiento',
    { estado: 'identificada', ods: [], ids_proyecto: [], ...datos },
    { id_proyecto: datos.ids_proyecto?.[0] ?? null },
  );
}

export async function actualizarProyectoPosicionamiento(id, cambios) {
  const bd = await obtenerBD();
  const previa = bd.proyectos_posicionamiento.find((a) => a.id === id);
  return actualizar('proyectos_posicionamiento', id, cambios, {
    id_proyecto: (cambios.ids_proyecto ?? previa?.ids_proyecto)?.[0] ?? null,
  });
}

export async function bajaProyectoPosicionamiento(id) {
  return bajaLogica('proyectos_posicionamiento', id);
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

/**
 * Edición de un tema ya cargado.
 *
 * Mantiene el compromiso asociado en sincronía. El invariante que garantiza
 * `agregarTema()` —todo tema con acción tiene su compromiso en la lista
 * general, y sólo esos— tiene que sobrevivir a la edición: corregir el
 * responsable o la fecha del tema sin tocar el compromiso dejaba las dos
 * versiones peleadas, marcar la acción después no creaba nada, y desmarcarla
 * dejaba un compromiso vivo por un tema que ya no lo pedía.
 */
export async function actualizarTema(id, cambios) {
  const bd = await obtenerBD();
  const previo = bd.temas_monitoreo.find((t) => t.id === id);
  if (!previo) throw new Error(`No existe el tema ${id}`);
  const monitoreo = bd.monitoreos.find((m) => m.id === previo.id_monitoreo);

  return enLote(async () => {
    const tema = await actualizar('temas_monitoreo', id, cambios, {
      id_proyecto: cambios.id_proyecto ?? previo.id_proyecto ?? null,
    });

    const datos = {
      descripcion: tema.descripcion,
      responsable: tema.responsable,
      fecha_limite: tema.fecha_limite || null,
      id_proyecto: tema.id_proyecto ?? null,
    };

    if (tema.requiere_accion && !previo.id_compromiso) {
      const compromiso = await crearCompromiso({
        origen_tipo: 'monitoreo',
        id_origen: previo.id_monitoreo,
        area: monitoreo?.area ?? '',
        ...datos,
      });
      return actualizar('temas_monitoreo', id, { id_compromiso: compromiso.id });
    }
    if (tema.requiere_accion) {
      await actualizarCompromiso(previo.id_compromiso, datos);
      return tema;
    }
    if (previo.id_compromiso) {
      // Baja lógica, no borrado: el sistema no borra nada, y el asiento de
      // bitácora deja constancia de por qué ese compromiso dejó de contar.
      await bajaLogica('compromisos', previo.id_compromiso);
      return actualizar('temas_monitoreo', id, { id_compromiso: null });
    }
    return tema;
  });
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
