import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, List, Pencil, Plus, Trash2 } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Aviso, Boton, Chip, Metrica, Pestanias, Semaforo, Tarjeta, Vacio, nivelPorDias } from '../../componentes/Basicos.jsx';
import { ModalConfirmacion } from '../../componentes/Modal.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { Calendario, useMesVisible } from '../../componentes/Calendario.jsx';
import { CampoSelect } from '../../componentes/Campo.jsx';
import { GrillaFiltros, TarjetaFiltros, limpiarClaves } from '../../componentes/Filtros.jsx';
import { FormularioEvento, SeccionRequerimientos } from './FormularioEvento.jsx';
import { UMBRALES, calcularAlertas, TIPOS_ALERTA } from '../../datos/alertas.js';
import { ESTADOS_EVENTO } from '../../datos/catalogos.js';
import { diasHasta, eventos as selEventos, hoyISO, itemsCalendario, requerimientosDe } from '../../datos/selectores.js';
import { fecha as fFecha, textoVencimiento } from '../../utilidades/formato.js';
import { acciones, useBD } from '../../estado/tienda.js';
import { conSecretariaGeneral, useOpciones } from '../../utilidades/catalogos.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';

const DEFAULTS = { tab: 'calendario', area: '', tipo: '', estado: '', evento: '' };

/** Lo que limpia el botón: filtros, nunca la pestaña ni el evento abierto. */
const CLAVES_FILTRO = ['area', 'tipo', 'estado'];

export default function Eventos() {
  const bd = useBD();
  const hoy = hoyISO();
  const [filtros, setFiltros] = useFiltrosUrl(DEFAULTS);
  const [formulario, setFormulario] = useState(null);
  const [aBorrar, setABorrar] = useState(null);
  const [errorRemoto, setErrorRemoto] = useState(null);
  const [errorAccion, setErrorAccion] = useState('');

  // Eventos es la primera colección que vive en Supabase y no en el navegador,
  // así que otra persona puede haber cargado algo desde que abriste el portal.
  // Se trae lo fresco al entrar a la pantalla — es la estrategia de
  // concurrencia acordada para esta etapa, en vez de escuchar cambios en vivo.
  useEffect(() => {
    let vigente = true;
    acciones.refrescar().then(() => {
      if (vigente) setErrorRemoto(acciones.estadoRemoto().error);
    });
    // Si el componente se desmontó mientras esperábamos, no se toca el estado:
    // React avisa por consola y, peor, se pisaría el aviso de otra pantalla.
    return () => {
      vigente = false;
    };
  }, []);

  const alertasEvento = useMemo(
    () => (bd ? calcularAlertas(bd, hoy).filter((a) => a.tipo === TIPOS_ALERTA.EVENTO_INCOMPLETO) : []),
    [bd, hoy],
  );

  const pestanias = [
    { valor: 'calendario', titulo: 'Calendario', icono: CalendarDays },
    { valor: 'lista', titulo: 'Lista', icono: List },
    { valor: 'checklist', titulo: 'Checklist', icono: ClipboardCheck, cantidad: alertasEvento.length || undefined },
  ];

  async function eliminar() {
    if (!aBorrar) return;
    setErrorAccion('');
    try {
      await acciones.eliminarEvento(aBorrar.id);
      setFiltros({ evento: '' });
    } catch (error) {
      setErrorAccion(error?.message ?? 'No se pudo eliminar el evento.');
    }
  }

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
        {/* Los eventos ya no viven en esta computadora. Si no se pudieron
            traer, lo que se ve puede estar desactualizado o incompleto — y eso
            hay que decirlo, no dejar que parezca la lista real. */}
        {errorRemoto && (
          <Aviso tono="error" titulo="No se pudieron traer los eventos de la base">
            Puede que estés viendo información desactualizada, y lo que cargues ahora quizás no se
            guarde. Probá recargar la página. Si sigue, avisale a Control de Gestión. ({errorRemoto})
          </Aviso>
        )}
        {errorAccion && <Aviso tono="error">{errorAccion}</Aviso>}

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
          <PanelChecklist
            bd={bd}
            hoy={hoy}
            filtros={filtros}
            setFiltros={setFiltros}
            alEditar={setFormulario}
            alBorrar={setABorrar}
          />
        )}
      </Pagina>

      {formulario && <FormularioEvento abierto alCerrar={() => setFormulario(null)} evento={formulario.id ? formulario : null} />}
      <ModalConfirmacion
        abierto={Boolean(aBorrar)}
        alCerrar={() => setABorrar(null)}
        alConfirmar={eliminar}
        titulo="Eliminar evento"
        mensaje={`¿Querés eliminar «${aBorrar?.nombre ?? ''}»? Dejará de aparecer en el calendario y en los listados.`}
        textoConfirmar="Eliminar"
        variante="peligro"
      />
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
                  {e.requerimientos.total > 0 && (
                    <p className="mt-1 text-[11px] text-tenue">
                      {e.requerimientos.pendientes
                        ? `${e.requerimientos.pendientes} requerimiento(s) pendiente(s)`
                        : 'Requerimientos confirmados'}
                    </p>
                  )}
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
  const opcionesAreaBase = useOpciones('areas');
  const opcionesArea = useMemo(() => conSecretariaGeneral(opcionesAreaBase), [opcionesAreaBase]);
  const opcionesTipo = useOpciones('tipos_evento');

  const filas = useMemo(
    () => (bd ? selEventos(bd, { area: filtros.area, tipo: filtros.tipo, estado: filtros.estado }) : []),
    [bd, filtros.area, filtros.tipo, filtros.estado],
  );

  return (
    <div className="flex flex-col gap-4">
      <TarjetaFiltros
        filtros={filtros}
        defaults={DEFAULTS}
        claves={CLAVES_FILTRO}
        alLimpiar={() => limpiarClaves(setFiltros, DEFAULTS, CLAVES_FILTRO)}
      >
        <GrillaFiltros columnas={3}>
          <CampoSelect etiqueta="Área organizadora" opciones={opcionesArea} value={filtros.area} onChange={(e) => setFiltros({ area: e.target.value })} placeholder="Todas" />
          <CampoSelect etiqueta="Tipo" opciones={opcionesTipo} value={filtros.tipo} onChange={(e) => setFiltros({ tipo: e.target.value })} placeholder="Todos" />
          <CampoSelect etiqueta="Estado" opciones={ESTADOS_EVENTO} value={filtros.estado} onChange={(e) => setFiltros({ estado: e.target.value })} placeholder="Todos" />
        </GrillaFiltros>
      </TarjetaFiltros>

      <Tarjeta sinPadding>
        <Tabla
          nombreExport="eventos"
          filas={filas}
          ordenInicial={{ clave: 'fecha', direccion: 'asc' }}
          columnas={[
            { clave: 'fecha', titulo: 'Fecha', ancho: 165, render: (f) => textoFechaEvento(f), formatoCSV: fFecha },
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
              valorOrden: (f) => f.requerimientos.pendientes,
              render: (f) =>
                f.requerimientos.total ? (
                  <span className="tabular text-sm text-gris">
                    {f.requerimientos.confirmados} de {f.requerimientos.total} confirmados
                  </span>
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

function PanelChecklist({ bd, hoy, filtros, setFiltros, alEditar, alBorrar }) {
  const eventos = useMemo(
    () => (bd ? selEventos(bd, {}) : []),
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
          descripcion="Cargá un evento para consultar su información y sus requerimientos."
          accion={{ texto: 'Cargar evento', icono: Plus, alHacerClic: () => alEditar({}) }}
        />
      </Tarjeta>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica valor={eventos.length} etiqueta="Eventos" />
        <Metrica valor={eventos.filter((e) => e.requerimientos.total > 0 && e.requerimientos.pendientes === 0).length} etiqueta="Con todo confirmado" />
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
                      {textoFechaEvento(e)} · {textoVencimiento(dias)}
                    </p>
                    {e.requerimientos.total > 0 && (
                      <p className="mt-1 text-[11px] text-tenue">
                        {e.requerimientos.confirmados}/{e.requerimientos.total} requerimientos confirmados
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Tarjeta>

        {elegido && <DetalleChecklist evento={elegido} bd={bd} hoy={hoy} alEditar={alEditar} alBorrar={alBorrar} />}
      </div>
    </div>
  );
}

function DetalleChecklist({ evento, bd, hoy, alEditar, alBorrar }) {
  const requerimientos = useMemo(() => requerimientosDe(bd, evento.id), [bd, evento.id]);
  const dias = diasHasta(evento.fecha, hoy);
  const enAlerta = dias >= 0 && dias <= UMBRALES.DIAS_EVENTO && evento.requerimientos.pendientes > 0;

  const porEstado = (estado) => requerimientos.filter((r) => r.estado === estado).length;

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo={evento.nombre}
        descripcion={`${textoFechaEvento(evento)}${evento.hora ? ` · ${evento.hora}` : ''}${evento.lugar ? ` · ${evento.lugar}` : ''}`}
        acciones={
          <div className="flex gap-2">
            <Boton tamanio="sm" icono={Pencil} onClick={() => alEditar(evento)}>
              Editar
            </Boton>
            <Boton tamanio="sm" variante="peligro" icono={Trash2} onClick={() => alBorrar(evento)}>
              Eliminar
            </Boton>
          </div>
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

        {/* `whitespace-pre-line` respeta los saltos de línea que la persona
            escribió en el textarea: sin eso, tres párrafos se ven como un
            bloque corrido. Los eventos cargados antes de que existiera el
            campo no tienen `detalle`, por eso el condicional. */}
        {evento.detalle && (
          <p className="mb-3 whitespace-pre-line text-sm leading-relaxed text-gris">{evento.detalle}</p>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-3">
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

function textoFechaEvento(evento) {
  if (evento.fecha_hasta && evento.fecha_hasta !== evento.fecha) {
    return `${fFecha(evento.fecha)} al ${fFecha(evento.fecha_hasta)}`;
  }
  return fFecha(evento.fecha);
}
