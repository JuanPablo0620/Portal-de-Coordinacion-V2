/**
 * Columnas de la tabla de compromisos.
 *
 * Están acá y no dentro de una pantalla porque las muestran tres: la ficha del
 * proyecto, la hoja de la secretaría y el propio módulo de Seguimiento. Una sola
 * definición garantiza que el semáforo y el rótulo de vencimiento digan lo mismo
 * en los tres lados.
 */
import { Semaforo, nivelPorDias } from '../../componentes/Basicos.jsx';
import { fecha as fFecha } from '../../utilidades/formato.js';

/**
 * Mismo criterio en todos lados que lo usan: el nivel de un compromiso
 * cumplido siempre es "en regla"; el resto depende de cuánto falta (o hace)
 * hasta la fecha límite. Se exporta porque `Seguimiento.jsx` arma su propia
 * columna "Compromiso" (con el link a "origen: X") en vez de reusar la de
 * acá, pero necesita el mismo punto de color al lado del nombre.
 */
export function nivelDe(f) {
  return f.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(f.dias_restantes);
}

export const COLUMNAS_COMPROMISO = [
  {
    clave: 'descripcion',
    titulo: 'Compromiso',
    render: (f) => (
      <div className="flex min-w-40 items-start gap-2">
        <span className="mt-1.5">
          <Semaforo nivel={nivelDe(f)} soloPunto texto={f.estado_efectivo} />
        </span>
        <div>
          <p className="leading-tight text-tinta">{f.descripcion}</p>
          <p className="text-[11px] text-tenue">Origen: {f.origen_tipo}</p>
        </div>
      </div>
    ),
  },
  { clave: 'responsable', titulo: 'Responsable', ancho: 130 },
  { clave: 'area', titulo: 'Área', ancho: 170 },
  {
    clave: 'fecha_limite',
    titulo: 'Vence',
    ancho: 100,
    render: (f) => <span className="tabular text-xs">{fFecha(f.fecha_limite)}</span>,
    formatoCSV: fFecha,
  },
  {
    clave: 'estado_efectivo',
    titulo: 'Estado',
    ancho: 130,
    render: (f) => (
      <Semaforo
        nivel={nivelDe(f)}
        sinPunto
        texto={f.estado_efectivo === 'vencido' ? `vencido · ${f.dias_atraso} d` : f.estado_efectivo}
      />
    ),
  },
];
