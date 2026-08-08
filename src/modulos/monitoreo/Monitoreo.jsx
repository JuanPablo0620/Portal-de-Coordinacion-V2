import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, ListChecks, Plus, Radar } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Boton, Chip, Criticidad, Metrica, Pestanias, Tarjeta, Vacio } from '../../componentes/Basicos.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { CampoFecha, CampoSelect } from '../../componentes/Campo.jsx';
import { CargarMonitoreo } from './CargarMonitoreo.jsx';
import { PanelAlertas } from './PanelAlertas.jsx';
import { calcularAlertas } from '../../datos/alertas.js';
import { hoyISO, monitoreos as selMonitoreos, monitoreosPorArea } from '../../datos/selectores.js';
import { fecha as fFecha } from '../../utilidades/formato.js';
import { useBD } from '../../estado/tienda.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';

const DEFAULTS = { tab: 'ultimos', area: '', desde: '', hasta: '' };

export default function Monitoreo() {
  const bd = useBD();
  const hoy = hoyISO();
  const [filtros, setFiltros] = useFiltrosUrl(DEFAULTS);

  const alertas = useMemo(() => (bd ? calcularAlertas(bd, hoy) : []), [bd, hoy]);

  const pestanias = [
    { valor: 'ultimos', titulo: 'Últimos monitoreos', icono: ListChecks },
    { valor: 'cobertura', titulo: 'Por área', icono: BarChart3 },
    { valor: 'cargar', titulo: 'Cargar monitoreo', icono: Plus },
    { valor: 'alertas', titulo: 'Alertas', icono: AlertTriangle, cantidad: alertas.length },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Monitoreo"
        descripcion="Registro estandarizado del día a día, distinto del seguimiento formal por proyecto."
        acciones={
          <Boton variante="primario" icono={Plus} onClick={() => setFiltros({ tab: 'cargar' })}>
            Nuevo monitoreo
          </Boton>
        }
      />

      <Pagina className="flex flex-col gap-4">
        <Pestanias opciones={pestanias} valor={filtros.tab} alCambiar={(v) => setFiltros({ tab: v })} />

        {/* El panel de alertas está siempre visible en el módulo, como pide la spec. */}
        {filtros.tab !== 'alertas' && <PanelAlertas compacto limitePorGrupo={4} />}

        {filtros.tab === 'ultimos' && <PanelUltimos bd={bd} filtros={filtros} setFiltros={setFiltros} />}
        {filtros.tab === 'cobertura' && <PanelCobertura bd={bd} filtros={filtros} setFiltros={setFiltros} />}
        {filtros.tab === 'cargar' && <CargarMonitoreo alTerminar={() => setFiltros({ tab: 'ultimos' })} />}
        {filtros.tab === 'alertas' && <PanelAlertas />}
      </Pagina>
    </>
  );
}

/* ── Últimos monitoreos ─────────────────────────────────────────────── */

function PanelUltimos({ bd, filtros, setFiltros }) {
  const navegar = useNavigate();
  const opcionesArea = useOpciones('areas');
  const filas = useMemo(
    () => (bd ? selMonitoreos(bd, { area: filtros.area, desde: filtros.desde, hasta: filtros.hasta }) : []),
    [bd, filtros],
  );

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Filtros">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CampoSelect etiqueta="Área" opciones={opcionesArea} value={filtros.area} onChange={(e) => setFiltros({ area: e.target.value })} placeholder="Todas" />
          <CampoFecha etiqueta="Desde" value={filtros.desde} onChange={(e) => setFiltros({ desde: e.target.value })} />
          <CampoFecha etiqueta="Hasta" value={filtros.hasta} onChange={(e) => setFiltros({ hasta: e.target.value })} />
        </div>
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

/* ── Cobertura por área ─────────────────────────────────────────────── */

function PanelCobertura({ bd, filtros, setFiltros }) {
  const datos = useMemo(
    () => (bd ? monitoreosPorArea(bd, { desde: filtros.desde, hasta: filtros.hasta }) : []),
    [bd, filtros.desde, filtros.hasta],
  );

  const sinCobertura = datos.filter((d) => d.cantidad === 0);
  const total = datos.reduce((s, d) => s + d.cantidad, 0);

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Período">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-lg">
          <CampoFecha etiqueta="Desde" value={filtros.desde} onChange={(e) => setFiltros({ desde: e.target.value })} />
          <CampoFecha etiqueta="Hasta" value={filtros.hasta} onChange={(e) => setFiltros({ hasta: e.target.value })} />
        </div>
      </Tarjeta>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metrica valor={total} etiqueta="Monitoreos en el período" />
        <Metrica valor={datos.length - sinCobertura.length} etiqueta="Áreas con cobertura" />
        <Metrica
          valor={sinCobertura.length}
          etiqueta="Áreas sin cobertura"
          tono={sinCobertura.length ? 'vencido' : 'neutro'}
          detalle={sinCobertura.length ? 'sin ningún monitoreo registrado' : 'todas cubiertas'}
        />
      </div>

      <Tarjeta
        titulo="Monitoreos por área"
        descripcion="Las áreas sin monitoreos aparecen en cero: es justamente lo que hay que detectar."
      >
        {datos.length === 0 ? (
          <Vacio compacto icono={BarChart3} titulo="Sin áreas en el catálogo" />
        ) : (
          <div style={{ width: '100%', height: Math.max(220, datos.length * 34) }}>
            <ResponsiveContainer>
              <BarChart data={datos} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-borde)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-gris)' }} />
                <YAxis
                  type="category"
                  dataKey="area"
                  width={200}
                  tick={{ fontSize: 11, fill: 'var(--color-gris)' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-borde)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => [v, 'Monitoreos']}
                />
                <Bar dataKey="cantidad" radius={[0, 4, 4, 0]} barSize={16}>
                  {datos.map((d) => (
                    <Cell
                      key={d.area}
                      fill={d.cantidad === 0 ? 'var(--color-vencido)' : 'var(--color-serie-1)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Tarjeta>

      <Tarjeta sinPadding>
        <Tabla
          nombreExport="monitoreos-por-area"
          filas={datos}
          claveFila={(f) => f.area}
          conBusqueda={false}
          columnas={[
            { clave: 'area', titulo: 'Área' },
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
        />
      </Tarjeta>
    </div>
  );
}
