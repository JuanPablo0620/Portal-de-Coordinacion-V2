/**
 * Selector de Objetivos de Desarrollo Sostenible.
 *
 * Diecisiete opciones son demasiadas para un select y muy pocas para un
 * buscador: se dibujan los diecisiete números como interruptores. El nombre
 * completo va en el `title` y en el nombre accesible, así el que sabe de
 * memoria que el 11 es ciudades lo aprieta directo y el que no, lo lee.
 */
import { ODS } from '../../datos/catalogos.js';

/** Etiqueta corta de un ODS, para chips y leyendas de gráfico. */
export function nombreODS(numero) {
  return ODS.find((o) => o.numero === Number(numero))?.nombre ?? `ODS ${numero}`;
}

export function SelectorODS({ valor = [], alCambiar, etiqueta = 'ODS a los que contribuye' }) {
  const alternar = (numero) =>
    alCambiar(valor.includes(numero) ? valor.filter((n) => n !== numero) : [...valor, numero]);

  return (
    <fieldset className="rounded-chip border border-borde p-3">
      <legend className="px-1 text-xs font-semibold text-gris">{etiqueta}</legend>
      <div className="flex flex-wrap gap-1.5">
        {ODS.map((o) => {
          const activo = valor.includes(o.numero);
          return (
            <button
              key={o.numero}
              type="button"
              onClick={() => alternar(o.numero)}
              title={`ODS ${o.numero} · ${o.nombre}`}
              aria-pressed={activo}
              aria-label={`ODS ${o.numero}: ${o.nombre}`}
              className={`tabular grid h-8 w-8 place-items-center rounded-chip border text-xs font-semibold transition ${
                activo
                  ? 'border-acento bg-acento text-white'
                  : 'border-borde-fuerte bg-card text-gris hover:bg-paper'
              }`}
            >
              {o.numero}
            </button>
          );
        })}
      </div>
      {valor.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-0.5">
          {[...valor]
            .sort((a, b) => a - b)
            .map((n) => (
              <li key={n} className="text-[11px] text-tenue">
                <span className="tabular font-medium text-gris">ODS {n}</span> · {nombreODS(n)}
              </li>
            ))}
        </ul>
      )}
    </fieldset>
  );
}
