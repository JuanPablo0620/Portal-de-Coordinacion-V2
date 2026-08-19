/**
 * Hoja de monitoreo desagregada por secretaría.
 *
 * Dos niveles, no uno: la grilla de tarjetas responde «¿dónde hay que meterse?»
 * de un vistazo, y la hoja de una secretaría responde «¿qué pasa acá adentro?».
 * El conteo agregado del sistema —una sola cifra para todo el municipio— era
 * justamente lo que impedía ver que el problema estaba en un área concreta.
 *
 * La hoja está pensada para llegar impresa a la reunión con el secretario: por
 * eso cierra los pendientes en línea (marcar un tema resuelto, un compromiso
 * cumplido) en lugar de mandar a otra pantalla a hacerlo después.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarPlus,
  Check,
  ClipboardList,
  FileText,
  History,
  ListChecks,
  Plus,
  Printer,
  Radar,
  Target,
} from 'lucide-react';
import {
  BarraAvance,
  Boton,
  Buscador,
  Chip,
  Criticidad,
  EstadoProyecto,
  Metrica,
  Semaforo,
  Tarjeta,
  Vacio,
  nivelPorDias,
} from '../../componentes/Basicos.jsx';
import { Alternadores, TarjetaFiltros, limpiarClaves } from '../../componentes/Filtros.jsx';
import { ListaAlertas } from '../../componentes/ListaAlertas.jsx';
import { Modal } from '../../componentes/Modal.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { CampoFecha } from '../../componentes/Campo.jsx';
import { SelectorPeriodo } from './periodo.jsx';
import { CLAVES_FILTRO, DEFAULTS } from './filtros.js';
import { GraficoBarras, GraficoTorta } from '../../componentes/Graficos.jsx';
import { COLUMNAS_COMPROMISO } from '../seguimiento/columnasCompromiso.jsx';
import { filtrarAlertas, UMBRALES } from '../../datos/alertas.js';
import {
  activos,
  compromisos as selCompromisos,
  desvioTrimestral,
  diasHasta,
  eventos as selEventos,
  hoyISO,
  monitoreos as selMonitoreos,
  nivelCumplimiento,
  proyectos as selProyectos,
  resumenSecretaria,
  resumenSecretarias,
  seguimientos as selSeguimientos,
  temasDeArea,
  trimestreDe,
} from '../../datos/selectores.js';
import { fecha as fFecha, fechaLarga, moneda, numero, sufijoArchivo } from '../../utilidades/formato.js';
import { useItems } from '../../utilidades/catalogos.js';
import { acciones } from '../../estado/tienda.js';

/** Rótulo del semáforo de cada tarjeta, para que el color no viaje solo. */
const TEXTO_NIVEL = {
  vencido: 'compromisos vencidos',
  proximo: 'temas críticos abiertos',
  atencion: 'requiere atención',
  enregla: 'al día',
  sindato: 'sin monitorear',
};

/** El color de la criticidad ES la información: no se deja al orden de la serie. */
const COLOR_CRITICIDAD = {
  alta: 'var(--color-vencido)',
  media: 'var(--color-proximo)',
  baja: 'var(--color-enregla)',
};

export function TableroSecretarias({ bd, filtros, setFiltros, alertas = [], rango }) {
  const hoy = hoyISO();
  const areas = useItems('areas');
  // El período lo resuelve el módulo y baja ya traducido a fechas: las tres
  // pestañas tienen que estar contando la misma ventana.
  const periodo = rango ?? { desde: '', hasta: '' };

  if (filtros.secretaria) {
    return (
      <HojaSecretaria
        bd={bd}
        area={filtros.secretaria}
        periodo={periodo}
        alertas={alertas}
        hoy={hoy}
        prefijo={areas.find((a) => a.nombre === filtros.secretaria)?.prefijo}
        alVolver={() => setFiltros({ secretaria: '' })}
      />
    );
  }

  return (
    <Grilla
      bd={bd}
      periodo={periodo}
      filtros={filtros}
      setFiltros={setFiltros}
      alertas={alertas}
      areas={areas}
      hoy={hoy}
    />
  );
}

/* ── Grilla de tarjetas ─────────────────────────────────────────────── */

function Grilla({ bd, periodo, filtros, setFiltros, alertas, areas, hoy }) {
  const resumenes = useMemo(
    () => (bd ? resumenSecretarias(bd, periodo, hoy) : []),
    [bd, periodo, hoy],
  );

  const porArea = useMemo(() => {
    const cuenta = new Map();
    for (const a of alertas) if (a.area) cuenta.set(a.area, (cuenta.get(a.area) ?? 0) + 1);
    return cuenta;
  }, [alertas]);

  const texto = (filtros.buscar ?? '').trim().toLowerCase();
  const visibles = resumenes
    .filter((r) => !texto || r.area.toLowerCase().includes(texto))
    .filter((r) => (filtros.solo_deuda ? r.compromisos.vencidos > 0 : true))
    .filter((r) => (filtros.sin_cobertura ? r.monitoreos === 0 : true));

  // Las cifras describen el universo completo aunque la grilla esté filtrada:
  // «3 sin cobertura» tiene que seguir diciendo lo mismo con el filtro puesto.
  const sinCobertura = resumenes.filter((r) => r.monitoreos === 0).length;
  const conDeuda = resumenes.filter((r) => r.compromisos.vencidos > 0).length;
  const totalMonitoreos = resumenes.reduce((s, r) => s + r.monitoreos, 0);

  return (
    <div className="flex flex-col gap-4">
      <TarjetaFiltros
        filtros={filtros}
        defaults={DEFAULTS}
        claves={CLAVES_FILTRO}
        alLimpiar={() => limpiarClaves(setFiltros, DEFAULTS, CLAVES_FILTRO)}
        descripcion="El período acota lo que se contabiliza. Los compromisos y proyectos se muestran siempre vigentes: recortarlos por fecha escondería lo que hay que ver."
      >
        <div className="sm:max-w-xs">
          <Buscador
            etiqueta="Buscar secretaría"
            valor={filtros.buscar}
            alCambiar={(v) => setFiltros({ buscar: v })}
            placeholder="Nombre del área"
          />
        </div>
        <SelectorPeriodo filtros={filtros} setFiltros={setFiltros} rango={periodo} hoy={hoy} />
        <Alternadores
          filtros={filtros}
          setFiltros={setFiltros}
          opciones={[
            ['solo_deuda', 'Sólo con compromisos vencidos'],
            ['sin_cobertura', 'Sólo sin cobertura'],
          ]}
        >
          <span className="tabular ml-1 text-xs text-tenue">
            {visibles.length} de {resumenes.length} secretarías
          </span>
        </Alternadores>
        {periodo.desde && (
          <p className="text-[11px] text-tenue">
            Con un período definido, cada tarjeta compara contra la ventana anterior del mismo largo.
          </p>
        )}
      </TarjetaFiltros>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica valor={resumenes.length} etiqueta="Secretarías en la hoja" icono={Building2} />
        <Metrica valor={totalMonitoreos} etiqueta="Monitoreos en el período" icono={ListChecks} />
        <Metrica
          valor={sinCobertura}
          etiqueta="Sin cobertura en el período"
          tono={sinCobertura ? 'vencido' : 'neutro'}
          icono={Radar}
          detalle={sinCobertura ? 'ningún monitoreo registrado' : 'todas cubiertas'}
        />
        <Metrica
          valor={conDeuda}
          etiqueta="Con compromisos vencidos"
          tono={conDeuda ? 'vencido' : 'neutro'}
          icono={AlertTriangle}
        />
      </div>

      {visibles.length === 0 ? (
        <Tarjeta>
          <Vacio
            icono={Building2}
            titulo={
              resumenes.length ? 'Ninguna secretaría coincide con los filtros' : 'Sin secretarías cargadas'
            }
            descripcion={
              resumenes.length
                ? 'Probá con otro término o quitá los filtros aplicados.'
                : 'Cargá las áreas desde Configuración para que la hoja de monitoreo se desagregue por secretaría.'
            }
          />
        </Tarjeta>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((r) => (
            <TarjetaSecretaria
              key={r.area}
              resumen={r}
              prefijo={areas.find((a) => a.nombre === r.area)?.prefijo}
              alertas={porArea.get(r.area) ?? 0}
              alAbrir={() => setFiltros({ secretaria: r.area })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaSecretaria({ resumen, prefijo, alertas, alAbrir }) {
  const { temas, compromisos, proyectos, comparativo } = resumen;
  const maximo = Math.max(1, ...resumen.serie.map((s) => s.monitoreos));

  return (
    <section
      className="tarjeta bloque-reporte flex cursor-pointer flex-col transition hover:border-acento/60 hover:shadow-md"
      role="button"
      tabIndex={0}
      onClick={alAbrir}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          alAbrir();
        }
      }}
      aria-label={`Abrir la hoja de ${resumen.area}`}
    >
      <header className="flex items-start gap-2.5 border-b border-borde px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {prefijo && <Chip tono="acento">{prefijo}</Chip>}
            <Semaforo nivel={resumen.nivel} texto={TEXTO_NIVEL[resumen.nivel]} />
            {alertas > 0 && (
              <Chip tono="vencido">
                {alertas} alerta{alertas === 1 ? '' : 's'}
              </Chip>
            )}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold leading-tight text-tinta">{resumen.area}</h3>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="grid grid-cols-4 gap-2">
          <Dato valor={resumen.monitoreos} etiqueta="monitoreos" delta={comparativo?.delta_monitoreos} />
          <Dato valor={temas.sin_resolver} etiqueta="temas abiertos" tono={temas.sin_resolver ? 'proximo' : 'neutro'} />
          <Dato
            valor={compromisos.vencidos}
            etiqueta="vencidos"
            tono={compromisos.vencidos ? 'vencido' : 'neutro'}
          />
          <Dato valor={proyectos.activos} etiqueta="proy. activos" />
        </div>

        <MiniSerie serie={resumen.serie} maximo={maximo} area={resumen.area} />

        <BarraCriticidad temas={temas} />

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">
            Avance agregado de sus proyectos
          </p>
          <BarraAvance valor={proyectos.porcentaje_avance} />
        </div>

        {(temas.acciones_pendientes > 0 || resumen.proximo_seguimiento) && (
          <div className="flex flex-wrap gap-1">
            {temas.acciones_pendientes > 0 && (
              <Chip tono="proximo">
                {temas.acciones_pendientes} acción{temas.acciones_pendientes === 1 ? '' : 'es'} comprometida
                {temas.acciones_pendientes === 1 ? '' : 's'}
              </Chip>
            )}
            {resumen.proximo_seguimiento && (
              <Chip tono="acento">seguimiento el {fFecha(resumen.proximo_seguimiento.fecha)}</Chip>
            )}
          </div>
        )}

        {resumen.categorias.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {resumen.categorias.slice(0, 3).map((c) => (
              <Chip key={c.nombre} tono="neutro">
                {c.nombre} · {c.cantidad}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-borde px-4 py-2.5">
        <p className="min-w-0 truncate text-[11px] text-tenue">
          {resumen.ultimo_monitoreo
            ? `Último monitoreo: ${fFecha(resumen.ultimo_monitoreo)} · hace ${resumen.dias_sin_monitoreo} d`
            : 'Nunca monitoreada'}
        </p>
        {/* Indicador visual, no interactivo: toda la tarjeta ya es el control clickeable. */}
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-acento">
          Abrir hoja
          <ArrowRight size={14} />
        </span>
      </footer>
    </section>
  );
}

function Dato({ valor, etiqueta, tono = 'neutro', delta }) {
  const color =
    tono === 'vencido' ? 'text-vencido-texto' : tono === 'proximo' ? 'text-proximo-texto' : 'text-tinta';
  return (
    <div>
      <p className={`tabular text-lg font-semibold leading-none ${color}`}>{valor}</p>
      <p className="mt-1 text-[10px] leading-tight text-tenue">{etiqueta}</p>
      {delta !== undefined && delta !== null && delta !== 0 && (
        <p
          className={`tabular text-[10px] leading-tight ${delta > 0 ? 'text-enregla-texto' : 'text-vencido-texto'}`}
          title="Variación contra el período anterior del mismo largo"
        >
          {delta > 0 ? '+' : ''}
          {delta} vs. anterior
        </p>
      )}
    </div>
  );
}

/**
 * Mini-serie mensual en barras planas. No usa Recharts a propósito: hay una por
 * tarjeta y montar N gráficos SVG para seis barras cuesta más de lo que aporta.
 * Cuenta el histórico del área, no la ventana: un mes en cero significa «no se
 * monitoreó», nunca «el filtro lo dejó afuera».
 */
function MiniSerie({ serie, maximo, area }) {
  const resumenTexto = serie.map((s) => `${s.etiqueta}: ${s.monitoreos}`).join(', ');
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">
        Monitoreos por mes
      </p>
      <div
        className="flex items-end gap-1"
        style={{ height: 44 }}
        role="img"
        aria-label={`Monitoreos por mes de ${area} — ${resumenTexto}`}
      >
        {serie.map((s) => (
          <div
            key={s.mes}
            className="flex flex-1 flex-col items-center gap-1"
            title={`${s.etiqueta}: ${s.monitoreos} monitoreo(s), ${s.temas} tema(s)`}
          >
            <div
              className="w-full rounded-t-sm"
              style={{
                height: `${Math.max(2, (s.monitoreos / maximo) * 32)}px`,
                background: s.monitoreos ? 'var(--color-acento)' : 'var(--color-sindato-suave)',
              }}
            />
            <span className="text-[9px] leading-none text-tenue">{s.etiqueta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Distribución de criticidad como una sola barra apilada. */
function BarraCriticidad({ temas }) {
  const total = temas.total;
  const tramos = ['alta', 'media', 'baja'].map((clave) => ({
    clave,
    cantidad: temas[clave],
    color: COLOR_CRITICIDAD[clave],
  }));

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-tenue">Criticidad de los temas</p>
        <span className="tabular text-[11px] text-tenue">{total}</span>
      </div>
      {total === 0 ? (
        <div className="h-2 rounded-full bg-sindato-suave" title="Sin temas en el período" />
      ) : (
        <>
          <div className="flex h-2 overflow-hidden rounded-full">
            {tramos
              .filter((t) => t.cantidad > 0)
              .map((t) => (
                <div
                  key={t.clave}
                  style={{ width: `${(t.cantidad / total) * 100}%`, background: t.color }}
                  title={`${t.cantidad} de criticidad ${t.clave}`}
                />
              ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5">
            {tramos
              .filter((t) => t.cantidad > 0)
              .map((t) => (
                <span key={t.clave} className="flex items-center gap-1 text-[10px] text-tenue">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
                  {t.clave} {t.cantidad}
                </span>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Hoja de una secretaría ─────────────────────────────────────────── */

function HojaSecretaria({ bd, area, periodo, alertas, hoy, prefijo, alVolver }) {
  const navegar = useNavigate();
  const [cerrando, setCerrando] = useState(null);

  const resumen = useMemo(
    () => (bd ? resumenSecretaria(bd, area, periodo, hoy) : null),
    [bd, area, periodo, hoy],
  );
  const temas = useMemo(() => (bd ? temasDeArea(bd, area, periodo) : []), [bd, area, periodo]);
  const monitoreos = useMemo(
    () => (bd ? selMonitoreos(bd, { area, ...periodo }) : []),
    [bd, area, periodo],
  );
  const compromisos = useMemo(() => (bd ? selCompromisos(bd, { area }, hoy) : []), [bd, area, hoy]);
  const proyectos = useMemo(() => (bd ? selProyectos(bd, { area }) : []), [bd, area]);
  const seguimientos = useMemo(
    () => (bd ? selSeguimientos(bd, { area, ...periodo }) : []),
    [bd, area, periodo],
  );
  const eventos = useMemo(() => (bd ? selEventos(bd, { area }) : []), [bd, area]);
  const alertasArea = useMemo(() => filtrarAlertas(alertas, { area }), [alertas, area]);

  const anio = Number(hoy.slice(0, 4));
  const trimestre = trimestreDe(hoy);
  const desvios = useMemo(
    () => (bd ? desvioTrimestral(bd, anio, trimestre, { area }) : []),
    [bd, anio, trimestre, area],
  );

  /**
   * Requerimientos que ESTA secretaría le debe a eventos de OTRA. Es lo que
   * ninguna vista mostraba: el área que va a hacer caer el evento ajeno.
   */
  const requerimientosDebidos = useMemo(() => {
    if (!bd) return [];
    const porEvento = new Map(activos(bd.eventos).map((e) => [e.id, e]));
    return activos(bd.requerimientos_evento)
      .filter((r) => r.area_responsable === area && r.estado !== 'confirmado' && r.estado !== 'entregado')
      .map((r) => {
        const evento = porEvento.get(r.id_evento);
        return {
          ...r,
          evento: evento?.nombre ?? '—',
          fecha: evento?.fecha ?? null,
          dias: evento ? diasHasta(evento.fecha, hoy) : null,
        };
      })
      .filter((r) => r.dias !== null && r.dias >= 0)
      .sort((a, b) => a.dias - b.dias);
  }, [bd, area, hoy]);

  if (!resumen) return null;

  const sufijo = sufijoArchivo(area);
  const porCriticidad = ['alta', 'media', 'baja']
    .map((nombre) => ({ nombre, cantidad: resumen.temas[nombre] }))
    .filter((c) => c.cantidad > 0);

  const rutaReporte = [
    '/reportes?area=' + encodeURIComponent(area),
    periodo.desde ? `desde=${periodo.desde}` : '',
    periodo.hasta ? `hasta=${periodo.hasta}` : '',
  ]
    .filter(Boolean)
    .join('&');

  return (
    <div className="flex flex-col gap-4">
      {/* Encabezado institucional que sólo sale en papel. */}
      <header className="solo-impresion encabezado-impresion">
        <h1 className="text-base font-semibold">Hoja de monitoreo · {area}</h1>
        <p className="text-xs">
          Municipio de Tres de Febrero · Coordinación · Emitida el {fechaLarga(hoy)}
          {periodo.desde || periodo.hasta
            ? ` · Período ${fFecha(periodo.desde) } a ${fFecha(periodo.hasta || hoy)}`
            : ' · Período completo'}
        </p>
      </header>

      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {prefijo && <Chip tono="acento">{prefijo}</Chip>}
              <Semaforo nivel={resumen.nivel} texto={TEXTO_NIVEL[resumen.nivel]} />
              {resumen.criticidad_maxima && (
                <span className="flex items-center gap-1 text-[11px] text-tenue">
                  criticidad máxima <Criticidad nivel={resumen.criticidad_maxima} />
                </span>
              )}
            </div>
            <h2 className="mt-1.5 text-base font-semibold text-tinta">{area}</h2>
            <p className="mt-0.5 text-xs text-gris">
              {resumen.ultimo_monitoreo
                ? `Último monitoreo el ${fFecha(resumen.ultimo_monitoreo)}, hace ${resumen.dias_sin_monitoreo} días`
                : 'Sin ningún monitoreo registrado'}
              {resumen.proximo_seguimiento
                ? ` · próximo seguimiento el ${fFecha(resumen.proximo_seguimiento.fecha)}`
                : ' · sin seguimiento agendado'}
            </p>
          </div>
          <div className="no-imprimir flex flex-wrap items-center gap-2">
            <Boton icono={ArrowLeft} onClick={alVolver}>
              Todas las secretarías
            </Boton>
            <Boton icono={Printer} onClick={() => window.print()} title="Se imprime en A4, sin controles ni navegación">
              Imprimir hoja
            </Boton>
            <Boton icono={FileText} onClick={() => navegar(rutaReporte)}>
              Reporte completo
            </Boton>
            <Boton
              icono={History}
              onClick={() => navegar(`/seguimiento?tab=historial&area=${encodeURIComponent(area)}`)}
            >
              Línea de tiempo
            </Boton>
            <Boton
              variante="primario"
              icono={Plus}
              onClick={() => navegar(`/monitoreo?tab=cargar&area=${encodeURIComponent(area)}`)}
            >
              Nuevo monitoreo
            </Boton>
          </div>
        </div>
      </Tarjeta>

      {/* Seis columnas recién a 2xl: más apretadas, las etiquetas se truncan y
          «Compromisos vencidos» queda en «Compromisos ven…». */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <Metrica
          valor={resumen.monitoreos}
          etiqueta="Monitoreos del período"
          icono={ListChecks}
          detalle={
            resumen.comparativo
              ? `${resumen.comparativo.delta_monitoreos >= 0 ? '+' : ''}${resumen.comparativo.delta_monitoreos} vs. período anterior`
              : undefined
          }
        />
        <Metrica valor={resumen.temas.total} etiqueta="Temas registrados" icono={Radar} />
        <Metrica
          valor={resumen.temas.sin_resolver}
          etiqueta="Temas sin resolver"
          tono={resumen.temas.sin_resolver ? 'vencido' : 'neutro'}
          detalle={resumen.temas.alta_sin_resolver ? `${resumen.temas.alta_sin_resolver} de criticidad alta` : undefined}
          icono={AlertTriangle}
        />
        <Metrica valor={resumen.seguimientos} etiqueta="Seguimientos" icono={CalendarCheck} />
        <Metrica
          valor={resumen.compromisos.vencidos}
          etiqueta="Compromisos vencidos"
          tono={resumen.compromisos.vencidos ? 'vencido' : 'neutro'}
          detalle={`${resumen.compromisos.por_vencer} vencen en ≤${UMBRALES.DIAS_POR_VENCER} d`}
          icono={ClipboardList}
        />
        <Metrica
          valor={resumen.proyectos.activos}
          etiqueta="Proyectos activos"
          detalle={`${resumen.proyectos.porcentaje_avance}% de avance agregado`}
          icono={BarChart3}
        />
      </div>

      {!resumen.proximo_seguimiento && (
        <Tarjeta>
          <Vacio
            compacto
            icono={CalendarPlus}
            titulo="Esta secretaría no tiene seguimiento agendado"
            descripcion="Sin próxima reunión, lo que se detecte en el monitoreo no tiene dónde plantearse."
            accion={{
              texto: 'Agendar seguimiento',
              icono: CalendarPlus,
              alHacerClic: () => navegar(`/seguimiento?tab=calendario&area=${encodeURIComponent(area)}`),
            }}
          />
        </Tarjeta>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tarjeta
          titulo="Monitoreos y temas por mes"
          descripcion="Serie histórica del área: un mes en cero significa que no se monitoreó, no que el filtro lo excluyó."
          className="lg:col-span-2"
        >
          <GraficoBarras
            datos={resumen.serie}
            clave="etiqueta"
            alto={220}
            series={[
              { clave: 'monitoreos', titulo: 'Monitoreos' },
              { clave: 'temas', titulo: 'Temas' },
            ]}
          />
        </Tarjeta>

        <Tarjeta titulo="Temas por criticidad">
          <GraficoTorta datos={porCriticidad} alto={220} colorPorItem={(d) => COLOR_CRITICIDAD[d.nombre]} />
        </Tarjeta>
      </div>

      {resumen.categorias.length > 0 && (
        <Tarjeta titulo="Temas por categoría" descripcion="De qué habla esta secretaría cuando se la monitorea.">
          <GraficoBarras
            datos={resumen.categorias}
            horizontal
            anchoEtiqueta={190}
            alto={Math.max(180, resumen.categorias.length * 32)}
          />
        </Tarjeta>
      )}

      {alertasArea.length > 0 && (
        <Tarjeta
          titulo="Alertas activas de la secretaría"
          descripcion="Salen del motor central: son las mismas que ve el inicio, con los mismos días de atraso."
          sinPadding
        >
          <ListaAlertas alertas={alertasArea} />
        </Tarjeta>
      )}

      <PanelPlanificacion
        desvios={desvios}
        presupuesto={resumen.presupuesto}
        anio={anio}
        trimestre={trimestre}
        sufijo={sufijo}
        navegar={navegar}
      />

      <Tarjeta
        titulo="Temas del período"
        descripcion="Los que requieren acción muestran responsable y fecha comprometida; se pueden cerrar acá mismo."
        sinPadding
      >
        <Tabla
          nombreExport={`temas-${sufijo}`}
          filas={temas}
          columnas={[
            { clave: 'fecha', titulo: 'Fecha', ancho: 100, render: (f) => fFecha(f.fecha), formatoCSV: fFecha },
            { clave: 'categoria', titulo: 'Categoría', ancho: 160 },
            { clave: 'descripcion', titulo: 'Tema' },
            {
              clave: 'criticidad',
              titulo: 'Criticidad',
              ancho: 100,
              render: (f) => <Criticidad nivel={f.criticidad} />,
            },
            {
              clave: 'responsable',
              titulo: 'Acción comprometida',
              ancho: 160,
              render: (f) =>
                f.requiere_accion ? (
                  <div>
                    <Chip tono="proximo">{f.responsable || 'sin responsable'}</Chip>
                    {f.fecha_limite && (
                      <p className="mt-0.5">
                        <Semaforo
                          nivel={f.resuelto ? 'enregla' : nivelPorDias(diasHasta(f.fecha_limite, hoy))}
                          texto={fFecha(f.fecha_limite)}
                        />
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-tenue">—</span>
                ),
            },
            {
              clave: 'resuelto',
              titulo: 'Estado',
              ancho: 130,
              render: (f) =>
                f.resuelto ? (
                  <Chip tono="enregla">resuelto</Chip>
                ) : (
                  <Boton
                    tamanio="sm"
                    icono={Check}
                    className="no-imprimir"
                    aria-label={`Marcar como resuelto: ${f.descripcion}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCerrando({ clase: 'tema', registro: f });
                    }}
                  >
                    Resolver
                  </Boton>
                ),
            },
          ]}
          alHacerClicFila={(f) => navegar(`/monitoreo?tab=ultimos&monitoreo=${f.id_monitoreo}`)}
          vacio={
            <Vacio
              compacto
              icono={Radar}
              titulo="Sin temas en el período"
              descripcion="Ajustá el período o cargá un monitoreo para esta secretaría."
            />
          }
        />
      </Tarjeta>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Tarjeta titulo="Monitoreos del período" sinPadding>
          <Tabla
            nombreExport={`monitoreos-${sufijo}`}
            filas={monitoreos}
            conBusqueda={false}
            columnas={[
              { clave: 'fecha', titulo: 'Fecha', ancho: 100, render: (f) => fFecha(f.fecha), formatoCSV: fFecha },
              { clave: 'cantidad_temas', titulo: 'Temas', ancho: 70, alinear: 'derecha' },
              {
                clave: 'criticidad_maxima',
                titulo: 'Criticidad máx.',
                ancho: 120,
                render: (f) => <Criticidad nivel={f.criticidad_maxima} />,
              },
              { clave: 'creado_por', titulo: 'Cargado por' },
            ]}
            alHacerClicFila={(f) => navegar(`/monitoreo?tab=ultimos&monitoreo=${f.id}`)}
            vacio={<Vacio compacto titulo="Sin monitoreos en el período" />}
          />
        </Tarjeta>

        <Tarjeta
          titulo="Compromisos vigentes"
          descripcion="No se recortan por período: son estado, no historia."
          sinPadding
        >
          <Tabla
            nombreExport={`compromisos-${sufijo}`}
            filas={compromisos.map((c) => ({ ...c, _resaltar: c.estado_efectivo === 'vencido' }))}
            conBusqueda={false}
            columnas={[
              ...COLUMNAS_COMPROMISO.filter((c) => c.clave !== 'area'),
              {
                clave: 'cerrar',
                titulo: '',
                ancho: 110,
                sinOrdenar: true,
                sinExportar: true,
                render: (f) =>
                  f.estado_efectivo === 'cumplido' ? (
                    <span className="text-[11px] text-tenue">{fFecha(f.fecha_cumplimiento)}</span>
                  ) : (
                    <Boton
                      tamanio="sm"
                      icono={Check}
                      className="no-imprimir"
                      aria-label={`Marcar como cumplido: ${f.descripcion}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCerrando({ clase: 'compromiso', registro: f });
                      }}
                    >
                      Cumplido
                    </Boton>
                  ),
              },
            ]}
            vacio={<Vacio compacto titulo="Sin compromisos registrados" />}
          />
        </Tarjeta>
      </div>

      <Tarjeta titulo="Proyectos de la secretaría" sinPadding>
        <Tabla
          nombreExport={`proyectos-${sufijo}`}
          filas={proyectos}
          claveFila={(f) => f.id_proyecto}
          columnas={[
            {
              clave: 'id_proyecto',
              titulo: 'ID',
              ancho: 120,
              render: (f) => <Chip tono="acento">{f.id_proyecto}</Chip>,
            },
            { clave: 'proyecto', titulo: 'Proyecto' },
            { clave: 'estado', titulo: 'Estado', ancho: 120, render: (f) => <EstadoProyecto estado={f.estado} /> },
            {
              clave: 'porcentaje_avance',
              titulo: 'Avance',
              ancho: 170,
              render: (f) => (
                <div>
                  <BarraAvance valor={f.porcentaje_avance} />
                  <p className="tabular mt-0.5 text-[11px] text-tenue">
                    {numero(f.avance)} / {numero(f.objetivo)} {f.unidad}
                  </p>
                </div>
              ),
            },
            {
              clave: 'fecha_fin_prevista',
              titulo: 'Fin previsto',
              ancho: 130,
              render: (f) => (
                <Semaforo
                  nivel={f.estado === 'finalizado' ? 'enregla' : nivelPorDias(diasHasta(f.fecha_fin_prevista, hoy))}
                  texto={fFecha(f.fecha_fin_prevista)}
                />
              ),
              formatoCSV: fFecha,
            },
          ]}
          alHacerClicFila={(f) => navegar(`/proyectos/${f.id_proyecto}`)}
          vacio={<Vacio compacto titulo="La secretaría no tiene proyectos cargados" />}
        />
      </Tarjeta>

      {requerimientosDebidos.length > 0 && (
        <Tarjeta
          titulo="Lo que esta secretaría le debe a eventos de otras"
          descripcion="Requerimientos sin confirmar a su cargo. Es la deuda que hace caer el evento ajeno y que no figura en ninguna otra vista."
          sinPadding
        >
          <Tabla
            nombreExport={`requerimientos-debidos-${sufijo}`}
            filas={requerimientosDebidos}
            conBusqueda={false}
            columnas={[
              { clave: 'evento', titulo: 'Evento' },
              { clave: 'item', titulo: 'Requerimiento', ancho: 160 },
              { clave: 'cantidad', titulo: 'Cant.', ancho: 70, alinear: 'derecha' },
              { clave: 'estado', titulo: 'Estado', ancho: 110, render: (f) => <Chip tono="proximo">{f.estado}</Chip> },
              {
                clave: 'fecha',
                titulo: 'Fecha del evento',
                ancho: 150,
                render: (f) => <Semaforo nivel={nivelPorDias(f.dias)} texto={fFecha(f.fecha)} />,
                formatoCSV: fFecha,
              },
            ]}
            alHacerClicFila={(f) => navegar(`/eventos?tab=checklist&evento=${f.id_evento}`)}
          />
        </Tarjeta>
      )}

      {eventos.length > 0 && (
        <Tarjeta titulo="Eventos que organiza la secretaría" sinPadding>
          <Tabla
            nombreExport={`eventos-${sufijo}`}
            filas={eventos}
            conBusqueda={false}
            columnas={[
              { clave: 'fecha', titulo: 'Fecha', ancho: 100, render: (f) => fFecha(f.fecha), formatoCSV: fFecha },
              { clave: 'nombre', titulo: 'Evento' },
              { clave: 'estado', titulo: 'Estado', ancho: 110, render: (f) => <Chip tono="neutro">{f.estado}</Chip> },
              {
                clave: 'requerimientos',
                titulo: 'Checklist',
                ancho: 170,
                valorOrden: (f) => f.requerimientos.porcentaje,
                render: (f) => (
                  <div>
                    <BarraAvance valor={f.requerimientos.porcentaje} />
                    <p className="tabular mt-0.5 text-[11px] text-tenue">
                      {f.requerimientos.confirmados} / {f.requerimientos.total} confirmados
                    </p>
                  </div>
                ),
                formatoCSV: (v) => `${v.confirmados}/${v.total}`,
              },
            ]}
            alHacerClicFila={(f) => navegar(`/eventos?tab=lista&evento=${f.id}`)}
          />
        </Tarjeta>
      )}

      {seguimientos.length > 0 && (
        <Tarjeta titulo="Seguimientos del período" sinPadding>
          <Tabla
            nombreExport={`seguimientos-${sufijo}`}
            filas={seguimientos}
            conBusqueda={false}
            columnas={[
              { clave: 'fecha', titulo: 'Fecha', ancho: 100, render: (f) => fFecha(f.fecha), formatoCSV: fFecha },
              {
                clave: 'tipo',
                titulo: 'Tipo',
                ancho: 110,
                render: (f) => <Chip tono={f.tipo === 'programado' ? 'acento' : 'neutro'}>{f.tipo}</Chip>,
              },
              { clave: 'participantes', titulo: 'Participantes', ancho: 200 },
              { clave: 'resumen', titulo: 'Resumen' },
            ]}
          />
        </Tarjeta>
      )}

      <footer className="solo-impresion pie-impresion">
        Hoja generada por el sistema de Coordinación. Los compromisos y proyectos se listan vigentes al{' '}
        {fFecha(hoy)}; los monitoreos, temas y seguimientos corresponden al período indicado.
      </footer>

      {cerrando && <ModalCierre item={cerrando} hoy={hoy} alCerrar={() => setCerrando(null)} />}
    </div>
  );
}

/* ── Planificación y presupuesto ────────────────────────────────────── */

function PanelPlanificacion({ desvios, presupuesto, anio, trimestre, sufijo, navegar }) {
  const atrasados = desvios.filter((d) => d.cumplimiento < 80).length;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Tarjeta
        titulo={`Cumplimiento al T${trimestre} ${anio}`}
        descripcion="Avance real contra la meta trimestral cargada. Sólo entran los proyectos con planificación."
        className="xl:col-span-2"
        sinPadding
      >
        <Tabla
          nombreExport={`cumplimiento-${sufijo}`}
          filas={desvios}
          claveFila={(f) => f.id_proyecto}
          conBusqueda={false}
          columnas={[
            {
              clave: 'id_proyecto',
              titulo: 'ID',
              ancho: 120,
              render: (f) => <Chip tono="acento">{f.id_proyecto}</Chip>,
            },
            { clave: 'proyecto', titulo: 'Proyecto' },
            { clave: 'meta', titulo: 'Meta', ancho: 90, alinear: 'derecha', render: (f) => numero(f.meta) },
            { clave: 'real', titulo: 'Real', ancho: 90, alinear: 'derecha', render: (f) => numero(f.real) },
            {
              clave: 'cumplimiento',
              titulo: 'Cumplimiento',
              ancho: 150,
              render: (f) => <Semaforo nivel={nivelCumplimiento(f.cumplimiento)} texto={`${f.cumplimiento}%`} />,
            },
          ]}
          alHacerClicFila={(f) => navegar(`/proyectos/${f.id_proyecto}`)}
          vacio={
            <Vacio
              compacto
              icono={Target}
              titulo="Sin planificación cargada para el año"
              descripcion="Sin meta trimestral no hay contra qué comparar el avance de esta secretaría."
              accion={{ texto: 'Ir a Planificación', alHacerClic: () => navegar('/planificacion?tab=carga') }}
            />
          }
        />
      </Tarjeta>

      <Tarjeta titulo="Ejecución presupuestaria" descripcion="Sumada sobre los proyectos de la secretaría.">
        <dl className="flex flex-col">
          <div className="flex items-baseline justify-between border-b border-borde/60 py-1.5">
            <dt className="text-xs text-gris">Planificado</dt>
            <dd className="tabular text-sm text-tinta">{moneda(presupuesto.planificado)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-b border-borde/60 py-1.5">
            <dt className="text-xs text-gris">Ejecutado</dt>
            <dd className="tabular text-sm text-tinta">{moneda(presupuesto.ejecutado)}</dd>
          </div>
        </dl>
        <div className="mt-3">
          <BarraAvance valor={presupuesto.porcentaje} />
          <p className="mt-1.5 text-[11px] text-tenue">
            {presupuesto.desvio === 0
              ? 'Ejecución en línea con lo planificado.'
              : presupuesto.desvio > 0
                ? `Sobreejecución de ${presupuesto.desvio} puntos.`
                : `Subejecución de ${Math.abs(presupuesto.desvio)} puntos.`}
          </p>
        </div>
        {atrasados > 0 && (
          <p className="mt-3 text-xs text-vencido-texto">
            {atrasados} proyecto{atrasados === 1 ? '' : 's'} por debajo del 80% de su meta trimestral.
          </p>
        )}
      </Tarjeta>
    </div>
  );
}

/* ── Cierre en línea ────────────────────────────────────────────────── */

/**
 * Confirmación única para las dos acciones de cierre. Pasa por el repositorio,
 * así que el cambio queda asentado en la bitácora como cualquier otra edición.
 */
function ModalCierre({ item, hoy, alCerrar }) {
  const [fecha, setFecha] = useState(hoy);
  const [trabajando, setTrabajando] = useState(false);
  const esTema = item.clase === 'tema';

  async function confirmar() {
    setTrabajando(true);
    try {
      if (esTema) await acciones.actualizarTema(item.registro.id, { resuelto: true });
      else await acciones.marcarCumplido(item.registro.id, fecha);
      alCerrar();
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      ancho="sm"
      titulo={esTema ? 'Marcar el tema como resuelto' : 'Marcar el compromiso como cumplido'}
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" icono={Check} onClick={confirmar} disabled={trabajando}>
            Confirmar
          </Boton>
        </>
      }
    >
      <p className="mb-3 text-sm leading-relaxed text-gris">{item.registro.descripcion}</p>
      {!esTema && (
        <CampoFecha etiqueta="Fecha de cumplimiento" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      )}
    </Modal>
  );
}
