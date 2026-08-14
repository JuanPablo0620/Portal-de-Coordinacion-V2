import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, Building2, ListChecks, Plus, Radar } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Boton, Chip, Criticidad, Metrica, Pestanias, Tarjeta, Vacio } from '../../componentes/Basicos.jsx';
import { Alternadores, GrillaFiltros, TarjetaFiltros, limpiarClaves } from '../../componentes/Filtros.jsx';
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
import { CLAVES_FILTRO, DEFAULTS } from './filtros.js';


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
          alCambiar={(v) => setFiltros({ tab: v, secretaria: '', monitoreo: '' })}
        />

        {/* Primero lo que elige la pestaña, después las alertas.
            El panel iba arriba en todas las pestañas menos dos, y con la base
            cargada mide más de mil píxeles: al entrar a «Últimos monitoreos» o
            a «Cobertura» lo primero —y a veces lo único— que se veía era el
            panel de alertas, y había que bajar a buscar aquello para lo que se
            había apretado la pestaña. Sigue estando siempre visible, como pide
            la spec, pero abajo: es el contexto de lo que se mira, no la pantalla. */}
        {filtros.tab === 'secretarias' && (
          <TableroSecretarias bd={bd} filtros={filtros} setFiltros={setFiltros} alertas={alertas} rango={rango} />
        )}
        {filtros.tab === 'ultimos' && (
          <PanelUltimos bd={bd} filtros={filtros} setFiltros={setFiltros} rango={rango} hoy={hoy} />
        )}
        {filtros.tab === 'cobertura' && (
          <PanelCobertura bd={bd} filtros={filtros} setFiltros={setFiltros} rango={rango} hoy={hoy} />
        )}
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

        {/* En la hoja de una secretaría no se repite: esa vista ya lista sus
            propias alertas, con el mismo origen y los mismos días de atraso. */}
        {filtros.tab === 'alertas' ? (
          <PanelAlertas />
        ) : (
          !filtros.secretaria && <PanelAlertas compacto limitePorGrupo={3} />
        )}
      </Pagina>
    </>
  );
}

/* ── Últimos monitoreos ─────────────────────────────────────────────── */

function PanelUltimos({ bd, filtros, setFiltros, rango, hoy }) {
  const navegar = useNavigate();
  const opcionesArea = useOpciones('areas');
  const filas = useMemo(() => {
    if (!bd) return [];
    const lista = selMonitoreos(bd, { area: filtros.area, desde: rango.desde, hasta: rango.hasta });
    if (!filtros.sin_resolver) return lista;
    return lista.filter((m) => m.temas.some((t) => !t.resuelto));
  }, [bd, filtros.area, filtros.sin_resolver, rango]);

  return (
    <div className="flex flex-col gap-4">
      <TarjetaFiltros
        filtros={filtros}
        defaults={DEFAULTS}
        claves={CLAVES_FILTRO}
        alLimpiar={() => limpiarClaves(setFiltros, DEFAULTS, CLAVES_FILTRO)}
      >
        <GrillaFiltros columnas={4}>
          <CampoSelect
            etiqueta="Área"
            opciones={opcionesArea}
            value={filtros.area}
            onChange={(e) => setFiltros({ area: e.target.value })}
            placeholder="Todas"
          />
        </GrillaFiltros>
        <SelectorPeriodo filtros={filtros} setFiltros={setFiltros} rango={rango} hoy={hoy} />
        <Alternadores
          filtros={filtros}
          setFiltros={setFiltros}
          opciones={[['sin_resolver', 'Sólo con temas sin resolver', 'Monitoreos con al menos un tema abierto']]}
        >
          <span className="tabular ml-1 text-xs text-tenue">
            {filas.length} monitoreo{filas.length === 1 ? '' : 's'} en la vista
          </span>
        </Alternadores>
      </TarjetaFiltros>

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
  const todas = useMemo(
    () => (bd ? monitoreosPorArea(bd, { desde: rango.desde, hasta: rango.hasta }) : []),
    [bd, rango],
  );

  const sinCobertura = todas.filter((d) => d.cantidad === 0);
  const total = todas.reduce((s, d) => s + d.cantidad, 0);
  // El recorte se aplica DESPUÉS de las cifras: los contadores describen el
  // universo completo aunque la tabla esté filtrada, que es lo que hace que
  // «3 de 14 sin cobertura» siga siendo legible con el filtro puesto.
  const datos = filtros.sin_cobertura ? sinCobertura : todas;

  /** Ir a la hoja de esa secretaría: la comparación sólo sirve si se puede entrar. */
  const abrirHoja = (area) => setFiltros({ tab: 'secretarias', secretaria: area });

  return (
    <div className="flex flex-col gap-4">
      <TarjetaFiltros
        filtros={filtros}
        defaults={DEFAULTS}
        claves={CLAVES_FILTRO}
        alLimpiar={() => limpiarClaves(setFiltros, DEFAULTS, CLAVES_FILTRO)}
      >
        <SelectorPeriodo filtros={filtros} setFiltros={setFiltros} rango={rango} hoy={hoy} />
        <Alternadores
          filtros={filtros}
          setFiltros={setFiltros}
          opciones={[['sin_cobertura', 'Sólo sin cobertura', 'Secretarías sin ningún monitoreo en el período']]}
        />
      </TarjetaFiltros>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metrica valor={total} etiqueta="Monitoreos en el período" />
        <Metrica valor={todas.length - sinCobertura.length} etiqueta="Secretarías con cobertura" />
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
