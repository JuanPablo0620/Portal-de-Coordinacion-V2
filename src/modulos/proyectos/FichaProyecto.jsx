import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, ClipboardList, FileText, History, Pencil, Target, Trash2 } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import {
  BarraAvance,
  Boton,
  Chip,
  Criticidad,
  EstadoProyecto,
  Prioridad,
  Semaforo,
  Tarjeta,
  Vacio,
  nivelPorDias,
} from '../../componentes/Basicos.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { Pestanias } from '../../componentes/Basicos.jsx';
import { ModalConfirmacion } from '../../componentes/Modal.jsx';
import { FormularioProyecto } from './FormularioProyecto.jsx';
import {
  compromisos as selCompromisos,
  historialProyecto,
  hoyISO,
  planificacionDe,
  proyectoPorId,
  seguimientos as selSeguimientos,
  serieAvance,
  activos,
} from '../../datos/selectores.js';
import { fecha as fFecha, fechaHora, haceCuanto, moneda, numero } from '../../utilidades/formato.js';
import { acciones, useBD } from '../../estado/tienda.js';

export default function FichaProyecto() {
  const { id } = useParams();
  const bd = useBD();
  const navegar = useNavigate();
  const hoy = hoyISO();
  const [pestania, setPestania] = useState('datos');
  const [editando, setEditando] = useState(false);
  const [confirmarBaja, setConfirmarBaja] = useState(false);

  const proyecto = useMemo(() => (bd ? proyectoPorId(bd, id) : null), [bd, id]);
  const sus = useMemo(() => (bd ? selSeguimientos(bd, { id_proyecto: id }) : []), [bd, id]);
  const coms = useMemo(() => (bd ? selCompromisos(bd, { id_proyecto: id }, hoy) : []), [bd, id, hoy]);
  const temas = useMemo(
    () => (bd ? activos(bd.temas_monitoreo).filter((t) => t.id_proyecto === id) : []),
    [bd, id],
  );
  const plan = useMemo(() => (bd ? planificacionDe(bd, id, Number(hoy.slice(0, 4))) : null), [bd, id, hoy]);
  const historial = useMemo(() => (bd ? historialProyecto(bd, id) : []), [bd, id]);
  const serie = useMemo(() => (bd ? serieAvance(bd, id) : []), [bd, id]);

  if (!proyecto) {
    return (
      <>
        <EncabezadoPagina titulo="Proyecto no encontrado" />
        <Pagina>
          <Tarjeta>
            <Vacio
              titulo="No existe un proyecto con ese identificador"
              descripcion="Puede haber sido dado de baja o el enlace estar mal escrito."
              accion={{ texto: 'Volver al listado', alHacerClic: () => navegar('/proyectos') }}
            />
          </Tarjeta>
        </Pagina>
      </>
    );
  }

  const pestanias = [
    { valor: 'datos', titulo: 'Datos', icono: FileText },
    { valor: 'seguimientos', titulo: 'Seguimientos', icono: CalendarCheck, cantidad: sus.length },
    { valor: 'compromisos', titulo: 'Compromisos', icono: ClipboardList, cantidad: coms.length },
    { valor: 'planificacion', titulo: 'Planificación', icono: Target },
    { valor: 'historial', titulo: 'Historial', icono: History, cantidad: historial.length },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo={proyecto.proyecto}
        descripcion={`${proyecto.area}${proyecto.programa ? ` · ${proyecto.programa}` : ''}`}
        acciones={
          <>
            <Boton icono={ArrowLeft} onClick={() => navegar('/proyectos')}>
              Volver
            </Boton>
            <Boton icono={Pencil} onClick={() => setEditando(true)}>
              Editar
            </Boton>
            <Boton variante="fantasma" icono={Trash2} onClick={() => setConfirmarBaja(true)} title="Baja lógica: el registro se conserva">
              Dar de baja
            </Boton>
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip tono="acento">{proyecto.id_proyecto}</Chip>
          <EstadoProyecto estado={proyecto.estado} />
          <Prioridad nivel={proyecto.prioridad} />
          {proyecto.es_obra && <Chip tono="neutro">Obra</Chip>}
          <div className="min-w-40 flex-1 sm:max-w-64">
            <BarraAvance valor={proyecto.porcentaje_avance} />
          </div>
          <span className="tabular text-xs text-gris">
            {numero(proyecto.avance)} / {numero(proyecto.objetivo)} {proyecto.unidad}
          </span>
        </div>
      </EncabezadoPagina>

      <Pagina className="flex flex-col gap-4">
        <Pestanias opciones={pestanias} valor={pestania} alCambiar={setPestania} />

        {pestania === 'datos' && <PanelDatos proyecto={proyecto} serie={serie} temas={temas} />}

        {pestania === 'seguimientos' && (
          <Tarjeta sinPadding>
            <Tabla
              nombreExport={`seguimientos-${proyecto.id_proyecto}`}
              filas={sus}
              columnas={[
                { clave: 'fecha', titulo: 'Fecha', ancho: 100, render: (f) => fFecha(f.fecha), formatoCSV: fFecha },
                { clave: 'tipo', titulo: 'Tipo', ancho: 110, render: (f) => <Chip tono={f.tipo === 'programado' ? 'acento' : 'neutro'}>{f.tipo}</Chip> },
                { clave: 'area', titulo: 'Área', ancho: 180 },
                { clave: 'participantes', titulo: 'Participantes' },
                { clave: 'resumen', titulo: 'Resumen' },
              ]}
              vacio={
                <Vacio
                  icono={CalendarCheck}
                  titulo="Sin seguimientos registrados"
                  descripcion="Los seguimientos que incluyan este proyecto van a aparecer acá."
                  accion={{ texto: 'Ir a Seguimiento', alHacerClic: () => navegar('/seguimiento?tab=cargar') }}
                />
              }
            />
          </Tarjeta>
        )}

        {pestania === 'compromisos' && (
          <Tarjeta sinPadding>
            <Tabla
              nombreExport={`compromisos-${proyecto.id_proyecto}`}
              filas={coms}
              columnas={COLUMNAS_COMPROMISO}
              vacio={
                <Vacio
                  icono={ClipboardList}
                  titulo="Sin compromisos"
                  descripcion="Los compromisos generados en seguimientos, monitoreos o mesas que refieran a este proyecto aparecen acá."
                />
              }
            />
          </Tarjeta>
        )}

        {pestania === 'planificacion' && <PanelPlanificacion plan={plan} proyecto={proyecto} navegar={navegar} />}

        {pestania === 'historial' && <PanelHistorial historial={historial} />}
      </Pagina>

      {editando && <FormularioProyecto abierto alCerrar={() => setEditando(false)} proyecto={proyecto} />}
      <ModalConfirmacion
        abierto={confirmarBaja}
        alCerrar={() => setConfirmarBaja(false)}
        alConfirmar={async () => {
          await acciones.bajaProyecto(proyecto.id_proyecto);
          navegar('/proyectos');
        }}
        titulo="Dar de baja el proyecto"
        mensaje="El borrado es lógico: el registro y todo su historial se conservan, pero el proyecto deja de aparecer en listados, gráficos y alertas. ¿Confirmás?"
        textoConfirmar="Dar de baja"
        variante="peligro"
      />
    </>
  );
}

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
        texto={f.estado_efectivo === 'vencido' ? `vencido · ${f.dias_atraso} d` : f.estado_efectivo}
      />
    ),
  },
];

function PanelDatos({ proyecto, serie, temas }) {
  const campos = [
    ['Área', proyecto.area],
    ['Programa', proyecto.programa],
    ['Eje estratégico', proyecto.eje],
    ['Tipo', proyecto.tipo],
    ['Responsable', proyecto.responsable],
    ['Unidad de medida', proyecto.unidad],
    ['Cantidad del período', numero(proyecto.cantidad)],
    ['Objetivo', `${numero(proyecto.objetivo)} ${proyecto.unidad ?? ''}`],
    ['Avance acumulado', `${numero(proyecto.avance)} ${proyecto.unidad ?? ''}`],
    ['Fecha de carga', fFecha(proyecto.fecha_carga)],
    ['Fecha de inicio', fFecha(proyecto.fecha_inicio)],
    ['Fin previsto', fFecha(proyecto.fecha_fin_prevista)],
    ['Monto planificado', moneda(proyecto.monto_planificado)],
    ['Monto ejecutado', moneda(proyecto.monto_ejecutado)],
    ['Última actualización', proyecto.ultima_actualizacion ? `${fFecha(proyecto.ultima_actualizacion)} · ${haceCuanto(proyecto.ultima_actualizacion)}` : 'Sin novedades'],
    ['Cargado por', proyecto.creado_por],
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Tarjeta titulo="Datos del proyecto" className="lg:col-span-2">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2">
          {campos.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex items-baseline justify-between gap-3 border-b border-borde/60 py-1.5">
              <dt className="shrink-0 text-xs text-gris">{etiqueta}</dt>
              <dd className="truncate text-right text-sm text-tinta">{valor || '—'}</dd>
            </div>
          ))}
        </dl>
        {proyecto.observaciones && (
          <div className="mt-3 rounded-chip bg-paper p-3">
            <p className="mb-1 text-xs font-semibold text-gris">Observaciones</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-tinta">{proyecto.observaciones}</p>
          </div>
        )}
      </Tarjeta>

      <div className="flex flex-col gap-4">
        <Tarjeta titulo="Evolución del avance" descripcion="Leída de la bitácora del proyecto.">
          {serie.length < 2 ? (
            <Vacio compacto titulo="Sin serie histórica" descripcion="Hace falta más de una actualización de avance registrada." />
          ) : (
            <ul className="flex flex-col gap-2">
              {serie.slice(-6).map((punto, i) => (
                <li key={`${punto.fecha}-${i}`} className="flex items-center gap-2.5">
                  <span className="tabular w-20 shrink-0 text-xs text-gris">{fFecha(punto.fecha)}</span>
                  <BarraAvance
                    valor={proyecto.objetivo ? (punto.avance / proyecto.objetivo) * 100 : 0}
                    mostrarValor={false}
                  />
                  <span className="tabular w-14 shrink-0 text-right text-xs text-tinta">{numero(punto.avance)}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Temas de monitoreo" descripcion="Temas registrados que refieren a este proyecto.">
          {temas.length === 0 ? (
            <Vacio compacto titulo="Sin temas registrados" />
          ) : (
            <ul className="flex flex-col gap-2">
              {temas.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-start gap-2 border-b border-borde/60 pb-2 last:border-0 last:pb-0">
                  <Criticidad nivel={t.criticidad} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-tight text-tinta">{t.descripcion}</p>
                    <p className="text-[11px] text-tenue">
                      {t.categoria} {t.resuelto ? '· resuelto' : '· sin resolver'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}

function PanelPlanificacion({ plan, proyecto, navegar }) {
  if (!plan) {
    return (
      <Tarjeta>
        <Vacio
          icono={Target}
          titulo="Sin planificación cargada para el año en curso"
          descripcion="Cargá meta anual, desagregación trimestral, monto e hitos para que este proyecto entre en el comparativo y en el ranking de desvíos."
          accion={{ texto: 'Ir a Planificación', alHacerClic: () => navegar(`/planificacion?tab=carga&proyecto=${proyecto.id_proyecto}`) }}
        />
      </Tarjeta>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Tarjeta titulo={`Planificación ${plan.anio}`}>
        <dl className="flex flex-col">
          <div className="flex items-baseline justify-between border-b border-borde/60 py-1.5">
            <dt className="text-xs text-gris">Meta anual</dt>
            <dd className="tabular text-sm text-tinta">
              {numero(plan.meta_anual)} {proyecto.unidad}
            </dd>
          </div>
          <div className="flex items-baseline justify-between border-b border-borde/60 py-1.5">
            <dt className="text-xs text-gris">Monto planificado</dt>
            <dd className="tabular text-sm text-tinta">{moneda(plan.monto_planificado)}</dd>
          </div>
        </dl>
        <p className="mb-1.5 mt-3 text-xs font-semibold text-gris">Metas trimestrales</p>
        <div className="grid grid-cols-4 gap-2">
          {(plan.metas_trimestrales ?? []).map((meta, i) => {
            const cumple = Number(proyecto.avance) >= Number(meta);
            return (
              <div key={i} className="rounded-chip border border-borde p-2 text-center">
                <p className="text-[11px] text-tenue">T{i + 1}</p>
                <p className="tabular text-sm font-semibold text-tinta">{numero(meta)}</p>
                <Semaforo nivel={cumple ? 'enregla' : 'atencion'} texto={cumple ? 'cumple' : 'pendiente'} />
              </div>
            );
          })}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Hitos" descripcion="Alimentan los próximos vencimientos del inicio.">
        {(plan.hitos ?? []).length === 0 ? (
          <Vacio compacto titulo="Sin hitos cargados" />
        ) : (
          <ul className="flex flex-col">
            {plan.hitos.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 border-b border-borde/60 py-2 last:border-0">
                <span className="min-w-0 flex-1 truncate text-sm text-tinta">{h.descripcion}</span>
                <span className="tabular shrink-0 text-xs text-gris">{fFecha(h.fecha)}</span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}

const ETIQUETA_ACCION = { alta: 'creó', edicion: 'editó', baja: 'dio de baja' };
const ETIQUETA_ENTIDAD = {
  proyectos: 'el proyecto',
  seguimientos: 'un seguimiento',
  compromisos: 'un compromiso',
  temas_monitoreo: 'un tema de monitoreo',
  monitoreos: 'un monitoreo',
  eventos: 'un evento',
  planificacion_anual: 'la planificación',
  mesas: 'una mesa',
  reuniones_mesa: 'una reunión de mesa',
  requerimientos_evento: 'un requerimiento',
};

function PanelHistorial({ historial }) {
  return (
    <Tarjeta
      titulo="Historial de cambios"
      descripcion="Ninguna edición borra el registro anterior: todo cambio queda asentado."
    >
      {historial.length === 0 ? (
        <Vacio compacto icono={History} titulo="Sin movimientos registrados" />
      ) : (
        <ol className="flex flex-col">
          {historial.map((h) => (
            <li key={h.id} className="flex gap-3 border-b border-borde/60 py-2.5 last:border-0">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-acento-medio" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-tinta">
                  <strong className="font-medium">{h.creado_por}</strong> {ETIQUETA_ACCION[h.accion] ?? h.accion}{' '}
                  {ETIQUETA_ENTIDAD[h.entidad] ?? h.entidad}
                </p>
                {(h.cambios ?? []).length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {h.cambios.map((c, i) => (
                      <li key={i} className="text-xs text-gris">
                        <span className="font-medium text-tinta">{c.campo}</span>:{' '}
                        <span className="text-tenue line-through">{formatoValor(c.antes)}</span> →{' '}
                        <span className="text-tinta">{formatoValor(c.despues)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-0.5 text-[11px] text-tenue">
                  {fechaHora(h.creado_en)} · {haceCuanto(h.creado_en)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Tarjeta>
  );
}

function formatoValor(v) {
  if (v === null || v === undefined || v === '') return '(vacío)';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '(vacío)';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
