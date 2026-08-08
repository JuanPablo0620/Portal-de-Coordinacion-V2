/**
 * Campos de formulario.
 *
 * Regla del sistema: nada de texto libre donde puede haber selección. Todo
 * campo de catálogo usa `<CampoSelect>` con `opciones` traídas del catálogo
 * administrable; el texto libre queda para descripciones y minutas.
 */
import { useId } from 'react';

function Etiqueta({ id, children, requerido, ayuda }) {
  if (!children) return null;
  return (
    <label htmlFor={id} className="mb-1 block text-xs font-medium text-gris">
      {children}
      {requerido && <span className="ml-0.5 text-vencido">*</span>}
      {ayuda && <span className="ml-1.5 font-normal text-tenue">{ayuda}</span>}
    </label>
  );
}

function Error({ children }) {
  if (!children) return null;
  return <p className="mt-1 text-[11px] text-vencido">{children}</p>;
}

export function Campo({ etiqueta, requerido, ayuda, error, children, className = '' }) {
  return (
    <div className={className}>
      <Etiqueta requerido={requerido} ayuda={ayuda}>
        {etiqueta}
      </Etiqueta>
      {children}
      <Error>{error}</Error>
    </div>
  );
}

export function CampoTexto({ etiqueta, requerido, ayuda, error, className = '', ...props }) {
  const id = useId();
  return (
    <div className={className}>
      <Etiqueta id={id} requerido={requerido} ayuda={ayuda}>
        {etiqueta}
      </Etiqueta>
      <input id={id} type="text" className="campo-base" {...props} />
      <Error>{error}</Error>
    </div>
  );
}

export function CampoNumero({ etiqueta, requerido, ayuda, error, className = '', ...props }) {
  const id = useId();
  return (
    <div className={className}>
      <Etiqueta id={id} requerido={requerido} ayuda={ayuda}>
        {etiqueta}
      </Etiqueta>
      <input id={id} type="number" className="campo-base tabular" {...props} />
      <Error>{error}</Error>
    </div>
  );
}

export function CampoFecha({ etiqueta, requerido, ayuda, error, className = '', ...props }) {
  const id = useId();
  return (
    <div className={className}>
      <Etiqueta id={id} requerido={requerido} ayuda={ayuda}>
        {etiqueta}
      </Etiqueta>
      <input id={id} type="date" className="campo-base" {...props} />
      <Error>{error}</Error>
    </div>
  );
}

export function CampoHora({ etiqueta, requerido, ayuda, error, className = '', ...props }) {
  const id = useId();
  return (
    <div className={className}>
      <Etiqueta id={id} requerido={requerido} ayuda={ayuda}>
        {etiqueta}
      </Etiqueta>
      <input id={id} type="time" className="campo-base" {...props} />
      <Error>{error}</Error>
    </div>
  );
}

export function CampoArea({ etiqueta, requerido, ayuda, error, filas = 4, className = '', ...props }) {
  const id = useId();
  return (
    <div className={className}>
      <Etiqueta id={id} requerido={requerido} ayuda={ayuda}>
        {etiqueta}
      </Etiqueta>
      <textarea id={id} rows={filas} className="campo-base resize-y leading-relaxed" {...props} />
      <Error>{error}</Error>
    </div>
  );
}

/**
 * Selector sobre catálogo cerrado. `opciones` acepta strings o
 * `{ valor, titulo }`; los catálogos administrables se pasan ya mapeados.
 */
export function CampoSelect({
  etiqueta,
  requerido,
  ayuda,
  error,
  opciones = [],
  placeholder = 'Seleccionar…',
  className = '',
  ...props
}) {
  const id = useId();
  const normalizadas = opciones.map((o) => (typeof o === 'string' ? { valor: o, titulo: o } : o));
  return (
    <div className={className}>
      <Etiqueta id={id} requerido={requerido} ayuda={ayuda}>
        {etiqueta}
      </Etiqueta>
      <select id={id} className="campo-base" {...props}>
        <option value="">{placeholder}</option>
        {normalizadas.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.titulo}
          </option>
        ))}
      </select>
      <Error>{error}</Error>
    </div>
  );
}

export function CampoCheck({ etiqueta, descripcion, className = '', ...props }) {
  const id = useId();
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-acento)]"
        {...props}
      />
      <label htmlFor={id} className="cursor-pointer select-none text-sm leading-tight text-tinta">
        {etiqueta}
        {descripcion && <span className="mt-0.5 block text-xs text-gris">{descripcion}</span>}
      </label>
    </div>
  );
}

/** Grupo de radios en línea, para escalas cortas como la criticidad. */
export function CampoRadios({ etiqueta, requerido, opciones = [], valor, alCambiar, className = '' }) {
  const nombre = useId();
  return (
    <div className={className}>
      <Etiqueta requerido={requerido}>{etiqueta}</Etiqueta>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((o) => {
          const op = typeof o === 'string' ? { valor: o, titulo: o } : o;
          const activo = valor === op.valor;
          return (
            <label
              key={op.valor}
              className={`cursor-pointer rounded-chip border px-2.5 py-1.5 text-xs font-medium capitalize transition ${
                activo ? 'border-acento bg-acento-suave text-acento-fuerte' : 'border-borde-fuerte bg-card text-gris hover:bg-paper'
              }`}
            >
              <input
                type="radio"
                name={nombre}
                className="sr-only"
                checked={activo}
                onChange={() => alCambiar(op.valor)}
              />
              {op.titulo}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Fila de acciones al pie de un formulario. */
export function PieFormulario({ children }) {
  return <div className="mt-5 flex items-center justify-end gap-2 border-t border-borde pt-4">{children}</div>;
}

/** Grilla responsive de campos. En tablet colapsa a una columna. */
export function GrillaCampos({ columnas = 2, children, className = '' }) {
  const clases = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' };
  return <div className={`grid grid-cols-1 gap-3 ${clases[columnas]} ${className}`}>{children}</div>;
}
