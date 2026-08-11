/**
 * Calendario mensual con capas de color conmutables.
 *
 * No conoce el dominio: recibe items ya unificados por `itemsCalendario()`
 * (`{ fecha, capa, titulo, detalle, ruta }`) y los pinta. Eso permite usar el
 * mismo componente en el dashboard, en seguimiento y en eventos.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { CAPAS_CALENDARIO } from '../datos/selectores.js';
import { nombreMes } from '../utilidades/formato.js';
import { Boton } from './Basicos.jsx';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Rango ISO [primero, ultimo] del mes, para pedir los items. */
function rangoDelMes(anio, mes) {
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const dosDigitos = (n) => String(n).padStart(2, '0');
  return [`${anio}-${dosDigitos(mes + 1)}-01`, `${anio}-${dosDigitos(mes + 1)}-${dosDigitos(ultimoDia)}`];
}

export function useMesVisible(hoy) {
  const inicial = new Date(`${hoy}T00:00:00Z`);
  const [anio, setAnio] = useState(inicial.getUTCFullYear());
  const [mes, setMes] = useState(inicial.getUTCMonth());

  const mover = (delta) => {
    const d = new Date(Date.UTC(anio, mes + delta, 1));
    setAnio(d.getUTCFullYear());
    setMes(d.getUTCMonth());
  };
  const volverAHoy = () => {
    setAnio(inicial.getUTCFullYear());
    setMes(inicial.getUTCMonth());
  };

  /**
   * El rango se memoriza porque es dependencia de los `useMemo` que arman los
   * items del calendario: devolver un arreglo nuevo en cada render hacía que
   * esos memos no sirvieran para nada y el recorrido de la base entera se
   * repitiera con cada tecla que se tocara en la pantalla.
   */
  const rango = useMemo(() => rangoDelMes(anio, mes), [anio, mes]);

  return { anio, mes, mover, volverAHoy, rango };
}

export function Calendario({ anio, mes, items = [], hoy, capas, alCambiarCapas, alMover, alVolverAHoy, compacto = false }) {
  const navegar = useNavigate();

  const celdas = useMemo(() => {
    const primero = new Date(Date.UTC(anio, mes, 1));
    // La semana arranca el lunes: getUTCDay() da 0 para domingo.
    const offset = (primero.getUTCDay() + 6) % 7;
    const diasEnMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
    const total = Math.ceil((offset + diasEnMes) / 7) * 7;

    const porFecha = new Map();
    for (const item of items) {
      if (!porFecha.has(item.fecha)) porFecha.set(item.fecha, []);
      porFecha.get(item.fecha).push(item);
    }

    return Array.from({ length: total }, (_, i) => {
      const numero = i - offset + 1;
      if (numero < 1 || numero > diasEnMes) return { vacia: true, clave: `v${i}` };
      const iso = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(numero).padStart(2, '0')}`;
      return { clave: iso, numero, iso, items: porFecha.get(iso) ?? [], esHoy: iso === hoy };
    });
  }, [anio, mes, items, hoy]);

  const colorDeCapa = (capa) => CAPAS_CALENDARIO.find((c) => c.clave === capa)?.color ?? 'var(--color-sindato)';

  return (
    <div className="flex flex-col gap-3">
      <div className="no-imprimir flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Boton tamanio="sm" variante="fantasma" onClick={() => alMover(-1)} aria-label="Mes anterior">
            <ChevronLeft size={16} />
          </Boton>
          <span className="min-w-36 text-center text-sm font-semibold text-tinta">{nombreMes(anio, mes)}</span>
          <Boton tamanio="sm" variante="fantasma" onClick={() => alMover(1)} aria-label="Mes siguiente">
            <ChevronRight size={16} />
          </Boton>
          <Boton tamanio="sm" variante="fantasma" icono={CalendarDays} onClick={alVolverAHoy}>
            Hoy
          </Boton>
        </div>

        {capas && (
          <div className="flex flex-wrap items-center gap-1">
            {CAPAS_CALENDARIO.map((capa) => {
              const encendida = capas[capa.clave] !== false;
              return (
                <button
                  key={capa.clave}
                  type="button"
                  onClick={() => alCambiarCapas({ ...capas, [capa.clave]: !encendida })}
                  className={`flex items-center gap-1.5 rounded-chip border px-2 py-1 text-[11px] font-medium transition ${
                    encendida ? 'border-borde-fuerte bg-card text-tinta' : 'border-borde bg-paper text-tenue'
                  }`}
                  title={encendida ? 'Ocultar capa' : 'Mostrar capa'}
                >
                  <span
                    className="h-2 w-2 rounded-full transition"
                    style={{ background: encendida ? capa.color : 'var(--color-sindato)' }}
                  />
                  {capa.titulo}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-borde">
        <div className="grid grid-cols-7 border-b border-borde bg-paper">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gris">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {celdas.map((celda) =>
            celda.vacia ? (
              <div key={celda.clave} className="min-h-16 border-b border-r border-borde/60 bg-paper/40 last:border-r-0" />
            ) : (
              <div
                key={celda.clave}
                className={`${compacto ? 'min-h-16' : 'min-h-24'} border-b border-r border-borde/60 p-1 last:border-r-0 ${
                  celda.esHoy ? 'bg-acento-suave/60' : 'bg-card'
                }`}
              >
                <div className="mb-0.5 flex items-center justify-between px-0.5">
                  <span
                    className={`tabular text-[11px] ${
                      celda.esHoy ? 'font-semibold text-acento-fuerte' : 'text-tenue'
                    }`}
                  >
                    {celda.numero}
                  </span>
                  {celda.items.length > (compacto ? 2 : 3) && (
                    <span className="tabular text-[10px] text-tenue">{celda.items.length}</span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  {celda.items.slice(0, compacto ? 2 : 3).map((item, i) => (
                    <button
                      key={`${item.capa}-${i}`}
                      type="button"
                      onClick={() => item.ruta && navegar(item.ruta)}
                      title={`${item.titulo}${item.detalle ? ` · ${item.detalle}` : ''}`}
                      className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] leading-tight
                        text-tinta transition hover:bg-paper"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: colorDeCapa(item.capa) }}
                      />
                      <span className="truncate">{item.titulo}</span>
                    </button>
                  ))}
                  {celda.items.length > (compacto ? 2 : 3) && (
                    <span className="px-1 text-[10px] text-tenue">
                      +{celda.items.length - (compacto ? 2 : 3)} más
                    </span>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
