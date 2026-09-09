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
    // El filtro era «sólo con temas sin resolver», y los temas ya no se cargan:
    // sobre un monitoreo nuevo no dejaba pasar ninguno. Ahora busca lo que hoy
    // sí es trabajo pendiente — la reunión que quedó abierta a medio cargar.
    return lista.filter((m) => !m.cerrado);
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
          opciones={[['sin_resolver', 'Sólo sin cerrar', 'Monitoreos que quedaron abiertos, a medio cargar']]}
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
            { clave: 'area', titulo: 'Área', ancho: 240 },
            {
              clave: 'cerrado',
              titulo: 'Estado',
              ancho: 110,
              valorOrden: (f) => (f.cerrado ? 1 : 0),
              formatoCSV: (v) => (v ? 'cerrado' : 'abierto'),
              render: (f) =>
                f.cerrado ? <Chip tono="enregla">Cerrado</Chip> : <Chip tono="proximo">Abierto</Chip>,
            },
            {
              clave: 'registrado',
              titulo: 'Registrado',
              ancho: 250,
              // Ordena por volumen de trabajo, que es lo que la columna comunica.
              valorOrden: (f) => f.cantidad_avances + f.cantidad_compromisos + f.cantidad_temas,
              formatoCSV: (_v, f) =>
                [
                  f.cantidad_avances ? `${f.cantidad_avances} avances` : '',
                  f.cantidad_compromisos ? `${f.cantidad_compromisos} compromisos` : '',
                  f.cantidad_temas ? `${f.cantidad_temas} temas` : '',
                ]
                  .filter(Boolean)
                  .join(' · ') || 'sin registro',
              render: (f) => <Registrado monitoreo={f} />,
            },
            {
              clave: 'dias_desde_anterior',
              titulo: 'Cadencia',
              ancho: 120,
              alinear: 'derecha',
              render: (f) => <Cadencia dias={f.dias_desde_anterior} />,
            },
            {
              clave: 'creado_por',
              titulo: 'Cargado por',
              ancho: 130,
              render: (f) => f.creado_por || <span className="text-tenue">—</span>,
            },
          ]}
          filaExpandida={filtros.monitoreo || null}
          renderExpandido={(f) => <DetalleMonitoreo monitoreo={f} navegar={navegar} />}
          alHacerClicFila={(f) => setFiltros({ monitoreo: filtros.monitoreo === f.id ? '' : f.id })}
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

    </div>
  );
}

/**
 * Qué se registró en la reunión, en una sola celda.
 *
 * Reemplaza a la columna «Temas», que contaba lo único que ya no se carga: la
 * sección de temas está desactivada en `CargarMonitoreo.jsx`, así que todo
 * monitoreo nuevo mostraba cero. Hoy una reunión son avances de proyecto y
 * compromisos, y eso es lo que tiene que contar.
 *
 * Los temas siguen apareciendo cuando los hay, porque los monitoreos viejos sí
 * los tienen y borrarlos de la vista sería perder historia.
 */
function Registrado({ monitoreo }) {
  const piezas = [
    [monitoreo.cantidad_avances, 'avance', 'avances'],
    [monitoreo.cantidad_compromisos, 'compromiso', 'compromisos'],
    [monitoreo.cantidad_temas, 'tema', 'temas'],
  ].filter(([n]) => n > 0);

  if (!piezas.length) {
    return <span className="text-xs italic text-tenue">Sin registro cargado</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {piezas.map(([n, singular, plural]) => (
        <span
          key={plural}
          className="inline-flex items-baseline gap-1 rounded-chip border border-borde bg-paper px-2 py-0.5 text-xs text-gris"
        >
          <b className="tabular font-semibold text-tinta">{n}</b>
          {n === 1 ? singular : plural}
        </span>
      ))}
    </div>
  );
}

/**
 * Días desde el monitoreo anterior de la misma área.
 *
 * El Monitoreo es semanal, así que el semáforo se calibra contra eso: hasta 7
 * días está en fecha, hasta 14 se pasó, más que eso es un área que quedó sin
 * seguimiento. Es la única columna que contesta «¿a quién le estamos faltando?»
 * sin abrir nada.
 */
const DIAS_CADENCIA_ESPERADA = 7;
const DIAS_CADENCIA_TOLERADA = 14;

function Cadencia({ dias }) {
  // El primero de cada área no tiene anterior contra qué comparar. No es un
  // atraso ni un cero: no hay dato, y decir «0 d» sería mentir.
  if (dias == null) return <span className="text-xs text-tenue">primero</span>;

  const tono =
    dias <= DIAS_CADENCIA_ESPERADA ? 'enregla' : dias <= DIAS_CADENCIA_TOLERADA ? 'proximo' : 'vencido';
  return <Chip tono={tono}>{dias} d</Chip>;
}

/**
 * El acta de la reunión, desplegada dentro de la fila.
 *
 * Antes esto era una tarjeta al final de la página, con una sola tabla de
 * temas: había que scrollear hasta el fondo y volver para comparar con otro
 * monitoreo. Ahora se abre en su lugar y muestra las tres cosas que puede tener
 * una reunión, cada bloque solo si tiene contenido.
 *
 * Los temas están al final y no primero porque son el camino viejo: solo los
 * tienen los monitoreos anteriores a que se desactivara esa sección.
 */
function DetalleMonitoreo({ monitoreo, navegar }) {
  const { avances = [], compromisos_generados: compromisos = [], temas = [] } = monitoreo;
  const vacio = !avances.length && !compromisos.length && !temas.length;

  return (
    <div className="flex flex-col gap-4 border-l-2 border-acento bg-paper px-4 py-4">
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        <Dato titulo="Secretaría">{monitoreo.area}</Dato>
        <Dato titulo="Fecha">{fFecha(monitoreo.fecha)}</Dato>
        <Dato titulo="Cargado por">{monitoreo.creado_por || 'sin registrar'}</Dato>
        <Dato titulo="Monitoreo anterior">
          {monitoreo.fecha_anterior
            ? `${fFecha(monitoreo.fecha_anterior)} · hace ${monitoreo.dias_desde_anterior} días`
            : 'es el primero del área'}
        </Dato>
        <Dato titulo="Estado">
          {monitoreo.cerrado ? <Chip tono="enregla">Cerrado</Chip> : <Chip tono="proximo">Abierto</Chip>}
        </Dato>
      </dl>

      {vacio && (
        <p className="text-sm text-gris">
          Este monitoreo no tiene nada cargado todavía. Se abre al crearlo y se completa con los
          avances de los proyectos del área y los compromisos que surjan.
        </p>
      )}

      {avances.length > 0 && (
        <Bloque titulo="Proyectos avanzados">
          {avances.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <button
                type="button"
                onClick={() => navegar(`/proyectos/${a.id_proyecto}`)}
                className="shrink-0"
              >
                <Chip tono="acento">{a.id_proyecto}</Chip>
              </button>
              <div className="min-w-40 flex-1">
                <p className="text-sm font-medium text-tinta">{a.proyecto}</p>
                <p className="text-[11px] text-tenue">
                  {[a.programa, a.estado].filter(Boolean).join(' · ')}
                </p>
              </div>
              <AporteDelPeriodo avance={a} />
            </li>
          ))}
        </Bloque>
      )}

      {compromisos.length > 0 && (
        <Bloque titulo="Compromisos generados acá">
          {compromisos.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <div className="min-w-40 flex-1">
                <p className="text-sm text-tinta">{c.descripcion}</p>
                <p className="text-[11px] text-tenue">
                  {c.responsable || 'sin responsable'}
                  {c.fecha_limite ? ` · vence ${fFecha(c.fecha_limite)}` : ' · sin fecha límite'}
                </p>
              </div>
              <Chip tono={c.estado === 'cumplido' ? 'enregla' : 'proximo'}>{c.estado}</Chip>
            </li>
          ))}
        </Bloque>
      )}

      {temas.length > 0 && (
        <Bloque titulo="Temas" nota="camino anterior, ya no se cargan">
          {temas.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <div className="min-w-40 flex-1">
                <p className="text-sm text-tinta">{t.descripcion}</p>
                <p className="text-[11px] text-tenue">{t.categoria}</p>
              </div>
              <Criticidad nivel={t.criticidad} />
              {t.resuelto ? <Chip tono="enregla">resuelto</Chip> : <Chip tono="vencido">sin resolver</Chip>}
            </li>
          ))}
        </Bloque>
      )}
    </div>
  );
}

function Dato({ titulo, children }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-tenue">{titulo}</dt>
      <dd className="text-sm font-medium text-tinta">{children}</dd>
    </div>
  );
}

function Bloque({ titulo, nota, children }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gris">
        {titulo}
        {nota && <span className="font-normal normal-case tracking-normal text-tenue">— {nota}</span>}
      </p>
      <ul className="divide-y divide-borde/70 rounded-chip border border-borde bg-card">{children}</ul>
    </div>
  );
}

/**
 * Lo que se informó en ESTA reunión, no el acumulado del proyecto.
 *
 * La base guarda una fila por observación y el total se calcula sumando, así
 * que este número es el aporte del período. Mostrar el acumulado acá haría
 * parecer que todo eso se hizo en esta reunión.
 */
function AporteDelPeriodo({ avance }) {
  if (avance.cantidad == null) {
    return <span className="text-xs text-tenue">sin dato numérico</span>;
  }
  return (
    <span className="tabular shrink-0 text-sm">
      <b className="font-semibold text-enregla-texto">+{avance.cantidad.toLocaleString('es-AR')}</b>
      {avance.unidad && <span className="ml-1 text-tenue">{avance.unidad}</span>}
    </span>
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
