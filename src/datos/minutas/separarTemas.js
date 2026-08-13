// ─────────────────────────────────────────────────────────────────────
// TRANSFERENCIA DE TEXTO A TEMAS DE MONITOREO.
//
// Misma idea que la minuta de seguimiento, distinta salida: monitoreo no
// registra tres bloques sino temas con estructura estandarizada, así que acá
// cada oración del texto se convierte en UN tema propuesto, con su categoría y
// su criticidad ya sugeridas.
//
// Todo lo que devuelve es PROPUESTA. La pantalla de carga los muestra como
// borradores editables y no persiste ninguno hasta que el usuario confirma.
//
// Igual que `separarMinuta.js`, este archivo no importa nada del resto del
// sistema —el catálogo de categorías vigente entra por parámetro— para que el
// día que haya un modelo de lenguaje detrás se reemplace de una sola pieza.
// ─────────────────────────────────────────────────────────────────────
import { clasificarMinuta } from './separarMinuta.js';

/**
 * Reglas de categoría, en orden de precedencia: gana la primera que matchea.
 *
 * El orden no es alfabético ni casual. Lo específico va antes que lo general:
 * «hay que pagarle al proveedor» es un tema de proveedores y contrataciones
 * aunque mencione un pago, y por eso `prov` se evalúa antes que `presup`.
 */
const REGLAS = [
  { clave: 'vecinal', patron: /\bvecin[oa]s?\b|\breclamo[s]?\b|\bqueja[s]?\b|\bdenuncia[s]?\b|\bbarrio\b/i },
  { clave: 'prov', patron: /\bproveedor|\bcontratista|\blicitaci[oó]n|\bpliego|\bcotizaci|\badjudic|\bcompra[s]?\b|\bcontrataci/i },
  { clave: 'rrhh', patron: /\bpersonal\b|\bagentes?\b|\blicencia[s]?\b|\bcuadrilla[s]?\b|\bguardia[s]?\b|\bhoras\s+extra|\bplanta\b/i },
  { clave: 'presup', patron: /\bpresupuest|\bpartida[s]?\b|\bfondos?\b|\bpago[s]?\b|\bfactura|\bcertificad|\bfinanciamiento|\bmonto[s]?\b/i },
  { clave: 'admin', patron: /\bexpediente|\bresoluci[oó]n|\bdecreto|\bordenanza|\btr[aá]mite|\bconvenio|\bfirma[s]?\b|\bnota\b/i },
  { clave: 'inter', patron: /\botra[s]?\s+[aá]rea|\barticul|\bcoordinaci[oó]n\s+con|\bsecretar[ií]a\s+de|\bprovincia\b|\bnaci[oó]n\b|\blegales\b/i },
  { clave: 'tecnico', patron: /\bproyecto\s+ejecutivo|\bplano[s]?\b|\bc[oó]mputo|\bt[eé]cnic[oa]|\bingenier|\bmedici[oó]n|\brelevamiento\b/i },
  { clave: 'operativo', patron: /\bobra\b|\bcuadrilla|\bm[aá]quina|\bmaterial(?:es)?\b|\bejecut|\bcolocaci|\btarea[s]?\b|\boperativ/i },
];

/**
 * Con qué palabras se busca cada regla dentro del catálogo VIGENTE.
 *
 * El catálogo de categorías es administrable: el municipio puede renombrar
 * «Reclamo vecinal» o borrarlo. Por eso la regla no devuelve un nombre fijo
 * sino que se busca por fragmento, y si no hay ninguna categoría que le
 * corresponda el tema queda sin categoría —que el usuario elige a mano— en
 * lugar de inventar una que no existe.
 */
const FRAGMENTOS = {
  vecinal: ['vecinal', 'reclamo'],
  prov: ['proveedor', 'contrataci'],
  rrhh: ['recursos humanos', 'personal'],
  presup: ['presupuest', 'financ'],
  admin: ['administrativ', 'expediente'],
  inter: ['articulaci', 'entre áreas', 'entre areas', 'coordinaci'],
  tecnico: ['técnic', 'tecnic', 'proyecto'],
  operativo: ['operativ'],
};

/** Señales de que el tema no puede esperar, para proponer criticidad alta. */
const URGENCIA =
  /\burgente|\bgrave|\briesgo|\bpeligro|\bcr[ií]tic|\bparaliz|\bfrenad|\bparad[oa]\b|\bno\s+se\s+puede|\breclamo[s]?\b|\bdenuncia/i;

function categoriaPropuesta(descripcion, categorias) {
  const disponibles = categorias.map((c) => (typeof c === 'string' ? c : c.valor ?? c.titulo ?? ''));
  for (const { clave, patron } of REGLAS) {
    if (!patron.test(descripcion)) continue;
    const encontrada = disponibles.find((nombre) =>
      FRAGMENTOS[clave].some((f) => nombre.toLowerCase().includes(f)),
    );
    if (encontrada) return encontrada;
  }
  return '';
}

/**
 * Criticidad propuesta a partir de la clase de la oración.
 *
 * Una traba es lo que hay que mirar —alta si además suena urgente—, un
 * compromiso queda en media porque todavía no falló nada, y un avance en baja:
 * informar algo que salió bien no requiere atención de coordinación.
 */
function criticidadPropuesta({ clase, descripcion }) {
  if (clase === 'problema') return URGENCIA.test(descripcion) ? 'alta' : 'media';
  if (clase === 'compromiso') return 'media';
  return 'baja';
}

/**
 * Convierte un texto libre en temas de monitoreo propuestos.
 *
 * @param {string} texto lo que se pegó en el campo de transferencia
 * @param {{hoy?: string, categorias?: ({valor: string}|string)[]}} opciones
 *        `categorias` es el catálogo vigente; sin él los temas salen sin categoría.
 * @returns {{descripcion: string, categoria: string, criticidad: string,
 *            requiere_accion: boolean, responsable: string, fecha_limite: string,
 *            id_proyecto: string, clase: string}[]}
 */
export function separarTemas(texto, { hoy, categorias = [] } = {}) {
  return clasificarMinuta(texto, hoy).map((oracion) => ({
    descripcion: oracion.descripcion,
    categoria: categoriaPropuesta(oracion.descripcion, categorias),
    criticidad: criticidadPropuesta(oracion),
    // Sólo un compromiso arrastra acción: marcar todo como accionable llenaría
    // la lista general de compromisos con avances ya cumplidos.
    requiere_accion: oracion.clase === 'compromiso',
    responsable: oracion.clase === 'compromiso' ? oracion.responsable : '',
    fecha_limite: oracion.clase === 'compromiso' ? oracion.fecha_limite : '',
    id_proyecto: '',
    /** Por qué quedó así: la pantalla lo muestra para que la propuesta sea revisable. */
    clase: oracion.clase,
  }));
}
