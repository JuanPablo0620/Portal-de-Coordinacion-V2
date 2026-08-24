/**
 * Vista previa del reporte.
 *
 * Es exactamente el marcado que se imprime: lo que se ve en pantalla es lo que
 * sale en el PDF. El encabezado institucional y el pie con los filtros
 * aplicados sólo aparecen al imprimir (`.solo-impresion`).
 *
 * Sus tablas van `sinTope`, al revés que las del resto del sistema: acá el
 * recorte de filas no sería un alivio de render sino un documento mutilado, y
 * un PDF al que le faltan filas sin decirlo es peor que uno largo.
 */
import { Building2, FileBarChart } from 'lucide-react';
import { BarraAvance, Chip, Criticidad, EstadoProyecto, Semaforo, Tarjeta, Vacio, nivelPorDias } from '../../componentes/Basicos.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { GraficoBarras, GraficoTorta } from '../../componentes/Graficos.jsx';
import { ETIQUETAS_ALERTA } from '../../datos/alertas.js';
import { fecha as fFecha, fechaLarga, moneda, numero } from '../../utilidades/formato.js';

/**
 * Un avance/problema de seguimiento es hoy `{ descripcion, id_proyecto }`
 * (24/08/2026, para poder vincular cada fila a un proyecto). Defensivo contra
 * el string simple de antes: un seguimiento cargado con la versión vieja del
 * formulario ya está guardado así en el navegador de quien lo cargó.
 */
const textoDe = (item) => (typeof item === 'string' ? item : item?.descripcion ?? '');

export function VistaPrevia({ reporte, bloques, hoy }) {
  const nada = !Object.values(bloques).some(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoImpresion hoy={hoy} />

      {nada ? (
        <Tarjeta>
          <Vacio
            icono={FileBarChart}
            titulo="No hay bloques seleccionados"
            descripcion="Marcá al menos un bloque arriba para armar el reporte."
          />
        </Tarjeta>
      ) : (
        <>
          {bloques.resumen && <BloqueResumen resumen={reporte.resumen} />}
          {bloques.graficos && <BloqueGraficos agregados={reporte.agregados} />}
          {bloques.proyectos && <BloqueProyectos filas={reporte.proyectos} />}
          {bloques.compromisos && <BloqueCompromisos filas={reporte.compromisos} />}
          {bloques.alertas && <BloqueAlertas alertas={reporte.alertas} />}
          {bloques.temas && <BloqueTemas filas={reporte.temas} />}
          {bloques.minutas && <BloqueMinutas seguimientos={reporte.seguimientos} />}
          {bloques.mesas && <BloqueMesas filas={reporte.mesas} />}
          {bloques.eventos && <BloqueEventos filas={reporte.eventos} />}
        </>
      )}

      <PieImpresion filtros={reporte.resumenFiltros} hoy={hoy} />
    </div>
  );
}

/* ── Encabezado y pie institucionales ───────────────────────────────── */

function EncabezadoImpresion({ hoy }) {
  return (
    <>
      {/* Sólo al imprimir */}
      <header className="solo-impresion encabezado-impresion">
        <p style={{ fontSize: '14pt', fontWeight: 700, margin: 0 }}>Municipio de Tres de Febrero</p>
        <p style={{ fontSize: '10pt', margin: '2pt 0 0' }}>Área de Coordinación · Reporte de seguimiento de proyectos</p>
        <p style={{ fontSize: '9pt', color: '#5b6672', margin: '2pt 0 0' }}>
          Emitido el {fechaLarga(hoy)}
        </p>
      </header>

      {/* Sólo en pantalla */}
      <div className="no-imprimir flex items-center gap-3 rounded-card border border-borde bg-card px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-chip bg-acento text-white">
          <Building2 size={20} />
        </span>
        <div>
          <p className="text-sm font-semibold text-tinta">Municipio de Tres de Febrero</p>
          <p className="text-xs text-gris">
            Área de Coordinación · Reporte emitido el {fechaLarga(hoy)}
          </p>
        </div>
        <span className="ml-auto text-[11px] text-tenue">Vista previa — así se imprime</span>
      </div>
    </>
  );
}

function PieImpresion({ filtros, hoy }) {
  return (
    <>
      <footer className="solo-impresion pie-impresion">
        <p style={{ margin: 0, fontWeight: 600 }}>Filtros aplicados</p>
        <p style={{ margin: '2pt 0 0' }}>{filtros.join(' · ')}</p>
        <p style={{ margin: '4pt 0 0' }}>
          Municipio de Tres de Febrero · Área de Coordinación · Emitido el {fechaLarga(hoy)}
        </p>
      </footer>

      <Tarjeta titulo="Filtros aplicados" descripcion="Se imprimen al pie del documento." className="no-imprimir">
        <ul className="flex flex-wrap gap-1.5">
          {filtros.map((f) => (
            <li key={f}>
              <Chip tono="acento">{f}</Chip>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </>
  );
}

/* ── Bloques ────────────────────────────────────────────────────────── */

function BloqueResumen({ resumen }) {
  const items = [
    ['Proyectos', numero(resumen.proyectos)],
    ['Obras', numero(resumen.obras)],
    ['Prioritarios', numero(resumen.prioritarios)],
    ['Compromisos', numero(resumen.compromisos)],
    ['Compromisos vencidos', numero(resumen.compromisosVencidos)],
    ['Seguimientos', numero(resumen.seguimientos)],
    ['Monitoreos', numero(resumen.monitoreos)],
    ['Temas críticos sin resolver', numero(resumen.temasCriticos)],
    ['Eventos', numero(resumen.eventos)],
    ['Alertas activas', numero(resumen.alertas)],
    ['Monto planificado', moneda(resumen.montoPlanificado)],
    ['Monto ejecutado', moneda(resumen.montoEjecutado)],
  ];
  return (
    <Tarjeta titulo="Resumen del recorte">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="flex items-baseline justify-between gap-2 border-b border-borde/60 py-1">
            <dt className="truncate text-xs text-gris">{etiqueta}</dt>
            <dd className="tabular shrink-0 text-sm font-semibold text-tinta">{valor}</dd>
          </div>
        ))}
      </dl>
    </Tarjeta>
  );
}

function BloqueGraficos({ agregados }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Tarjeta titulo="Proyectos por área">
        <GraficoBarras datos={agregados.porArea ?? []} horizontal alto={Math.max(200, (agregados.porArea?.length ?? 0) * 30)} anchoEtiqueta={170} />
      </Tarjeta>
      <Tarjeta titulo="Proyectos por eje">
        <GraficoTorta datos={agregados.porEje ?? []} alto={260} />
      </Tarjeta>
      <Tarjeta titulo="Proyectos por estado">
        <GraficoBarras datos={agregados.porEstado ?? []} alto={240} />
      </Tarjeta>
      <Tarjeta titulo="Ejecución presupuestaria por área">
        <GraficoBarras
          datos={agregados.gastoPorArea ?? []}
          horizontal
          alto={Math.max(200, (agregados.gastoPorArea?.length ?? 0) * 30)}
          anchoEtiqueta={170}
          formato={moneda}
          series={[
            { clave: 'planificado', titulo: 'Planificado' },
            { clave: 'ejecutado', titulo: 'Ejecutado' },
          ]}
        />
      </Tarjeta>
    </div>
  );
}

function BloqueProyectos({ filas }) {
  return (
    <Tarjeta titulo={`Proyectos (${filas.length})`} sinPadding>
      <Tabla
        sinTope
        nombreExport="reporte-proyectos"
        filas={filas}
        claveFila={(f) => f.id_proyecto}
        conBusqueda={false}
        columnas={[
          { clave: 'id_proyecto', titulo: 'ID', ancho: 125, render: (f) => <Chip tono="acento">{f.id_proyecto}</Chip> },
          { clave: 'proyecto', titulo: 'Proyecto' },
          { clave: 'area', titulo: 'Área', ancho: 175 },
          { clave: 'eje', titulo: 'Eje', ancho: 145 },
          { clave: 'estado', titulo: 'Estado', ancho: 115, render: (f) => <EstadoProyecto estado={f.estado} /> },
          { clave: 'porcentaje_avance', titulo: 'Avance', ancho: 130, render: (f) => <BarraAvance valor={f.porcentaje_avance} /> },
          { clave: 'responsable', titulo: 'Responsable', ancho: 125 },
          { clave: 'monto_planificado', titulo: 'Planificado', ancho: 125, alinear: 'derecha', render: (f) => moneda(f.monto_planificado) },
        ]}
        vacio={<Vacio compacto titulo="Ningún proyecto cumple los filtros aplicados" />}
      />
    </Tarjeta>
  );
}

function BloqueCompromisos({ filas }) {
  return (
    <Tarjeta titulo={`Compromisos (${filas.length})`} sinPadding>
      <Tabla
        sinTope
        nombreExport="reporte-compromisos"
        filas={filas}
        conBusqueda={false}
        columnas={[
          { clave: 'descripcion', titulo: 'Compromiso' },
          { clave: 'responsable', titulo: 'Responsable', ancho: 130 },
          { clave: 'area', titulo: 'Área', ancho: 175 },
          { clave: 'origen_tipo', titulo: 'Origen', ancho: 105 },
          { clave: 'fecha_limite', titulo: 'Vence', ancho: 100, render: (f) => fFecha(f.fecha_limite), formatoCSV: fFecha },
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
        ]}
        vacio={<Vacio compacto titulo="Ningún compromiso cumple los filtros aplicados" />}
      />
    </Tarjeta>
  );
}

function BloqueAlertas({ alertas }) {
  return (
    <Tarjeta titulo={`Alertas activas (${alertas.length})`} sinPadding>
      <Tabla
        sinTope
        nombreExport="reporte-alertas"
        filas={alertas}
        conBusqueda={false}
        columnas={[
          { clave: 'tipo', titulo: 'Tipo', ancho: 230, render: (f) => ETIQUETAS_ALERTA[f.tipo] ?? f.tipo, formatoCSV: (v) => ETIQUETAS_ALERTA[v] ?? v },
          { clave: 'titulo', titulo: 'Detalle' },
          { clave: 'area', titulo: 'Área', ancho: 170 },
          { clave: 'responsable', titulo: 'Responsable', ancho: 125 },
          {
            clave: 'dias_atraso',
            titulo: 'Atraso',
            ancho: 90,
            alinear: 'derecha',
            render: (f) => (f.dias_atraso > 0 ? <Chip tono="vencido">{f.dias_atraso} d</Chip> : <span className="text-tenue">—</span>),
          },
        ]}
        vacio={<Vacio compacto titulo="Sin alertas activas en este recorte" />}
      />
    </Tarjeta>
  );
}

function BloqueTemas({ filas }) {
  return (
    <Tarjeta titulo={`Temas de monitoreo (${filas.length})`} sinPadding>
      <Tabla
        sinTope
        nombreExport="reporte-temas"
        filas={filas}
        conBusqueda={false}
        columnas={[
          { clave: 'fecha', titulo: 'Fecha', ancho: 100, render: (f) => fFecha(f.fecha), formatoCSV: fFecha },
          { clave: 'area', titulo: 'Área', ancho: 170 },
          { clave: 'categoria', titulo: 'Categoría', ancho: 170 },
          { clave: 'descripcion', titulo: 'Tema' },
          { clave: 'criticidad', titulo: 'Criticidad', ancho: 105, render: (f) => <Criticidad nivel={f.criticidad} /> },
          { clave: 'resuelto', titulo: 'Estado', ancho: 110, render: (f) => (f.resuelto ? <Chip tono="enregla">resuelto</Chip> : <Chip tono="vencido">sin resolver</Chip>) },
        ]}
        vacio={<Vacio compacto titulo="Sin temas de monitoreo en este recorte" />}
      />
    </Tarjeta>
  );
}

function BloqueMinutas({ seguimientos }) {
  const conTexto = seguimientos.filter((s) => s.texto_crudo?.trim());
  return (
    <Tarjeta titulo={`Minutas de seguimiento (${conTexto.length})`}>
      {conTexto.length === 0 ? (
        <Vacio compacto titulo="Sin minutas en este recorte" descripcion="Sólo se incluyen los seguimientos realizados con texto cargado." />
      ) : (
        <div className="flex flex-col gap-3">
          {conTexto.map((s) => (
            <article key={s.id} className="bloque-reporte rounded-chip border border-borde p-3">
              <header className="mb-1.5 flex flex-wrap items-center gap-2">
                <Chip tono="acento">{fFecha(s.fecha)}</Chip>
                <span className="text-sm font-medium text-tinta">{s.area}</span>
                {s.participantes && <span className="text-[11px] text-tenue">{s.participantes}</span>}
              </header>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-gris">{s.texto_crudo}</p>
              {(s.avances?.length > 0 || s.problemas?.length > 0) && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {s.avances?.length > 0 && (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-enregla-texto">Avances informados</p>
                      <ul className="list-inside list-disc text-[11px] text-gris">
                        {s.avances.map((a, i) => (
                          <li key={i}>{textoDe(a)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {s.problemas?.length > 0 && (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-vencido-texto">Problemas / trabas</p>
                      <ul className="list-inside list-disc text-[11px] text-gris">
                        {s.problemas.map((p, i) => (
                          <li key={i}>{textoDe(p)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

function BloqueMesas({ filas }) {
  return (
    <Tarjeta titulo={`Mesas de trabajo (${filas.length})`} sinPadding>
      <Tabla
        sinTope
        nombreExport="reporte-mesas"
        filas={filas}
        conBusqueda={false}
        columnas={[
          { clave: 'nombre', titulo: 'Mesa' },
          { clave: 'tipo', titulo: 'Tipo', ancho: 140, render: (f) => <Chip tono="acento">{f.tipo}</Chip> },
          { clave: 'referente', titulo: 'Referente', ancho: 130 },
          { clave: 'periodicidad', titulo: 'Periodicidad', ancho: 115 },
          { clave: 'estado', titulo: 'Estado', ancho: 100 },
          { clave: 'cantidad_reuniones', titulo: 'Reuniones', ancho: 95, alinear: 'derecha' },
          { clave: 'ultima_reunion', titulo: 'Última', ancho: 105, render: (f) => (f.ultima_reunion ? fFecha(f.ultima_reunion) : '—'), formatoCSV: (v) => (v ? fFecha(v) : '') },
        ]}
        vacio={<Vacio compacto titulo="Sin mesas en este recorte" />}
      />
    </Tarjeta>
  );
}

function BloqueEventos({ filas }) {
  return (
    <Tarjeta titulo={`Eventos (${filas.length})`} sinPadding>
      <Tabla
        sinTope
        nombreExport="reporte-eventos"
        filas={filas}
        conBusqueda={false}
        columnas={[
          { clave: 'fecha', titulo: 'Fecha', ancho: 100, render: (f) => fFecha(f.fecha), formatoCSV: fFecha },
          { clave: 'nombre', titulo: 'Evento' },
          { clave: 'lugar', titulo: 'Lugar', ancho: 180 },
          { clave: 'area_organizadora', titulo: 'Área', ancho: 170 },
          { clave: 'estado', titulo: 'Estado', ancho: 105 },
          {
            clave: 'requerimientos',
            titulo: 'Requerimientos',
            ancho: 145,
            valorOrden: (f) => f.requerimientos.porcentaje,
            render: (f) => (f.requerimientos.total ? <BarraAvance valor={f.requerimientos.porcentaje} /> : <span className="text-tenue">—</span>),
            formatoCSV: (v) => `${v.confirmados}/${v.total}`,
          },
        ]}
        vacio={<Vacio compacto titulo="Sin eventos en este recorte" />}
      />
    </Tarjeta>
  );
}
