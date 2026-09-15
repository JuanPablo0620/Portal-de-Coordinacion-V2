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
import { fecha as fFecha, fechaLarga, moneda, numero, sufijoArchivo } from '../../utilidades/formato.js';
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
          { clave: 'monto_planificado', titulo: 'Planificado', ancho: 125, alinear: 'derecha', render: (f) => moneda(f.monto_planificado) },
        ]}
        vacio={<Vacio compacto titulo="Ningún proyecto cumple los filtros aplicados" />}
      />
    </Tarjeta>
  );
}

/**
 * Los compromisos, una tabla por secretaría.
 *
 * Todos juntos no se podían repartir: en la reunión cada secretario mira lo
 * suyo, y una tabla de ciento treinta filas mezcladas obliga a leerlas todas
 * para encontrar tres. Con una tabla por área, la hoja se recorta sola.
 *
 * La columna Área se va: con el nombre de la secretaría en el título de cada
 * tabla, repetirlo en cada fila es gastar ancho en decir lo mismo.
 */
function BloqueCompromisos({ filas }) {
  const columnas = [
    { clave: 'descripcion', titulo: 'Compromiso' },
    { clave: 'origen_tipo', titulo: 'Origen', ancho: 105 },
    { clave: 'fecha_limite', titulo: 'Vence', ancho: 100, render: (f) => (f.fecha_limite ? fFecha(f.fecha_limite) : <span className="text-tenue">—</span>), formatoCSV: fFecha },
    {
      clave: 'estado_efectivo',
      titulo: 'Estado',
      ancho: 140,
      render: (f) => (
        <Semaforo
          nivel={f.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(f.dias_restantes)}
          texto={f.estado_efectivo === 'alerta' ? `vencido · ${f.dias_atraso} d` : f.estado_efectivo}
        />
      ),
    },
  ];

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
        <Tarjeta key={area} titulo={`Compromisos · ${area} (${deLArea.length})`} sinPadding>
          <Tabla
            sinTope
            nombreExport={`reporte-compromisos-${sufijoArchivo(area)}`}
            filas={deLArea}
            conBusqueda={false}
            columnas={columnas}
          />
        </Tarjeta>
      ))}
    </>
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
