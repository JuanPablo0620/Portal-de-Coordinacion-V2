/**
 * ─────────────────────────────────────────────────────────────────────
 * MÓDULO DE OBRAS.
 *
 * La obra ya vivía en la base maestra —es un proyecto con `es_obra`—, pero se
 * miraba con las herramientas de la cartera general: una fila más entre
 * programas sociales y compras. Este módulo la mira como obra, que es otra
 * pregunta: DÓNDE está, en qué zona se acumulan las demoras y cuáles ya
 * pasaron su fin previsto.
 *
 * Nada de acá guarda datos propios: todo sale de la base maestra y del motor
 * central de alertas. Si una obra aparece vencida acá, aparece vencida en el
 * inicio y en monitoreo, con los mismos días de atraso.
 * ─────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  HardHat,
  Layers,
  Map as MapaIcono,
  MapPinOff,
  Plus,
  Table2,
  TrendingUp,
} from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import {
  BarraAvance,
  Boton,
  Buscador,
  Chip,
  EstadoProyecto,
  Metrica,
  Pestanias,
  Prioridad,
  Semaforo,
  Tarjeta,
  Vacio,
} from '../../componentes/Basicos.jsx';
import { Alternadores, GrillaFiltros, TarjetaFiltros, limpiarClaves } from '../../componentes/Filtros.jsx';
import { CampoSelect } from '../../componentes/Campo.jsx';
import { GraficoBarras } from '../../componentes/Graficos.jsx';
import { ListaAlertas } from '../../componentes/ListaAlertas.jsx';
import { MapaObras } from '../../componentes/MapaObras.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { FormularioProyecto } from '../proyectos/FormularioProyecto.jsx';
import { ESTADOS_PROYECTO, PRIORIDADES } from '../../datos/catalogos.js';
import { ETIQUETAS_ALERTA, ORDEN_TIPOS, alertasPorTipo, calcularAlertas } from '../../datos/alertas.js';
import {
  hoyISO,
  obras as selObras,
  obrasPorZona,
  resumenObras,
  zonasDeObras,
} from '../../datos/selectores.js';
import { fecha as fFecha, moneda, numero, textoVencimiento } from '../../utilidades/formato.js';
import { useBD } from '../../estado/tienda.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';

const DEFAULTS = {
  tab: 'mapa',
  area: '',
  zona: '',
  estado: '',
  prioridad: '',
  buscar: '',
  solo_activas: true,
  solo_vencidas: false,
  solo_sin_ubicar: false,
  obra: '',
};

/** Claves que limpia el botón: las de filtro, nunca la pestaña ni la selección. */
const CLAVES_FILTRO = ['area', 'zona', 'estado', 'prioridad', 'buscar', 'solo_activas', 'solo_vencidas', 'solo_sin_ubicar'];

export default function Obras() {
  const bd = useBD();
  const hoy = hoyISO();
  const navegar = useNavigate();
  const [filtros, setFiltros] = useFiltrosUrl(DEFAULTS);
  const [formulario, setFormulario] = useState(false);

  const opcionesArea = useOpciones('areas');
  const zonas = useMemo(() => (bd ? zonasDeObras(bd) : []), [bd]);

  /**
   * La lista es UNA sola y la comparten el mapa, el listado, el desagregado por
   * zona y los contadores. Cada vista calculando la suya era la forma segura de
   * que el mapa mostrara doce puntos mientras el contador decía quince.
   */
  const lista = useMemo(() => {
    if (!bd) return [];
    const texto = (filtros.buscar ?? '').trim().toLowerCase();
    return selObras(
      bd,
      {
        area: filtros.area,
        zona: filtros.zona,
        estado: filtros.estado,
        prioridad: filtros.prioridad,
        solo_activos: filtros.solo_activas,
        solo_sin_ubicar: filtros.solo_sin_ubicar,
      },
      hoy,
    )
      .filter((o) => (filtros.solo_vencidas ? o.dias_al_fin !== null && o.dias_al_fin < 0 && o.estado !== 'finalizado' : true))
      .filter(
        (o) =>
          !texto ||
          `${o.proyecto} ${o.id_proyecto} ${o.zona} ${o.responsable ?? ''}`.toLowerCase().includes(texto),
      );
  }, [bd, filtros, hoy]);

  const resumen = useMemo(() => resumenObras(lista), [lista]);
  const porZona = useMemo(() => obrasPorZona(lista), [lista]);

  /** Alertas del motor central que caen sobre alguna de las obras listadas. */
  const alertas = useMemo(() => {
    if (!bd) return [];
    const ids = new Set(lista.map((o) => o.id_proyecto));
    return calcularAlertas(bd, hoy).filter((a) => a.id_proyecto && ids.has(a.id_proyecto));
  }, [bd, lista, hoy]);

  const seleccionada = useMemo(
    () => lista.find((o) => o.id_proyecto === filtros.obra) ?? null,
    [lista, filtros.obra],
  );

  const hayObras = (bd?.proyectos ?? []).some((p) => p.activo !== false && p.es_obra);

  const pestanias = [
    { valor: 'mapa', titulo: 'Mapa', icono: MapaIcono },
    { valor: 'listado', titulo: 'Listado', icono: Table2 },
    { valor: 'zonas', titulo: 'Por zona', icono: Layers, cantidad: porZona.length },
    { valor: 'alertas', titulo: 'Alertas', icono: AlertTriangle, cantidad: alertas.length },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Obras"
        descripcion="Las obras de la base maestra, desagregadas por zona, por estado y por plazo."
        acciones={
          <>
            <Boton icono={ExternalLink} onClick={() => navegar('/proyectos?es_obra=1')}>
              Ver en la base maestra
            </Boton>
            <Boton variante="primario" icono={Plus} onClick={() => setFormulario(true)}>
              Cargar obra
            </Boton>
          </>
        }
      />

      <Pagina className="flex flex-col gap-4">
        {!hayObras ? (
          <Tarjeta>
            <Vacio
              icono={HardHat}
              titulo="No hay ninguna obra cargada"
              descripcion="Una obra es un proyecto de la base maestra marcado como obra: el tipo «Obra» lo marca solo. Cargá la primera para ver el mapa y el desagregado por zona."
              accion={{ texto: 'Cargar obra', icono: Plus, alHacerClic: () => setFormulario(true) }}
            />
          </Tarjeta>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
              <Metrica icono={HardHat} valor={resumen.activas} etiqueta="Obras activas" detalle={`${resumen.total} en la vista`} />
              <Metrica valor={resumen.en_ejecucion} etiqueta="En ejecución" />
              <Metrica
                valor={resumen.demoradas}
                etiqueta="Demoradas"
                tono={resumen.demoradas ? 'vencido' : 'neutro'}
                icono={AlertTriangle}
              />
              <Metrica
                valor={resumen.vencidas}
                etiqueta="Con fin previsto vencido"
                tono={resumen.vencidas ? 'vencido' : 'neutro'}
                detalle={`${resumen.por_vencer} vencen en ≤7 d`}
              />
              <Metrica
                valor={resumen.sin_ubicar}
                etiqueta="Sin ubicar en el mapa"
                icono={MapPinOff}
                detalle={resumen.sin_ubicar ? 'les falta latitud y longitud' : 'todas ubicadas'}
              />
              <Metrica
                icono={TrendingUp}
                valor={`${resumen.avance_promedio}%`}
                etiqueta="Avance agregado"
                detalle={`${moneda(resumen.monto_planificado)} planificados`}
              />
            </div>

            <TarjetaFiltros
              filtros={filtros}
              defaults={DEFAULTS}
              claves={CLAVES_FILTRO}
              alLimpiar={() => limpiarClaves(setFiltros, DEFAULTS, CLAVES_FILTRO)}
            >
              <GrillaFiltros columnas={5}>
                <CampoSelect
                  etiqueta="Área"
                  opciones={opcionesArea}
                  value={filtros.area}
                  onChange={(e) => setFiltros({ area: e.target.value })}
                  placeholder="Todas"
                />
                <CampoSelect
                  etiqueta="Zona"
                  opciones={zonas}
                  value={filtros.zona}
                  onChange={(e) => setFiltros({ zona: e.target.value })}
                  placeholder="Todas"
                />
                <CampoSelect
                  etiqueta="Estado"
                  opciones={ESTADOS_PROYECTO}
                  value={filtros.estado}
                  onChange={(e) => setFiltros({ estado: e.target.value })}
                  placeholder="Todos"
                />
                <CampoSelect
                  etiqueta="Prioridad"
                  opciones={PRIORIDADES}
                  value={filtros.prioridad}
                  onChange={(e) => setFiltros({ prioridad: e.target.value })}
                  placeholder="Todas"
                />
                <Buscador
                  etiqueta="Buscar obra"
                  valor={filtros.buscar}
                  alCambiar={(v) => setFiltros({ buscar: v })}
                  placeholder="Nombre, id, zona o responsable"
                />
              </GrillaFiltros>
              <Alternadores
                filtros={filtros}
                setFiltros={setFiltros}
                opciones={[
                  ['solo_activas', 'Sólo activas', 'Planificadas, en ejecución o demoradas'],
                  ['solo_vencidas', 'Sólo vencidas', 'Fin previsto ya pasado'],
                  ['solo_sin_ubicar', 'Sólo sin ubicar', 'Obras sin coordenadas cargadas'],
                ]}
              >
                <span className="tabular ml-1 text-xs text-tenue">
                  {lista.length} obra{lista.length === 1 ? '' : 's'} en la vista
                </span>
              </Alternadores>
            </TarjetaFiltros>

            <Pestanias opciones={pestanias} valor={filtros.tab} alCambiar={(v) => setFiltros({ tab: v })} />

            {/* Primero lo que elige la pestaña. Las alertas van al final: son el
                contexto de lo que se está mirando, no lo primero que empuja el
                contenido fuera de pantalla. */}
            {filtros.tab === 'mapa' && (
              <PanelMapa
                lista={lista}
                resumen={resumen}
                seleccionada={seleccionada}
                alSeleccionar={(o) => setFiltros({ obra: o.id_proyecto })}
                alCerrarDetalle={() => setFiltros({ obra: '' })}
                navegar={navegar}
              />
            )}
            {filtros.tab === 'listado' && <PanelListado lista={lista} navegar={navegar} />}
            {filtros.tab === 'zonas' && (
              <PanelZonas porZona={porZona} alAbrirZona={(z) => setFiltros({ zona: z, tab: 'listado' })} />
            )}

            {filtros.tab === 'alertas' ? (
              <AlertasDeObras alertas={alertas} />
            ) : (
              <AlertasDeObras alertas={alertas} compacto />
            )}
          </>
        )}
      </Pagina>

      {formulario && <FormularioProyecto abierto alCerrar={() => setFormulario(false)} proyecto={null} />}
    </>
  );
}

/* ── Mapa ───────────────────────────────────────────────────────────── */

function PanelMapa({ lista, resumen, seleccionada, alSeleccionar, alCerrarDetalle, navegar }) {
  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo="Dónde están las obras"
        descripcion="Un punto por obra ubicada, con el color del plazo. Se puede hacer clic para ver su ficha resumida."
        acciones={
          resumen.sin_ubicar > 0 && (
            <Chip tono="atencion">
              {resumen.sin_ubicar} sin ubicar
            </Chip>
          )
        }
      >
        <MapaObras obras={lista} seleccionada={seleccionada} alSeleccionar={alSeleccionar} />
      </Tarjeta>

      {seleccionada && (
        <Tarjeta
          titulo={seleccionada.proyecto}
          descripcion={[seleccionada.zona || 'Sin zona cargada', seleccionada.area].filter(Boolean).join(' · ')}
          acciones={
            <>
              <Boton tamanio="sm" variante="fantasma" onClick={alCerrarDetalle}>
                Cerrar
              </Boton>
              <Boton
                tamanio="sm"
                icono={ArrowRight}
                onClick={() => navegar(`/proyectos/${seleccionada.id_proyecto}`)}
              >
                Abrir ficha
              </Boton>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Dato titulo="Estado">
              <EstadoProyecto estado={seleccionada.estado} />
            </Dato>
            <Dato titulo="Fin previsto">
              <Semaforo nivel={seleccionada.nivel} texto={fFecha(seleccionada.fecha_fin_prevista)} />
              <p className="mt-0.5 text-[11px] text-tenue">{textoVencimiento(seleccionada.dias_al_fin)}</p>
            </Dato>
            <Dato titulo="Avance">
              <BarraAvance valor={seleccionada.porcentaje_avance} />
              <p className="tabular mt-0.5 text-[11px] text-tenue">
                {numero(seleccionada.avance)} / {numero(seleccionada.objetivo)} {seleccionada.unidad}
              </p>
            </Dato>
            <Dato titulo="Presupuesto">
              <p className="tabular text-sm text-tinta">{moneda(seleccionada.monto_planificado)}</p>
              <p className="tabular text-[11px] text-tenue">
                {moneda(seleccionada.monto_ejecutado)} ejecutados
              </p>
            </Dato>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}

function Dato({ titulo, children }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">{titulo}</p>
      {children}
    </div>
  );
}

/* ── Listado desagregado ────────────────────────────────────────────── */

function PanelListado({ lista, navegar }) {
  return (
    <Tarjeta sinPadding>
      <Tabla
        nombreExport="obras"
        filas={lista}
        claveFila={(f) => f.id_proyecto}
        columnas={[
          { clave: 'id_proyecto', titulo: 'ID', ancho: 130, render: (f) => <Chip tono="acento">{f.id_proyecto}</Chip> },
          {
            clave: 'proyecto',
            titulo: 'Obra',
            render: (f) => (
              <div className="min-w-40">
                <p className="font-medium leading-tight text-tinta">{f.proyecto}</p>
                <p className="text-[11px] text-tenue">{f.area}</p>
              </div>
            ),
          },
          {
            clave: 'zona',
            titulo: 'Zona',
            ancho: 150,
            render: (f) =>
              f.zona ? (
                <span className="text-xs text-tinta">{f.zona}</span>
              ) : (
                <span className="text-tenue">sin zona</span>
              ),
          },
          { clave: 'estado', titulo: 'Estado', ancho: 120, render: (f) => <EstadoProyecto estado={f.estado} /> },
          { clave: 'prioridad', titulo: 'Prioridad', ancho: 95, render: (f) => <Prioridad nivel={f.prioridad} /> },
          {
            clave: 'porcentaje_avance',
            titulo: 'Avance',
            ancho: 150,
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
            ancho: 140,
            render: (f) => <Semaforo nivel={f.nivel} texto={fFecha(f.fecha_fin_prevista)} />,
            formatoCSV: fFecha,
          },
          { clave: 'responsable', titulo: 'Responsable', ancho: 130 },
          {
            clave: 'monto_planificado',
            titulo: 'Planificado',
            ancho: 120,
            alinear: 'derecha',
            render: (f) => <span className="text-xs">{moneda(f.monto_planificado)}</span>,
          },
          {
            clave: 'ubicada',
            titulo: 'Mapa',
            ancho: 100,
            render: (f) =>
              f.ubicada ? <Chip tono="enregla">ubicada</Chip> : <Chip tono="atencion">sin ubicar</Chip>,
            formatoCSV: (v) => (v ? 'ubicada' : 'sin ubicar'),
          },
        ]}
        alHacerClicFila={(f) => navegar(`/proyectos/${f.id_proyecto}`)}
        vacio={
          <Vacio
            icono={HardHat}
            titulo="Ninguna obra coincide con los filtros"
            descripcion="Probá limpiando los filtros o ampliando la búsqueda."
          />
        }
      />
    </Tarjeta>
  );
}

/* ── Desagregado por zona ───────────────────────────────────────────── */

function PanelZonas({ porZona, alAbrirZona }) {
  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo="Obras por zona"
        descripcion="Las zonas con obras vencidas se ordenan primero: es donde hay que meterse."
      >
        <GraficoBarras
          datos={porZona}
          clave="zona"
          horizontal
          anchoEtiqueta={190}
          alto={Math.max(220, porZona.length * 30)}
          series={[
            { clave: 'activas', titulo: 'Activas' },
            { clave: 'vencidas', titulo: 'Vencidas', color: 'var(--color-vencido)' },
          ]}
        />
      </Tarjeta>

      <Tarjeta sinPadding>
        <Tabla
          nombreExport="obras-por-zona"
          filas={porZona}
          claveFila={(f) => f.zona}
          columnas={[
            { clave: 'zona', titulo: 'Zona' },
            { clave: 'total', titulo: 'Obras', ancho: 90, alinear: 'derecha' },
            { clave: 'activas', titulo: 'Activas', ancho: 90, alinear: 'derecha' },
            {
              clave: 'vencidas',
              titulo: 'Vencidas',
              ancho: 100,
              alinear: 'derecha',
              render: (f) => (f.vencidas ? <Chip tono="vencido">{f.vencidas}</Chip> : <span className="text-tenue">0</span>),
            },
            {
              clave: 'porcentaje_avance',
              titulo: 'Avance agregado',
              ancho: 170,
              render: (f) => <BarraAvance valor={f.porcentaje_avance} />,
            },
            {
              clave: 'monto',
              titulo: 'Planificado',
              ancho: 140,
              alinear: 'derecha',
              render: (f) => <span className="text-xs">{moneda(f.monto)}</span>,
            },
            {
              clave: 'ubicadas',
              titulo: 'En el mapa',
              ancho: 110,
              alinear: 'derecha',
              render: (f) => (
                <span className="tabular text-xs text-gris">
                  {f.ubicadas}/{f.total}
                </span>
              ),
            },
          ]}
          alHacerClicFila={(f) => alAbrirZona(f.zona === 'Sin zona cargada' ? '' : f.zona)}
          vacio={<Vacio compacto icono={Layers} titulo="Sin zonas para agrupar" />}
        />
      </Tarjeta>
    </div>
  );
}

/* ── Alertas ────────────────────────────────────────────────────────── */

/**
 * Las alertas que caen sobre las obras de la vista. Salen del motor central sin
 * recalcular nada: son las mismas del inicio y del panel de monitoreo.
 */
function AlertasDeObras({ alertas, compacto = false }) {
  const grupos = useMemo(() => alertasPorTipo(alertas), [alertas]);
  const tipos = ORDEN_TIPOS.filter((t) => grupos[t]?.length);

  if (!alertas.length) {
    if (compacto) return null;
    return (
      <Tarjeta titulo="Alertas de obras">
        <Vacio
          compacto
          icono={AlertTriangle}
          titulo="Sin alertas sobre las obras de la vista"
          descripcion="Ninguna obra listada tiene compromisos vencidos, fin previsto superado, temas críticos abiertos ni falta de novedades."
        />
      </Tarjeta>
    );
  }

  return (
    <Tarjeta
      titulo="Alertas de obras"
      descripcion="Salen del motor central de alertas, acotadas a las obras que se están viendo."
      acciones={<Chip tono="vencido">{alertas.length}</Chip>}
    >
      {/* Cada grupo es una caja con borde propio, no una celda de una grilla
          separada por líneas: con un número impar de grupos, la celda que sobra
          se veía como un bloque gris vacío al lado del último. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {tipos.map((tipo) => (
          <div key={tipo} className="rounded-chip border border-borde py-2">
            <p className="px-4 pb-1 text-xs font-semibold text-tinta">
              {ETIQUETAS_ALERTA[tipo]} <span className="tabular font-normal text-tenue">({grupos[tipo].length})</span>
            </p>
            <ListaAlertas alertas={grupos[tipo]} limite={compacto ? 3 : 10} />
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}
