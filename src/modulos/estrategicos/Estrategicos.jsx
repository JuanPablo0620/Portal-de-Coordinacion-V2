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
} from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import {
  Aviso,
  BarraAvance,
  Boton,
  Chip,
  EstadoProyecto,
  Metrica,
  Pestanias,
  Semaforo,
  Tarjeta,
  Vacio,
} from '../../componentes/Basicos.jsx';
import { GraficoBarras } from '../../componentes/Graficos.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { CampoSelect, GrillaCampos } from '../../componentes/Campo.jsx';
import { ModalConfirmacion } from '../../componentes/Modal.jsx';
import { FormularioEstrategico } from './FormularioEstrategico.jsx';
import { PRIORIDADES, UMBRALES } from '../../datos/catalogos.js';
import {
  candidatosEstrategicos,
  hoyISO,
  proyectosEstrategicos,
  resumenEstrategico,
} from '../../datos/selectores.js';
import { fecha as fFecha, moneda, numero } from '../../utilidades/formato.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';
import { acciones as repo, useBD } from '../../estado/tienda.js';

const DEFAULTS = {
  tab: 'tablero',
  area: '',
  prioridad_estrategica: '',
  motivo_estrategico: '',
  estado: '',
  origen_tipo: '',
  proyecto: '',
};

const ETIQUETA_ORIGEN = { base: 'Base maestra', monitoreo: 'Monitoreo', seguimiento: 'Seguimiento' };

export default function Estrategicos() {
  const bd = useBD();
  const hoy = hoyISO();
  const [filtros, setFiltros] = useFiltrosUrl(DEFAULTS);
  const [formulario, setFormulario] = useState(null);
  const [aQuitar, setAQuitar] = useState(null);

  const criterios = useMemo(
    () => ({
      area: filtros.area,
      prioridad_estrategica: filtros.prioridad_estrategica,
      motivo_estrategico: filtros.motivo_estrategico,
      estado: filtros.estado,
    }),
    [filtros],
  );

  const cartera = useMemo(() => (bd ? proyectosEstrategicos(bd, criterios, hoy) : []), [bd, criterios, hoy]);
  const resumen = useMemo(() => (bd ? resumenEstrategico(bd, criterios, hoy) : null), [bd, criterios, hoy]);
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

        {filtros.tab === 'tablero' && <Tablero resumen={resumen} cartera={cartera} setFiltros={setFiltros} />}
        {filtros.tab === 'cartera' && (
          <PanelCartera
            cartera={cartera}
            filtros={filtros}
            setFiltros={setFiltros}
            alEditar={(p) => setFormulario({ proyecto: p })}
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

function Tablero({ resumen, cartera, setFiltros }) {
  if (!resumen) return null;

  const porNivel = [
    { clave: 'vencido', titulo: 'Con compromisos vencidos o plazo superado' },
    { clave: 'proximo', titulo: 'Con temas críticos o sin novedades' },
    { clave: 'atencion', titulo: 'Con el fin previsto a menos de 30 días' },
    { clave: 'enregla', titulo: 'En regla' },
  ].map((n) => ({ ...n, cantidad: resumen.por_nivel[n.clave] ?? 0 }));

  const porPrioridad = PRIORIDADES.map((p) => ({
    nombre: p,
    cantidad: resumen.por_prioridad[p] ?? 0,
  }));

  const enRiesgo = cartera.filter((p) => ['vencido', 'proximo'].includes(p.nivel_estrategico)).slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica valor={resumen.total} etiqueta="Proyectos estratégicos" icono={Gem} detalle={`${resumen.activos} activos · ${resumen.finalizados} finalizados`} />
        <Metrica
          valor={resumen.en_riesgo}
          etiqueta="En riesgo"
          tono={resumen.en_riesgo ? 'vencido' : 'neutro'}
          detalle="con vencidos, temas críticos o sin novedades"
          alHacerClic={() => setFiltros({ tab: 'cartera' })}
        />
        <Metrica
          valor={resumen.sin_novedad}
          etiqueta={`Sin novedades hace más de ${UMBRALES.DIAS_ESTRATEGICO_SIN_NOVEDAD} días`}
          detalle="la mitad del umbral del resto de la cartera"
        />
        <Metrica valor={`${resumen.avance_promedio}%`} etiqueta="Avance agregado" detalle={`ejecución presupuestaria ${resumen.ejecucion}%`} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metrica valor={resumen.compromisos_vencidos} etiqueta="Compromisos vencidos" tono={resumen.compromisos_vencidos ? 'vencido' : 'neutro'} />
        <Metrica valor={resumen.compromisos_abiertos} etiqueta="Compromisos abiertos" />
        <Metrica valor={resumen.temas_criticos} etiqueta="Temas críticos sin resolver" />
      </div>

      <Tarjeta
        titulo="Lo que hay que mirar esta semana"
        descripcion="Ordenado por gravedad. Si esta lista está vacía, la cartera está al día."
        sinPadding
      >
        {enRiesgo.length === 0 ? (
          <div className="p-4">
            <Vacio compacto icono={Star} titulo="Nada en riesgo" descripcion="Ningún proyecto estratégico tiene compromisos vencidos, temas críticos ni silencio prolongado." />
          </div>
        ) : (
          <ul className="divide-y divide-borde/60">
            {enRiesgo.map((p) => (
              <li key={p.id_proyecto} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Semaforo nivel={p.nivel_estrategico} soloPunto />
                <button
                  type="button"
                  onClick={() => setFiltros({ tab: 'cartera', proyecto: p.id_proyecto })}
                  className="min-w-40 flex-1 text-left"
                >
                  <p className="text-sm font-medium leading-tight text-tinta">{p.proyecto}</p>
                  <p className="text-[11px] text-tenue">
                    {p.id_proyecto} · {p.area}
                  </p>
                </button>
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.compromisos_vencidos > 0 && <Chip tono="vencido">{p.compromisos_vencidos} vencido(s)</Chip>}
                  {p.temas_criticos > 0 && <Chip tono="proximo">{p.temas_criticos} tema(s) crítico(s)</Chip>}
                  {p.dias_sin_novedad !== null && p.dias_sin_novedad > UMBRALES.DIAS_ESTRATEGICO_SIN_NOVEDAD && (
                    <Chip tono="atencion">{p.dias_sin_novedad} días sin novedades</Chip>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Tarjeta titulo="Estado de la cartera" descripcion="Con el semáforo propio de lo estratégico.">
          <GraficoBarras
            datos={porNivel}
            clave="clave"
            horizontal
            anchoEtiqueta={90}
            alto={220}
            series={[
              {
                clave: 'cantidad',
                titulo: 'Proyectos',
                colorPorItem: (d) => `var(--color-${d.clave})`,
              },
            ]}
          />
          <ul className="mt-2 flex flex-col gap-0.5">
            {porNivel.map((n) => (
              <li key={n.clave} className="text-[11px] text-tenue">
                <span className="font-medium text-gris">{n.clave}</span> · {n.titulo}
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta titulo="Por qué son estratégicos" descripcion="El motivo declarado al momento de promoverlos.">
          <GraficoBarras
            datos={resumen.por_motivo}
            horizontal
            anchoEtiqueta={210}
            alto={Math.max(220, resumen.por_motivo.length * 30)}
            series={[{ clave: 'cantidad', titulo: 'Proyectos' }]}
          />
        </Tarjeta>
      </div>

      <Tarjeta titulo="Por prioridad estratégica" descripcion="No todos los estratégicos pesan igual.">
        <GraficoBarras datos={porPrioridad} alto={200} series={[{ clave: 'cantidad', titulo: 'Proyectos' }]} />
      </Tarjeta>
    </div>
  );
}

/* ── Cartera ────────────────────────────────────────────────────────── */

function PanelCartera({ cartera, filtros, setFiltros, alEditar, alQuitar }) {
  const navegar = useNavigate();
  const opcionesArea = useOpciones('areas');
  const opcionesMotivo = useOpciones('motivos_estrategicos');
  const elegido = filtros.proyecto ? cartera.find((p) => p.id_proyecto === filtros.proyecto) : null;

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Filtros">
        <GrillaCampos columnas={3}>
          <CampoSelect etiqueta="Área" opciones={opcionesArea} value={filtros.area} onChange={(e) => setFiltros({ area: e.target.value })} placeholder="Todas" />
          <CampoSelect
            etiqueta="Prioridad estratégica"
            opciones={PRIORIDADES}
            value={filtros.prioridad_estrategica}
            onChange={(e) => setFiltros({ prioridad_estrategica: e.target.value })}
            placeholder="Todas"
          />
          <CampoSelect
            etiqueta="Motivo"
            opciones={opcionesMotivo}
            value={filtros.motivo_estrategico}
            onChange={(e) => setFiltros({ motivo_estrategico: e.target.value })}
            placeholder="Todos"
          />
        </GrillaCampos>
      </Tarjeta>

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
            {
              clave: 'prioridad_estrategica',
              titulo: 'Prioridad',
              ancho: 110,
              render: (p) => (
                <Chip tono={p.prioridad_estrategica === 'alta' ? 'vencido' : p.prioridad_estrategica === 'media' ? 'atencion' : 'neutro'}>
                  {p.prioridad_estrategica || '—'}
                </Chip>
              ),
            },
            { clave: 'motivo_estrategico', titulo: 'Motivo', ancho: 200 },
            {
              clave: 'origen_estrategico',
              titulo: 'Origen',
              ancho: 130,
              render: (p) => <Chip tono="neutro">{ETIQUETA_ORIGEN[p.origen_estrategico] ?? 'Base maestra'}</Chip>,
            },
            { clave: 'estado', titulo: 'Estado', ancho: 130, render: (p) => <EstadoProyecto estado={p.estado} /> },
            {
              clave: 'porcentaje_avance',
              titulo: 'Avance',
              ancho: 130,
              render: (p) => <BarraAvance valor={p.porcentaje_avance} compacta />,
            },
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
              <Chip tono="acento">prioridad {elegido.prioridad_estrategica || 'sin definir'}</Chip>
              {elegido.motivo_estrategico && <Chip tono="neutro">{elegido.motivo_estrategico}</Chip>}
              <Chip tono="neutro">{ETIQUETA_ORIGEN[elegido.origen_estrategico] ?? 'Base maestra'}</Chip>
              <EstadoProyecto estado={elegido.estado} />
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <Dato titulo="Responsable político" valor={elegido.responsable_politico || '—'} />
              <Dato titulo="Fecha comprometida" valor={elegido.fecha_compromiso ? fFecha(elegido.fecha_compromiso) : '—'} />
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

      <Tarjeta titulo="Filtros">
        <GrillaCampos columnas={2}>
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
        </GrillaCampos>
      </Tarjeta>

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
