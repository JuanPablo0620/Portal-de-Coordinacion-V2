import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, GitCompare, Target } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { BarraAvance, Chip, Metrica, Pestanias, Semaforo, Tarjeta, Vacio } from '../../componentes/Basicos.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { CampoSelect } from '../../componentes/Campo.jsx';
import { GraficoBarras, GraficoLineas, GraficoTorta } from '../../componentes/Graficos.jsx';
import { CargarPlanificacion } from './CargarPlanificacion.jsx';
import {
  avancePorDimension,
  desvioTrimestral,
  ejecucionPresupuestaria,
  gastoPorDimension,
  hoyISO,
  nivelCumplimiento,
  porDimension,
  proyectos as selProyectos,
  trimestreDe,
  activos,
} from '../../datos/selectores.js';
import { moneda, numero, porcentaje } from '../../utilidades/formato.js';
import { useBD } from '../../estado/tienda.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';

const DEFAULTS = { tab: 'estadisticas', proyecto: '', anio: '', dimension: 'area', area: '', eje: '' };

const DIMENSIONES = [
  { valor: 'area', titulo: 'Área' },
  { valor: 'eje', titulo: 'Eje' },
  { valor: 'tipo', titulo: 'Tipo' },
  { valor: 'estado', titulo: 'Estado' },
];

export default function Planificacion() {
  const bd = useBD();
  const [filtros, setFiltros] = useFiltrosUrl(DEFAULTS);

  const pestanias = [
    { valor: 'estadisticas', titulo: 'Estadísticas', icono: BarChart3 },
    { valor: 'comparativo', titulo: 'Planificado vs. real', icono: GitCompare },
    { valor: 'carga', titulo: 'Cargar planificación', icono: Target },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Planificación"
        descripcion="Metas anuales, ejecución presupuestaria y desvíos respecto de lo planificado."
      />
      <Pagina className="flex flex-col gap-4">
        <Pestanias opciones={pestanias} valor={filtros.tab} alCambiar={(v) => setFiltros({ tab: v })} />
        {filtros.tab === 'estadisticas' && <Estadisticas bd={bd} filtros={filtros} setFiltros={setFiltros} />}
        {filtros.tab === 'comparativo' && <Comparativo bd={bd} filtros={filtros} setFiltros={setFiltros} />}
        {filtros.tab === 'carga' && <CargarPlanificacion filtros={filtros} setFiltros={setFiltros} />}
      </Pagina>
    </>
  );
}

/* ── Tablero de estadísticas ────────────────────────────────────────── */

function Estadisticas({ bd, filtros, setFiltros }) {
  const opcionesArea = useOpciones('areas');
  const opcionesEje = useOpciones('ejes');
  const dimension = filtros.dimension || 'area';
  const base = { area: filtros.area, eje: filtros.eje };

  const proyectos = useMemo(() => (bd ? selProyectos(bd, base) : []), [bd, filtros.area, filtros.eje]);
  const cantidades = useMemo(() => (bd ? porDimension(bd, dimension, base) : []), [bd, dimension, filtros.area, filtros.eje]);
  const avance = useMemo(() => (bd ? avancePorDimension(bd, dimension, base) : []), [bd, dimension, filtros.area, filtros.eje]);
  const gasto = useMemo(() => (bd ? gastoPorDimension(bd, dimension, base) : []), [bd, dimension, filtros.area, filtros.eje]);
  const ejecucion = useMemo(() => (bd ? ejecucionPresupuestaria(bd, base) : null), [bd, filtros.area, filtros.eje]);

  /** Evolución mensual del avance, leída de los asientos de bitácora. */
  const evolucion = useMemo(() => {
    if (!bd) return [];
    const ids = new Set(proyectos.map((p) => p.id_proyecto));
    const porMes = new Map();
    for (const h of bd.historial ?? []) {
      if (!ids.has(h.id_proyecto)) continue;
      const cambio = (h.cambios ?? []).find((c) => c.campo === 'avance');
      if (!cambio) continue;
      const mes = h.creado_en.slice(0, 7);
      porMes.set(mes, (porMes.get(mes) ?? 0) + (Number(cambio.despues) - Number(cambio.antes || 0)));
    }
    let acumulado = 0;
    return [...porMes.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, delta]) => {
        acumulado += delta;
        return { fecha: mes, avance: Math.round(acumulado), incremento: Math.round(delta) };
      });
  }, [bd, proyectos]);

  const anio = Number(filtros.anio) || Number(hoyISO().slice(0, 4));
  const trimestre = trimestreDe(hoyISO());
  const ranking = useMemo(
    () => (bd ? desvioTrimestral(bd, anio, trimestre, base).slice(0, 12) : []),
    [bd, anio, trimestre, filtros.area, filtros.eje],
  );

  if (!proyectos.length) {
    return (
      <Tarjeta>
        <Vacio
          icono={BarChart3}
          titulo="Sin proyectos para analizar"
          descripcion="Cargá proyectos en la base maestra —o quitá los filtros— para ver las estadísticas."
        />
      </Tarjeta>
    );
  }

  const tituloDim = DIMENSIONES.find((d) => d.valor === dimension)?.titulo ?? 'Área';

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Filtros y dimensión de análisis">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CampoSelect etiqueta="Área" opciones={opcionesArea} value={filtros.area} onChange={(e) => setFiltros({ area: e.target.value })} placeholder="Todas" />
          <CampoSelect etiqueta="Eje" opciones={opcionesEje} value={filtros.eje} onChange={(e) => setFiltros({ eje: e.target.value })} placeholder="Todos" />
          <CampoSelect
            etiqueta="Agrupar por"
            opciones={DIMENSIONES}
            value={dimension}
            onChange={(e) => setFiltros({ dimension: e.target.value })}
            placeholder=""
          />
        </div>
      </Tarjeta>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica valor={proyectos.length} etiqueta="Proyectos" />
        <Metrica valor={moneda(ejecucion.planificado)} etiqueta="Monto planificado" />
        <Metrica valor={moneda(ejecucion.ejecutado)} etiqueta="Monto ejecutado" />
        <Metrica
          valor={porcentaje(ejecucion.porcentaje)}
          etiqueta="Ejecución presupuestaria"
          detalle={`desvío ${ejecucion.desvio > 0 ? '+' : ''}${ejecucion.desvio} p.p.`}
          tono={Math.abs(ejecucion.desvio) > 20 ? 'vencido' : 'neutro'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Tarjeta titulo={`Proyectos por ${tituloDim.toLowerCase()}`}>
          <GraficoBarras datos={cantidades} horizontal alto={Math.max(220, cantidades.length * 32)} anchoEtiqueta={170} />
        </Tarjeta>

        <Tarjeta titulo={`Avance agregado por ${tituloDim.toLowerCase()}`} descripcion="Objetivo comprometido contra avance acumulado.">
          <GraficoBarras
            datos={avance}
            horizontal
            alto={Math.max(220, avance.length * 32)}
            anchoEtiqueta={170}
            formato={numero}
            series={[
              { clave: 'objetivo', titulo: 'Objetivo' },
              { clave: 'avance', titulo: 'Avance' },
            ]}
          />
        </Tarjeta>

        <Tarjeta titulo={`Gasto planificado por ${tituloDim.toLowerCase()}`}>
          <GraficoTorta datos={gasto} valor="planificado" formato={moneda} alto={280} />
        </Tarjeta>

        <Tarjeta titulo="Ejecución presupuestaria" descripcion="Planificado contra ejecutado, con el desvío en puntos porcentuales.">
          <GraficoBarras
            datos={gasto}
            horizontal
            alto={Math.max(220, gasto.length * 32)}
            anchoEtiqueta={170}
            formato={moneda}
            series={[
              { clave: 'planificado', titulo: 'Planificado' },
              { clave: 'ejecutado', titulo: 'Ejecutado' },
            ]}
          />
        </Tarjeta>

        <Tarjeta titulo="Evolución temporal del avance" descripcion="Acumulado según los asientos de bitácora.">
          <GraficoLineas
            datos={evolucion}
            formato={numero}
            series={[{ clave: 'avance', titulo: 'Avance acumulado' }]}
          />
        </Tarjeta>

        <Tarjeta
          titulo={`Ranking de desvío · T${trimestre} ${anio}`}
          descripcion="Los que más lejos están de su meta trimestral, primero."
        >
          <GraficoBarras
            datos={ranking.map((r) => ({ nombre: r.proyecto.slice(0, 34), cumplimiento: r.cumplimiento, nivel: nivelCumplimiento(r.cumplimiento) }))}
            horizontal
            alto={Math.max(220, ranking.length * 30)}
            anchoEtiqueta={190}
            formato={(v) => `${v}%`}
            series={[
              {
                clave: 'cumplimiento',
                titulo: 'Cumplimiento',
                colorPorItem: (d) => `var(--color-${d.nivel})`,
              },
            ]}
          />
        </Tarjeta>
      </div>

      <Tarjeta titulo={`Detalle por ${tituloDim.toLowerCase()}`} sinPadding>
        <Tabla
          nombreExport={`planificacion-por-${dimension}`}
          filas={gasto.map((g) => {
            const a = avance.find((x) => x.nombre === g.nombre) ?? {};
            const c = cantidades.find((x) => x.nombre === g.nombre) ?? {};
            return { ...g, proyectos: c.cantidad ?? 0, objetivo: a.objetivo ?? 0, avance: a.avance ?? 0, porcentaje_avance: a.porcentaje ?? 0 };
          })}
          claveFila={(f) => f.nombre}
          conBusqueda={false}
          columnas={[
            { clave: 'nombre', titulo: tituloDim },
            { clave: 'proyectos', titulo: 'Proyectos', ancho: 90, alinear: 'derecha' },
            {
              clave: 'porcentaje_avance',
              titulo: 'Avance',
              ancho: 140,
              render: (f) => <BarraAvance valor={f.porcentaje_avance} />,
            },
            { clave: 'planificado', titulo: 'Planificado', ancho: 140, alinear: 'derecha', render: (f) => moneda(f.planificado), formatoCSV: (v) => v },
            { clave: 'ejecutado', titulo: 'Ejecutado', ancho: 140, alinear: 'derecha', render: (f) => moneda(f.ejecutado), formatoCSV: (v) => v },
            {
              clave: 'desvio',
              titulo: 'Desvío',
              ancho: 100,
              alinear: 'derecha',
              render: (f) => (
                <span style={{ color: Math.abs(f.desvio) > 20 ? 'var(--color-vencido)' : 'var(--color-tinta)' }}>
                  {f.desvio > 0 ? '+' : ''}
                  {f.desvio} p.p.
                </span>
              ),
            },
          ]}
        />
      </Tarjeta>
    </div>
  );
}

/* ── Comparativo planificado vs. real ───────────────────────────────── */

function Comparativo({ bd, filtros, setFiltros }) {
  const navegar = useNavigate();
  const opcionesArea = useOpciones('areas');
  const hoy = hoyISO();
  const anio = Number(filtros.anio) || Number(hoy.slice(0, 4));
  const [trimestre, setTrimestre] = useState(trimestreDe(hoy));

  const filas = useMemo(
    () => (bd ? desvioTrimestral(bd, anio, trimestre, { area: filtros.area }) : []),
    [bd, anio, trimestre, filtros.area],
  );

  const sinPlanificacion = useMemo(() => {
    if (!bd) return 0;
    const conPlan = new Set(activos(bd.planificacion_anual).filter((p) => Number(p.anio) === anio).map((p) => p.id_proyecto));
    return selProyectos(bd, { area: filtros.area }).filter((p) => !conPlan.has(p.id_proyecto)).length;
  }, [bd, anio, filtros.area]);

  const porNivel = (nivel) => filas.filter((f) => nivelCumplimiento(f.cumplimiento) === nivel).length;

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Período y filtros">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CampoSelect etiqueta="Área" opciones={opcionesArea} value={filtros.area} onChange={(e) => setFiltros({ area: e.target.value })} placeholder="Todas" />
          <CampoSelect
            etiqueta="Año"
            opciones={[anio - 1, anio, anio + 1].map((a) => ({ valor: String(a), titulo: String(a) }))}
            value={String(anio)}
            onChange={(e) => setFiltros({ anio: e.target.value })}
            placeholder=""
          />
          <CampoSelect
            etiqueta="Trimestre"
            opciones={[1, 2, 3, 4].map((t) => ({ valor: String(t), titulo: `T${t}` }))}
            value={String(trimestre)}
            onChange={(e) => setTrimestre(Number(e.target.value))}
            placeholder=""
          />
        </div>
      </Tarjeta>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metrica valor={filas.length} etiqueta="Con planificación" />
        <Metrica valor={porNivel('enregla')} etiqueta="En regla (≥95%)" />
        <Metrica valor={porNivel('atencion')} etiqueta="Atención (80–95%)" />
        <Metrica valor={porNivel('proximo')} etiqueta="Rezagados (60–80%)" />
        <Metrica valor={porNivel('vencido')} etiqueta="Críticos (<60%)" tono={porNivel('vencido') ? 'vencido' : 'neutro'} />
      </div>

      <Tarjeta
        titulo={`Comparativo al T${trimestre} de ${anio}`}
        descripcion={
          sinPlanificacion > 0
            ? `${sinPlanificacion} proyecto(s) sin planificación cargada para ${anio} quedan fuera del comparativo.`
            : 'Todos los proyectos filtrados tienen planificación cargada.'
        }
        sinPadding
      >
        <Tabla
          nombreExport={`comparativo-t${trimestre}-${anio}`}
          filas={filas}
          claveFila={(f) => f.id_proyecto}
          alHacerClicFila={(f) => navegar(`/proyectos/${f.id_proyecto}`)}
          ordenInicial={{ clave: 'cumplimiento', direccion: 'asc' }}
          columnas={[
            { clave: 'id_proyecto', titulo: 'ID', ancho: 125, render: (f) => <Chip tono="acento">{f.id_proyecto}</Chip> },
            { clave: 'proyecto', titulo: 'Proyecto' },
            { clave: 'area', titulo: 'Área', ancho: 180 },
            { clave: 'meta', titulo: `Meta T${trimestre}`, ancho: 100, alinear: 'derecha', render: (f) => numero(f.meta) },
            { clave: 'real', titulo: 'Avance real', ancho: 100, alinear: 'derecha', render: (f) => numero(f.real) },
            {
              clave: 'desvio',
              titulo: 'Desvío',
              ancho: 100,
              alinear: 'derecha',
              render: (f) => (
                <span style={{ color: f.desvio < 0 ? 'var(--color-vencido)' : 'var(--color-enregla)' }}>
                  {f.desvio > 0 ? '+' : ''}
                  {numero(f.desvio)}
                </span>
              ),
            },
            {
              clave: 'cumplimiento',
              titulo: 'Cumplimiento',
              ancho: 170,
              render: (f) => (
                <div className="flex items-center gap-2">
                  <Semaforo nivel={nivelCumplimiento(f.cumplimiento)} texto={`${f.cumplimiento}%`} />
                </div>
              ),
            },
          ]}
          vacio={
            <Vacio
              icono={GitCompare}
              titulo="Sin proyectos planificados en este período"
              descripcion="Cargá metas trimestrales para que los proyectos entren en el comparativo."
              accion={{ texto: 'Cargar planificación', icono: Target, alHacerClic: () => setFiltros({ tab: 'carga' }) }}
            />
          }
        />
      </Tarjeta>
    </div>
  );
}
