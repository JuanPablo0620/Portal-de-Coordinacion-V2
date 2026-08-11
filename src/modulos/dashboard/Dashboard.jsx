import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CalendarCheck,
  Database,
  HardHat,
  History,
  Star,
} from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { BarraAvance, Boton, Chip, EstadoProyecto, Metrica, Semaforo, Tarjeta, Vacio } from '../../componentes/Basicos.jsx';
import { Calendario, useMesVisible } from '../../componentes/Calendario.jsx';
import { vencimientosProximos } from '../../datos/alertas.js';
import {
  feedBitacora,
  hoyISO,
  itemsCalendario,
  proyectos as selProyectos,
  seguimientos as selSeguimientos,
  esProyectoActivo,
  activos,
  diasHasta,
} from '../../datos/selectores.js';
import { fecha as fFecha, haceCuanto, textoVencimiento } from '../../utilidades/formato.js';
import { acciones, useBD } from '../../estado/tienda.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';

const CAPAS_DEFAULT = { seguimientos: true, eventos: true, mesas: true, vencimientos: true };

export default function Dashboard() {
  const bd = useBD();
  const navegar = useNavigate();
  const hoy = hoyISO();
  const mes = useMesVisible(hoy);
  const [filtros, setFiltros] = useFiltrosUrl(CAPAS_DEFAULT);

  // Objeto memorizado, no literal: es dependencia del `useMemo` que arma los
  // items del calendario, y uno nuevo por render lo invalidaba siempre.
  const capas = useMemo(
    () => ({
      seguimientos: filtros.seguimientos !== false,
      eventos: filtros.eventos !== false,
      mesas: filtros.mesas !== false,
      vencimientos: filtros.vencimientos !== false,
    }),
    [filtros.seguimientos, filtros.eventos, filtros.mesas, filtros.vencimientos],
  );

  const vencimientos = useMemo(() => (bd ? vencimientosProximos(bd, hoy, 15) : []), [bd, hoy]);
  /**
   * Lo atrasado y lo que viene se separan.
   *
   * La lista mezclaba las dos cosas ordenadas por fecha, así que con la base
   * cargada las catorce filas visibles eran todas deuda de hace meses y lo que
   * vencía esta semana —el motivo por el que existe la tarjeta— no entraba en
   * pantalla. El arrastre no se esconde: se resume arriba y linkea a las alertas.
   */
  const atrasados = useMemo(() => vencimientos.filter((v) => v.dias < 0), [vencimientos]);
  const porVenir = useMemo(() => vencimientos.filter((v) => v.dias >= 0), [vencimientos]);
  const proximosSeguimientos = useMemo(() => {
    if (!bd) return [];
    return selSeguimientos(bd, { tipo: 'programado' })
      .filter((s) => diasHasta(s.fecha, hoy) >= 0)
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
      .slice(0, 6);
  }, [bd, hoy]);
  /**
   * El contador y la lista son dos cosas distintas.
   *
   * Estaban en una: el contador mostraba el largo de la lista YA recortada a
   * seis, así que el tablero decía «6 prioritarios activos» hubiera seis o
   * cuarenta y seis. Con el set chico el recorte no llegaba a activarse y el
   * número parecía correcto.
   */
  const prioritariosTodos = useMemo(
    () => (bd ? selProyectos(bd, { solo_prioritarios: true, solo_activos: true }) : []),
    [bd],
  );
  const prioritarios = useMemo(() => prioritariosTodos.slice(0, 6), [prioritariosTodos]);
  const feed = useMemo(() => (bd ? feedBitacora(bd, 10) : []), [bd]);
  const items = useMemo(() => (bd ? itemsCalendario(bd, capas, mes.rango[0], mes.rango[1]) : []), [bd, capas, mes.rango]);

  const proyectosActivos = useMemo(() => (bd ? activos(bd.proyectos).filter(esProyectoActivo) : []), [bd]);
  const obrasActivas = proyectosActivos.filter((p) => p.es_obra);
  const sistemaVacio = (bd?.proyectos ?? []).length === 0;

  if (sistemaVacio) {
    return (
      <>
        <EncabezadoPagina titulo="Inicio" descripcion="Panel de coordinación · Municipio de Tres de Febrero" />
        <Pagina>
          <Tarjeta>
            <Vacio
              icono={Database}
              titulo="El sistema está vacío"
              descripcion="Cargá el primer proyecto en la base maestra, o cargá los datos de demostración para ver los siete módulos funcionando con contenido."
              accion={{ texto: 'Cargar datos de demostración', icono: Database, alHacerClic: () => acciones.cargarDemo(hoy) }}
            />
            <div className="mt-1 flex justify-center">
              <Boton variante="fantasma" tamanio="sm" onClick={() => navegar('/proyectos')}>
                O cargar un proyecto a mano
              </Boton>
            </div>
          </Tarjeta>
        </Pagina>
      </>
    );
  }

  return (
    <>
      <EncabezadoPagina titulo="Inicio" descripcion={`Panel de coordinación · ${fFecha(hoy)}`} />

      <Pagina className="flex flex-col gap-4">
        {/* Contadores */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metrica
            icono={Activity}
            valor={proyectosActivos.length}
            etiqueta="Proyectos activos"
            detalle="planificados, en ejecución o demorados"
            alHacerClic={() => navegar('/proyectos?solo_activos=1')}
          />
          <Metrica
            icono={HardHat}
            valor={obrasActivas.length}
            etiqueta="Obras activas"
            detalle="proyectos marcados como obra"
            alHacerClic={() => navegar('/proyectos?solo_activos=1&es_obra=1')}
          />
          <Metrica
            icono={AlertTriangle}
            tono="vencido"
            valor={atrasados.length}
            etiqueta="Vencidos"
            detalle="compromisos, hitos y fines previstos"
            alHacerClic={() => navegar('/monitoreo?tab=alertas')}
          />
          <Metrica
            icono={Star}
            valor={prioritariosTodos.length}
            etiqueta="Prioritarios activos"
            detalle="proyectos de prioridad alta"
            alHacerClic={() => navegar('/proyectos?solo_prioritarios=1&solo_activos=1')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Columna izquierda */}
          <div className="flex flex-col gap-4">
            <Tarjeta
              titulo="Próximos vencimientos importantes"
              descripcion="Compromisos, hitos y fines previstos de los próximos 15 días."
              sinPadding
            >
              {atrasados.length > 0 && (
                <Link
                  to="/monitoreo?tab=alertas"
                  className="flex items-center gap-2 border-b border-borde bg-vencido-suave/60 px-4 py-2 transition hover:bg-vencido-suave"
                >
                  <AlertTriangle size={14} className="shrink-0 text-vencido-texto" />
                  <span className="text-xs text-tinta">
                    <span className="tabular font-semibold">{atrasados.length}</span> vencidos de antes, todavía sin cerrar
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-acento">Ver alertas</span>
                </Link>
              )}
              {porVenir.length === 0 ? (
                <Vacio
                  compacto
                  titulo="Nada vence en los próximos 15 días"
                  descripcion={atrasados.length ? 'Lo que figura arriba ya está vencido.' : 'Todo al día por ahora.'}
                />
              ) : (
                <ul className="scroll-fino max-h-80 overflow-y-auto">
                  {porVenir.slice(0, 14).map((v, i) => (
                    <li key={`${v.clase}-${i}`}>
                      <Link
                        to={v.ruta}
                        className="flex items-start gap-2.5 border-b border-borde/60 px-4 py-2.5 transition hover:bg-paper"
                      >
                        <Semaforo nivel={v.nivel} soloPunto texto={textoVencimiento(v.dias)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm leading-tight text-tinta">{v.titulo}</p>
                          <p className="truncate text-[11px] text-tenue">
                            {v.clase} {v.detalle ? `· ${v.detalle}` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tabular text-xs text-tinta">{fFecha(v.fecha)}</p>
                          <p
                            className="text-[11px]"
                            style={{ color: v.dias < 0 ? 'var(--color-vencido)' : 'var(--color-tenue)' }}
                          >
                            {textoVencimiento(v.dias)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                  {porVenir.length > 14 && (
                    <li className="px-4 py-2 text-[11px] text-tenue">
                      y {porVenir.length - 14} vencimiento{porVenir.length - 14 === 1 ? '' : 's'} más en la quincena
                    </li>
                  )}
                </ul>
              )}
            </Tarjeta>

            <Tarjeta
              titulo="Próximos seguimientos"
              descripcion="Reuniones de seguimiento agendadas."
              sinPadding
              acciones={
                <Boton tamanio="sm" variante="fantasma" onClick={() => navegar('/seguimiento?tab=agenda')}>
                  Agendar
                </Boton>
              }
            >
              {proximosSeguimientos.length === 0 ? (
                <Vacio
                  compacto
                  icono={CalendarCheck}
                  titulo="Sin seguimientos agendados"
                  accion={{ texto: 'Agendar seguimiento', alHacerClic: () => navegar('/seguimiento?tab=agenda') }}
                />
              ) : (
                <ul>
                  {proximosSeguimientos.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/seguimiento?tab=calendario&seguimiento=${s.id}`}
                        className="flex items-center gap-3 border-b border-borde/60 px-4 py-2.5 transition hover:bg-paper"
                      >
                        <div className="w-11 shrink-0 rounded-chip bg-acento-suave py-1 text-center">
                          <p className="tabular text-sm font-semibold leading-none text-acento-fuerte">
                            {s.fecha.slice(8, 10)}
                          </p>
                          <p className="text-[10px] uppercase text-acento">{MES_CORTO[Number(s.fecha.slice(5, 7)) - 1]}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm leading-tight text-tinta">{s.area}</p>
                          <p className="truncate text-[11px] text-tenue">
                            {s.hora ? `${s.hora} · ` : ''}
                            {(s.ids_proyecto ?? []).length} proyecto(s)
                          </p>
                        </div>
                        <span className="tabular shrink-0 text-[11px] text-gris">
                          {textoVencimiento(diasHasta(s.fecha, hoy))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          </div>

          {/* Columna derecha */}
          <Tarjeta titulo="Calendario" descripcion="Seguimientos, eventos, reuniones de mesa y vencimientos.">
            <Calendario
              anio={mes.anio}
              mes={mes.mes}
              items={items}
              hoy={hoy}
              capas={capas}
              alCambiarCapas={setFiltros}
              alMover={mes.mover}
              alVolverAHoy={mes.volverAHoy}
            />
          </Tarjeta>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Tarjeta
            titulo="Proyectos prioritarios"
            descripcion="Proyectos activos de prioridad alta."
            sinPadding
            acciones={
              <Boton tamanio="sm" variante="fantasma" onClick={() => navegar('/proyectos?solo_prioritarios=1')}>
                Ver todos
              </Boton>
            }
          >
            {prioritarios.length === 0 ? (
              <Vacio
                compacto
                icono={Star}
                titulo="Ningún proyecto marcado como prioritario"
                descripcion="Marcá prioridad alta en la ficha de un proyecto para que aparezca acá."
                accion={{ texto: 'Ir a proyectos', alHacerClic: () => navegar('/proyectos') }}
              />
            ) : (
              <ul>
                {prioritarios.map((p) => (
                  <li key={p.id_proyecto}>
                    <Link
                      to={`/proyectos/${p.id_proyecto}`}
                      className="flex items-center gap-3 border-b border-borde/60 px-4 py-2.5 transition hover:bg-paper"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm leading-tight text-tinta">{p.proyecto}</p>
                        <p className="truncate text-[11px] text-tenue">{p.area}</p>
                      </div>
                      <div className="w-28 shrink-0">
                        <BarraAvance valor={p.porcentaje_avance} />
                      </div>
                      <div className="w-24 shrink-0 text-right">
                        <EstadoProyecto estado={p.estado} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo="Última actualización" descripcion="Las 10 cargas más recientes del sistema." sinPadding>
            {feed.length === 0 ? (
              <Vacio compacto icono={History} titulo="Sin movimientos registrados" />
            ) : (
              <ol>
                {feed.map((h) => (
                  <li key={h.id} className="flex items-start gap-2.5 border-b border-borde/60 px-4 py-2 last:border-0">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-acento-medio" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-snug text-tinta">
                        <strong className="font-medium">{h.creado_por}</strong> {ACCION[h.accion] ?? h.accion}{' '}
                        {ENTIDAD[h.entidad] ?? h.entidad}
                        {h.id_proyecto && (
                          <>
                            {' '}
                            en <Chip tono="acento">{h.id_proyecto}</Chip>
                          </>
                        )}
                      </p>
                      <p className="text-[11px] text-tenue">{haceCuanto(h.creado_en)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Tarjeta>
        </div>
      </Pagina>
    </>
  );
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ACCION = { alta: 'cargó', edicion: 'actualizó', baja: 'dio de baja' };
const ENTIDAD = {
  proyectos: 'un proyecto',
  seguimientos: 'un seguimiento',
  compromisos: 'un compromiso',
  monitoreos: 'un monitoreo',
  temas_monitoreo: 'un tema de monitoreo',
  mesas: 'una mesa',
  reuniones_mesa: 'una reunión de mesa',
  eventos: 'un evento',
  requerimientos_evento: 'un requerimiento',
  planificacion_anual: 'una planificación',
  reportes_guardados: 'un reporte guardado',
};
