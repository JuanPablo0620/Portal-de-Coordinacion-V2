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

export const COLUMNAS_COMPROMISO = [
  {
    clave: 'descripcion',
    titulo: 'Compromiso',
    render: (f) => (
      <div className="min-w-40">
        <p className="leading-tight text-tinta">{f.descripcion}</p>
        <p className="text-[11px] text-tenue">Origen: {f.origen_tipo}</p>
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
        nivel={f.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(f.dias_restantes)}
        texto={f.estado_efectivo === 'alerta' ? `alerta · ${f.dias_atraso} d` : f.estado_efectivo}
      />
    ),
  },
];
