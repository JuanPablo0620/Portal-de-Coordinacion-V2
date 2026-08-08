import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, List, Pencil, Plus } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Aviso, BarraAvance, Boton, Chip, Metrica, Pestanias, Semaforo, Tarjeta, Vacio, nivelPorDias } from '../../componentes/Basicos.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { Calendario, useMesVisible } from '../../componentes/Calendario.jsx';
import { CampoSelect } from '../../componentes/Campo.jsx';
import { FormularioEvento, SeccionRequerimientos } from './FormularioEvento.jsx';
import { UMBRALES, calcularAlertas, TIPOS_ALERTA } from '../../datos/alertas.js';
import { ESTADOS_EVENTO } from '../../datos/catalogos.js';
import { diasHasta, eventos as selEventos, hoyISO, itemsCalendario, requerimientosDe } from '../../datos/selectores.js';
import { fecha as fFecha, textoVencimiento } from '../../utilidades/formato.js';
import { useBD } from '../../estado/tienda.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';

const DEFAULTS = { tab: 'calendario', area: '', tipo: '', estado: '', evento: '' };

export default function Eventos() {
  const bd = useBD();
  const hoy = hoyISO();
  const [filtros, setFiltros] = useFiltrosUrl(DEFAULTS);
  const [formulario, setFormulario] = useState(null);

  const alertasEvento = useMemo(
    () => (bd ? calcularAlertas(bd, hoy).filter((a) => a.tipo === TIPOS_ALERTA.EVENTO_INCOMPLETO) : []),
    [bd, hoy],
  );

  const pestanias = [
    { valor: 'calendario', titulo: 'Calendario', icono: CalendarDays },
    { valor: 'lista', titulo: 'Lista', icono: List },
    { valor: 'checklist', titulo: 'Checklist', icono: ClipboardCheck, cantidad: alertasEvento.length || undefined },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Eventos"
        descripcion="Agenda de eventos y checklist de requerimientos por evento."
        acciones={
          <Boton variante="primario" icono={Plus} onClick={() => setFormulario({})}>
            Cargar evento
          </Boton>
        }
      />

      <Pagina className="flex flex-col gap-4">
        <Pestanias opciones={pestanias} valor={filtros.tab} alCambiar={(v) => setFiltros({ tab: v })} />

        {alertasEvento.length > 0 && filtros.tab !== 'checklist' && (
          <Aviso tono="alerta" titulo={`${alertasEvento.length} evento(s) con requerimientos sin confirmar`}>
            {alertasEvento.map((a) => a.titulo).join(' · ')} — a menos de {UMBRALES.DIAS_EVENTO} días.{' '}
            <button type="button" className="underline" onClick={() => setFiltros({ tab: 'checklist' })}>
              Ver checklist
            </button>
          </Aviso>
        )}

        {filtros.tab === 'calendario' && <PanelCalendario bd={bd} hoy={hoy} alCargar={() => setFormulario({})} />}
        {filtros.tab === 'lista' && (
          <PanelLista bd={bd} hoy={hoy} filtros={filtros} setFiltros={setFiltros} alEditar={setFormulario} />
        )}
        {filtros.tab === 'checklist' && (
          <PanelChecklist bd={bd} hoy={hoy} filtros={filtros} setFiltros={setFiltros} alEditar={setFormulario} />
        )}
      </Pagina>

      {formulario && <FormularioEvento abierto alCerrar={() => setFormulario(null)} evento={formulario.id ? formulario : null} />}
    </>
  );
}

/* ── Calendario ─────────────────────────────────────────────────────── */

function PanelCalendario({ bd, hoy, alCargar }) {
  const mes = useMesVisible(hoy);
  const items = useMemo(
    () =>
      bd
        ? itemsCalendario(bd, { seguimientos: false, eventos: true, mesas: false, vencimientos: false }, mes.rango[0], mes.rango[1])
        : [],
    [bd, mes.rango],
  );

  const proximos = useMemo(
    () => (bd ? selEventos(bd, {}).filter((e) => diasHasta(e.fecha, hoy) >= 0).slice(0, 8) : []),
    [bd, hoy],
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
      <Tarjeta titulo="Calendario de eventos">
        <Calendario anio={mes.anio} mes={mes.mes} items={items} hoy={hoy} alMover={mes.mover} alVolverAHoy={mes.volverAHoy} />
      </Tarjeta>

      <Tarjeta titulo="Próximos eventos" sinPadding>
        {proximos.length === 0 ? (
          <Vacio
            compacto
            icono={CalendarDays}
            titulo="Sin eventos próximos"
            accion={{ texto: 'Cargar evento', icono: Plus, alHacerClic: alCargar }}
          />
        ) : (
          <ul className="divide-y divide-borde/60">
            {proximos.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="w-12 shrink-0 rounded-chip bg-acento-suave py-1 text-center">
                  <p className="tabular text-sm font-semibold leading-none text-acento-fuerte">{e.fecha.slice(8, 10)}</p>
                  <p className="text-[10px] uppercase text-acento">{MES_CORTO[Number(e.fecha.slice(5, 7)) - 1]}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm leading-tight text-tinta">{e.nombre}</p>
                  <p className="truncate text-[11px] text-tenue">
                    {[e.hora, e.lugar].filter(Boolean).join(' · ') || e.area_organizadora}
                  </p>
                  <div className="mt-1">
                    <BarraAvance valor={e.requerimientos.porcentaje} compacta />
                  </div>
                </div>
                <Semaforo nivel={nivelPorDias(diasHasta(e.fecha, hoy))} soloPunto texto={textoVencimiento(diasHasta(e.fecha, hoy))} />
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}

/* ── Lista ──────────────────────────────────────────────────────────── */

function PanelLista({ bd, hoy, filtros, setFiltros, alEditar }) {
  const navegar = useNavigate();
  const opcionesArea = useOpciones('areas');
  const opcionesTipo = useOpciones('tipos_evento');

  const filas = useMemo(
    () => (bd ? selEventos(bd, { area: filtros.area, tipo: filtros.tipo, estado: filtros.estado }) : []),
    [bd, filtros.area, filtros.tipo, filtros.estado],
  );

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Filtros">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CampoSelect etiqueta="Área organizadora" opciones={opcionesArea} value={filtros.area} onChange={(e) => setFiltros({ area: e.target.value })} placeholder="Todas" />
          <CampoSelect etiqueta="Tipo" opciones={opcionesTipo} value={filtros.tipo} onChange={(e) => setFiltros({ tipo: e.target.value })} placeholder="Todos" />
          <CampoSelect etiqueta="Estado" opciones={ESTADOS_EVENTO} value={filtros.estado} onChange={(e) => setFiltros({ estado: e.target.value })} placeholder="Todos" />
        </div>
      </Tarjeta>

      <Tarjeta sinPadding>
        <Tabla
          nombreExport="eventos"
          filas={filas}
          ordenInicial={{ clave: 'fecha', direccion: 'asc' }}
          columnas={[
            { clave: 'fecha', titulo: 'Fecha', ancho: 105, render: (f) => fFecha(f.fecha), formatoCSV: fFecha },
            { clave: 'hora', titulo: 'Hora', ancho: 65 },
            { clave: 'nombre', titulo: 'Evento' },
            { clave: 'lugar', titulo: 'Lugar', ancho: 200 },
            { clave: 'area_organizadora', titulo: 'Área', ancho: 180 },
            { clave: 'tipo', titulo: 'Tipo', ancho: 140 },
            { clave: 'estado', titulo: 'Estado', ancho: 110, render: (f) => <Chip tono={f.estado === 'confirmado' ? 'enregla' : f.estado === 'suspendido' ? 'vencido' : 'neutro'}>{f.estado}</Chip> },
            {
              clave: 'requerimientos',
              titulo: 'Requerimientos',
              ancho: 160,
              valorOrden: (f) => f.requerimientos.porcentaje,
              render: (f) =>
                f.requerimientos.total ? (
                  <div>
                    <BarraAvance valor={f.requerimientos.porcentaje} />
                    <p className="tabular mt-0.5 text-[11px] text-tenue">
                      {f.requerimientos.confirmados} de {f.requerimientos.total}
                    </p>
                  </div>
                ) : (
                  <span className="text-tenue">sin cargar</span>
                ),
              formatoCSV: (v) => `${v.confirmados}/${v.total}`,
            },
            {
              clave: 'id_proyecto',
              titulo: 'Proyecto',
              ancho: 120,
              render: (f) =>
                f.id_proyecto ? (
                  <button type="button" onClick={(e) => { e.stopPropagation(); navegar(`/proyectos/${f.id_proyecto}`); }}>
                    <Chip tono="acento">{f.id_proyecto}</Chip>
                  </button>
                ) : (
                  <span className="text-tenue">—</span>
                ),
            },
            {
              clave: 'acciones',
              titulo: '',
              ancho: 80,
              sinOrdenar: true,
              sinExportar: true,
              render: (f) => (
                <Boton tamanio="sm" variante="fantasma" icono={Pencil} onClick={(e) => { e.stopPropagation(); alEditar(f); }}>
                  Editar
                </Boton>
              ),
            },
          ]}
          alHacerClicFila={(f) => setFiltros({ tab: 'checklist', evento: f.id })}
          vacio={
            <Vacio
              icono={CalendarDays}
              titulo="Sin eventos cargados"
              descripcion="Cargá el primero con su fecha, lugar y requerimientos."
              accion={{ texto: 'Cargar evento', icono: Plus, alHacerClic: () => alEditar({}) }}
            />
          }
        />
      </Tarjeta>
    </div>
  );
}

/* ── Checklist ──────────────────────────────────────────────────────── */

function PanelChecklist({ bd, hoy, filtros, setFiltros, alEditar }) {
  const eventos = useMemo(
    () => (bd ? selEventos(bd, {}).filter((e) => e.estado !== 'realizado' && e.estado !== 'suspendido') : []),
    [bd],
  );

  const elegido = filtros.evento ? eventos.find((e) => e.id === filtros.evento) : eventos[0];

  const conAlerta = eventos.filter((e) => {
    const d = diasHasta(e.fecha, hoy);
    return d >= 0 && d <= UMBRALES.DIAS_EVENTO && e.requerimientos.pendientes > 0;
  });

  if (!eventos.length) {
    return (
      <Tarjeta>
        <Vacio
          icono={ClipboardCheck}
          titulo="Sin eventos pendientes"
          descripcion="El checklist muestra los eventos previstos y confirmados. Cargá uno para empezar."
          accion={{ texto: 'Cargar evento', icono: Plus, alHacerClic: () => alEditar({}) }}
        />
      </Tarjeta>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica valor={eventos.length} etiqueta="Eventos pendientes" />
        <Metrica valor={eventos.filter((e) => e.requerimientos.porcentaje === 100 && e.requerimientos.total).length} etiqueta="Con todo confirmado" />
        <Metrica valor={eventos.reduce((s, e) => s + e.requerimientos.pendientes, 0)} etiqueta="Requerimientos sin confirmar" />
        <Metrica
          valor={conAlerta.length}
          etiqueta={`En alerta (≤${UMBRALES.DIAS_EVENTO} días)`}
          tono={conAlerta.length ? 'vencido' : 'neutro'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
        <Tarjeta titulo="Eventos" sinPadding>
          <ul className="scroll-fino max-h-[28rem] divide-y divide-borde/60 overflow-y-auto">
            {eventos.map((e) => {
              const dias = diasHasta(e.fecha, hoy);
              const enAlerta = dias >= 0 && dias <= UMBRALES.DIAS_EVENTO && e.requerimientos.pendientes > 0;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setFiltros({ evento: e.id })}
                    className={`w-full px-4 py-2.5 text-left transition hover:bg-paper ${
                      elegido?.id === e.id ? 'bg-acento-suave/60' : ''
                    } ${enAlerta ? 'border-l-2 border-vencido' : ''}`}
                  >
                    <p className="truncate text-sm leading-tight text-tinta">{e.nombre}</p>
                    <p className="text-[11px] text-tenue">
                      {fFecha(e.fecha)} · {textoVencimiento(dias)}
                    </p>
                    <div className="mt-1">
                      <BarraAvance valor={e.requerimientos.porcentaje} compacta />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Tarjeta>

        {elegido && <DetalleChecklist evento={elegido} bd={bd} hoy={hoy} alEditar={alEditar} />}
      </div>
    </div>
  );
}

function DetalleChecklist({ evento, bd, hoy, alEditar }) {
  const requerimientos = useMemo(() => requerimientosDe(bd, evento.id), [bd, evento.id]);
  const dias = diasHasta(evento.fecha, hoy);
  const enAlerta = dias >= 0 && dias <= UMBRALES.DIAS_EVENTO && evento.requerimientos.pendientes > 0;

  const porEstado = (estado) => requerimientos.filter((r) => r.estado === estado).length;

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo={evento.nombre}
        descripcion={`${fFecha(evento.fecha)}${evento.hora ? ` · ${evento.hora}` : ''}${evento.lugar ? ` · ${evento.lugar}` : ''}`}
        acciones={
          <Boton tamanio="sm" icono={Pencil} onClick={() => alEditar(evento)}>
            Editar
          </Boton>
        }
      >
        {enAlerta && (
          <div className="mb-3">
            <Aviso tono="error" titulo={`Faltan ${evento.requerimientos.pendientes} requerimientos por confirmar`}>
              El evento es en {dias} día{dias === 1 ? '' : 's'}, dentro del umbral de{' '}
              {UMBRALES.DIAS_EVENTO} días. Esta alerta también figura en el panel de Monitoreo y en el inicio.
            </Aviso>
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="min-w-40 flex-1">
            <BarraAvance valor={evento.requerimientos.porcentaje} />
          </div>
          <Chip tono="neutro">{porEstado('solicitado')} solicitados</Chip>
          <Chip tono="proximo">{porEstado('confirmado')} confirmados</Chip>
          <Chip tono="enregla">{porEstado('entregado')} entregados</Chip>
          <Semaforo nivel={nivelPorDias(dias)} texto={textoVencimiento(dias)} />
        </div>

        <SeccionRequerimientos idEvento={evento.id} bd={bd} />
      </Tarjeta>
    </div>
  );
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
