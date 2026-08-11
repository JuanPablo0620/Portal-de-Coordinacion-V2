/**
 * Historial de un proyecto.
 *
 * El historial SE COMPONE de monitoreo y seguimiento: son las dos capas que
 * cuentan qué pasó con el proyecto en la realidad. Los compromisos y los
 * cambios de ficha se suman como contexto —de dónde salió cada obligación, qué
 * campo se tocó y cuándo— y se pueden apagar. Antes esto vivía en cuatro
 * pestañas distintas y había que cruzarlas a ojo para reconstruir la secuencia.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, History } from 'lucide-react';
import { Boton, Chip, Semaforo, Tarjeta, Vacio } from '../../componentes/Basicos.jsx';
import { GraficoLineas } from '../../componentes/Graficos.jsx';
import { descargarCSV } from '../../datos/csv.js';
import { formatoValor } from '../../datos/bitacora.js';
import {
  CAPAS_HISTORIAL,
  historialUnificado,
  hoyISO,
  planificacionDe,
  serieAvance,
} from '../../datos/selectores.js';
import { fecha as fFecha, fechaHora, haceCuanto, nombreMes, numero } from '../../utilidades/formato.js';

const TODAS = Object.fromEntries(CAPAS_HISTORIAL.map((c) => [c.clave, true]));

const TITULO_CAPA = Object.fromEntries(CAPAS_HISTORIAL.map((c) => [c.clave, c.titulo]));
const COLOR_CAPA = Object.fromEntries(CAPAS_HISTORIAL.map((c) => [c.clave, c.color]));

/**
 * `historial` puede venir ya calculado desde la ficha, que lo necesita para el
 * contador de la pestaña. Recalcularlo acá era pagar el selector dos veces por
 * cada render de la ficha.
 */
export function HistorialProyecto({ bd, proyecto, historial }) {
  const hoy = hoyISO();
  const [capas, setCapas] = useState(TODAS);

  // El historial completo alimenta los contadores de cada capa; el filtrado, la
  // línea de tiempo. Calcular sólo el filtrado dejaría los contadores en cero
  // justo de las capas apagadas, que es cuando hacen falta para volver a prenderlas.
  const completo = useMemo(
    () => historial ?? (bd ? historialUnificado(bd, proyecto.id_proyecto, TODAS, hoy) : []),
    [historial, bd, proyecto.id_proyecto, hoy],
  );
  const items = useMemo(() => completo.filter((i) => capas[i.capa] !== false), [completo, capas]);

  const conteo = useMemo(() => {
    const c = Object.fromEntries(CAPAS_HISTORIAL.map((x) => [x.clave, 0]));
    for (const i of completo) c[i.capa] += 1;
    return c;
  }, [completo]);

  /** Agrupado por mes: sin cortes, cuarenta líneas seguidas se leen como una sola masa. */
  const meses = useMemo(() => {
    const grupos = new Map();
    for (const i of items) {
      const mes = String(i.fecha).slice(0, 7);
      if (!grupos.has(mes)) grupos.set(mes, []);
      grupos.get(mes).push(i);
    }
    return [...grupos.entries()];
  }, [items]);

  /**
   * Avance real contra las metas trimestrales del plan. Es lo que permite ver
   * en qué mes el proyecto se despegó y bajar en la línea de tiempo a leer qué
   * pasó ahí; sin plan cargado no se dibuja nada inventado.
   */
  const curva = useMemo(() => {
    if (!bd) return [];
    const serie = serieAvance(bd, proyecto.id_proyecto);
    if (serie.length < 2) return [];
    const plan = planificacionDe(bd, proyecto.id_proyecto, Number(hoy.slice(0, 4)));
    const metas = plan?.metas_trimestrales ?? [];
    return serie.map((punto) => {
      const trimestre = Math.floor((Number(punto.fecha.slice(5, 7)) - 1) / 3);
      return {
        fecha: fFecha(punto.fecha),
        avance: punto.avance,
        meta: metas.length ? Number(metas[trimestre]) || 0 : undefined,
      };
    });
  }, [bd, proyecto.id_proyecto, hoy]);

  function exportar() {
    descargarCSV(`historial-${proyecto.id_proyecto}`, items, [
      { clave: 'fecha', titulo: 'Fecha', formatoCSV: fFecha },
      { clave: 'capa', titulo: 'Capa', formatoCSV: (v) => TITULO_CAPA[v] ?? v },
      { clave: 'titulo', titulo: 'Detalle' },
      { clave: 'detalle', titulo: 'Observación' },
      { clave: 'extra', titulo: 'Área y responsable' },
      { clave: 'estado', titulo: 'Estado' },
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo="Historial del proyecto"
        descripcion="Monitoreo y seguimiento en una sola línea de tiempo, con los compromisos y los cambios de ficha como contexto."
        acciones={
          <Boton tamanio="sm" icono={Download} onClick={exportar} disabled={!items.length}>
            Exportar CSV
          </Boton>
        }
      >
        <div className="flex flex-wrap gap-2">
          {CAPAS_HISTORIAL.map((c) => {
            const activa = capas[c.clave] !== false;
            return (
              <button
                key={c.clave}
                type="button"
                onClick={() => setCapas((p) => ({ ...p, [c.clave]: !activa }))}
                aria-pressed={activa}
                className={`flex items-center gap-1.5 rounded-chip border px-2.5 py-1.5 text-xs font-medium transition ${
                  activa ? 'border-borde-fuerte bg-card text-tinta' : 'border-borde bg-paper text-tenue'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: activa ? c.color : 'var(--color-sindato)' }}
                />
                {c.titulo}
                <span className="tabular rounded-full bg-sindato-suave px-1.5 text-[11px] text-gris">
                  {conteo[c.clave]}
                </span>
              </button>
            );
          })}
        </div>
      </Tarjeta>

      {curva.length > 0 && (
        <Tarjeta
          titulo="Avance real contra la meta trimestral"
          descripcion="Leída de la bitácora. Donde la línea se despega de la meta, bajá a ese mes de la línea de tiempo."
        >
          <GraficoLineas
            datos={curva}
            alto={200}
            formato={numero}
            series={[
              { clave: 'avance', titulo: 'Avance real' },
              ...(curva.some((c) => c.meta !== undefined) ? [{ clave: 'meta', titulo: 'Meta del trimestre' }] : []),
            ]}
          />
        </Tarjeta>
      )}

      {items.length === 0 ? (
        <Tarjeta>
          <Vacio
            icono={History}
            titulo={completo.length ? 'Todas las capas están apagadas' : 'Sin movimientos registrados'}
            descripcion={
              completo.length
                ? 'Prendé al menos una capa para ver la línea de tiempo.'
                : 'El historial se arma solo: cada monitoreo con un tema de este proyecto y cada seguimiento que lo incluya aparecen acá.'
            }
          />
        </Tarjeta>
      ) : (
        <Tarjeta sinPadding>
          <div className="flex flex-col">
            {meses.map(([mes, delMes]) => (
              <section key={mes}>
                <h3 className="border-b border-borde bg-paper px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gris">
                  {/* Mes y año completos, no «feb 27»: en mayúsculas y sobre una
                      lista de fechas, la forma corta se lee como «27 de febrero».
                      Un compromiso sin fecha límite es válido en el esquema, así
                      que se agrupa aparte en vez de encabezar el mes con un guión. */}
                  {mes ? nombreMes(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1) : 'Sin fecha'}
                  <span className="tabular ml-2 font-normal text-tenue">{delMes.length}</span>
                </h3>
                <ol className="flex flex-col px-4">
                  {delMes.map((i) => (
                    <Asiento key={i.clave} item={i} hoy={hoy} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}

function Asiento({ item, hoy }) {
  const cuerpo = (
    <>
      <div className="w-20 shrink-0 pt-0.5 text-right">
        <p className="tabular text-xs text-tinta">{fFecha(item.fecha)}</p>
        {/* «hace cuánto» sólo para lo ya ocurrido: sobre una fecha futura —un
            compromiso o un hito por vencer— leerlo sería contradictorio. */}
        {item.momento && item.fecha <= hoy && <p className="text-[10px] text-tenue">{haceCuanto(item.momento)}</p>}
      </div>
      <span
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: COLOR_CAPA[item.capa] }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tono="neutro">{TITULO_CAPA[item.capa]}</Chip>
          {item.estado && <Semaforo nivel={item.nivel} texto={item.estado} />}
        </div>
        <p className="mt-1 text-sm leading-tight text-tinta">{item.titulo}</p>
        {item.detalle && <p className="text-[11px] text-tenue">{item.detalle}</p>}
        {item.extra && <p className="text-[11px] text-tenue">{item.extra}</p>}
        {(item.cambios ?? []).length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5">
            {item.cambios.map((c, i) => (
              <li key={i} className="text-xs text-gris">
                <span className="font-medium text-tinta">{c.campo}</span>:{' '}
                <span className="text-tenue line-through">{formatoValor(c.antes)}</span> →{' '}
                <span className="text-tinta">{formatoValor(c.despues)}</span>
              </li>
            ))}
          </ul>
        )}
        {item.capa === 'cambio' && item.momento && (
          <p className="mt-0.5 text-[11px] text-tenue">{fechaHora(item.momento)}</p>
        )}
      </div>
    </>
  );

  if (!item.ruta) {
    return <li className="flex gap-3 border-b border-borde/60 py-2.5 last:border-0">{cuerpo}</li>;
  }
  return (
    <li className="border-b border-borde/60 last:border-0">
      <Link to={item.ruta} className="-mx-2 flex gap-3 rounded-chip px-2 py-2.5 transition hover:bg-paper">
        {cuerpo}
      </Link>
    </li>
  );
}
