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
import { BarraAvance, Chip, EstadoProyecto, Semaforo, Tarjeta, Vacio, nivelPorDias } from '../../componentes/Basicos.jsx';
import { Tabla } from '../../componentes/Tabla.jsx';
import { fecha as fFecha, fechaLarga, numero } from '../../utilidades/formato.js';
import { agruparParaInforme } from '../../datos/reportes.js';

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
          {/* El orden es el de la reunión: primero el número, después lo que
              reclama acción, después lo que se conversó, y al final el detalle
              de respaldo. No es alfabético ni el orden en que se programó. */}
          {bloques.resumen && <BloqueResumen resumen={reporte.resumen} />}
          {/* Va pegada al resumen y no a cada tabla: quien recibe el informe
              impreso no tiene un tooltip donde preguntar qué significa un
              punto naranja, y repetirla en cada bloque la vuelve ruido. */}
          {bloques.resumen && (bloques.compromisos || bloques.proyectos) && (
            <BloqueLeyenda conCompromisos={bloques.compromisos} conProyectos={bloques.proyectos} />
          )}
          {bloques.compromisos && <BloqueCompromisos filas={reporte.compromisos} />}
          {bloques.mesas && <BloqueMesas filas={reporte.mesas} />}
          {bloques.minutas && <BloqueMinutas seguimientos={reporte.seguimientos} />}
          {bloques.proyectos && <BloqueProyectos filas={reporte.proyectos} />}
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

/**
 * Qué significa cada color, para quien lee el informe en papel.
 *
 * Los dos vocabularios son distintos y conviene no mezclarlos: el de un
 * compromiso habla de su PLAZO —cuánto falta o cuánto hace que venció— y el
 * de un proyecto, de su ESTADO declarado. El mismo verde dice cosas
 * diferentes en cada tabla.
 */
function BloqueLeyenda({ conCompromisos, conProyectos }) {
  const compromisos = [
    ['vencido', 'vencido: pasó la fecha límite y sigue sin cumplirse'],
    ['proximo', 'vence en 3 días o menos'],
    ['atencion', 'vence entre 4 y 15 días'],
    ['enregla', 'vence en más de 15 días, o ya está cumplido'],
    ['sindato', 'sin fecha límite cargada'],
  ];
  const proyectos = [
    ['vencido', 'suspendido'],
    ['proximo', 'demorado'],
    ['enregla', 'en ejecución'],
    ['sindato', 'planificado'],
  ];

  return (
    <Tarjeta titulo="Cómo leer los colores">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {conCompromisos && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-tenue">
              Compromisos · por plazo
            </p>
            <ul className="flex flex-col gap-1">
              {compromisos.map(([nivel, texto]) => (
                <li key={nivel} className="flex items-start gap-2 text-xs leading-snug text-gris">
                  <span className="mt-1 shrink-0">
                    <Semaforo nivel={nivel} soloPunto texto={texto} />
                  </span>
                  {texto}
                </li>
              ))}
            </ul>
          </div>
        )}
        {conProyectos && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-tenue">
              Proyectos · por estado
            </p>
            <ul className="flex flex-col gap-1">
              {proyectos.map(([nivel, texto]) => (
                <li key={nivel} className="flex items-start gap-2 text-xs leading-snug text-gris">
                  <span className="mt-1 shrink-0">
                    <Semaforo nivel={nivel} soloPunto texto={texto} />
                  </span>
                  {texto}
                </li>
              ))}
              <li className="flex items-start gap-2 text-xs leading-snug text-gris">
                <Chip tono="acento">Finalizado</Chip>
                <span className="mt-0.5">terminado, no va más al seguimiento</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </Tarjeta>
  );
}

/**
 * Columna vacía para escribir a mano sobre el informe impreso.
 *
 * Va última en cada tabla y no lleva nada: el punto es el espacio. Se queda
 * fuera del CSV —no hay nada que exportar— y no se puede ordenar por ella.
 */
const COLUMNA_ANOTACIONES = {
  clave: 'anotaciones',
  titulo: 'Anotaciones',
  ancho: 190,
  sinOrdenar: true,
  sinExportar: true,
  render: () => '',
};

function BloqueResumen({ resumen }) {
  const items = [
    ['Proyectos', numero(resumen.proyectos)],
    ['Obras', numero(resumen.obras)],
    ['Prioritarios', numero(resumen.prioritarios)],
    ['Compromisos', numero(resumen.compromisos)],
    ['Compromisos vencidos', numero(resumen.compromisosVencidos)],
    ['Seguimientos', numero(resumen.seguimientos)],
    ['Monitoreos', numero(resumen.monitoreos)],
    ['Eventos', numero(resumen.eventos)],
    ['Alertas activas', numero(resumen.alertas)],
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
          COLUMNA_ANOTACIONES,
        ]}
        vacio={<Vacio compacto titulo="Ningún proyecto cumple los filtros aplicados" />}
      />
    </Tarjeta>
  );
}

/**
 * Los compromisos, en lista y agrupados por secretaría.
 *
 * No es una tabla a propósito. Lo que hay que leer de un compromiso es su
 * texto —una oración entera, a veces dos renglones— y eso en una celda de
 * tabla se aprieta contra las columnas de al lado o se corta. En lista, el
 * compromiso ocupa el ancho de la hoja y los datos que lo acompañan —origen,
 * vencimiento, estado— van abajo, en una línea que se lee de corrido.
 *
 * Debajo va la última novedad cargada. Es la diferencia entre «esto vence el
 * 30» y «esto vence el 30, y hace tres días el área avisó que está trabado en
 * Legales»: lo primero es una fecha, lo segundo es de lo que hay que hablar en
 * la reunión.
 */
function BloqueCompromisos({ filas }) {
  if (filas.length === 0) {
    return (
      <Tarjeta titulo="Compromisos (0)">
        <Vacio compacto titulo="Ningún compromiso cumple los filtros aplicados" />
      </Tarjeta>
    );
  }

  return (
    <>
      {agruparParaInforme(filas).map(([area, deLArea]) => (
        <Tarjeta key={area} titulo={`Compromisos · ${area} (${deLArea.length})`}>
          <ol className="flex flex-col">
            {deLArea.map((c) => (
              <FichaCompromiso key={c.id} compromiso={c} />
            ))}
          </ol>
        </Tarjeta>
      ))}
    </>
  );
}

function FichaCompromiso({ compromiso: c }) {
  const nivel = c.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(c.dias_restantes);
  const plazo =
    c.estado_efectivo === 'alerta'
      ? `venció el ${fFecha(c.fecha_limite)} · ${c.dias_atraso} días de atraso`
      : c.fecha_limite
        ? `vence el ${fFecha(c.fecha_limite)}`
        : 'sin fecha límite';

  return (
    <li className="border-b border-borde/70 py-2.5 last:border-0">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 shrink-0">
          <Semaforo nivel={nivel} soloPunto texto={c.estado_efectivo} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-tinta">{c.descripcion}</p>

          {/* Los datos que en la tabla eran columnas, acá en una sola línea. */}
          <p className="mt-0.5 text-[11px] text-tenue">
            <Semaforo
              nivel={nivel}
              texto={c.estado_efectivo === 'alerta' ? 'vencido' : c.estado_efectivo}
            />
            <span className="ml-1.5">{plazo}</span>
            {c.origen_tipo && <span className="ml-1.5">· origen: {c.origen_tipo}</span>}
            {c.id_proyecto && <span className="ml-1.5">· {c.id_proyecto}</span>}
          </p>

          <UltimaNovedad novedad={c.ultima_actualizacion} />
        </div>

        {/* El espacio para escribir a mano, igual que la columna de las tablas. */}
        <span
          aria-hidden="true"
          className="ml-2 hidden w-40 shrink-0 self-stretch border-b border-dashed border-borde-fuerte/50 print:block"
        />
      </div>
    </li>
  );
}

/**
 * La última novedad, o el silencio.
 *
 * Que un compromiso no tenga ninguna es información: significa que desde que
 * se cargó nadie informó nada. Decirlo es más útil que dejar el hueco, porque
 * en la reunión eso es una pregunta.
 */
function UltimaNovedad({ novedad }) {
  if (!novedad) {
    return <p className="mt-1 text-[11px] italic text-tenue">Sin novedades cargadas.</p>;
  }

  const cambioDeEstado =
    novedad.estado_anterior && novedad.estado_anterior !== novedad.estado
      ? `${novedad.estado_anterior} → ${novedad.estado}`
      : '';

  return (
    <div className="mt-1 border-l-2 border-borde pl-2">
      <p className="text-[11px] text-tenue">
        Última novedad
        {novedad.fecha && <span className="tabular"> · {fFecha(novedad.fecha)}</span>}
        {cambioDeEstado && <span> · {cambioDeEstado}</span>}
      </p>
      {novedad.texto && (
        <p className="whitespace-pre-line text-xs leading-snug text-gris">{novedad.texto}</p>
      )}
    </div>
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
          {
            clave: 'areas',
            titulo: 'Secretarías',
            ancho: 200,
            sinOrdenar: true,
            formatoCSV: (v) => (v ?? []).join(' · '),
            // Una mesa no tiene área propia: las que salen acá son las que
            // asumieron algún compromiso en sus reuniones.
            render: (f) =>
              f.areas?.length ? f.areas.join(' · ') : <span className="text-tenue">sin compromisos</span>,
          },
          { clave: 'referente', titulo: 'Referente', ancho: 130 },
          { clave: 'periodicidad', titulo: 'Periodicidad', ancho: 115 },
          { clave: 'estado', titulo: 'Estado', ancho: 100 },
          { clave: 'cantidad_reuniones', titulo: 'Reuniones', ancho: 95, alinear: 'derecha' },
          { clave: 'ultima_reunion', titulo: 'Última', ancho: 105, render: (f) => (f.ultima_reunion ? fFecha(f.ultima_reunion) : '—'), formatoCSV: (v) => (v ? fFecha(v) : '') },
          COLUMNA_ANOTACIONES,
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
          COLUMNA_ANOTACIONES,
        ]}
        vacio={<Vacio compacto titulo="Sin eventos en este recorte" />}
      />
    </Tarjeta>
  );
}
