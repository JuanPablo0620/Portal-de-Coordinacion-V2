/**
 * ─────────────────────────────────────────────────────────────────────
 * FORMA DE LOS CSV IMPORTABLES — una sola definición para los dos lados.
 *
 * La exportación de la tabla maestra y la importación por CSV describían el
 * mismo archivo por separado, y no coincidían. Exportar la tabla y volver a
 * importarla —editar la planilla en Excel y subirla, que es lo primero que
 * cualquiera intenta— fallaba de tres maneras distintas:
 *
 *  · La columna «Área» no se reconocía sola, porque el mapeo automático
 *    comparaba con acentos: «área» nunca iba a coincidir con `area`.
 *  · La exportación no incluía `unidad` ni `objetivo`, que son obligatorios,
 *    así que TODAS las filas se rechazaban.
 *  · La columna «Avance» de la tabla es el PORCENTAJE, pero el importador la
 *    mapeaba al campo `avance`, que es la cantidad absoluta. Nadie avisaba: se
 *    importaba «45» donde el proyecto llevaba 1.200 metros.
 *
 * Ahora las columnas del archivo, el mapeo automático y la validación viven
 * acá, y tanto la tabla como el importador los leen de este módulo. El de
 * planificación arrastraba una copia de la misma lógica —y con ella el mismo
 * error de mapeo, agravado: su columna «Año» no coincidía con la clave `anio`
 * ni sacándole el acento—, así que también pasó a leer de acá.
 * ─────────────────────────────────────────────────────────────────────
 */
import { ESTADOS_PROYECTO, PRIORIDADES } from './catalogos.js';

/** Campos importables. Los requeridos rechazan la fila si faltan. */
export const CAMPOS_PROYECTO = Object.freeze([
  { clave: 'proyecto', titulo: 'Nombre del proyecto', requerido: true, alias: ['nombre', 'obra'] },
  { clave: 'area', titulo: 'Área', requerido: true, catalogo: 'areas', alias: ['secretaria', 'dependencia'] },
  { clave: 'programa', titulo: 'Programa', catalogo: 'programas' },
  { clave: 'eje', titulo: 'Eje', catalogo: 'ejes' },
  { clave: 'tipo', titulo: 'Tipo', requerido: true, catalogo: 'tipos' },
  { clave: 'unidad', titulo: 'Unidad', requerido: true, catalogo: 'unidades' },
  { clave: 'objetivo', titulo: 'Objetivo', requerido: true, numerico: true, alias: ['meta'] },
  { clave: 'avance', titulo: 'Avance', numerico: true },
  { clave: 'cantidad', titulo: 'Cantidad', numerico: true },
  { clave: 'estado', titulo: 'Estado', lista: ESTADOS_PROYECTO },
  { clave: 'prioridad', titulo: 'Prioridad', lista: PRIORIDADES },
  { clave: 'responsable', titulo: 'Responsable' },
  { clave: 'fecha_inicio', titulo: 'Fecha de inicio', fecha: true, alias: ['inicio'] },
  { clave: 'fecha_fin_prevista', titulo: 'Fin previsto', fecha: true, alias: ['fin', 'fecha de fin'] },
  { clave: 'monto_planificado', titulo: 'Monto planificado', numerico: true, alias: ['presupuesto'] },
  { clave: 'monto_ejecutado', titulo: 'Monto ejecutado', numerico: true, alias: ['devengado'] },
]);

/** Encabezados de la plantilla, en el orden en que se esperan. */
export const PLANTILLA_PROYECTOS = CAMPOS_PROYECTO.map((c) => c.clave).join(',');

/**
 * Columnas con las que la base maestra se exporta a CSV.
 *
 * Son las del modelo, no las de la pantalla: un archivo pensado para volver a
 * entrar tiene que traer todo lo obligatorio, y la columna de avance tiene que
 * ser la cantidad absoluta —la que el sistema guarda— y no el porcentaje que la
 * tabla dibuja en una barra. El id se exporta al principio para poder cruzarlo
 * a mano, aunque la importación no lo use: dar de alta genera ids nuevos.
 */
export const COLUMNAS_CSV_PROYECTO = Object.freeze([
  { clave: 'id_proyecto', titulo: 'id_proyecto' },
  ...CAMPOS_PROYECTO.map((c) => ({ clave: c.clave, titulo: c.titulo })),
]);

/** Sin acentos, sin mayúsculas, sin espacios ni guiones bajos. */
function normalizar(texto) {
  // Se descompone y se descartan los diacríticos por punto de código, en lugar
  // de con una clase de caracteres literal: un rango de combinantes escrito a
  // mano en el fuente es de las cosas que un reencodeo rompe en silencio.
  const sinAcentos = [...String(texto ?? '').normalize('NFD')]
    .filter((c) => {
      const punto = c.codePointAt(0);
      return punto < 0x300 || punto > 0x36f;
    })
    .join('');
  return sinAcentos.toLowerCase().replace(/[\s_.]/g, '');
}

/**
 * Mapeo automático de encabezados a campos: `{ campo: índiceDeColumna }`.
 *
 * Reconoce la clave del modelo (`fecha_fin_prevista`), el título legible
 * («Fin previsto») y los alias declarados, porque las tres formas aparecen en
 * archivos reales: la primera en la plantilla, la segunda en lo que exporta el
 * propio sistema y la tercera en las planillas que ya usan las áreas. El
 * usuario puede corregirlo a mano; esto sólo evita el trabajo obvio.
 */
export function proponerMapeo(encabezados = [], campos = CAMPOS_PROYECTO) {
  const normalizados = encabezados.map(normalizar);
  const mapeo = {};
  for (const campo of campos) {
    const candidatos = [campo.clave, campo.titulo, ...(campo.alias ?? [])].map(normalizar);
    const indice = normalizados.findIndex((e) => e && candidatos.includes(e));
    if (indice >= 0) mapeo[campo.clave] = String(indice);
  }
  return mapeo;
}

/**
 * Valida y normaliza UN valor según la definición de su campo.
 *
 * Devuelve `{ valor }` si pasa y `{ motivo }` si no. Está separado porque los
 * dos validadores —proyectos y planificación— hacían exactamente las mismas
 * cuentas con los números y las fechas en copias distintas: el que aceptaba
 * «45.000.000» en un archivo tenía que seguir aceptándolo en el otro, y con dos
 * copias eso dependía de que alguien se acordara.
 */
function normalizarValor(campo, valor, catalogos = {}) {
  if (campo.catalogo) {
    const item = (catalogos[campo.catalogo] ?? []).find(
      (x) => x.nombre.toLowerCase() === valor.toLowerCase(),
    );
    if (!item) return { motivo: `«${valor}» no está en el catálogo de ${campo.titulo.toLowerCase()}` };
    return { valor: item.nombre };
  }

  if (campo.lista && !campo.lista.includes(valor.toLowerCase())) {
    return { motivo: `«${valor}» no es un valor válido de ${campo.titulo.toLowerCase()}` };
  }

  if (campo.numerico) {
    // Se acepta el formato local: «1.234.567,89».
    const n = Number(String(valor).replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(n)) return { motivo: `${campo.titulo.toLowerCase()} no es un número` };
    return { valor: n };
  }

  if (campo.fecha) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return { valor };
    // Se acepta DD/MM/AAAA y se normaliza a ISO.
    const m = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return { motivo: `${campo.titulo.toLowerCase()} debe ser DD/MM/AAAA o AAAA-MM-DD` };
    return { valor: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` };
  }

  return { valor };
}

/**
 * Valida las filas ya mapeadas contra los catálogos vigentes.
 *
 * Devuelve aceptadas y rechazadas por separado, con el motivo de cada rechazo:
 * la pantalla muestra fila por fila qué entra y qué no, en lugar de un total
 * opaco. Es una función pura para poder probarla con un archivo entero.
 *
 * @param {object[]} objetos filas ya convertidas a objetos por `filasAObjetos`
 * @param {object} catalogos `{ areas, programas, ejes, tipos, unidades }`
 * @param {string} hoy fecha de carga por defecto
 */
export function validarFilasProyecto(objetos, catalogos, hoy) {
  const aceptadas = [];
  const rechazadas = [];

  objetos.forEach((crudo, i) => {
    const motivos = [];
    const limpio = { ...crudo };

    for (const campo of CAMPOS_PROYECTO) {
      const valor = String(crudo[campo.clave] ?? '').trim();

      if (campo.requerido && !valor) {
        motivos.push(`falta ${campo.titulo.toLowerCase()}`);
        continue;
      }
      if (!valor) continue;

      const resultado = normalizarValor(campo, valor, catalogos);
      if (resultado.motivo) motivos.push(resultado.motivo);
      else limpio[campo.clave] = resultado.valor;
    }

    if (motivos.length) {
      rechazadas.push({
        id: `r${i}`,
        fila: i + 2,
        proyecto: crudo.proyecto || '(sin nombre)',
        motivo: motivos.join(' · '),
      });
      return;
    }

    const area = (catalogos.areas ?? []).find((a) => a.nombre === limpio.area);
    const tipo = (catalogos.tipos ?? []).find((t) => t.nombre === limpio.tipo);
    aceptadas.push({
      id: `a${i}`,
      ...limpio,
      id_area: area?.id,
      es_obra: Boolean(tipo?.es_obra),
      estado: limpio.estado || 'planificado',
      prioridad: limpio.prioridad || 'media',
      fecha_carga: limpio.fecha_inicio || hoy,
    });
  });

  return { aceptadas, rechazadas };
}

/* ── Planificación anual ────────────────────────────────────────────── */

/**
 * Campos del CSV de planificación.
 *
 * `anio` lleva alias: la columna se llama «Año» en cualquier planilla que un
 * área mande, y el mapeo automático por clave no la reconocía —«año» no se
 * parece a `anio` ni sacándole el acento—. Las metas trimestrales entran como
 * cuatro columnas sueltas porque así vienen de la planilla, y recién acá se
 * arman en el arreglo que guarda el sistema.
 */
export const CAMPOS_PLANIFICACION = Object.freeze([
  { clave: 'id_proyecto', titulo: 'ID de proyecto', requerido: true, alias: ['id', 'proyecto'] },
  { clave: 'anio', titulo: 'Año', numerico: true, alias: ['año', 'ejercicio'] },
  { clave: 'meta_anual', titulo: 'Meta anual', requerido: true, numerico: true, alias: ['meta'] },
  { clave: 't1', titulo: 'Meta T1', numerico: true, alias: ['trimestre1', 'primer trimestre'] },
  { clave: 't2', titulo: 'Meta T2', numerico: true, alias: ['trimestre2', 'segundo trimestre'] },
  { clave: 't3', titulo: 'Meta T3', numerico: true, alias: ['trimestre3', 'tercer trimestre'] },
  { clave: 't4', titulo: 'Meta T4', numerico: true, alias: ['trimestre4', 'cuarto trimestre'] },
  { clave: 'monto_planificado', titulo: 'Monto planificado', numerico: true, alias: ['presupuesto'] },
]);

export const PLANTILLA_PLANIFICACION = CAMPOS_PLANIFICACION.map((c) => c.clave).join(',');

/**
 * Valida las filas de planificación. La comprobación que importa es que el
 * `id_proyecto` exista en la base maestra: sin eso la planificación queda
 * huérfana y no la ve ningún comparativo.
 *
 * @param {Set<string>} idsValidos ids de proyecto vigentes
 * @param {number} anioPorDefecto año de la pantalla, para las filas sin columna de año
 */
export function validarFilasPlanificacion(objetos, idsValidos, anioPorDefecto) {
  const aceptadas = [];
  const rechazadas = [];

  objetos.forEach((crudo, i) => {
    const motivos = [];
    const limpio = {};

    for (const campo of CAMPOS_PLANIFICACION) {
      const valor = String(crudo[campo.clave] ?? '').trim();
      if (campo.requerido && !valor) {
        motivos.push(`falta ${campo.titulo.toLowerCase()}`);
        continue;
      }
      if (!valor) continue;
      const resultado = normalizarValor(campo, valor);
      if (resultado.motivo) motivos.push(resultado.motivo);
      else limpio[campo.clave] = resultado.valor;
    }

    if (limpio.id_proyecto && !idsValidos.has(limpio.id_proyecto)) {
      motivos.push(`el proyecto «${limpio.id_proyecto}» no existe en la base maestra`);
    }

    if (motivos.length) {
      rechazadas.push({
        id: `r${i}`,
        fila: i + 2,
        id_proyecto: crudo.id_proyecto || '(sin id)',
        motivo: motivos.join(' · '),
      });
      return;
    }

    aceptadas.push({
      id: `a${i}`,
      id_proyecto: limpio.id_proyecto,
      anio: limpio.anio ?? anioPorDefecto,
      meta_anual: limpio.meta_anual,
      // La meta del cuarto trimestre por defecto es la anual: es el cierre del
      // año, no un trimestre más.
      metas_trimestrales: [limpio.t1 ?? 0, limpio.t2 ?? 0, limpio.t3 ?? 0, limpio.t4 ?? limpio.meta_anual],
      monto_planificado: limpio.monto_planificado ?? 0,
      hitos: [],
    });
  });

  return { aceptadas, rechazadas };
}
