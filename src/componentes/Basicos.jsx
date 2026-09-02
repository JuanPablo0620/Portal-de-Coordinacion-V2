/**
 * Primitivos visuales del sistema. Todos toman su color de los tokens del
 * bloque @theme: ningún hex hardcodeado.
 */
import { useId } from 'react';
import { AlertCircle, Info, Search } from 'lucide-react';
import { nivelPorDias } from '../datos/selectores.js';

// La escala de días vive en la capa de datos —la comparten las alertas y los
// tableros—; se reexporta acá porque es de donde la importan los módulos.
export { nivelPorDias };

/* ── Tarjeta ────────────────────────────────────────────────────────── */

export function Tarjeta({ titulo, descripcion, acciones, children, className = '', sinPadding = false, style }) {
  return (
    <section className={`tarjeta bloque-reporte flex flex-col ${className}`} style={style}>
      {(titulo || acciones) && (
        <header className="flex items-start justify-between gap-3 border-b border-borde px-4 py-3">
          <div className="min-w-0">
            {titulo && <h2 className="text-sm font-semibold text-tinta">{titulo}</h2>}
            {descripcion && <p className="mt-0.5 text-xs text-gris">{descripcion}</p>}
          </div>
          {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
        </header>
      )}
      <div className={sinPadding ? 'flex-1' : 'flex-1 p-4'}>{children}</div>
    </section>
  );
}

/* ── Botón ──────────────────────────────────────────────────────────── */

const VARIANTES_BOTON = {
  primario: 'bg-acento text-white hover:bg-acento-fuerte border-acento',
  secundario: 'bg-card text-tinta hover:bg-paper border-borde-fuerte',
  fantasma: 'bg-transparent text-gris hover:bg-paper hover:text-tinta border-transparent',
  peligro: 'bg-vencido text-white hover:brightness-95 border-vencido',
};

const TAMANIOS_BOTON = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
};

export function Boton({
  variante = 'secundario',
  tamanio = 'md',
  icono: Icono,
  children,
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-chip border font-medium transition
        disabled:cursor-not-allowed disabled:opacity-50
        ${VARIANTES_BOTON[variante]} ${TAMANIOS_BOTON[tamanio]} ${className}`}
      {...props}
    >
      {Icono && <Icono size={tamanio === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

/* ── Botón alternable y conmutador ──────────────────────────────────── */

/**
 * Interruptor de un filtro booleano, con forma de chip.
 *
 * Estaba escrito a mano —las mismas ocho clases de Tailwind— en la base
 * maestra, en los compromisos, en el selector de período y en el tablero de
 * secretarías: cuatro copias que ya habían empezado a diferir en el `disabled`
 * y en el estado activo. Acá también entra el `aria-pressed`, que ninguna de
 * las copias tenía: sin él, un lector de pantalla anuncia «Sólo obras, botón»
 * sin decir nunca si está aplicado.
 */
export function BotonAlternable({ activo = false, children, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      className={`rounded-chip border px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed
        disabled:opacity-40 ${
          activo
            ? 'border-acento bg-acento-suave text-acento-fuerte'
            : 'border-borde-fuerte bg-card text-gris hover:bg-paper'
        } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Conmutador segmentado: una opción entre pocas, todas visibles. */
export function Conmutador({ opciones, valor, alCambiar, etiqueta, className = '' }) {
  return (
    <div role="group" aria-label={etiqueta} className={`flex rounded-chip border border-borde-fuerte ${className}`}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => alCambiar(o.valor)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition
              first:rounded-l-chip last:rounded-r-chip ${
                activo ? 'bg-acento-suave text-acento-fuerte' : 'text-gris hover:bg-paper'
              }`}
          >
            {o.icono && <o.icono size={13} />}
            {o.titulo}
          </button>
        );
      })}
    </div>
  );
}

/* ── Buscador ───────────────────────────────────────────────────────── */

/**
 * Campo de búsqueda del sistema. Es el mismo que ya vivía dentro de la tabla:
 * se extrajo para que un buscador de tarjetas —el de secretarías, el de obras—
 * se vea y se comporte igual que el de un listado, en lugar de ser un
 * `<CampoTexto>` con otra altura y sin ícono.
 */
export function Buscador({ valor, alCambiar, placeholder = 'Buscar…', etiqueta, className = '' }) {
  const id = useId();
  return (
    <div className={`relative min-w-40 ${className}`}>
      {etiqueta && (
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-gris">
          {etiqueta}
        </label>
      )}
      <Search
        size={14}
        className={`pointer-events-none absolute left-2.5 text-tenue ${
          etiqueta ? 'bottom-2.5' : 'top-1/2 -translate-y-1/2'
        }`}
      />
      <input
        id={id}
        type="search"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder={placeholder}
        aria-label={etiqueta ? undefined : placeholder}
        className="campo-base py-1.5 pl-8 text-xs"
      />
    </div>
  );
}

/* ── Chip ───────────────────────────────────────────────────────────── */

const TONOS_CHIP = {
  neutro: 'bg-sindato-suave text-gris border-borde',
  acento: 'bg-acento-suave text-acento-fuerte border-acento-medio',
  vencido: 'bg-vencido-suave text-vencido-texto border-vencido/30',
  proximo: 'bg-proximo-suave text-proximo-texto border-proximo/30',
  atencion: 'bg-atencion-suave text-atencion-texto border-atencion/40',
  enregla: 'bg-enregla-suave text-enregla-texto border-enregla/30',
  'area-amb': 'bg-area-amb-suave text-area-amb-texto border-area-amb/30',
  'area-cah': 'bg-area-cah-suave text-area-cah-texto border-area-cah/30',
  'area-obr': 'bg-area-obr-suave text-area-obr-texto border-area-obr/30',
  'area-sal': 'bg-area-sal-suave text-area-sal-texto border-area-sal/30',
  'area-seg': 'bg-area-seg-suave text-area-seg-texto border-area-seg/30',
  'area-typ': 'bg-area-typ-suave text-area-typ-texto border-area-typ/30',
  'area-cor': 'bg-area-cor-suave text-area-cor-texto border-area-cor/30',
};

/**
 * De qué prefijo de `id_proyecto` (AMB-2026-018 → AMB) a qué tono de `Chip`.
 * Las siete secretarías reales tienen su color fijo; cualquier prefijo que no
 * esté acá (por ejemplo, alguna de las catorce áreas ficticias de la base
 * completa) cae en un tono acento genérico — no vale la pena mantener un
 * color propio por cada área de prueba.
 */
const TONO_POR_PREFIJO = {
  AMB: 'area-amb',
  CAH: 'area-cah',
  OBR: 'area-obr',
  SAL: 'area-sal',
  SEG: 'area-seg',
  TYP: 'area-typ',
  COR: 'area-cor',
};

/** Tono de `Chip` para un `id_proyecto` tipo «AMB-2026-018», por su prefijo. */
export function tonoPorIdProyecto(idProyecto) {
  const prefijo = String(idProyecto ?? '').split('-')[0];
  return TONO_POR_PREFIJO[prefijo] ?? 'acento';
}

export function Chip({ tono = 'neutro', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-chip border px-1.5 py-0.5
        text-[11px] font-medium leading-tight ${TONOS_CHIP[tono] ?? TONOS_CHIP.neutro} ${className}`}
    >
      {children}
    </span>
  );
}

/* ── Semáforo ───────────────────────────────────────────────────────── */

/**
 * Escala diferencial de cuatro niveles, distinguibles de un vistazo.
 * Los niveles claros llevan texto oscuro, nunca blanco: es lo que sostiene el
 * contraste cuando se imprime o se proyecta.
 */
const NIVELES = {
  /* `color` pinta el punto —un objeto gráfico, le alcanza con 3:1— y el texto
     del semáforo va en tinta sobre el fondo suave, que da 15:1. Por eso acá va
     el relleno y no la variante `-texto`. */
  vencido: { color: 'var(--color-vencido)', fondo: 'var(--color-vencido-suave)', texto: 'Vencido' },
  proximo: { color: 'var(--color-proximo)', fondo: 'var(--color-proximo-suave)', texto: 'Próximo' },
  atencion: { color: 'var(--color-atencion)', fondo: 'var(--color-atencion-suave)', texto: 'Atención' },
  enregla: { color: 'var(--color-enregla)', fondo: 'var(--color-enregla-suave)', texto: 'En regla' },
  sindato: { color: 'var(--color-sindato)', fondo: 'var(--color-sindato-suave)', texto: 'Sin dato' },
};

/**
 * `sinPunto` saca el puntito de color de adentro del pill, para cuando ya va
 * en otro lado de la fila (ver Mis Áreas: el punto se muda al nombre del
 * compromiso y el pill de Estado queda solo con el fondo tintado y el texto).
 */
export function Semaforo({ nivel = 'sindato', texto, soloPunto = false, sinPunto = false }) {
  const cfg = NIVELES[nivel] ?? NIVELES.sindato;
  if (soloPunto) {
    return (
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: cfg.color }}
        title={texto ?? cfg.texto}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip px-1.5 py-0.5 text-[11px] font-medium leading-tight"
      style={{ background: cfg.fondo, color: 'var(--color-tinta)' }}
    >
      {!sinPunto && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cfg.color }} />}
      {texto ?? cfg.texto}
    </span>
  );
}

/* ── Estados de proyecto y criticidades ─────────────────────────────── */

const NIVEL_POR_ESTADO = {
  planificado: 'sindato',
  'en ejecución': 'enregla',
  demorado: 'proximo',
  finalizado: 'acento',
  suspendido: 'vencido',
};

export function EstadoProyecto({ estado }) {
  const nivel = NIVEL_POR_ESTADO[estado];
  if (nivel === 'acento') return <Chip tono="acento">Finalizado</Chip>;
  return <Semaforo nivel={nivel ?? 'sindato'} texto={estado} />;
}

const TONO_CRITICIDAD = { alta: 'vencido', media: 'proximo', baja: 'enregla' };

export function Criticidad({ nivel }) {
  if (!nivel) return <span className="text-tenue">—</span>;
  return <Chip tono={TONO_CRITICIDAD[nivel] ?? 'neutro'}>{nivel}</Chip>;
}

const TONO_PRIORIDAD = { alta: 'vencido', media: 'atencion', baja: 'neutro' };

export function Prioridad({ nivel }) {
  if (!nivel) return <span className="text-tenue">—</span>;
  return <Chip tono={TONO_PRIORIDAD[nivel] ?? 'neutro'}>{nivel}</Chip>;
}

/* ── Barra de avance ────────────────────────────────────────────────── */

export function BarraAvance({ valor = 0, mostrarValor = true, compacta = false }) {
  const v = Math.max(0, Math.min(100, Math.round(Number(valor) || 0)));
  const color =
    v >= 100 ? 'var(--color-enregla)' : v >= 50 ? 'var(--color-acento)' : v > 0 ? 'var(--color-proximo)' : 'var(--color-sindato)';
  return (
    <div className="flex items-center gap-2">
      <div className={`${compacta ? 'h-1.5 w-16' : 'h-2 w-full min-w-16'} overflow-hidden rounded-full bg-sindato-suave`}>
        <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color }} />
      </div>
      {mostrarValor && <span className="tabular w-9 shrink-0 text-right text-xs text-gris">{v}%</span>}
    </div>
  );
}

/* ── Estado vacío ───────────────────────────────────────────────────── */

/**
 * Toda vista sin datos pasa por acá. Nunca una pantalla en blanco: siempre un
 * mensaje claro y el atajo de carga que corresponde.
 */
export function Vacio({ icono: Icono = Info, titulo, descripcion, accion, compacto = false }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compacto ? 'gap-1.5 py-6' : 'gap-2 py-12'}`}>
      <div className="rounded-full bg-sindato-suave p-2.5 text-tenue">
        <Icono size={compacto ? 18 : 22} />
      </div>
      <p className="text-sm font-medium text-tinta">{titulo}</p>
      {descripcion && <p className="max-w-sm text-xs leading-relaxed text-gris">{descripcion}</p>}
      {accion && (
        <Boton variante="primario" tamanio="sm" className="mt-1.5 no-imprimir" onClick={accion.alHacerClic} icono={accion.icono}>
          {accion.texto}
        </Boton>
      )}
    </div>
  );
}

/* ── Aviso ──────────────────────────────────────────────────────────── */

const TONOS_AVISO = {
  info: { fondo: 'var(--color-acento-suave)', borde: 'var(--color-acento-medio)', icono: Info },
  alerta: { fondo: 'var(--color-proximo-suave)', borde: 'var(--color-proximo)', icono: AlertCircle },
  error: { fondo: 'var(--color-vencido-suave)', borde: 'var(--color-vencido)', icono: AlertCircle },
};

export function Aviso({ tono = 'info', titulo, children }) {
  const cfg = TONOS_AVISO[tono] ?? TONOS_AVISO.info;
  const Icono = cfg.icono;
  return (
    <div
      className="flex items-start gap-2.5 rounded-chip border px-3 py-2.5 text-xs leading-relaxed text-tinta"
      style={{ background: cfg.fondo, borderColor: cfg.borde }}
    >
      <Icono size={15} className="mt-px shrink-0" />
      <div className="min-w-0">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children}
      </div>
    </div>
  );
}

/* ── Métrica ────────────────────────────────────────────────────────── */

export function Metrica({ etiqueta, valor, detalle, icono: Icono, alHacerClic, tono = 'neutro' }) {
  const interactiva = Boolean(alHacerClic);
  const Elemento = interactiva ? 'button' : 'div';
  return (
    <Elemento
      type={interactiva ? 'button' : undefined}
      onClick={alHacerClic}
      className={`tarjeta flex items-center gap-3 px-4 py-3 text-left ${
        interactiva ? 'cursor-pointer transition hover:border-acento-medio hover:shadow-flotante' : ''
      }`}
    >
      {Icono && (
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-chip"
          style={{
            background: tono === 'vencido' ? 'var(--color-vencido-suave)' : 'var(--color-acento-suave)',
            color: tono === 'vencido' ? 'var(--color-vencido)' : 'var(--color-acento)',
          }}
        >
          <Icono size={18} />
        </span>
      )}
      <div className="min-w-0">
        <p className="tabular text-xl font-semibold leading-none text-tinta">{valor}</p>
        <p className="mt-1 truncate text-xs text-gris">{etiqueta}</p>
        {detalle && <p className="mt-0.5 truncate text-[11px] text-tenue">{detalle}</p>}
      </div>
    </Elemento>
  );
}

/* ── Pestañas ───────────────────────────────────────────────────────── */

export function Pestanias({ opciones, valor, alCambiar, className = '' }) {
  return (
    <div className={`no-imprimir flex flex-wrap items-center gap-1 border-b border-borde ${className}`}>
      {opciones.map((o) => {
        const activa = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => alCambiar(o.valor)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
              activa ? 'text-tinta' : 'border-transparent text-gris hover:text-tinta'
            }`}
            style={activa ? { borderColor: o.color ?? 'var(--color-acento)' } : undefined}
          >
            {o.icono && <o.icono size={15} />}
            {o.titulo}
            {o.cantidad !== undefined && (
              <span className="tabular rounded-full bg-sindato-suave px-1.5 text-[11px] text-gris">{o.cantidad}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
