/**
 * Panel de alertas.
 *
 * Se alimenta EXCLUSIVAMENTE de `calcularAlertas`. No recalcula vencimientos ni
 * criticidades: si hiciera su propia cuenta, el mismo compromiso podría figurar
 * con distinto atraso acá y en el inicio.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Chip, Tarjeta, Vacio } from '../../componentes/Basicos.jsx';
import { ETIQUETAS_ALERTA, ORDEN_TIPOS, alertasPorTipo, calcularAlertas } from '../../datos/alertas.js';
import { hoyISO } from '../../datos/selectores.js';
import { fecha as fFecha } from '../../utilidades/formato.js';
import { useBD } from '../../estado/tienda.js';

const COLOR_SEVERIDAD = {
  critica: 'var(--color-vencido)',
  alta: 'var(--color-proximo)',
  media: 'var(--color-atencion)',
};

const TONO_SEVERIDAD = { critica: 'vencido', alta: 'proximo', media: 'atencion' };

export function PanelAlertas({ compacto = false, limitePorGrupo = 6 }) {
  const bd = useBD();
  const hoy = hoyISO();

  const alertas = useMemo(() => (bd ? calcularAlertas(bd, hoy) : []), [bd, hoy]);
  const grupos = useMemo(() => alertasPorTipo(alertas), [alertas]);
  const criticas = alertas.filter((a) => a.severidad === 'critica').length;

  if (alertas.length === 0) {
    return (
      <Tarjeta titulo="Panel de alertas">
        <Vacio
          icono={ShieldCheck}
          titulo="Sin alertas activas"
          descripcion="No hay compromisos vencidos ni por vencer, proyectos atrasados, temas críticos sin resolver ni eventos con requerimientos incompletos."
        />
      </Tarjeta>
    );
  }

  return (
    <section
      className="tarjeta bloque-reporte overflow-hidden"
      style={{ borderColor: criticas ? 'var(--color-vencido)' : 'var(--color-proximo)' }}
    >
      <header
        className="flex flex-wrap items-center gap-2 border-b px-4 py-3"
        style={{
          background: criticas ? 'var(--color-vencido-suave)' : 'var(--color-proximo-suave)',
          borderColor: criticas ? 'var(--color-vencido)' : 'var(--color-proximo)',
        }}
      >
        <AlertTriangle size={17} style={{ color: criticas ? 'var(--color-vencido)' : 'var(--color-proximo)' }} />
        <h2 className="text-sm font-semibold text-tinta">Panel de alertas</h2>
        <span className="text-xs text-gris">
          {alertas.length} alerta{alertas.length === 1 ? '' : 's'} activa{alertas.length === 1 ? '' : 's'}
        </span>
        {criticas > 0 && <Chip tono="vencido">{criticas} crítica{criticas === 1 ? '' : 's'}</Chip>}
      </header>

      <div className={`grid grid-cols-1 gap-px bg-borde ${compacto ? '' : 'lg:grid-cols-2'}`}>
        {ORDEN_TIPOS.filter((tipo) => grupos[tipo]?.length).map((tipo) => (
          <div key={tipo} className="bg-card p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: COLOR_SEVERIDAD[grupos[tipo][0].severidad] }}
              />
              <h3 className="text-xs font-semibold text-tinta">{ETIQUETAS_ALERTA[tipo]}</h3>
              <Chip tono={TONO_SEVERIDAD[grupos[tipo][0].severidad]}>{grupos[tipo].length}</Chip>
            </div>
            <ul className="flex flex-col">
              {grupos[tipo].slice(0, limitePorGrupo).map((a) => (
                <li key={a.id}>
                  <Link
                    to={a.ruta_origen}
                    className="flex items-start gap-2 rounded-chip border-b border-borde/60 px-1 py-1.5 transition last:border-0 hover:bg-paper"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs leading-snug text-tinta">{a.titulo}</p>
                      <p className="truncate text-[11px] text-tenue">
                        {[a.area, a.responsable, a.id_proyecto].filter(Boolean).join(' · ') || a.detalle}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {a.dias_atraso > 0 ? (
                        <span className="tabular text-[11px] font-medium" style={{ color: 'var(--color-vencido)' }}>
                          +{a.dias_atraso} d
                        </span>
                      ) : a.dias_restantes !== undefined ? (
                        <span className="tabular text-[11px] text-gris">{a.dias_restantes} d</span>
                      ) : null}
                      {a.fecha && <p className="tabular text-[10px] text-tenue">{fFecha(a.fecha)}</p>}
                    </div>
                  </Link>
                </li>
              ))}
              {grupos[tipo].length > limitePorGrupo && (
                <li className="pt-1 text-[11px] text-tenue">+{grupos[tipo].length - limitePorGrupo} más</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
