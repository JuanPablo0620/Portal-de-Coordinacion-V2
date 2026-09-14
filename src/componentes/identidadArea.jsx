/**
 * Color, sigla y nombre corto de cada secretaría, para las vistas donde lo
 * que se está mirando es «de quién es esto».
 *
 * El color identifica al área, no el estado del registro. La sigla siempre
 * queda escrita al lado: así la pantalla sigue siendo legible impresa, en
 * escala de grises y para personas que no distinguen todos los colores.
 *
 * Vive acá y no dentro de un módulo porque lo usan el calendario de eventos y
 * el de seguimiento: tenerlo duplicado hacía que Ambiente pudiera terminar
 * siendo azul en una pantalla y verde en la otra.
 */
import { Chip } from './Basicos.jsx';

const IDENTIDAD_POR_PREFIJO = {
  AMB: { tono: 'area-amb', nombreCorto: 'Ambiente' },
  CAH: { tono: 'area-cah', nombreCorto: 'Capital Humano' },
  OBR: { tono: 'area-obr', nombreCorto: 'Obras' },
  SAL: { tono: 'area-sal', nombreCorto: 'Salud' },
  SEG: { tono: 'area-seg', nombreCorto: 'Seguridad' },
  TYP: { tono: 'area-typ', nombreCorto: 'Trabajo y Producción' },
  COR: { tono: 'area-cor', nombreCorto: 'Coordinación' },
  SGR: { tono: 'area-sgr', nombreCorto: 'Secretaría General' },
  SIN: { tono: 'neutro', nombreCorto: 'Sin asignar' },
};

const VARIABLES_POR_TONO = {
  'area-amb': ['--color-area-amb-suave', '--color-area-amb-texto', '--color-area-amb'],
  'area-cah': ['--color-area-cah-suave', '--color-area-cah-texto', '--color-area-cah'],
  'area-obr': ['--color-area-obr-suave', '--color-area-obr-texto', '--color-area-obr'],
  'area-sal': ['--color-area-sal-suave', '--color-area-sal-texto', '--color-area-sal'],
  'area-seg': ['--color-area-seg-suave', '--color-area-seg-texto', '--color-area-seg'],
  'area-typ': ['--color-area-typ-suave', '--color-area-typ-texto', '--color-area-typ'],
  'area-cor': ['--color-area-cor-suave', '--color-area-cor-texto', '--color-area-cor'],
  'area-sgr': ['--color-area-sgr-suave', '--color-area-sgr-texto', '--color-area-sgr'],
  neutro: ['--color-sindato-suave', '--color-sindato-texto', '--color-sindato'],
};

/**
 * @param nombreArea  el nombre tal como lo guarda el registro
 * @param opciones    las del catálogo `areas`, que son las que traen `prefijo`
 */
export function identidadArea(nombreArea, opciones = []) {
  const nombre = String(nombreArea ?? '').trim();
  const opcion = opciones.find((item) => item.valor === nombre || item.nombre === nombre);
  let sigla = opcion?.prefijo;
  if (!sigla && nombre === 'Secretaría General') sigla = 'SGR';
  if (!sigla && !nombre) sigla = 'SIN';
  const base = IDENTIDAD_POR_PREFIJO[sigla] ?? IDENTIDAD_POR_PREFIJO.SIN;
  const variables = VARIABLES_POR_TONO[base.tono];
  return {
    ...base,
    sigla: sigla && IDENTIDAD_POR_PREFIJO[sigla] ? (sigla === 'SIN' ? '—' : sigla) : '—',
    nombreArea: nombre || 'Sin área asignada',
    fondo: `var(${variables[0]})`,
    color: `var(${variables[1]})`,
    borde: `var(${variables[2]})`,
  };
}

/**
 * La franja de referencia que acompaña a un calendario coloreado por área.
 *
 * `soloConDatos` deja afuera las secretarías que no tienen nada en el mes: en
 * Seguimiento son casi siempre una o dos de las ocho, y una leyenda de ocho
 * colores para dos que se usan explica menos de lo que ocupa.
 */
export function LeyendaAreas({ opciones, areasPresentes, etiqueta = 'Color por área' }) {
  const conDatos = areasPresentes
    ? opciones.filter((opcion) => areasPresentes.has(opcion.valor))
    : opciones;
  const identidades = conDatos.map((opcion) => identidadArea(opcion.valor, opciones));
  if (areasPresentes?.has('')) identidades.push(identidadArea('', opciones));
  if (!areasPresentes) identidades.push(identidadArea('', opciones));
  if (identidades.length === 0) return null;

  return (
    <div
      className="no-imprimir scroll-fino flex items-center gap-2 overflow-x-auto rounded-card border border-borde bg-card px-3 py-2"
      aria-label={etiqueta}
    >
      <span className="sticky left-0 z-10 shrink-0 bg-card pr-1 text-[11px] font-semibold text-gris">{etiqueta}</span>
      {identidades.map((identidad) => (
        <Chip key={identidad.sigla} tono={identidad.tono} className="shrink-0" title={identidad.nombreArea}>
          {identidad.sigla} · {identidad.nombreCorto}
        </Chip>
      ))}
    </div>
  );
}
