/**
 * Proyectos contra Supabase — la colección de la que cuelga todo lo demás.
 *
 * Es un traductor bastante más grande que el de eventos, porque acá los dos
 * sistemas no difieren solo en los nombres: difieren en el MODELO.
 *
 *   - El portal guarda el avance como un campo del proyecto, y lo pisa. Cargar
 *     el de junio borra el de mayo. La evolución en el tiempo se reconstruye
 *     hoy leyendo la bitácora y buscando cambios del campo `avance`, que es un
 *     parche y se nota.
 *   - La base guarda una fila fechada por observación (`actualizaciones` +
 *     `act_cuantitativas`) y nunca la pisa. El acumulado se calcula sumando.
 *
 * El modelo de la base es el correcto y es el que pidió el área: querían el
 * historial completo. Pero rehacer Monitoreo y Seguimiento para que carguen
 * observaciones en vez de campos sería reescribir las dos pantallas centrales
 * del circuito. Así que la diferencia se la come este módulo:
 *
 *   - Al ESCRIBIR un avance, se crea una observación fechada con lo que
 *     corresponde a este período.
 *   - Al LEER, se devuelve el acumulado como si fuera un campo del proyecto.
 *
 * Ninguna pantalla cambia, y el historial se gana igual.
 *
 * Semántica de los números, confirmada con el área el 08/09/2026:
 *   `objetivo`  la meta, en la unidad del indicador (25.000 m²)
 *   `cantidad`  lo hecho EN ESE PERÍODO (este mes, 500 m²)
 *   `avance`    el ACUMULADO, que es contra lo que se mide el objetivo (3.500)
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

export const activo = () => supabaseConfigurado;

/* ── Catálogos ──────────────────────────────────────────────────────── */

/**
 * La traducción va por `slug`, no por nombre visible.
 *
 * Es la lección de las áreas: ahí matcheábamos por texto y no coincidía
 * ninguna de las siete, porque un lado decía «Secretaría de Obras» y el otro
 * «Obras». Con slug dejan de importar las tildes, las mayúsculas y los
 * espacios — «en ejecución», «En ejecucion» y «EN EJECUCIÓN» caen todos en
 * `en_ejecucion`.
 */
export function aSlug(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marcas de acento, ya separadas por NFD
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

let cache = null;

async function catalogos() {
  if (cache) return cache;

  const [areas, programas, ejes, tipos, estados, unidades, motivos] = await Promise.all([
    supabase.from('areas').select('id, slug, nombre, nombre_formal, prefijo'),
    supabase.from('programas').select('id, nombre, area_id').eq('activo', true),
    supabase.from('ejes').select('id, slug, nombre'),
    supabase.from('tipos_proyecto').select('id, slug, nombre'),
    supabase.from('estados').select('id, slug, nombre'),
    supabase.from('unidades').select('id, slug, nombre'),
    supabase.from('motivos_estrategicos').select('id, slug, nombre'),
  ]);

  for (const r of [areas, programas, ejes, tipos, estados, unidades, motivos]) {
    if (r.error) throw r.error;
  }

  /**
   * Cada catálogo se indexa por slug Y por nombre exacto.
   *
   * El slug solo no alcanza, y lo descubrió una prueba: `aSlug('m²')` da `'m'`
   * y `aSlug('%')` da cadena vacía, porque la función tira todo lo que no sea
   * letra o número. Para «En ejecución» eso es exactamente lo que se quiere;
   * para una unidad que ES un símbolo, la destruye. Con el nombre exacto como
   * segunda llave, «m²» y «%» resuelven bien y las palabras siguen tolerando
   * tildes y mayúsculas.
   */
  const indexar = (filas) => {
    const mapa = new Map();
    for (const f of filas) {
      if (f.slug) mapa.set(f.slug, f.id);
      if (f.nombre) {
        mapa.set(f.nombre, f.id);
        const s = aSlug(f.nombre);
        if (s) mapa.set(s, f.id);
      }
    }
    return mapa;
  };

  // Las áreas además entran por sus dos nombres visibles: el portal ofrece el
  // formal y la base guarda el corto (ver 0005_areas_nombre_formal.sql).
  const mapaAreas = new Map();
  for (const a of areas.data) {
    mapaAreas.set(a.slug, a.id);
    mapaAreas.set(aSlug(a.nombre), a.id);
    if (a.nombre_formal) mapaAreas.set(aSlug(a.nombre_formal), a.id);
  }

  // Los programas NO son catálogo cerrado con slug: se dan de alta por área y
  // dos áreas podrían tener uno con el mismo nombre. Se indexa por área+nombre.
  const mapaProgramas = new Map();
  for (const p of programas.data) mapaProgramas.set(`${p.area_id}|${aSlug(p.nombre)}`, p.id);

  cache = {
    areas: mapaAreas,
    areasPorId: new Map(areas.data.map((a) => [a.id, a])),
    programas: mapaProgramas,
    ejes: indexar(ejes.data),
    tipos: indexar(tipos.data),
    estados: indexar(estados.data),
    unidades: indexar(unidades.data),
    motivos: indexar(motivos.data),
  };
  return cache;
}

export function olvidarCatalogos() {
  cache = null;
}

/**
 * Falla con un mensaje que se entiende, en vez de guardar el dato a medias.
 *
 * Prueba el valor tal cual antes del slug, por el caso de las unidades que son
 * símbolos: `aSlug('%')` es cadena vacía y nunca encontraría nada.
 */
function resolver(mapa, valor, queEs) {
  if (!valor) return null;
  const id = mapa.get(valor) ?? mapa.get(aSlug(valor));
  if (!id) {
    throw new Error(
      `«${valor}» no existe en el catálogo de ${queEs} de la base. ` +
        'Pedile a un administrador que lo dé de alta antes de usarlo.',
    );
  }
  return id;
}

const oNulo = (v) => (v === '' || v === undefined ? null : v);
const oNumero = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/* ── Lectura ────────────────────────────────────────────────────────── */

// `perfiles` se desambigua por columna: `proyectos` la referencia dos veces
// (creado_por y estrategico_marcado_por) y sin decir cuál, PostgREST no sabe
// por dónde unir y devuelve error.
const CAMPOS_PROYECTO = [
  'id, id_legible, nombre, estado_general, responsable, prioridad',
  'fecha_inicio, fecha_fin_proyectada, causa_atraso, es_obra',
  'monto_planificado, monto_ejecutado, zona, latitud, longitud, observaciones, activo',
  'es_estrategico, descripcion_estrategica, estrategico_nota, estrategico_marcado_en',
  'compromiso_publico, origen_estrategico',
  'created_at',
  'programa:programas(nombre, area:areas(nombre, nombre_formal))',
  'eje:ejes(nombre)',
  'tipo:tipos_proyecto(nombre)',
  'autor:perfiles!creado_por(nombre)',
].join(', ');

const CAMPOS_ACTUALIZACION =
  'proyecto_id, fecha_actualizacion, estado:estados(nombre), ' +
  'cuanti:act_cuantitativas(cantidad, objetivo, unidad:unidades(nombre))';

/**
 * Reduce las observaciones de un proyecto a los cuatro campos planos que el
 * portal espera.
 *
 * Acá es donde se paga la diferencia de modelo, y conviene entender cada uno:
 *
 *   `avance`    SUMA de todas las cantidades. Es el acumulado, y es contra lo
 *               que se mide el objetivo.
 *   `cantidad`  la del ÚLTIMO período, no la suma. Es «lo que se hizo esta vez».
 *   `objetivo`  el de la última observación: la meta puede recalibrarse y vale
 *               la vigente, no la primera que se cargó.
 *   `estado`    el de la última observación. En la base el estado es propiedad
 *               de cada observación, no del proyecto.
 */
function aplanarObservaciones(lista) {
  if (!lista.length) return {};

  const ordenadas = [...lista].sort((a, b) =>
    String(a.fecha_actualizacion).localeCompare(String(b.fecha_actualizacion)),
  );
  const ultima = ordenadas[ordenadas.length - 1];
  const conNumero = ordenadas.filter((a) => a.cuanti);

  return {
    avance: conNumero.reduce((suma, a) => suma + (Number(a.cuanti.cantidad) || 0), 0),
    cantidad: ultima.cuanti ? Number(ultima.cuanti.cantidad) || 0 : '',
    objetivo: conNumero.length ? Number(conNumero[conNumero.length - 1].cuanti.objetivo) || '' : '',
    unidad: conNumero.length ? conNumero[conNumero.length - 1].cuanti.unidad?.nombre ?? '' : '',
    estado: ultima.estado?.nombre ? ultima.estado.nombre.toLowerCase() : undefined,
  };
}

const nombreArea = (a) => a?.nombre_formal ?? a?.nombre ?? '';

function aFormaLocal(fila, observaciones) {
  const obs = aplanarObservaciones(observaciones ?? []);
  return {
    // El portal identifica por el código visible, no por el uuid: es lo que se
    // muestra como chip y lo que referencian eventos, compromisos y mesas.
    id_proyecto: fila.id_legible,
    // El uuid viaja igual porque es lo que la base necesita para escribir.
    uuid: fila.id,
    proyecto: fila.nombre,
    area: nombreArea(fila.programa?.area),
    programa: fila.programa?.nombre ?? '',
    eje: fila.eje?.nombre ?? '',
    tipo: fila.tipo?.nombre ?? '',
    // Sin observaciones todavía, el estado sale del general de la fila.
    estado: obs.estado ?? (fila.estado_general === 'finalizado' ? 'finalizado' : 'planificado'),
    cantidad: obs.cantidad ?? '',
    objetivo: obs.objetivo ?? '',
    avance: obs.avance ?? 0,
    unidad: obs.unidad ?? '',
    responsable: fila.responsable ?? '',
    prioridad: fila.prioridad ?? 'media',
    fecha_inicio: fila.fecha_inicio ?? '',
    fecha_fin_prevista: fila.fecha_fin_proyectada ?? '',
    es_obra: fila.es_obra,
    monto_planificado: fila.monto_planificado ?? '',
    monto_ejecutado: fila.monto_ejecutado ?? '',
    zona: fila.zona ?? '',
    latitud: fila.latitud ?? '',
    longitud: fila.longitud ?? '',
    observaciones: fila.observaciones ?? '',
    estrategico: fila.es_estrategico,
    descripcion_estrategica: fila.descripcion_estrategica ?? '',
    compromiso_publico: fila.compromiso_publico ?? '',
    origen_estrategico: fila.origen_estrategico ?? '',
    fecha_marcado_estrategico: fila.estrategico_marcado_en ?? '',
    // Se lee de la base. Estaba fijo en true, asi que dar de baja un proyecto
    // no tenia efecto: la lectura pisaba el cambio. Ver 0020_proyectos_activo.
    activo: fila.activo ?? true,
    creado_por: fila.autor?.nombre ?? '',
    creado_en: fila.created_at,
  };
}

export async function cargar() {
  const [proyectos, actualizaciones] = await Promise.all([
    supabase.from('proyectos').select(CAMPOS_PROYECTO).order('id_legible'),
    supabase.from('actualizaciones').select(CAMPOS_ACTUALIZACION),
  ]);
  if (proyectos.error) throw proyectos.error;
  if (actualizaciones.error) throw actualizaciones.error;

  // Se agrupan en memoria en vez de pedir «la última por proyecto» a la base:
  // PostgREST no expresa bien esa consulta y son volúmenes chicos. Si algún día
  // hay miles de observaciones, esto va a una vista de Postgres.
  const porProyecto = new Map();
  for (const a of actualizaciones.data) {
    if (!porProyecto.has(a.proyecto_id)) porProyecto.set(a.proyecto_id, []);
    porProyecto.get(a.proyecto_id).push(a);
  }

  return proyectos.data.map((p) => aFormaLocal(p, porProyecto.get(p.id)));
}

/* ── Escritura ──────────────────────────────────────────────────────── */

/** Campos del portal que son observación fechada, no atributos del proyecto. */
const CAMPOS_OBSERVACION = ['avance', 'cantidad', 'objetivo', 'unidad', 'estado'];

/** El resto: atributos que sí viven en la fila del proyecto. */
async function aFilaProyecto(datos, cat) {
  const fila = {};

  if ('proyecto' in datos) fila.nombre = datos.proyecto;
  if ('responsable' in datos) fila.responsable = oNulo(datos.responsable);
  if ('prioridad' in datos) fila.prioridad = oNulo(datos.prioridad);
  if ('fecha_inicio' in datos) fila.fecha_inicio = oNulo(datos.fecha_inicio);
  if ('fecha_fin_prevista' in datos) fila.fecha_fin_proyectada = oNulo(datos.fecha_fin_prevista);
  if ('es_obra' in datos) fila.es_obra = Boolean(datos.es_obra);
  if ('monto_planificado' in datos) fila.monto_planificado = oNumero(datos.monto_planificado);
  if ('monto_ejecutado' in datos) fila.monto_ejecutado = oNumero(datos.monto_ejecutado);
  if ('zona' in datos) fila.zona = oNulo(datos.zona);
  if ('latitud' in datos) fila.latitud = oNumero(datos.latitud);
  if ('longitud' in datos) fila.longitud = oNumero(datos.longitud);
  if ('observaciones' in datos) fila.observaciones = oNulo(datos.observaciones);
  if ('activo' in datos) fila.activo = Boolean(datos.activo);

  if ('eje' in datos) fila.eje_id = resolver(cat.ejes, datos.eje, 'ejes');
  if ('tipo' in datos) fila.tipo_id = resolver(cat.tipos, datos.tipo, 'tipos de proyecto');

  // El programa se busca DENTRO del área: el mismo nombre de programa podría
  // existir en dos secretarías, y colgar el proyecto de la equivocada lo saca
  // del informe de su área sin que nadie lo note.
  if ('programa' in datos || 'area' in datos) {
    const areaId = resolver(cat.areas, datos.area, 'áreas');
    if (areaId && datos.programa) {
      const programaId = cat.programas.get(`${areaId}|${aSlug(datos.programa)}`);
      if (!programaId) {
        throw new Error(
          `El programa «${datos.programa}» no existe en ${datos.area}. ` +
            'Verificá el área, o pedile a un administrador que lo dé de alta.',
        );
      }
      fila.programa_id = programaId;
    }
  }

  // `estado_general` es vigente/finalizado, distinto del estado de la
  // observación. Se deriva: el proyecto está finalizado o no lo está.
  if ('estado' in datos) {
    fila.estado_general = aSlug(datos.estado) === 'finalizado' ? 'finalizado' : 'vigente';
  }

  return fila;
}

/** uuid a partir del código visible, que es con el que trabaja el portal. */
async function uuidDe(idLegible) {
  const { data, error } = await supabase
    .from('proyectos')
    .select('id')
    .eq('id_legible', idLegible)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No existe el proyecto ${idLegible} en la base.`);
  return data.id;
}

/**
 * Crea la observación fechada que corresponde a este cambio.
 *
 * `estado_id` es obligatorio en la tabla, así que si el cambio no trae estado
 * se reusa el que ya tenía el proyecto. Sin eso, tocar solo el avance fallaría.
 *
 * El período: el portal no tiene concepto de período por proyecto, así que se
 * usa el día de la carga como inicio y fin. Es lo honesto — inventar un mes
 * completo sería afirmar algo que nadie dijo. Cuando Monitoreo cargue períodos
 * de verdad, este es el lugar donde entran.
 */
async function registrarObservacion(uuid, cambios, { estadoActual, avanceActual = 0, monitoreoId = null }, cat) {
  const hoy = new Date().toISOString().slice(0, 10);
  const hayNumero = ['cantidad', 'avance', 'objetivo'].some(
    (c) => c in cambios && cambios[c] !== '' && cambios[c] !== null,
  );

  const estadoId = resolver(
    cat.estados,
    cambios.estado ?? estadoActual ?? 'planificado',
    'estados',
  );

  const { data: act, error } = await supabase
    .from('actualizaciones')
    .insert({
      proyecto_id: uuid,
      tipo: hayNumero ? 'cuantitativa' : 'cualitativa',
      fecha_actualizacion: hoy,
      periodo_inicio: hayNumero ? hoy : null,
      periodo_fin: hayNumero ? hoy : null,
      estado_id: estadoId,
      origen: 'monitoreo',
      // De que monitoreo salio este avance. Null si se cargo desde la ficha del
      // proyecto o desde un seguimiento -- ver 0012_origen_monitoreo.sql.
      monitoreo_id: monitoreoId,
      // El comentario de ESTA observacion.
      //
      // El campo «Descripcion / observaciones» del monitoreo iba solo a
      // `proyectos.observaciones`, que se sobrescribe: el relato de esta semana
      // borraba el de la anterior. La columna correcta existia desde 0001 y no
      // la llenaba nadie.
      //
      // Se sigue escribiendo tambien en el proyecto, para no cambiar lo que hoy
      // muestran las pantallas que leen `observaciones`. La copia de mas es
      // barata; perder el historial de como avanzo un proyecto, no.
      comentarios: oNulo(cambios.observaciones),
    })
    .select('id')
    .single();
  if (error) throw error;

  if (!hayNumero) return;

  await supabase.from('act_cuantitativas').insert({
    actualizacion_id: act.id,
    cantidad: cantidadDelPeriodo(cambios, avanceActual),
    objetivo: oNumero(cambios.objetivo),
    unidad_id: cambios.unidad ? resolver(cat.unidades, cambios.unidad, 'unidades') : null,
  });
}

/**
 * Qué número guardar como «lo de este período».
 *
 * La tabla guarda el aporte de cada período y el acumulado se calcula sumando.
 * Pero las pantallas mandan dos cosas distintas:
 *
 *   - `cantidad` ya ES lo del período (lo dice la etiqueta del formulario):
 *     se guarda tal cual.
 *   - `avance` es el ACUMULADO. Guardarlo entero contaría de nuevo todo lo
 *     anterior: si venían 3.000 y ahora informan 3.500, lo de este período son
 *     500, no 3.500. Por eso se resta lo ya registrado.
 *
 * La diferencia puede dar negativa si alguien corrige a la baja un avance mal
 * cargado. Se guarda igual: es una corrección legítima y el acumulado queda
 * bien. Falsearla a cero dejaría el total inflado para siempre.
 */
function cantidadDelPeriodo(cambios, avanceActual) {
  if ('cantidad' in cambios && cambios.cantidad !== '' && cambios.cantidad !== null) {
    return Number(cambios.cantidad);
  }
  const acumulado = oNumero(cambios.avance);
  if (acumulado === null) return 0;
  return acumulado - (Number(avanceActual) || 0);
}

/* ── Superficie pública ─────────────────────────────────────────────── */

export async function crearProyecto(datos) {
  const cat = await catalogos();
  const fila = await aFilaProyecto(datos, cat);

  if (!fila.programa_id) throw new Error('El proyecto necesita un área y un programa.');
  if (!fila.eje_id) throw new Error('El proyecto necesita un eje.');

  fila.id_legible = datos.id_proyecto || null;

  const { data: sesion } = await supabase.auth.getSession();
  if (sesion?.session?.user?.id) fila.creado_por = sesion.session.user.id;

  const { data, error } = await supabase
    .from('proyectos')
    .insert(fila)
    .select(CAMPOS_PROYECTO)
    .single();
  if (error) throw error;

  // La primera observación deja registrado el punto de partida, para que el
  // historial arranque en el alta y no en la primera edición.
  if (CAMPOS_OBSERVACION.some((c) => c in datos)) {
    await registrarObservacion(data.id, datos, { estadoActual: datos.estado, avanceActual: 0 }, cat);
  }

  return aFormaLocal(data, await observacionesDe(data.id));
}

export async function actualizarProyecto(idLegible, cambios, contexto = {}) {
  const cat = await catalogos();
  const uuid = contexto.uuid ?? (await uuidDe(idLegible));
  const fila = await aFilaProyecto(cambios, cat);

  if (Object.keys(fila).length) {
    fila.updated_at = new Date().toISOString();
    const { error } = await supabase.from('proyectos').update(fila).eq('id', uuid);
    if (error) throw error;
  }

  if (CAMPOS_OBSERVACION.some((c) => c in cambios)) {
    await registrarObservacion(uuid, cambios, contexto, cat);
  }

  const { data, error } = await supabase
    .from('proyectos')
    .select(CAMPOS_PROYECTO)
    .eq('id', uuid)
    .single();
  if (error) throw error;
  return aFormaLocal(data, await observacionesDe(uuid));
}

async function observacionesDe(uuid) {
  const { data, error } = await supabase
    .from('actualizaciones')
    .select(CAMPOS_ACTUALIZACION)
    .eq('proyecto_id', uuid);
  if (error) throw error;
  return data;
}

/**
 * Marcar y desmarcar estratégico van por las funciones de 0003_rls.sql, no por
 * un UPDATE: los campos estratégicos son diez columnas dentro de `proyectos` y
 * RLS decide por fila, no por columna. Es lo que permite que el jefe de
 * gabinete toque solo eso y nada más del proyecto.
 */
export async function marcarEstrategico(idLegible, datos, contexto = {}) {
  const uuid = contexto.uuid ?? (await uuidDe(idLegible));

  const { error } = await supabase.rpc('marcar_estrategico', {
    p_proyecto_id: uuid,
    p_descripcion_estrategica: oNulo(datos.descripcion_estrategica),
    p_compromiso_publico: oNulo(datos.compromiso_publico),
  });
  if (error) throw error;

  const { data } = await supabase.from('proyectos').select(CAMPOS_PROYECTO).eq('id', uuid).single();
  return aFormaLocal(data, await observacionesDe(uuid));
}

export async function quitarEstrategico(idLegible, contexto = {}) {
  const uuid = contexto.uuid ?? (await uuidDe(idLegible));
  const { error } = await supabase.rpc('quitar_estrategico', { p_proyecto_id: uuid });
  if (error) throw error;

  const { data } = await supabase.from('proyectos').select(CAMPOS_PROYECTO).eq('id', uuid).single();
  return aFormaLocal(data, await observacionesDe(uuid));
}

/**
 * Los programas reales, con la secretaria a la que pertenece cada uno.
 *
 * El portal traia los programas de `bd.catalogos.programas`, que es la semilla
 * de la maqueta: nombres genericos —«Infraestructura urbana», «Habitat y
 * vivienda»— que ningun proyecto real usa, y sin area. Por eso el desplegable
 * de Programa mostraba opciones que no eran y no podia filtrarse por
 * secretaria: el catalogo local no sabe de que area es cada programa.
 *
 * Estos son los 61 que existen de verdad, los mismos de los que cuelgan los 87
 * proyectos. Se devuelven con la forma de un item de catalogo para que
 * `useOpciones()` los consuma sin cambios, mas el `area` que hace posible
 * filtrarlos.
 */
export async function cargarProgramas() {
  const { data, error } = await supabase
    .from('programas')
    .select('id, nombre, activo, area:areas(nombre, nombre_formal)')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;

  return data.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    // El area va con su denominacion formal, que es la que ofrecen los
    // desplegables del portal (ver 0005_areas_nombre_formal.sql).
    area: p.area?.nombre_formal ?? p.area?.nombre ?? '',
    activo: p.activo,
  }));
}
