import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarPlus,
  CalendarRange,
  Check,
  ClipboardList,
  History,
  List,
  NotebookPen,
  X,
} from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Boton, Chip, Pestanias, Semaforo, Tarjeta, Vacio, nivelPorDias } from '../../componentes/Basicos.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { Calendario, useMesVisible } from '../../componentes/Calendario.jsx';
import { Modal } from '../../componentes/Modal.jsx';
import { CampoFecha, CampoHora, CampoSelect, CampoTexto, GrillaCampos } from '../../componentes/Campo.jsx';
import { SelectorProyecto } from '../../componentes/SelectorProyecto.jsx';
import { CargarSeguimiento } from './CargarSeguimiento.jsx';
import { HistorialArea } from './HistorialArea.jsx';
import { ESTADOS_COMPROMISO } from '../../datos/catalogos.js';
import {
  compromisos as selCompromisos,
  diasHasta,
  hoyISO,
  itemsCalendario,
  seguimientos as selSeguimientos,
} from '../../datos/selectores.js';
import { fecha as fFecha, textoVencimiento } from '../../utilidades/formato.js';
import { acciones, useBD } from '../../estado/tienda.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';

const DEFAULTS = { tab: 'calendario', vista: 'calendario', area: '', responsable: '', estado: '', desde: '', hasta: '' };

export default function Seguimiento() {
  const bd = useBD();
  const [filtros, setFiltros] = useFiltrosUrl(DEFAULTS);
  const [agendando, setAgendando] = useState(false);

  const pestanias = [
    { valor: 'calendario', titulo: 'Próximos seguimientos', icono: CalendarRange },
    { valor: 'cargar', titulo: 'Cargar realizado', icono: NotebookPen },
    { valor: 'compromisos', titulo: 'Compromisos', icono: ClipboardList },
    { valor: 'historial', titulo: 'Historial por área', icono: History },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Seguimiento"
        descripcion="Reuniones de seguimiento con las áreas y compromisos que surgen de ellas."
        acciones={
          <>
            <Boton icono={CalendarPlus} onClick={() => setAgendando(true)}>
              Agendar seguimiento
            </Boton>
            <Boton variante="primario" icono={NotebookPen} onClick={() => setFiltros({ tab: 'cargar' })}>
              Cargar seguimiento realizado
            </Boton>
          </>
        }
      />

      <Pagina className="flex flex-col gap-4">
        <Pestanias opciones={pestanias} valor={filtros.tab} alCambiar={(v) => setFiltros({ tab: v })} />

        {filtros.tab === 'calendario' && (
          <PanelCalendario bd={bd} filtros={filtros} setFiltros={setFiltros} alAgendar={() => setAgendando(true)} />
        )}
        {filtros.tab === 'cargar' && <CargarSeguimiento alTerminar={() => setFiltros({ tab: 'compromisos' })} />}
        {filtros.tab === 'compromisos' && <PanelCompromisos bd={bd} filtros={filtros} setFiltros={setFiltros} />}
        {filtros.tab === 'historial' && <HistorialArea bd={bd} filtros={filtros} setFiltros={setFiltros} />}
      </Pagina>

      {agendando && <AgendarSeguimiento abierto alCerrar={() => setAgendando(false)} />}
    </>
  );
}

/* ── Calendario y lista de próximos ─────────────────────────────────── */

function PanelCalendario({ bd, filtros, setFiltros, alAgendar }) {
  const hoy = hoyISO();
  const mes = useMesVisible(hoy);
  const esLista = filtros.vista === 'lista';

  const programados = useMemo(() => {
    if (!bd) return [];
    return selSeguimientos(bd, { tipo: 'programado' })
      .filter((s) => diasHasta(s.fecha, hoy) >= 0)
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  }, [bd, hoy]);

  const items = useMemo(
    () =>
      bd
        ? itemsCalendario(bd, { seguimientos: true, eventos: false, mesas: false, vencimientos: false }, mes.rango[0], mes.rango[1])
        : [],
    [bd, mes.rango],
  );

  const conmutador = (
    <div className="flex rounded-chip border border-borde-fuerte">
      {[
        ['calendario', 'Calendario', CalendarRange],
        ['lista', 'Lista', List],
      ].map(([valor, titulo, Icono]) => (
        <button
          key={valor}
          type="button"
          onClick={() => setFiltros({ vista: valor })}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition first:rounded-l-chip last:rounded-r-chip ${
            filtros.vista === valor ? 'bg-acento-suave text-acento-fuerte' : 'text-gris hover:bg-paper'
          }`}
        >
          <Icono size={13} />
          {titulo}
        </button>
      ))}
    </div>
  );

  if (esLista) {
    return (
      <Tarjeta titulo="Próximos seguimientos" acciones={conmutador} sinPadding>
        <Tabla
          nombreExport="proximos-seguimientos"
          filas={programados}
          columnas={[
            { clave: 'fecha', titulo: 'Fecha', ancho: 100, render: (f) => fFecha(f.fecha), formatoCSV: fFecha },
            { clave: 'hora', titulo: 'Hora', ancho: 70 },
            { clave: 'area', titulo: 'Área', ancho: 200 },
            {
              clave: 'ids_proyecto',
              titulo: 'Proyectos',
              render: (f) => <span className="text-xs text-gris">{(f.ids_proyecto ?? []).join(', ') || '—'}</span>,
            },
            { clave: 'participantes', titulo: 'Participantes' },
            { clave: 'temas', titulo: 'Temas a tratar' },
            {
              clave: 'dias',
              titulo: 'Cuándo',
              ancho: 120,
              sinOrdenar: true,
              render: (f) => (
                <Semaforo nivel={nivelPorDias(diasHasta(f.fecha, hoy))} texto={textoVencimiento(diasHasta(f.fecha, hoy))} />
              ),
            },
          ]}
          vacio={
            <Vacio
              icono={CalendarRange}
              titulo="Sin seguimientos agendados"
              descripcion="Agendá el próximo encuentro con un área para que aparezca acá y en el calendario del inicio."
              accion={{ texto: 'Agendar seguimiento', icono: CalendarPlus, alHacerClic: alAgendar }}
            />
          }
        />
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Próximos seguimientos" acciones={conmutador}>
      <Calendario
        anio={mes.anio}
        mes={mes.mes}
        items={items}
        hoy={hoy}
        alMover={mes.mover}
        alVolverAHoy={mes.volverAHoy}
      />
      {programados.length === 0 && (
        <div className="mt-3">
          <Vacio
            compacto
            icono={CalendarRange}
            titulo="Sin seguimientos agendados"
            accion={{ texto: 'Agendar seguimiento', icono: CalendarPlus, alHacerClic: alAgendar }}
          />
        </div>
      )}
    </Tarjeta>
  );
}

/* ── Lista de compromisos ───────────────────────────────────────────── */

function PanelCompromisos({ bd, filtros, setFiltros }) {
  const hoy = hoyISO();
  const navegar = useNavigate();
  const opcionesArea = useOpciones('areas');
  const [cumpliendo, setCumpliendo] = useState(null);

  const filas = useMemo(
    () =>
      bd
        ? selCompromisos(bd, { area: filtros.area, responsable: filtros.responsable, estado: filtros.estado, desde: filtros.desde, hasta: filtros.hasta }, hoy)
            .map((c) => ({ ...c, _resaltar: c.estado_efectivo === 'vencido' }))
        : [],
    [bd, filtros, hoy],
  );

  const responsables = useMemo(() => {
    const set = new Set((bd?.compromisos ?? []).filter((c) => c.activo !== false).map((c) => c.responsable).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [bd]);

  const vencidos = filas.filter((f) => f.estado_efectivo === 'vencido').length;

  const RUTA_ORIGEN = {
    seguimiento: (f) => `/seguimiento?tab=calendario&seguimiento=${f.id_origen}`,
    monitoreo: (f) => `/monitoreo?tab=ultimos&monitoreo=${f.id_origen}`,
    mesa: (f) => `/mesas?mesa=${f.id_origen}`,
  };

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo="Filtros"
        acciones={
          vencidos > 0 && (
            <Chip tono="vencido">
              {vencidos} vencido{vencidos === 1 ? '' : 's'}
            </Chip>
          )
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <CampoSelect etiqueta="Área" opciones={opcionesArea} value={filtros.area} onChange={(e) => setFiltros({ area: e.target.value })} placeholder="Todas" />
          <CampoSelect etiqueta="Responsable" opciones={responsables} value={filtros.responsable} onChange={(e) => setFiltros({ responsable: e.target.value })} placeholder="Todos" />
          <CampoSelect
            etiqueta="Estado"
            opciones={[...ESTADOS_COMPROMISO, 'vencido']}
            value={filtros.estado}
            onChange={(e) => setFiltros({ estado: e.target.value })}
            placeholder="Todos"
          />
          <CampoFecha etiqueta="Vence desde" value={filtros.desde} onChange={(e) => setFiltros({ desde: e.target.value })} />
          <CampoFecha etiqueta="Vence hasta" value={filtros.hasta} onChange={(e) => setFiltros({ hasta: e.target.value })} />
        </div>
      </Tarjeta>

      <Tarjeta sinPadding>
        <Tabla
          nombreExport="compromisos"
          filas={filas}
          columnas={[
            {
              clave: 'descripcion',
              titulo: 'Compromiso',
              render: (f) => (
                <div className="min-w-40">
                  <p className="leading-tight text-tinta">{f.descripcion}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navegar(RUTA_ORIGEN[f.origen_tipo]?.(f) ?? '/seguimiento');
                    }}
                    className="text-[11px] text-acento underline-offset-2 hover:underline"
                  >
                    origen: {f.origen_tipo}
                  </button>
                </div>
              ),
            },
            { clave: 'responsable', titulo: 'Responsable', ancho: 130 },
            { clave: 'area', titulo: 'Área', ancho: 180 },
            {
              clave: 'id_proyecto',
              titulo: 'Proyecto',
              ancho: 120,
              render: (f) =>
                f.id_proyecto ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navegar(`/proyectos/${f.id_proyecto}`);
                    }}
                  >
                    <Chip tono="acento">{f.id_proyecto}</Chip>
                  </button>
                ) : (
                  <span className="text-tenue">—</span>
                ),
            },
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
              ancho: 140,
              render: (f) => (
                <Semaforo
                  nivel={f.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(f.dias_restantes)}
                  texto={f.estado_efectivo === 'vencido' ? `vencido · ${f.dias_atraso} d` : f.estado_efectivo}
                />
              ),
            },
            {
              clave: 'acciones',
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setCumpliendo(f);
                    }}
                  >
                    Cumplido
                  </Boton>
                ),
            },
          ]}
          vacio={
            <Vacio
              icono={ClipboardList}
              titulo="Sin compromisos"
              descripcion="Los compromisos se generan al cargar un seguimiento, un tema de monitoreo con acción requerida o una reunión de mesa."
              accion={{ texto: 'Cargar seguimiento', icono: NotebookPen, alHacerClic: () => setFiltros({ tab: 'cargar' }) }}
            />
          }
        />
      </Tarjeta>

      {cumpliendo && <ModalCumplimiento compromiso={cumpliendo} alCerrar={() => setCumpliendo(null)} hoy={hoy} />}
    </div>
  );
}

function ModalCumplimiento({ compromiso, alCerrar, hoy }) {
  const [fechaCumplimiento, setFechaCumplimiento] = useState(hoy);
  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      ancho="sm"
      titulo="Marcar compromiso como cumplido"
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            icono={Check}
            onClick={async () => {
              await acciones.marcarCumplido(compromiso.id, fechaCumplimiento);
              alCerrar();
            }}
          >
            Confirmar
          </Boton>
        </>
      }
    >
      <p className="mb-3 text-sm leading-relaxed text-gris">{compromiso.descripcion}</p>
      <CampoFecha
        etiqueta="Fecha de cumplimiento"
        value={fechaCumplimiento}
        onChange={(e) => setFechaCumplimiento(e.target.value)}
      />
    </Modal>
  );
}

/* ── Agendar seguimiento ────────────────────────────────────────────── */

function AgendarSeguimiento({ abierto, alCerrar }) {
  const hoy = hoyISO();
  const opcionesArea = useOpciones('areas');
  const [datos, setDatos] = useState({ area: '', fecha: '', hora: '', participantes: '', temas: '' });
  const [ids, setIds] = useState([]);
  const [error, setError] = useState('');

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  async function guardar() {
    if (!datos.area || !datos.fecha) {
      setError('El área y la fecha son obligatorias.');
      return;
    }
    await acciones.crearSeguimiento({
      ...datos,
      ids_proyecto: ids,
      tipo: 'programado',
      texto_crudo: '',
      resumen: '',
      avances: [],
      problemas: [],
      estado_reportado: '',
    });
    alCerrar();
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="md"
      titulo="Agendar seguimiento"
      descripcion="Queda en el calendario de este módulo y en el del inicio."
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" icono={CalendarPlus} onClick={guardar}>
            Agendar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <GrillaCampos columnas={3}>
          <CampoSelect etiqueta="Área" requerido opciones={opcionesArea} value={datos.area} onChange={cambiar('area')} />
          <CampoFecha etiqueta="Fecha" requerido min={hoy} value={datos.fecha} onChange={cambiar('fecha')} />
          <CampoHora etiqueta="Hora" value={datos.hora} onChange={cambiar('hora')} />
        </GrillaCampos>
        <SelectorProyecto multiple valor={ids} alCambiar={setIds} etiqueta="Proyectos a tratar" maxAltura={180} />
        <CampoTexto etiqueta="Participantes previstos" value={datos.participantes} onChange={cambiar('participantes')} placeholder="Nombres separados por coma" />
        <CampoTexto etiqueta="Temas a tratar" value={datos.temas} onChange={cambiar('temas')} placeholder="Ej.: avance trimestral, cronograma, presupuesto" />
        {error && (
          <p className="flex items-center gap-1.5 text-xs text-vencido">
            <X size={13} /> {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
