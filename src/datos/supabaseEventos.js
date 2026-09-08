/**
 * Eventos y requerimientos contra Supabase — primera colección que deja de
 * vivir en el navegador.
 *
 * ¿Por qué existe un traductor y no se usan las filas tal cual vienen? Porque
 * el portal y la base guardan lo mismo de dos formas distintas:
 *
 *   - El portal guarda NOMBRES: `area_organizadora: 'Obras'`, `item: 'Sonido'`.
 *     Es lo natural cuando todo vive en un objeto en memoria.
 *   - La base guarda CLAVES: `area_organizadora_id`, `item_id`, que apuntan a
 *     las tablas de catálogo. Es lo natural en una base relacional — si mañana
 *     se corrige el nombre de una secretaría, se corrige en un solo lugar.
 *
 * Ninguna de las dos está mal; hay que traducir. Es la misma traducción que
 * hizo `cargar_supabase.py` para la carga inicial del 04/09, ahora en vivo y
 * en las dos direcciones.
 *
 * La regla de oro: de acá para afuera SOLO salen objetos con la forma del
 * portal. Ni `selectores.js` ni un componente se enteran de que estos datos
 * vienen de otro lado — es lo que permite migrar de a una colección sin
 * reescribir las pantallas.
 */
import { supabase, supabaseConfigurado } from './supabaseClient.js';

/** Si no hay Supabase configurado, el repositorio sigue con el navegador. */
export const activo = () => supabaseConfigurado;

/* ── Catálogos ──────────────────────────────────────────────────────── */

/**
 * Para escribir hace falta el camino inverso: del nombre que eligió la persona
 * al id que guarda la base. Se cachea porque los catálogos no cambian durante
 * una sesión, y resolver cada alta con dos consultas extra sería absurdo.
 */
let cacheCatalogos = null;

async function catalogos() {
  if (cacheCatalogos) return cacheCatalogos;

  const [areas, items] = await Promise.all([
    supabase.from('areas').select('id, nombre, nombre_formal'),
    supabase.from('items_requerimiento').select('id, nombre').eq('activo', true),
  ]);
  if (areas.error) throw areas.error;
  if (items.error) throw items.error;

  const porNombre = (filas) => new Map(filas.map((f) => [f.nombre, f.id]));

  // Las áreas entran por sus DOS nombres. El portal ofrece la denominación
  // formal («Secretaría de Obras») y la base guarda la corta («Obras»): sin
  // esto no coincide ninguna de las siete y elegir una secretaría corta con
  // error. Los dos nombres son correctos y se usan en contextos distintos —
  // ver 0005_areas_nombre_formal.sql.
  const mapaAreas = porNombre(areas.data);
  for (const a of areas.data) {
    if (a.nombre_formal) mapaAreas.set(a.nombre_formal, a.id);
  }

  cacheCatalogos = { areas: mapaAreas, items: porNombre(items.data) };
  return cacheCatalogos;
}

/** La invalida el refresco: si un admin agregó un ítem, hay que volver a leer. */
export function olvidarCatalogos() {
  cacheCatalogos = null;
}

/* ── Traducción ─────────────────────────────────────────────────────── */

/**
 * Postgres devuelve las horas como `HH:MM:SS`; el campo del formulario espera
 * `HH:MM` y con los segundos se muestra vacío, sin decir por qué.
 */
const soloHoraMinuto = (hora) => (hora ? hora.slice(0, 5) : '');

/**
 * El formulario manda cadenas vacías cuando no se completó algo. Una columna
 * `date`, `time` o `uuid` rechaza `''` — el valor correcto es `null`.
 */
const oNulo = (v) => (v === '' || v === undefined ? null : v);

/**
 * Nombre de área para el portal: el formal, porque es el que ofrecen los
 * desplegables. Si por algo falta, cae al corto en vez de dejar el campo vacío
 * — es preferible mostrar «Obras» que nada.
 */
const nombreDeArea = (area) => area?.nombre_formal ?? area?.nombre ?? '';

/** Fila de la base → objeto con la forma que espera el portal. */
function aFormaLocal(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    // En la base la columna se llama `descripcion` y viene de 0001; en el
    // portal el campo se llama «Detalle». Se traduce, no se renombra ninguna
    // de las dos puntas.
    detalle: fila.descripcion ?? '',
    fecha: fila.fecha ?? '',
    hora: soloHoraMinuto(fila.hora),
    lugar: fila.lugar ?? '',
    area_organizadora: nombreDeArea(fila.area),
    tipo: fila.tipo ?? '',
    estado: fila.estado ?? 'previsto',
    // Ver `proyecto_ref_local` en 0004_eventos.sql: puente temporal mientras
    // los proyectos sigan viviendo en el navegador con ids de otra forma.
    id_proyecto: fila.proyecto_ref_local ?? '',
    activo: fila.activo,
    creado_por: fila.autor?.nombre ?? '',
    creado_en: fila.created_at,
  };
}

/** Objeto del portal → fila para la base. */
async function aFormaBase(datos) {
  const { areas } = await catalogos();
  const fila = {};

  // Se mapea campo por campo y no con un spread: así una propiedad que el
  // front agregue mañana no se cuela a la base y falla con «column not found»
  // en el momento menos oportuno.
  if ('nombre' in datos) fila.nombre = datos.nombre;
  if ('detalle' in datos) fila.descripcion = oNulo(datos.detalle);
  if ('fecha' in datos) fila.fecha = oNulo(datos.fecha);
  if ('hora' in datos) fila.hora = oNulo(datos.hora);
  if ('lugar' in datos) fila.lugar = oNulo(datos.lugar);
  if ('tipo' in datos) fila.tipo = oNulo(datos.tipo);
  if ('estado' in datos) fila.estado = oNulo(datos.estado);
  if ('activo' in datos) fila.activo = datos.activo;
  if ('id_proyecto' in datos) fila.proyecto_ref_local = oNulo(datos.id_proyecto);

  if ('area_organizadora' in datos) {
    const nombre = datos.area_organizadora;
    // Un área que no está en el catálogo de la base es un error de datos, no
    // algo para guardar a medias: se avisa y se corta, en vez de dejar el
    // evento sin secretaría y que alguien lo descubra en un informe.
    if (nombre && !areas.has(nombre)) {
      throw new Error(
        `El área «${nombre}» no existe en el catálogo de la base. ` +
          'Pedile a un administrador que la dé de alta antes de usarla.',
      );
    }
    fila.area_organizadora_id = nombre ? areas.get(nombre) : null;
  }

  return fila;
}

/* ── Lectura ────────────────────────────────────────────────────────── */

const CAMPOS_EVENTO =
  'id, nombre, descripcion, fecha, hora, lugar, tipo, estado, activo, created_at, ' +
  'proyecto_ref_local, area:areas(nombre, nombre_formal), autor:perfiles(nombre)';

const CAMPOS_REQUERIMIENTO =
  'id, evento_id, cantidad, estado, activo, item:items_requerimiento(nombre), area:areas(nombre, nombre_formal)';

/**
 * Trae eventos y requerimientos de una sola vez, ya traducidos.
 *
 * Van juntos porque el checklist no tiene sentido sin su evento, y traerlos en
 * dos momentos distintos deja la pantalla mostrando un evento sin
 * requerimientos durante un instante.
 */
export async function cargar() {
  const [eventos, requerimientos] = await Promise.all([
    supabase.from('eventos').select(CAMPOS_EVENTO).order('fecha', { ascending: false }),
    supabase.from('requerimientos_evento').select(CAMPOS_REQUERIMIENTO),
  ]);
  if (eventos.error) throw eventos.error;
  if (requerimientos.error) throw requerimientos.error;

  return {
    eventos: eventos.data.map(aFormaLocal),
    requerimientos_evento: requerimientos.data.map((r) => ({
      id: r.id,
      id_evento: r.evento_id,
      item: r.item?.nombre ?? '',
      cantidad: r.cantidad ?? 1,
      area_responsable: nombreDeArea(r.area),
      estado: r.estado,
      activo: r.activo,
    })),
  };
}

/* ── Escritura ──────────────────────────────────────────────────────── */

export async function crearEvento(datos) {
  const fila = await aFormaBase(datos);

  // Quién lo cargó, de verdad. Hasta que hubo login esto era el texto libre de
  // `config.usuario` y no valía nada; ahora sale de la sesión y nadie puede
  // firmar con el nombre de otro. Es el primer registro del sistema que lo usa.
  const { data: sesion } = await supabase.auth.getSession();
  if (sesion?.session?.user?.id) fila.creado_por = sesion.session.user.id;

  const { data, error } = await supabase
    .from('eventos')
    .insert(fila)
    .select(CAMPOS_EVENTO)
    .single();
  if (error) throw error;
  return aFormaLocal(data);
}

export async function actualizarEvento(id, cambios) {
  const fila = await aFormaBase(cambios);
  const { data, error } = await supabase
    .from('eventos')
    .update(fila)
    .eq('id', id)
    .select(CAMPOS_EVENTO)
    .single();
  if (error) throw error;
  return aFormaLocal(data);
}

export async function crearRequerimiento(datos) {
  const { areas, items } = await catalogos();
  if (!items.has(datos.item)) {
    throw new Error(`El ítem «${datos.item}» no existe en el catálogo de la base.`);
  }

  const { data, error } = await supabase
    .from('requerimientos_evento')
    .insert({
      evento_id: datos.id_evento,
      item_id: items.get(datos.item),
      cantidad: datos.cantidad ?? 1,
      area_responsable_id: datos.area_responsable ? areas.get(datos.area_responsable) ?? null : null,
      estado: datos.estado ?? 'solicitado',
    })
    .select(CAMPOS_REQUERIMIENTO)
    .single();
  if (error) throw error;

  return {
    id: data.id,
    id_evento: data.evento_id,
    item: data.item?.nombre ?? '',
    cantidad: data.cantidad ?? 1,
    area_responsable: nombreDeArea(data.area),
    estado: data.estado,
    activo: data.activo,
  };
}

export async function actualizarRequerimiento(id, cambios) {
  const { areas } = await catalogos();
  const fila = {};
  if ('estado' in cambios) fila.estado = cambios.estado;
  if ('cantidad' in cambios) fila.cantidad = cambios.cantidad;
  if ('activo' in cambios) fila.activo = cambios.activo;
  if ('area_responsable' in cambios) {
    fila.area_responsable_id = cambios.area_responsable
      ? areas.get(cambios.area_responsable) ?? null
      : null;
  }

  const { data, error } = await supabase
    .from('requerimientos_evento')
    .update(fila)
    .eq('id', id)
    .select(CAMPOS_REQUERIMIENTO)
    .single();
  if (error) throw error;

  return {
    id: data.id,
    id_evento: data.evento_id,
    item: data.item?.nombre ?? '',
    cantidad: data.cantidad ?? 1,
    area_responsable: nombreDeArea(data.area),
    estado: data.estado,
    activo: data.activo,
  };
}
