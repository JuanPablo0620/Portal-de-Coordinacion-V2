import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, Building2, ListChecks, Plus, Radar } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Boton, Chip, Criticidad, Metrica, Pestanias, Tarjeta, Vacio } from '../../componentes/Basicos.jsx';
import { GraficoBarras } from '../../componentes/Graficos.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { CampoSelect } from '../../componentes/Campo.jsx';
import { CargarMonitoreo } from './CargarMonitoreo.jsx';
import { PanelAlertas } from './PanelAlertas.jsx';
import { TableroSecretarias } from './TableroSecretarias.jsx';
import { calcularAlertas } from '../../datos/alertas.js';
import { hoyISO, monitoreos as selMonitoreos, monitoreosPorArea } from '../../datos/selectores.js';
import { fecha as fFecha } from '../../utilidades/formato.js';
import { useBD } from '../../estado/tienda.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';
import { SelectorPeriodo, resolverPeriodo } from './periodo.jsx';

const DEFAULTS = { tab: 'secretarias', area: '', periodo: '', desde: '', hasta: '', secretaria: '', buscar: '' };

export default function Monitoreo() {
  const bd = useBD();
  const hoy = hoyISO();
  const [filtros, setFiltros] = useFiltrosUrl(DEFAULTS);

  // Un solo período para todo el módulo: las tres pestañas miran la misma
  // ventana, así que cambiar de pestaña no cambia lo que se está contando.
  const rango = useMemo(() => resolverPeriodo(filtros, hoy), [filtros, hoy]);

  const alertas = useMemo(() => (bd ? calcularAlertas(bd, hoy) : []), [bd, hoy]);

  const pestanias = [
    { valor: 'secretarias', titulo: 'Por secretaría', icono: Building2 },
    { valor: 'ultimos', titulo: 'Últimos monitoreos', icono: ListChecks },
    { valor: 'cobertura', titulo: 'Cobertura', icono: BarChart3 },
    { valor: 'cargar', titulo: 'Cargar monitoreo', icono: Plus },
    { valor: 'alertas', titulo: 'Alertas', icono: AlertTriangle, cantidad: alertas.length },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Monitoreo"
        descripcion="Registro estandarizado del día a día, desagregado por secretaría y distinto del seguimiento formal por proyecto."
        acciones={
          <Boton variante="primario" icono={Plus} onClick={() => setFiltros({ tab: 'cargar' })}>
            Nuevo monitoreo
          </Boton>
        }
      />

      <Pagina className="flex flex-col gap-4">
        <Pestanias
          opciones={pestanias}
          valor={filtros.tab}
          alCambiar={(v) => setFiltros({ tab: v, secretaria: '' })}
        />

        {/* El panel de alertas está siempre visible en el módulo, como pide la
            spec, pero en «Por secretaría» va DEBAJO del tablero: arriba empuja
            la grilla más de mil píxeles hacia abajo y la desagregación —que es
            el punto de la pestaña— deja de verse al entrar. Además, cada
            secretaría ya muestra sus propias alertas en su tarjeta y en su hoja. */}
        {filtros.tab !== 'alertas' && filtros.tab !== 'secretarias' && (
          <PanelAlertas compacto limitePorGrupo={4} />
        )}

        {/* Las alertas ya están calculadas para el contador de la pestaña: se
            pasan en lugar de recalcularlas, que recorre la base entera. */}
        {filtros.tab === 'secretarias' && (
          <>
            <TableroSecretarias bd={bd} filtros={filtros} setFiltros={setFiltros} alertas={alertas} rango={rango} />
            {!filtros.secretaria && <PanelAlertas compacto limitePorGrupo={3} />}
          </>
        )}
        {filtros.tab === 'ultimos' && <PanelUltimos bd={bd} filtros={filtros} setFiltros={setFiltros} rango={rango} hoy={hoy} />}
        {filtros.tab === 'cobertura' && <PanelCobertura bd={bd} filtros={filtros} setFiltros={setFiltros} rango={rango} hoy={hoy} />}
        {/* `key` fuerza el remonte al cambiar de área: el formulario toma el
            área inicial al montar, y sin esto llegar desde otra secretaría
            reutilizaría el estado del formulario anterior. */}
        {filtros.tab === 'cargar' && (
          <CargarMonitoreo
            key={filtros.area}
            areaInicial={filtros.area}
            alTerminar={() => setFiltros({ tab: 'ultimos' })}
          />
        )}
        {filtros.tab === 'alertas' && <PanelAlertas />}
      </Pagina>
    </>
  );
}

/* ── Últimos monitoreos ─────────────────────────────────────────────── */

function PanelUltimos({ bd, filtros, setFiltros, rango, hoy }) {
  const navegar = useNavigate();
  const opcionesArea = useOpciones('areas');
  const filas = useMemo(
    () => (bd ? selMonitoreos(bd, { area: filtros.area, desde: rango.desde, hasta: rango.hasta }) : []),
    [bd, filtros.area, rango],
  );

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Filtros">
        <div className="mb-3">
          <CampoSelect etiqueta="Área" opciones={opcionesArea} value={filtros.area} onChange={(e) => setFiltros({ area: e.target.value })} placeholder="Todas" />
        </div>
        <SelectorPeriodo filtros={filtros} setFiltros={setFiltros} rango={rango} hoy={hoy} />
      </Tarjeta>

      <Tarjeta sinPadding>
        <Tabla
          nombreExport="monitoreos"
          filas={filas}
          columnas={[
            { clave: 'fecha', titulo: 'Fecha', ancho: 110, render: (f) => fFecha(f.fecha), formatoCSV: fFecha },
            { clave: 'area', titulo: 'Área', ancho: 220 },
            { clave: 'cantidad_temas', titulo: 'Temas', ancho: 80, alinear: 'derecha' },
            {
              clave: 'criticidad_maxima',
              titulo: 'Criticidad máxima',
              ancho: 150,
              render: (f) => <Criticidad nivel={f.criticidad_maxima} />,
            },
            {
              clave: 'accionables',
              titulo: 'Con acción',
              ancho: 110,
              alinear: 'derecha',
              valorOrden: (f) => f.temas.filter((t) => t.requiere_accion).length,
              render: (f) => {
                const n = f.temas.filter((t) => t.requiere_accion).length;
                return n ? <Chip tono="proximo">{n}</Chip> : <span className="text-tenue">—</span>;
              },
            },
            {
              clave: 'sin_resolver',
              titulo: 'Sin resolver',
              ancho: 110,
              alinear: 'derecha',
              valorOrden: (f) => f.temas.filter((t) => !t.resuelto).length,
              render: (f) => {
                const n = f.temas.filter((t) => !t.resuelto).length;
                return n ? <Chip tono="vencido">{n}</Chip> : <Chip tono="enregla">0</Chip>;
              },
            },
            { clave: 'creado_por', titulo: 'Cargado por', ancho: 130 },
          ]}
          alHacerClicFila={(f) => setFiltros({ monitoreo: f.id })}
          vacio={
            <Vacio
              icono={Radar}
              titulo="Sin monitoreos registrados"
              descripcion="Cargá el primero para dejar asentado lo que pasa día a día en cada área."
              accion={{ texto: 'Nuevo monitoreo', icono: Plus, alHacerClic: () => setFiltros({ tab: 'cargar' }) }}
            />
          }
        />
      </Tarjeta>

      {filtros.monitoreo && <DetalleMonitoreo bd={bd} id={filtros.monitoreo} navegar={navegar} />}
    </div>
  );
}

function DetalleMonitoreo({ bd, id, navegar }) {
  const monitoreo = useMemo(() => selMonitoreos(bd, {}).find((m) => m.id === id), [bd, id]);
  if (!monitoreo) return null;

  return (
    <Tarjeta
      titulo={`Temas del monitoreo del ${fFecha(monitoreo.fecha)}`}
      descripcion={monitoreo.area}
      sinPadding
    >
      <Tabla
        nombreExport={`temas-monitoreo-${monitoreo.fecha}`}
        filas={monitoreo.temas}
        conBusqueda={false}
        columnas={[
          { clave: 'categoria', titulo: 'Categoría', ancho: 180 },
          { clave: 'descripcion', titulo: 'Tema' },
          { clave: 'criticidad', titulo: 'Criticidad', ancho: 110, render: (f) => <Criticidad nivel={f.criticidad} /> },
          {
            clave: 'id_proyecto',
            titulo: 'Proyecto',
            ancho: 130,
            render: (f) =>
              f.id_proyecto ? (
                <button type="button" onClick={() => navegar(`/proyectos/${f.id_proyecto}`)}>
                  <Chip tono="acento">{f.id_proyecto}</Chip>
                </button>
              ) : (
                <span className="text-tenue">—</span>
              ),
          },
          {
            clave: 'requiere_accion',
            titulo: 'Acción',
            ancho: 150,
            render: (f) =>
              f.requiere_accion ? (
                <div>
                  <Chip tono="proximo">{f.responsable || 'sin responsable'}</Chip>
                  {f.fecha_limite && <p className="tabular mt-0.5 text-[11px] text-tenue">{fFecha(f.fecha_limite)}</p>}
                </div>
              ) : (
                <span className="text-tenue">—</span>
              ),
          },
          {
            clave: 'resuelto',
            titulo: 'Estado',
            ancho: 110,
            render: (f) => (f.resuelto ? <Chip tono="enregla">resuelto</Chip> : <Chip tono="vencido">sin resolver</Chip>),
          },
        ]}
      />
    </Tarjeta>
  );
}

/* ── Cobertura comparada entre secretarías ──────────────────────────── */

function PanelCobertura({ bd, filtros, setFiltros, rango, hoy }) {
  const datos = useMemo(
    () => (bd ? monitoreosPorArea(bd, { desde: rango.desde, hasta: rango.hasta }) : []),
    [bd, rango],
  );

  const sinCobertura = datos.filter((d) => d.cantidad === 0);
  const total = datos.reduce((s, d) => s + d.cantidad, 0);

  /** Ir a la hoja de esa secretaría: la comparación sólo sirve si se puede entrar. */
  const abrirHoja = (area) => setFiltros({ tab: 'secretarias', secretaria: area });

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Período">
        <SelectorPeriodo filtros={filtros} setFiltros={setFiltros} rango={rango} hoy={hoy} />
      </Tarjeta>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metrica valor={total} etiqueta="Monitoreos en el período" />
        <Metrica valor={datos.length - sinCobertura.length} etiqueta="Secretarías con cobertura" />
        <Metrica
          valor={sinCobertura.length}
          etiqueta="Secretarías sin cobertura"
          tono={sinCobertura.length ? 'vencido' : 'neutro'}
          detalle={sinCobertura.length ? 'sin ningún monitoreo registrado' : 'todas cubiertas'}
        />
      </div>

      <Tarjeta
        titulo="Monitoreos por secretaría"
        descripcion="Las que no tienen monitoreos aparecen en cero y en rojo: es justamente lo que hay que detectar."
      >
        <GraficoBarras
          datos={datos}
          clave="area"
          horizontal
          anchoEtiqueta={200}
          alto={Math.max(220, datos.length * 34)}
          series={[
            {
              clave: 'cantidad',
              titulo: 'Monitoreos',
              colorPorItem: (d) => (d.cantidad === 0 ? 'var(--color-vencido)' : 'var(--color-serie-1)'),
            },
          ]}
        />
      </Tarjeta>

      <Tarjeta sinPadding>
        <Tabla
          nombreExport="monitoreos-por-secretaria"
          filas={datos}
          claveFila={(f) => f.area}
          conBusqueda={false}
          columnas={[
            { clave: 'area', titulo: 'Secretaría' },
            { clave: 'cantidad', titulo: 'Monitoreos', ancho: 120, alinear: 'derecha' },
            {
              clave: 'cobertura',
              titulo: 'Cobertura',
              ancho: 140,
              sinOrdenar: true,
              valorOrden: (f) => f.cantidad,
              render: (f) =>
                f.cantidad === 0 ? <Chip tono="vencido">sin cobertura</Chip> : <Chip tono="enregla">cubierta</Chip>,
            },
          ]}
          alHacerClicFila={(f) => abrirHoja(f.area)}
          vacio={<Vacio compacto icono={BarChart3} titulo="Sin secretarías en el catálogo" />}
        />
      </Tarjeta>
    </div>
  );
}
