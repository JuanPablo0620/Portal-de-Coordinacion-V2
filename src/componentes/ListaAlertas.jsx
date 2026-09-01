/**
 * Lista compacta de alertas, enlazada a su registro de origen.
 *
 * La usan la hoja de cada secretaría y el historial por área. Estaba copiada en
 * las dos, incluido el mapeo de severidad a color: con una sola definición, un
 * cambio en la escala de severidades no puede dejar una vista discrepando.
 */
import { Link } from 'react-router-dom';
import { Chip, Semaforo } from './Basicos.jsx';
import { nivelPorSeveridad } from '../datos/alertas.js';

export function ListaAlertas({ alertas, limite = 10 }) {
  if (!alertas.length) return null;
  return (
    <ul className="divide-y divide-borde/60">
      {alertas.slice(0, limite).map((a) => {
        const nivel = nivelPorSeveridad(a.severidad);
        // Vencida: mismo rótulo "vencido · N d" que ya usa la tabla de
        // compromisos, en vez del punto solo — acá es lo único que se
        // muestra, conviene que quede tan claro como ahí.
        const vencida = nivel === 'vencido';
        return (
          <li key={a.id}>
            <Link to={a.ruta_origen} className="flex items-start gap-2.5 px-4 py-2.5 transition hover:bg-paper">
              {vencida ? (
                <Semaforo nivel="vencido" texto={`vencido · ${a.dias_atraso} d`} />
              ) : (
                <Semaforo nivel={nivel} soloPunto texto={a.severidad} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm leading-tight text-tinta">{a.titulo}</p>
                <p className="truncate text-[11px] text-tenue">{a.detalle}</p>
              </div>
              {!vencida && a.dias_atraso > 0 && <Chip tono="vencido">{a.dias_atraso} d</Chip>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
