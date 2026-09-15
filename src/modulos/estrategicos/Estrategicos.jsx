/**
 * MÓDULO DE PROYECTOS ESTRATÉGICOS.
 *
 * No es una base paralela: es la MISMA base maestra mirada con otra prioridad.
 * Un proyecto estratégico se declara con un campo, y a partir de ahí el sistema
 * lo vigila más de cerca —quince días sin novedades ya alerta, contra treinta
 * del resto— y lo muestra junto a sus compromisos vencidos y sus temas críticos.
 *
 * La pestaña «Promover» es la que hace que la cartera se mantenga viva: lo
 * estratégico casi nunca nace declarado, aparece cuando un tema de monitoreo se
 * repite o un seguimiento informa una traba. Ahí se ve lo que el sistema ya
 * sabe que merece mirarse y todavía nadie declaró.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpCircle,
  BarChart3,
  Briefcase,
  Gem,
  Pencil,
  Plus,
  Radar,
  Star,
  XCircle,
  BookOpen,
} from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import {
  Aviso,
  Boton,
  Chip,
  EstadoProyecto,
  Pestanias,
  Semaforo,
  Tarjeta,
  Vacio,
  nivelPorDias,
} from '../../componentes/Basicos.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { CampoSelect } from '../../componentes/Campo.jsx';
import { GrillaFiltros, TarjetaFiltros, limpiarClaves } from '../../componentes/Filtros.jsx';
import { ModalConfirmacion } from '../../componentes/Modal.jsx';
import { FormularioEstrategico } from './FormularioEstrategico.jsx';
import { FormularioNovedad } from './FormularioNovedad.jsx';
import { UMBRALES } from '../../datos/catalogos.js';
import {
  candidatosEstrategicos,
  compromisos as selCompromisos,
  hoyISO,
  proyectosEstrategicos,
  recordatoriosEstrategicos,
} from '../../datos/selectores.js';
import { fecha as fFecha, moneda, numero } from '../../utilidades/formato.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';
import { acciones as repo, useBD } from '../../estado/tienda.js';

const DEFAULTS = {
  tab: 'tablero',
  area: '',
  estado: '',
  origen_tipo: '',
  proyecto: '',
};

/** Lo que limpia el botón: filtros, nunca la pestaña ni el proyecto abierto. */
const CLAVES_FILTRO = ['area', 'estado', 'origen_tipo'];

const ETIQUETA_ORIGEN = { base: 'Base maestra', monitoreo: 'Monitoreo', seguimiento: 'Seguimiento' };

export default function Estrategicos() {
  const bd = useBD();
  const hoy = hoyISO();
  const navegar = useNavigate();
  const [filtros, setFiltros] = useFiltrosUrl(DEFAULTS);
  const [formulario, setFormulario] = useState(null);
  const [novedad, setNovedad] = useState(null);
  const [aQuitar, setAQuitar] = useState(null);

  const criterios = useMemo(
    () => ({
      area: filtros.area,
      estado: filtros.estado,
    }),
    [filtros],
  );

  const cartera = useMemo(() => (bd ? proyectosEstrategicos(bd, criterios, hoy) : []), [bd, criterios, hoy]);
  /*
   * Los compromisos vigentes de la cartera y los recordatorios con fecha. Van
   * acá y no adentro del Tablero para que la cuenta de cada tarjeta —cuántos
   * recordatorios tiene el proyecto— salga de la misma lista que el panel, y
   * no de dos recorridos que se pueden desincronizar.
   */
  const recordatorios = useMemo(
    () => (bd ? recordatoriosEstrategicos(bd, criterios, hoy) : []),
    [bd, criterios, hoy],
  );

  const compromisosCartera = useMemo(() => {
    if (!bd) return [];
    const porId = new Map(cartera.map((p) => [p.id_proyecto, p]));
    return selCompromisos(bd, { solo_vigentes: true }, hoy)
      .filter((c) => c.id_proyecto && porId.has(c.id_proyecto))
      .map((c) => {
        const p = porId.get(c.id_proyecto);
        return { ...c, proyecto: p.proyecto, prioridad: p.prioridad ?? '', area: c.area || p.area || '' };
      });
  }, [bd, cartera, hoy]);

  const carteraConNotas = useMemo(() => {
    const cuenta = new Map();
    for (const r of recordatorios) cuenta.set(r.id_proyecto, (cuenta.get(r.id_proyecto) ?? 0) + 1);
    return cartera.map((p) => ({ ...p, recordatorios: cuenta.get(p.id_proyecto) ?? 0 }));
  }, [cartera, recordatorios]);

  const candidatos = useMemo(
    () => (bd ? candidatosEstrategicos(bd, { area: filtros.area, origen_tipo: filtros.origen_tipo }, hoy) : []),
    [bd, filtros.area, filtros.origen_tipo, hoy],
  );

  const pestanias = [
    { valor: 'tablero', titulo: 'Tablero', icono: BarChart3 },
    { valor: 'cartera', titulo: 'Cartera', icono: Briefcase, cantidad: cartera.length },
    { valor: 'promover', titulo: 'Promover', icono: ArrowUpCircle, cantidad: candidatos.length },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Proyectos estratégicos"
        descripcion="La cartera que la gestión mira todas las semanas. Son proyectos de la base maestra declarados estratégicos, o promovidos desde un tema de monitoreo o un seguimiento."
        acciones={
          <Boton variante="primario" icono={Plus} onClick={() => setFormulario({ nuevo: true })}>
            Declarar estratégico
          </Boton>
        }
      />

      <Pagina className="flex flex-col gap-4">
        <Pestanias opciones={pestanias} valor={filtros.tab} alCambiar={(v) => setFiltros({ tab: v, proyecto: '' })} />

        {filtros.tab === 'tablero' && (
          <Tablero
            cartera={carteraConNotas}
            compromisos={compromisosCartera}
            recordatorios={recordatorios}
            hoy={hoy}
            navegar={navegar}
          />
        )}
        {filtros.tab === 'cartera' && (
          <PanelCartera
            cartera={cartera}
            filtros={filtros}
            setFiltros={setFiltros}
            alEditar={(p) => setFormulario({ proyecto: p })}
            alRegistrarNovedad={(p) => setNovedad(p)}
            alQuitar={(p) => setAQuitar(p)}
          />
        )}
        {filtros.tab === 'promover' && (
          <PanelPromover
            candidatos={candidatos}
            filtros={filtros}
            setFiltros={setFiltros}
            alPromover={(c) => setFormulario({ candidato: c })}
          />
        )}
      </Pagina>

      {formulario && (
        <FormularioEstrategico
          abierto
          proyecto={formulario.proyecto}
          candidato={formulario.candidato}
          alCerrar={() => setFormulario(null)}
        />
      )}

      {novedad && (
        <FormularioNovedad
          abierto
          proyecto={novedad}
          alCerrar={() => setNovedad(null)}
        />
      )}

      <ModalConfirmacion
        abierto={Boolean(aQuitar)}
        alCerrar={() => setAQuitar(null)}
        alConfirmar={() => repo.quitarEstrategico(aQuitar.id_proyecto)}
        titulo="Sacar de la cartera estratégica"
        mensaje={`«${aQuitar?.proyecto ?? ''}» vuelve a seguirse como cualquier otro proyecto. No se borra nada: el motivo y el historial quedan, y se puede volver a declarar cuando haga falta.`}
        textoConfirmar="Sacar de la cartera"
      />
    </>
  );
}

/* ── Tablero ────────────────────────────────────────────────────────── */

/**
 * Lo que la cartera necesita ver al entrar: qué se comprometió y todavía no se
 * cumplió, qué hay anotado para no olvidarse, y cómo viene cada proyecto.
 *
 * Antes esto eran seis métricas, una lista de «lo que hay que mirar» y un
 * gráfico de barras. Se reemplazaron porque respondían «cuántos hay» cuando la
 * pregunta de esta pantalla es «cuál toco ahora»: un clic en cualquier fila
 * abre la ficha del proyecto con ese ítem marcado.
 */
function Tablero({ cartera, compromisos, recordatorios, hoy, navegar }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Tres cuartos para los compromisos, un cuarto para los recordatorios. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_1fr] xl:items-start">
        <TablaCompromisos compromisos={compromisos} navegar={navegar} />
        <PanelRecordatorios recordatorios={recordatorios} hoy={hoy} navegar={navegar} />
      </div>

      <Tarjeta
        titulo="Proyectos estratégicos en curso"
        descripcion="Se lee de la base maestra de proyectos, filtrado por los declarados estratégicos — no es una lista fija. Hacé clic en una tarjeta para abrir su ficha."
        sinPadding
      >
        {cartera.length === 0 ? (
          <div className="p-4">
            <Vacio
              compacto
              icono={Gem}
              titulo="Sin proyectos estratégicos"
              descripcion="Declará uno desde el botón de arriba, o promové un candidato desde la pestaña «Promover»."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {cartera.map((p) => (
              <button
                key={p.id_proyecto}
                type="button"
                onClick={() => navegar(`/estrategicos/${encodeURIComponent(p.id_proyecto)}`)}
                className="flex flex-col gap-2 rounded-chip border border-borde p-3 text-left transition-colors hover:border-acento/50 hover:bg-acento/5"
              >
                <h3 className="flex items-start gap-2 text-sm font-semibold leading-tight text-tinta">
                  <span className="mt-1">
                    <Semaforo nivel={p.nivel_estrategico} soloPunto />
                  </span>
                  {p.proyecto}
                </h3>
                <EstadoProyecto estado={p.estado} />
                {p.observaciones && (
                  <p className="line-clamp-3 text-xs leading-relaxed text-gris">{p.observaciones}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {p.compromisos_vencidos > 0 && (
                    <Chip tono="vencido">{p.compromisos_vencidos} vencido(s)</Chip>
                  )}
                  {p.recordatorios > 0 && (
                    <Chip tono="atencion">
                      {p.recordatorios} recordatorio{p.recordatorios === 1 ? '' : 's'}
                    </Chip>
                  )}
                </div>
                {p.ultima_actualizacion && (
                  <p className="mt-auto text-[11px] text-tenue">
                    Actualizado {fFecha(p.ultima_actualizacion)}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

/** Prioridad del proyecto, con el color de la escala del portal. */
const NIVEL_PRIORIDAD = { alta: 'vencido', media: 'proximo', baja: 'enregla' };

function TablaCompromisos({ compromisos, navegar }) {
  const columnas = [
    {
      clave: 'descripcion',
      titulo: 'Compromiso',
      render: (f) => (
        <div className="flex min-w-40 items-start gap-2">
          <span className="mt-1.5">
            <Semaforo
              nivel={f.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(f.dias_restantes)}
              soloPunto
              texto={f.estado_efectivo}
            />
          </span>
          <div>
            <p className="leading-tight text-tinta">{f.descripcion}</p>
            <p className="text-[11px] text-tenue">Origen: {f.origen_tipo}</p>
          </div>
        </div>
      ),
    },
    {
      clave: 'proyecto',
      titulo: 'Proyecto',
      ancho: 170,
      render: (f) => (
        <div>
          <p className="leading-tight">{f.proyecto}</p>
          <p className="tabular text-[11px] text-tenue">{f.id_proyecto}</p>
        </div>
      ),
    },
    // Un compromiso sin secretaría muestra un guion, no un hueco: el espacio
    // en blanco se lee como un error de carga.
    {
      clave: 'area',
      titulo: 'Área',
      ancho: 160,
      render: (f) => f.area || <span className="text-tenue">—</span>,
    },
    {
      clave: 'prioridad',
      titulo: 'Prioridad',
      ancho: 110,
      render: (f) =>
        f.prioridad ? (
          <Semaforo nivel={NIVEL_PRIORIDAD[f.prioridad] ?? 'sindato'} texto={f.prioridad} />
        ) : (
          <span className="text-tenue">—</span>
        ),
    },
    {
      clave: 'fecha_limite',
      titulo: 'Vence',
      ancho: 100,
      render: (f) =>
        f.fecha_limite ? (
          <span className="tabular text-xs">{fFecha(f.fecha_limite)}</span>
        ) : (
          <span className="text-tenue">—</span>
        ),
      formatoCSV: fFecha,
    },
    {
      clave: 'estado_efectivo',
      titulo: 'Estado',
      ancho: 120,
      render: (f) => <Semaforo nivel={nivelPorDias(f.dias_restantes)} texto={leyendaPlazo(f)} />,
    },
  ];

  return (
    <Tarjeta
      titulo="Compromisos pendientes de la cartera estratégica"
      descripcion="Vigentes, no recortados por período: son estado, no historia. Lo vencido se reconoce por la columna Estado. Un clic en la fila abre la ficha del proyecto."
      sinPadding
    >
      <Tabla
        nombreExport="compromisos-estrategicos"
        filas={compromisos}
        conBusqueda={false}
        columnas={columnas}
        alHacerClicFila={(f) =>
          navegar(
            `/estrategicos/${encodeURIComponent(f.id_proyecto)}?compromiso=${encodeURIComponent(f.id)}`,
          )
        }
        vacio={
          <Vacio
            compacto
            icono={Star}
            titulo="Sin compromisos pendientes"
            descripcion="La cartera estratégica no tiene compromisos vigentes sin cumplir."
          />
        }
      />
    </Tarjeta>
  );
}

function leyendaPlazo(c) {
  if (c.dias_restantes === null || c.dias_restantes === undefined) return 'sin fecha';
  if (c.dias_restantes < 0) return `${Math.abs(c.dias_restantes)} días`;
  if (c.dias_restantes === 0) return 'vence hoy';
  return `en ${c.dias_restantes} días`;
}

/**
 * El cuarto restante: las notas que llevan fecha, de todos los proyectos de la
 * cartera. Lo más urgente arriba.
 */
function PanelRecordatorios({ recordatorios, hoy, navegar }) {
  return (
    <Tarjeta titulo="Recordatorios" descripcion="Notas con fecha. Lo más urgente arriba." sinPadding>
      {recordatorios.length === 0 ? (
        <div className="p-4">
          <Vacio
            compacto
            icono={BookOpen}
            titulo="Sin recordatorios"
            descripcion="Una nota con fecha, cargada en la ficha de un proyecto, aparece acá."
          />
        </div>
      ) : (
        <ul className="divide-y divide-borde/70">
          {recordatorios.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() =>
                  navegar(
                    `/estrategicos/${encodeURIComponent(r.id_proyecto)}?nota=${encodeURIComponent(r.id)}`,
                  )
                }
                style={{ borderLeftColor: `var(--color-${r.nivel})` }}
                className="w-full border-l-[3px] px-3.5 py-2.5 text-left transition-colors hover:bg-acento/5"
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <Semaforo nivel={r.nivel} texto={leyendaRecordatorio(r)} />
                  <span className="tabular text-[10px] text-tenue">{fFecha(r.fecha_recordatorio)}</span>
                </div>
                <p className="text-[11.5px] font-semibold leading-tight text-tinta">{r.proyecto}</p>
                <p className="mt-0.5 line-clamp-3 text-[11.5px] leading-snug text-gris">{r.texto}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

function leyendaRecordatorio(r) {
  if (r.dias_restantes === null) return 'sin fecha';
  if (r.dias_restantes < 0) return `venció hace ${Math.abs(r.dias_restantes)} días`;
  if (r.dias_restantes === 0) return 'vence hoy';
  return `vence en ${r.dias_restantes} días`;
}

/* ── Cartera ────────────────────────────────────────────────────────── */

function PanelCartera({ cartera, filtros, setFiltros, alEditar, alRegistrarNovedad, alQuitar }) {
  const navegar = useNavigate();
  const opcionesArea = useOpciones('areas');
  const elegido = filtros.proyecto ? cartera.find((p) => p.id_proyecto === filtros.proyecto) : null;

  return (
    <div className="flex flex-col gap-4">
      <TarjetaFiltros
        filtros={filtros}
        defaults={DEFAULTS}
        claves={CLAVES_FILTRO}
        alLimpiar={() => limpiarClaves(setFiltros, DEFAULTS, CLAVES_FILTRO)}
      >
        <GrillaFiltros columnas={3}>
          <CampoSelect etiqueta="Área" opciones={opcionesArea} value={filtros.area} onChange={(e) => setFiltros({ area: e.target.value })} placeholder="Todas" />
        </GrillaFiltros>
      </TarjetaFiltros>

      <Tarjeta sinPadding>
        <Tabla
          nombreExport="proyectos-estrategicos"
          filas={cartera}
          columnas={[
            {
              clave: 'proyecto',
              titulo: 'Proyecto',
              render: (p) => (
                <div className="flex min-w-0 items-center gap-2">
                  <Semaforo nivel={p.nivel_estrategico} soloPunto />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-tinta">{p.proyecto}</p>
                    <p className="truncate text-[11px] text-tenue">
                      {p.id_proyecto} · {p.area}
                    </p>
                  </div>
                </div>
              ),
            },
            { clave: 'descripcion_estrategica', titulo: 'Descripción', ancho: 260 },
            { clave: 'estado', titulo: 'Estado', ancho: 130, render: (p) => <EstadoProyecto estado={p.estado} /> },
            {
              clave: 'dias_sin_novedad',
              titulo: 'Sin novedades',
              ancho: 120,
              alinear: 'derecha',
              render: (p) =>
                p.dias_sin_novedad === null ? (
                  <span className="text-tenue">—</span>
                ) : (
                  <span className={`tabular text-sm ${p.dias_sin_novedad > UMBRALES.DIAS_ESTRATEGICO_SIN_NOVEDAD ? 'text-vencido-texto' : 'text-tinta'}`}>
                    {p.dias_sin_novedad} d
                  </span>
                ),
            },
            {
              clave: 'compromisos_vencidos',
              titulo: 'Vencidos',
              ancho: 100,
              alinear: 'derecha',
              render: (p) => (p.compromisos_vencidos ? <Chip tono="vencido">{p.compromisos_vencidos}</Chip> : <span className="text-tenue">—</span>),
            },
          ]}
          alHacerClicFila={(p) => setFiltros({ proyecto: p.id_proyecto })}
          vacio={
            <Vacio
              icono={Gem}
              titulo="Sin proyectos estratégicos"
              descripcion="Declarar uno lo pone bajo vigilancia más estricta: quince días sin novedades ya alertan."
              accion={{ texto: 'Ver candidatos', icono: ArrowUpCircle, alHacerClic: () => setFiltros({ tab: 'promover' }) }}
            />
          }
        />
      </Tarjeta>

      {elegido && (
        <Tarjeta
          titulo={elegido.proyecto}
          descripcion={`${elegido.id_proyecto} · ${elegido.area}`}
          acciones={
            <>
              <Boton tamanio="sm" onClick={() => navegar(`/proyectos/${elegido.id_proyecto}`)}>
                Abrir ficha
              </Boton>
              <Boton tamanio="sm" icono={BookOpen} onClick={() => alRegistrarNovedad(elegido)}>
                Registrar novedad
              </Boton>
              <Boton tamanio="sm" icono={Pencil} onClick={() => alEditar(elegido)}>
                Editar
              </Boton>
              <Boton tamanio="sm" icono={XCircle} onClick={() => alQuitar(elegido)}>
                Sacar de la cartera
              </Boton>
              <Boton tamanio="sm" variante="fantasma" onClick={() => setFiltros({ proyecto: '' })}>
                Cerrar
              </Boton>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tono="neutro">{ETIQUETA_ORIGEN[elegido.origen_estrategico] ?? 'Base maestra'}</Chip>
              <EstadoProyecto estado={elegido.estado} />
            </div>

            {elegido.descripcion_estrategica && (
              <Aviso tono="info" titulo="Descripción del proyecto">
                {elegido.descripcion_estrategica}
              </Aviso>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <Dato titulo="Declarado el" valor={elegido.fecha_marcado_estrategico ? fFecha(elegido.fecha_marcado_estrategico) : '—'} />
              <Dato titulo="Fin previsto" valor={fFecha(elegido.fecha_fin_prevista)} />
              <Dato titulo="Avance" valor={`${numero(elegido.avance)} / ${numero(elegido.objetivo)} ${elegido.unidad}`} />
              <Dato titulo="Monto planificado" valor={moneda(elegido.monto_planificado)} />
              <Dato titulo="Monto ejecutado" valor={moneda(elegido.monto_ejecutado)} />
              <Dato titulo="Compromisos abiertos" valor={`${elegido.compromisos_abiertos} (${elegido.compromisos_vencidos} vencidos)`} />
            </dl>

            {elegido.compromiso_publico && (
              <Aviso tono="info" titulo="Compromiso público">
                {elegido.compromiso_publico}
              </Aviso>
            )}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}

function Dato({ titulo, valor }) {
  return (
    <div>
      <dt className="text-[11px] text-tenue">{titulo}</dt>
      <dd className="tabular text-sm text-tinta">{valor}</dd>
    </div>
  );
}

/* ── Promover ───────────────────────────────────────────────────────── */

function PanelPromover({ candidatos, filtros, setFiltros, alPromover }) {
  const opcionesArea = useOpciones('areas');

  return (
    <div className="flex flex-col gap-4">
      <Aviso tono="info" titulo="De dónde sale esta lista">
        Son temas de monitoreo de criticidad alta sin resolver y seguimientos que informaron
        problemas, agrupados por proyecto y sin los que ya son estratégicos. Un proyecto con varias
        señales es un candidato más fuerte que uno con una sola: por eso la lista se ordena por ahí.
      </Aviso>

      <TarjetaFiltros
        filtros={filtros}
        defaults={DEFAULTS}
        claves={CLAVES_FILTRO}
        alLimpiar={() => limpiarClaves(setFiltros, DEFAULTS, CLAVES_FILTRO)}
      >
        <GrillaFiltros columnas={2}>
          <CampoSelect etiqueta="Área" opciones={opcionesArea} value={filtros.area} onChange={(e) => setFiltros({ area: e.target.value })} placeholder="Todas" />
          <CampoSelect
            etiqueta="Origen de la señal"
            opciones={[
              { valor: 'monitoreo', titulo: 'Monitoreo' },
              { valor: 'seguimiento', titulo: 'Seguimiento' },
            ]}
            value={filtros.origen_tipo}
            onChange={(e) => setFiltros({ origen_tipo: e.target.value })}
            placeholder="Los dos"
          />
        </GrillaFiltros>
      </TarjetaFiltros>

      <Tarjeta sinPadding>
        <Tabla
          nombreExport="candidatos-estrategicos"
          filas={candidatos}
          claveFila={(c) => c.clave}
          columnas={[
            {
              clave: 'titulo',
              titulo: 'Señal',
              render: (c) => (
                <div className="min-w-0">
                  <p className="truncate text-sm text-tinta">{c.titulo}</p>
                  <p className="truncate text-[11px] text-tenue">{c.detalle}</p>
                </div>
              ),
            },
            {
              clave: 'proyecto',
              titulo: 'Proyecto',
              ancho: 220,
              render: (c) =>
                c.proyecto ? (
                  <div className="min-w-0">
                    <p className="truncate text-sm text-tinta">{c.proyecto}</p>
                    <p className="text-[11px] text-tenue">{c.id_proyecto}</p>
                  </div>
                ) : (
                  <Chip tono="atencion">sin proyecto vinculado</Chip>
                ),
            },
            { clave: 'area', titulo: 'Área', ancho: 200 },
            {
              clave: 'senales',
              titulo: 'Señales',
              ancho: 100,
              alinear: 'derecha',
              render: (c) => <Chip tono={c.senales > 2 ? 'vencido' : c.senales > 1 ? 'proximo' : 'neutro'}>{c.senales}</Chip>,
            },
            {
              clave: 'origen_tipo',
              titulo: 'Origen',
              ancho: 130,
              render: (c) => (
                <div className="flex flex-wrap gap-1">
                  {c.origenes.map((o) => (
                    <Chip key={o} tono="neutro">
                      {ETIQUETA_ORIGEN[o]}
                    </Chip>
                  ))}
                </div>
              ),
            },
            { clave: 'fecha', titulo: 'Fecha', ancho: 110, formatoCSV: fFecha, render: (c) => fFecha(c.fecha) },
            {
              clave: 'promover',
              titulo: '',
              ancho: 130,
              sinOrdenar: true,
              sinExportar: true,
              render: (c) => (
                <Boton tamanio="sm" variante="primario" icono={ArrowUpCircle} onClick={() => alPromover(c)}>
                  Promover
                </Boton>
              ),
            },
          ]}
          vacio={
            <Vacio
              icono={Radar}
              titulo="Sin candidatos"
              descripcion="No hay temas críticos sin resolver ni seguimientos con problemas fuera de la cartera estratégica."
            />
          }
        />
      </Tarjeta>
    </div>
  );
}
