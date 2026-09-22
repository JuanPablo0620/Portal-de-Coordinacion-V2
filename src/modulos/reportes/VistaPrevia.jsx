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
import { Chip, EstadoProyecto, Semaforo, Tarjeta, Vacio, nivelPorDias } from '../../componentes/Basicos.jsx';
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
  // La plantilla de Dirección imprime lo vigente completo, con el diseño
  // institucional (navy/naranja) que JP aprobó el 21/09/2026: sin renglones
  // de anotaciones ni datos de proyecto, barras navy en vez de tarjetas por
  // secretaría, y sin resumen/leyenda/observaciones (esos bloques quedan
  // apagados en la plantilla, ver `plantillasReportes.js`).
  const institucional = Boolean(reporte.plantilla?.compacto);

  return (
    <div className={`flex flex-col gap-4 ${institucional ? 'informe-institucional' : ''}`}>
      <EncabezadoImpresion hoy={hoy} titulo={reporte.plantilla?.nombre} />

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
          {bloques.eventos && institucional && (
            <BloqueEventosInstitucional filas={reporte.eventos} rango={reporte.rangoEventos} />
          )}
          {bloques.compromisos && (institucional ? (
            <BloqueCompromisosInstitucional filas={reporte.compromisos} />
          ) : (
            <BloqueCompromisos filas={reporte.compromisos} ausentes={reporte.compromisosAusentes} />
          ))}
          {bloques.mesas && (institucional ? (
            <BloqueMesasInstitucional filas={reporte.mesas} />
          ) : (
            <BloqueMesas filas={reporte.mesas} />
          ))}
          {bloques.minutas && (
            <BloqueObservaciones seguimientos={reporte.seguimientos} compromisos={reporte.compromisos} />
          )}
          {bloques.monitoreos && <BloqueMonitoreos filas={reporte.monitoreos} />}
          {bloques.proyectos && <BloqueProyectos filas={reporte.proyectos} ausentes={reporte.proyectosAusentes} />}
          {bloques.eventos && !institucional && <BloqueEventos filas={reporte.eventos} rango={reporte.rangoEventos} />}
        </>
      )}

      <PieImpresion filtros={reporte.resumenFiltros} hoy={hoy} />
    </div>
  );
}

/* ── Encabezado y pie institucionales ───────────────────────────────── */

function EncabezadoImpresion({ hoy, titulo }) {
  const subtitulo = titulo ?? 'Reporte de seguimiento de proyectos';
  return (
    <>
      {/* Sólo al imprimir */}
      <header className="solo-impresion encabezado-impresion">
        <p className="titulo-informe" style={{ fontSize: '14pt', fontWeight: 700, margin: 0 }}>Municipio de Tres de Febrero</p>
        <p style={{ fontSize: '10pt', margin: '2pt 0 0' }}>Área de Coordinación · {subtitulo}</p>
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
            Área de Coordinación · {subtitulo} · emitido el {fechaLarga(hoy)}
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


function BloqueProyectos({ filas, ausentes = [] }) {
  return (
    <Tarjeta titulo={`Proyectos (${filas.length})`} sinPadding>
      {ausentes.length > 0 && (
        <p className="border-b border-borde bg-paper px-4 py-2 text-xs text-gris">
          Pendientes de cargar: {ausentes.join(' · ')}
        </p>
      )}
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

function BloqueMonitoreos({ filas }) {
  return (
    <Tarjeta titulo={`Monitoreos (${filas.length})`} sinPadding>
      <Tabla
        sinTope
        nombreExport="reporte-monitoreos"
        filas={filas}
        claveFila={(f) => f.id}
        conBusqueda={false}
        columnas={[
          { clave: 'fecha', titulo: 'Fecha', ancho: 120, render: (f) => fFecha(f.fecha) },
          { clave: 'area', titulo: 'Área', ancho: 190 },
          { clave: 'cantidad_avances', titulo: 'Avances', ancho: 100, render: (f) => numero(f.cantidad_avances) },
          { clave: 'cantidad_compromisos', titulo: 'Compromisos', ancho: 125, render: (f) => numero(f.cantidad_compromisos) },
          { clave: 'cantidad_temas', titulo: 'Temas', ancho: 90, render: (f) => numero(f.cantidad_temas) },
          { clave: 'cerrado', titulo: 'Estado', ancho: 110, render: (f) => <Chip tono={f.cerrado ? 'enregla' : 'proximo'}>{f.cerrado ? 'Cerrado' : 'Abierto'}</Chip> },
          COLUMNA_ANOTACIONES,
        ]}
        vacio={<Vacio compacto titulo="Ningún monitoreo cumple los filtros aplicados" />}
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
function BloqueCompromisos({ filas, ausentes = [] }) {
  if (filas.length === 0) {
    return (
      <Tarjeta titulo="Compromisos (0)">
        {ausentes.length > 0 && (
          <p className="mb-3 text-xs text-gris">Pendientes de cargar: {ausentes.join(' · ')}</p>
        )}
        <Vacio compacto titulo="Ningún compromiso cumple los filtros aplicados" />
      </Tarjeta>
    );
  }

  return (
    <>
      {ausentes.length > 0 && (
        <p className="rounded-card border border-borde bg-paper px-4 py-2 text-xs text-gris">
          Pendientes de cargar: {ausentes.join(' · ')}
        </p>
      )}
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
    // `evitar-corte` mantiene junto al compromiso con sus renglones: partirlo
    // deja media ficha en una hoja y el espacio para anotar en la siguiente,
    // que es peor que dejar el hueco al pie.
    <li className="evitar-corte border-b border-borde/70 py-4 last:border-0">
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 shrink-0">
          <Semaforo nivel={nivel} soloPunto texto={c.estado_efectivo} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-tinta">{c.descripcion}</p>

          {/* Los datos que en la tabla eran columnas, acá en una sola línea. */}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-tenue">
            <Semaforo
              nivel={nivel}
              texto={c.estado_efectivo === 'alerta' ? 'vencido' : c.estado_efectivo}
            />
            <span>{plazo}</span>
            {c.origen_tipo && <span>· origen: {c.origen_tipo}</span>}
            {c.id_proyecto && <span>· {c.id_proyecto}</span>}
          </p>

          <UltimaNovedad novedad={c.ultima_actualizacion} />
          <Anotaciones />
        </div>
      </div>
    </li>
  );
}

/**
 * Novedad de un compromiso, sin ruido.
 *
 * El alta automática («Alta del compromiso», «Estado al empezar a
 * registrarse el historial») no dice nada que la ficha no diga ya, y hoy es
 * la novedad de la mayoría de los compromisos activos (ver traspaso
 * 22/09/2026). En el diseño institucional se omite entera; sólo se imprime
 * cuando alguien escribió algo de verdad.
 */
function novedadUtil(c) {
  const texto = c.ultima_actualizacion?.texto?.trim();
  if (!texto) return null;
  if (/^(alta del compromiso|estado al empezar a registrarse)/i.test(texto)) return null;
  return c.ultima_actualizacion;
}

/**
 * Tres renglones en blanco para escribir sobre el informe impreso.
 *
 * Van debajo de cada compromiso y no en una columna al costado: lo que se
 * anota en una reunión es una frase, no una palabra, y al costado no entra.
 */
function Anotaciones() {
  return (
    <div className="mt-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-tenue">Anotaciones</p>
      <div className="mt-1 flex flex-col">
        {[0, 1, 2].map((i) => (
          <span key={i} aria-hidden="true" className="h-[18px] border-b border-dotted border-borde-fuerte/40" />
        ))}
      </div>
    </div>
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
    return <p className="mt-2 text-[11px] italic text-tenue">Sin novedades cargadas.</p>;
  }

  const cambioDeEstado =
    novedad.estado_anterior && novedad.estado_anterior !== novedad.estado
      ? `${novedad.estado_anterior} → ${novedad.estado}`
      : '';

  return (
    <div className="mt-2 border-l-2 border-borde py-0.5 pl-2.5">
      <p className="text-[11px] text-tenue">
        Última novedad
        {novedad.fecha && <span className="tabular"> · {fFecha(novedad.fecha)}</span>}
        {cambioDeEstado && <span> · {cambioDeEstado}</span>}
      </p>
      {novedad.texto && (
        <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-gris">{novedad.texto}</p>
      )}
    </div>
  );
}




/**
 * Lo que dejó cada seguimiento: avances, problemas y compromisos asumidos.
 *
 * NO se incluye el texto de «Lo conversado». Es la transcripción cruda de la
 * reunión —media carilla por seguimiento, escrita al correr— y lo que importa
 * en un informe es lo que se decidió, no cómo se llegó. El texto sigue estando
 * en el seguimiento, para quien necesite volver a él.
 *
 * Por eso también un seguimiento sin ninguna de las tres cosas no aparece: si
 * no dejó avance, ni problema, ni compromiso, no hay nada que informar.
 */
function BloqueObservaciones({ seguimientos, compromisos }) {
  const porSeguimiento = new Map();
  for (const c of compromisos) {
    if (c.origen_tipo !== 'seguimiento' || !c.id_origen) continue;
    if (!porSeguimiento.has(c.id_origen)) porSeguimiento.set(c.id_origen, []);
    porSeguimiento.get(c.id_origen).push(c);
  }

  const conContenido = seguimientos
    .map((s) => ({ ...s, compromisos: porSeguimiento.get(s.id) ?? [] }))
    .filter((s) => s.avances?.length || s.problemas?.length || s.compromisos.length);

  return (
    <Tarjeta titulo={`Observaciones de Seguimiento (${conContenido.length})`}>
      {conContenido.length === 0 ? (
        <Vacio
          compacto
          titulo="Sin observaciones en este recorte"
          descripcion="Sólo se incluyen los seguimientos que dejaron un avance, un problema o un compromiso."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {conContenido.map((s) => (
            <article key={s.id} className="evitar-corte rounded-chip border border-borde p-3">
              <header className="mb-2 flex flex-wrap items-center gap-2">
                <Chip tono="acento">{fFecha(s.fecha)}</Chip>
                <span className="text-sm font-medium text-tinta">{s.area}</span>
                {s.participantes && <span className="text-[11px] text-tenue">{s.participantes}</span>}
              </header>

              <div className="flex flex-col gap-2">
                <ListaObservacion
                  titulo="Avances informados"
                  clase="text-enregla-texto"
                  items={s.avances}
                />
                <ListaObservacion
                  titulo="Problemas / trabas"
                  clase="text-vencido-texto"
                  items={s.problemas}
                />
                {s.compromisos.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-acento">Compromisos asumidos</p>
                    <ul className="flex flex-col gap-0.5">
                      {s.compromisos.map((c) => (
                        <li key={c.id} className="text-[11px] leading-snug text-gris">
                          {c.descripcion}
                          {c.fecha_limite && (
                            <span className="tabular text-tenue"> · vence el {fFecha(c.fecha_limite)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

function ListaObservacion({ titulo, clase, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className={`mb-1 text-[11px] font-semibold ${clase}`}>{titulo}</p>
      <ul className="list-inside list-disc text-[11px] leading-snug text-gris">
        {items.map((x, i) => (
          <li key={i}>{textoDe(x)}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Las mesas, en lista y con sus compromisos, igual que los compromisos.
 *
 * Una mesa no se entiende por sus metadatos —tipo, referente, periodicidad—
 * sino por lo que se asumió en ella. En tabla, esos compromisos no entraban:
 * quedaba una fila con el nombre y un número de reuniones, que no dice nada
 * de lo que hay que seguir. Acá cada mesa abre su lista, y cada compromiso
 * dice de qué secretaría y de qué dirección es.
 */
function BloqueMesas({ filas }) {
  return (
    <Tarjeta titulo={`Mesas de trabajo (${filas.length})`}>
      {filas.length === 0 ? (
        <Vacio compacto titulo="Sin mesas en este recorte" />
      ) : (
        <ol className="flex flex-col">
          {filas.map((m) => (
            <FichaMesaInforme key={m.id} mesa={m} />
          ))}
        </ol>
      )}
    </Tarjeta>
  );
}

function FichaMesaInforme({ mesa: m }) {
  return (
    <li className="evitar-corte border-b border-borde/70 py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold leading-snug text-tinta">{m.nombre}</p>
        <Chip tono="acento">{m.tipo}</Chip>
        <Chip tono="neutro">{m.estado}</Chip>
      </div>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-tenue">
        {m.referente && <span>referente: {m.referente}</span>}
        {m.periodicidad && <span>· {m.periodicidad}</span>}
        <span>· {m.cantidad_reuniones} reunion{m.cantidad_reuniones === 1 ? '' : 'es'}</span>
        {m.ultima_reunion && <span className="tabular">· última: {fFecha(m.ultima_reunion)}</span>}
      </p>

      <CompromisosDeMesa compromisos={m.compromisos ?? []} />
      <Anotaciones />
    </li>
  );
}

/**
 * Lo que se asumió en la mesa, con la unidad que se hizo cargo.
 *
 * Que no haya ninguno es información: una mesa que se reunió y no dejó
 * compromisos es exactamente lo que hay que preguntar en la reunión
 * siguiente.
 */
function CompromisosDeMesa({ compromisos }) {
  if (compromisos.length === 0) {
    return <p className="mt-2 text-[11px] italic text-tenue">Sin compromisos asumidos en esta mesa.</p>;
  }

  return (
    <div className="mt-2 border-l-2 border-borde pl-2.5">
      <p className="mb-1 text-[11px] font-semibold text-acento">
        Compromisos de la mesa ({compromisos.length})
      </p>
      <ul className="flex flex-col gap-1.5">
        {compromisos.map((c) => {
          const nivel = c.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(c.dias_restantes);
          return (
            <li key={c.id} className="text-[11px] leading-snug text-gris">
              <span className="text-tinta">{c.descripcion}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-tenue">
                <Semaforo
                  nivel={nivel}
                  texto={c.estado_efectivo === 'alerta' ? 'vencido' : c.estado_efectivo}
                />
                {/* La secretaría y, si está cargada, la unidad de adentro. */}
                <span>{c.area || 'sin secretaría'}</span>
                {c.unidad && <span>· {c.unidad}</span>}
                {c.fecha_limite && <span className="tabular">· vence el {fFecha(c.fecha_limite)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
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
          COLUMNA_ANOTACIONES,
        ]}
        vacio={<Vacio compacto titulo="Sin eventos en este recorte" />}
      />
    </Tarjeta>
  );
}

/* ── Diseño institucional (Informe de Dirección) ──────────────────────
 *
 * Un solo bloque de impresión por sección (barra navy), con las
 * secretarías o mesas como subtítulos adentro — a diferencia del resto de
 * Reportes, que abre una tarjeta por secretaría. JP aprobó este diseño el
 * 21/09/2026 sobre un PDF armado aparte con datos reales; esto lo deja
 * fijo en el portal para que imprimir desde acá dé lo mismo. Las clases
 * `tarjeta-institucional` / `subseccion-institucional` / etc. están en
 * `src/estilos/impresion.css`, activas sólo bajo `.informe-institucional`.
 */

function BloqueCompromisosInstitucional({ filas }) {
  const grupos = agruparParaInforme(filas);
  return (
    <Tarjeta titulo={`Compromisos vigentes por secretaría (${filas.length})`} className="tarjeta-institucional" sinPadding>
      <div className="p-4">
        {grupos.length === 0 ? (
          <Vacio compacto titulo="Ningún compromiso vigente" />
        ) : (
          grupos.map(([area, deLArea]) => (
            <section key={area} className="subseccion-institucional">
              <h3>
                {area} <span>({deLArea.length})</span>
              </h3>
              <ol>
                {deLArea.map((c) => (
                  <ItemCompromisoInstitucional key={c.id} compromiso={c} />
                ))}
              </ol>
            </section>
          ))
        )}
      </div>
    </Tarjeta>
  );
}

function BloqueMesasInstitucional({ filas }) {
  return (
    <Tarjeta titulo="Compromisos de las mesas" className="tarjeta-institucional" sinPadding>
      <div className="p-4">
        {filas.length === 0 ? (
          <p className="vacio-institucional">No hay compromisos vigentes vinculados a una mesa.</p>
        ) : (
          filas.map((m) => (
            <section key={m.id} className="subseccion-institucional">
              <h3>
                {m.nombre} <span>({(m.compromisos ?? []).length})</span>
              </h3>
              <ol>
                {(m.compromisos ?? []).map((c) => (
                  <ItemCompromisoInstitucional key={c.id} compromiso={c} conSecretaria />
                ))}
              </ol>
            </section>
          ))
        )}
      </div>
    </Tarjeta>
  );
}

/** Un compromiso: texto, estado y plazo, y la novedad sólo si dice algo real. */
function ItemCompromisoInstitucional({ compromiso: c, conSecretaria = false }) {
  const vencido = c.estado_efectivo === 'alerta';
  const plazo = vencido
    ? `Vencido el ${fFecha(c.fecha_limite)} (${c.dias_atraso} día${c.dias_atraso === 1 ? '' : 's'} de atraso)`
    : c.fecha_limite
      ? `Vence el ${fFecha(c.fecha_limite)}`
      : 'Sin fecha límite';
  const estado = c.estado_efectivo === 'cumplido' ? 'Cumplido' : c.estado === 'en_curso' ? 'En curso' : 'Pendiente';
  const novedad = novedadUtil(c);

  return (
    <li className="evitar-corte">
      <p>{c.descripcion}</p>
      <p className={vencido ? 'meta-institucional vencido' : 'meta-institucional'}>
        {estado} · {plazo}
        {conSecretaria && <> · {c.area || 'sin secretaría'}</>}
      </p>
      {novedad && (
        <p className="novedad-institucional">
          Novedad ({fFecha(novedad.fecha)}): {novedad.texto}
        </p>
      )}
    </li>
  );
}

function BloqueEventosInstitucional({ filas, rango = null }) {
  const titulo = rango
    ? `Eventos del ${fFecha(rango.desde)} al ${fFecha(rango.hasta)} (${filas.length})`
    : `Eventos (${filas.length})`;
  return (
    <Tarjeta titulo={titulo} className="tarjeta-institucional" sinPadding>
      {filas.length === 0 ? (
        <p className="vacio-institucional">Sin eventos cargados para estas dos semanas.</p>
      ) : (
        <table className="tabla-institucional">
          <thead>
            <tr>
              <th>Semana</th>
              <th>Fecha</th>
              <th>Evento</th>
              <th>Lugar</th>
              <th>Área</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.semana ?? '—'}</td>
                <td className="tabular">{fFecha(ev.fecha)}</td>
                <td>{ev.nombre}</td>
                <td>{ev.lugar || '—'}</td>
                <td>{ev.area_organizadora || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Tarjeta>
  );
}
