/**
 * Control del período del módulo de monitoreo.
 *
 * La traducción de la opción a fechas vive en `rangoPeriodo.js` —es lógica pura
 * y se prueba sin montar nada—; acá queda sólo el control. Este archivo no lo
 * importa `Monitoreo.jsx` por gusto: lo usan también las hojas de secretaría, y
 * tenerlo suelto evita que un módulo tenga que importar al otro.
 */
import { CampoFecha } from '../../componentes/Campo.jsx';
import { fecha as fFecha } from '../../utilidades/formato.js';
import { OPCIONES_PERIODO } from './rangoPeriodo.js';

export { OPCIONES_PERIODO, resolverPeriodo } from './rangoPeriodo.js';

export function SelectorPeriodo({ filtros, setFiltros, rango, hoy }) {
  const personalizado = filtros.periodo === 'personalizado';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {OPCIONES_PERIODO.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => setFiltros({ periodo: o.valor })}
            className={`rounded-chip border px-2.5 py-1.5 text-xs font-medium transition ${
              (filtros.periodo ?? '') === o.valor
                ? 'border-acento bg-acento-suave text-acento-fuerte'
                : 'border-borde-fuerte bg-card text-gris hover:bg-paper'
            }`}
          >
            {o.titulo}
          </button>
        ))}
      </div>

      {personalizado ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoFecha etiqueta="Desde" value={filtros.desde} onChange={(e) => setFiltros({ desde: e.target.value })} />
          <CampoFecha etiqueta="Hasta" value={filtros.hasta} onChange={(e) => setFiltros({ hasta: e.target.value })} />
        </div>
      ) : (
        // El recorte vigente se dice con todas las letras: un filtro por defecto
        // que no se ve es un filtro que engaña.
        <p className="text-[11px] text-tenue">
          {rango.desde
            ? `Se contabiliza desde el ${fFecha(rango.desde)} hasta hoy (${fFecha(hoy)}).`
            : 'Se contabiliza todo lo cargado, sin recorte temporal.'}
        </p>
      )}
    </div>
  );
}
