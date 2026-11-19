/**
 * Módulo de Bacheo: la programación semanal de asfalto y hormigón en el mapa.
 *
 * Reemplaza al mapa que se armaba afuera del portal con los PDF de cada semana
 * (maquetas de Tomás, noviembre de 2026). Lo ven todos; carga Coordinación.
 *
 * El panel va por localidad, no por cuadrilla: la pregunta que llega a
 * Coordinación es «¿qué se hace esta semana en Caseros?». El control de día
 * es el segundo eje: elegir un día no esconde el resto de la semana en el
 * mapa, lo atenúa, para que se siga viendo dónde se trabajó o se va a
 * trabajar.
 *
 * La capa de reclamos queda para una segunda etapa (decisión de JP del
 * 17/11/2026): primero la programación, después el cruce.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Construction, MapPinOff, MapPinned, Ruler, Upload } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Aviso, Boton, BotonAlternable, Metrica, Vacio } from '../../componentes/Basicos.jsx';
import { MapaLeaflet } from '../../componentes/MapaLeaflet.jsx';
import { puedeEscribir, useRol } from '../../estado/sesion.js';
import { hoyISO } from '../../datos/tiempo.js';
import { bacheoDisponible, listarSemanas, trabajosDeSemana } from '../../datos/supabaseBacheo.js';
import { ETIQUETAS_TIPO } from '../../datos/bacheo/programacion.js';
import { verticesDe } from '../../datos/bacheo/geometria.js';
import {
  ESTADOS_UBICACION,
  agruparPorLocalidad,
  diaYMes,
  diasDeSemana,
  esProvisoria,
  letraDia,
  nombreDia,
  pasaFiltros,
  resumenSemana,
  textoTareas,
} from '../../datos/bacheo/semana.js';
import {
  consolidarPeriodo,
  esNovedadReal,
  novedadesDelPeriodo,
  periodoDeParametros,
  periodoInicial,
  rangoPeriodo,
  rotuloPeriodo,
  semanasDelPeriodo,
  semanasFaltantes,
} from '../../datos/bacheo/periodo.js';
import { encuadreDe, formasDeTrabajos, formasDelPartido, useLimitePartido } from './formas.js';
import { CargaSemana } from './CargaSemana.jsx';
import { SelectorPeriodo } from './SelectorPeriodo.jsx';

const formatoM2 = (n) => `${Math.round(n).toLocaleString('es-AR')} m²`;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const mayor = (a, b) => (a > b ? a : b);
const menor = (a, b) => (a < b ? a : b);

export default function Bacheo() {
  const rol = useRol();
  const puedeCargar = puedeEscribir(rol);
  const hoy = hoyISO();
  const [parametros, setParametros] = useSearchParams();
  const [semanas, setSemanas] = useState(null);
  const [porSemana, setPorSemana] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoPeriodo, setCargandoPeriodo] = useState(false);
  const [foco, setFoco] = useState('');
  const [tipos, setTipos] = useState(null);
  const [seleccion, setSeleccion] = useState(null);
  // Trabajos ya leídos, por id de semana: volver a un período visto no vuelve a pedir nada.
  const memoria = useRef(new Map());

  // El período vive en la URL (?semana=, ?mes=, ?trimestre=): se puede pasar el link.
  const periodo = periodoDeParametros(parametros) ?? periodoInicial(semanas ?? []);
  const clavePeriodo = periodo ? `${periodo.tipo}:${periodo.valor}` : '';
  const cambiarPeriodo = (p) => setParametros({ [p.tipo]: p.valor }, { replace: true });

  const leerSemanas = async (preferida) => {
    if (!bacheoDisponible()) {
      setSemanas([]);
      return;
    }
    try {
      const lista = await listarSemanas();
      setSemanas(lista);
      setError(null);
      const publicada = preferida && lista.find((s) => s.id === preferida);
      if (publicada) {
        memoria.current.delete(publicada.id);
        cambiarPeriodo({ tipo: 'semana', valor: publicada.lunes });
      }
    } catch (e) {
      setSemanas([]);
      setError(e);
    }
  };

  useEffect(() => {
    leerSemanas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFoco('');
    setSeleccion(null);
    if (!periodo || !semanas) {
      setPorSemana([]);
      return undefined;
    }
    const lista = semanasDelPeriodo(semanas, periodo);
    const faltan = lista.filter((s) => !memoria.current.has(s.id));
    const armar = () => lista.map((s) => ({ semana: s, trabajos: memoria.current.get(s.id) ?? [] }));
    if (!faltan.length) {
      setPorSemana(armar());
      return undefined;
    }
    let vivo = true;
    setCargandoPeriodo(true);
    Promise.all(faltan.map((s) => trabajosDeSemana(s.id).then((t) => memoria.current.set(s.id, t))))
      .then(() => vivo && (setPorSemana(armar()), setError(null)))
      .catch((e) => vivo && setError(e))
      .finally(() => vivo && setCargandoPeriodo(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clavePeriodo, semanas]);

  const esSemana = periodo?.tipo === 'semana';
  const rango = periodo ? rangoPeriodo(periodo) : null;
  const semana = esSemana ? (porSemana[0]?.semana ?? null) : null;
  const trabajos = useMemo(
    () => (esSemana ? (porSemana[0]?.trabajos ?? []) : rango ? consolidarPeriodo(porSemana, rango) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [porSemana, esSemana],
  );
  const dias = semana ? diasDeSemana(semana) : [];
  // El segundo eje de la vista: los días de la semana, o las semanas del mes o trimestre.
  const segmentos = esSemana
    ? dias.map((d) => ({ clave: d, rotulo: `${nombreDia(d)} ${d.slice(8, 10)}`, rango: [d, d] }))
    : porSemana.map(({ semana: s }) => {
        const desde = mayor(s.desde, rango.desde);
        return { clave: s.lunes, rotulo: `Sem. ${diaYMes(desde)}`, rango: [desde, menor(s.hasta, rango.hasta)] };
      });
  const rangoFoco = segmentos.find((s) => s.clave === foco)?.rango ?? null;

  const tiposPresentes = useMemo(
    () => Object.keys(ETIQUETAS_TIPO).filter((t) => trabajos.some((x) => x.tipo === t)),
    [trabajos],
  );
  const visibles = useMemo(
    () => trabajos.filter((t) => pasaFiltros(t, { foco: rangoFoco, tipos })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trabajos, foco, tipos],
  );
  // En el mapa van los de los tipos elegidos de TODO el período; el día o la
  // semana elegida solo atenúa. En el panel, solo los que pasan todos los filtros.
  const enMapa = useMemo(() => trabajos.filter((t) => pasaFiltros(t, { tipos })), [trabajos, tipos]);
  const limite = useLimitePartido();
  const formas = useMemo(
    () => [...formasDelPartido(limite), ...formasDeTrabajos(enMapa, { foco: rangoFoco })],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [limite, enMapa, foco],
  );
  const grupos = useMemo(() => agruparPorLocalidad(visibles), [visibles]);
  const resumen = resumenSemana(visibles);
  const elegido = trabajos.find((t) => t.id === seleccion) ?? null;
  const encuadre = useMemo(
    () => (elegido ? verticesDe(elegido.geometria) : encuadreDe(enMapa)),
    // Se re-encuadra al cambiar de período o de trabajo elegido, no con cada filtro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clavePeriodo, seleccion, trabajos],
  );
  const novedades = !periodo
    ? []
    : esSemana
      ? (semana?.novedades ?? []).filter((n) => esNovedadReal(n.texto))
      : novedadesDelPeriodo(porSemana.map((p) => p.semana), rango);
  const faltantes = periodo && semanas ? semanasFaltantes(semanas, periodo, hoy) : [];
  const archivos = porSemana.flatMap((p) => p.semana.archivos ?? []);

  if (cargando) {
    return (
      <CargaSemana
        semanas={semanas ?? []}
        alCancelar={() => setCargando(false)}
        alPublicar={async (id) => {
          setCargando(false);
          await leerSemanas(id);
        }}
      />
    );
  }

  const alternarTipo = (t) => {
    const base = new Set(tipos ?? tiposPresentes);
    base.has(t) ? base.delete(t) : base.add(t);
    setTipos(base.size === tiposPresentes.length ? null : base);
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Bacheo"
        descripcion="Programación de asfalto y hormigón, en el mapa y por localidad: por semana, mes o trimestre."
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {semanas?.length > 0 && periodo && (
              <SelectorPeriodo semanas={semanas} periodo={periodo} alCambiar={cambiarPeriodo} hoy={hoy} />
            )}
            {puedeCargar && bacheoDisponible() && (
              <Boton variante="primario" icono={Upload} onClick={() => setCargando(true)}>
                Cargar semana
              </Boton>
            )}
          </div>
        }
      />
      <Pagina className="flex flex-col gap-4">
        {error && (
          <Aviso tono="error" titulo="No se pudo leer la programación de Bacheo">
            {String(error.message ?? error)}
          </Aviso>
        )}

        {semanas === null && <p className="text-sm text-tenue">Cargando las semanas…</p>}

        {semanas?.length === 0 && !error && (
          <Vacio
            icono={Construction}
            titulo="Todavía no hay ninguna semana publicada"
            descripcion={
              puedeCargar
                ? 'Subí los PDF de programación de asfalto y hormigón con «Cargar semana».'
                : 'Cuando Coordinación cargue la programación semanal, aparece acá.'
            }
          />
        )}

        {semanas?.length > 0 && periodo && !cargandoPeriodo && porSemana.length === 0 && (
          <Vacio
            icono={Construction}
            titulo={`No hay programación cargada para ${rotuloPeriodo(periodo, semanas).replace(/^Semana/, 'la semana del')}`}
            descripcion="Elegí otro período en el calendario."
          />
        )}

        {porSemana.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metrica
                etiqueta="Trabajos"
                valor={resumen.trabajos}
                icono={Construction}
                detalle={esSemana ? '' : foco ? 'en la semana elegida' : `${plural(porSemana.length, 'semana', 'semanas')} con programación`}
              />
              <Metrica etiqueta="Localidades" valor={resumen.localidades} icono={MapPinned} />
              <Metrica etiqueta="Hormigón" valor={formatoM2(resumen.m2Hormigon)} icono={Ruler} />
              <Metrica
                etiqueta="Sin ubicar"
                valor={resumen.sinUbicar}
                icono={MapPinOff}
                detalle={resumen.provisorios ? `${resumen.provisorios} con ubicación sin revisar` : ''}
              />
            </div>

            {faltantes.length > 0 && (
              <Aviso tono="info" titulo={`Falta la programación de ${plural(faltantes.length, 'semana', 'semanas')}`}>
                No se cargaron los PDF de {faltantes.map((l) => `la semana del ${diaYMes(l)}`).join(', ')}. Lo que
                se ve abajo es solo lo de las semanas cargadas.
              </Aviso>
            )}

            {esSemana &&
              novedades.map((n) => (
                <Aviso key={n.fecha} tono="alerta" titulo={`${nombreDia(n.fecha)} ${diaYMes(n.fecha)}`}>
                  {n.texto}
                </Aviso>
              ))}
            {!esSemana && novedades.length > 0 && (
              <Aviso tono="alerta" titulo={`Novedades del período (${novedades.length})`}>
                <ul className="flex flex-col gap-0.5">
                  {novedades.map((n) => (
                    <li key={`${n.fecha}${n.texto}`}>
                      {nombreDia(n.fecha)} {diaYMes(n.fecha)}: {n.texto}
                    </li>
                  ))}
                </ul>
              </Aviso>
            )}

            <div className="flex flex-col gap-2">
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label={esSemana ? 'Día' : 'Semana del período'}
              >
                <BotonAlternable activo={!foco} onClick={() => setFoco('')}>
                  {esSemana ? 'Toda la semana' : 'Todo el período'}
                </BotonAlternable>
                {segmentos.map((g) => (
                  <BotonAlternable
                    key={g.clave}
                    activo={foco === g.clave}
                    onClick={() => setFoco(foco === g.clave ? '' : g.clave)}
                  >
                    {g.rotulo}
                  </BotonAlternable>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tipo de trabajo">
                {tiposPresentes.map((t) => (
                  <BotonAlternable key={t} className="inline-flex items-center gap-1.5" activo={!tipos || tipos.has(t)} onClick={() => alternarTipo(t)}>
                    <span aria-hidden="true" className={`bacheo-muestra bacheo-muestra-${t} inline-block h-2.5 w-2.5 rounded-full`} />
                    {ETIQUETAS_TIPO[t]}
                  </BotonAlternable>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="flex flex-col gap-2">
                <MapaLeaflet
                  formas={formas}
                  seleccionada={seleccion}
                  alSeleccionar={(id) => setSeleccion(id === seleccion ? null : id)}
                  encuadrar={encuadre}
                  alto={560}
                  etiqueta="Mapa de la programación de Bacheo"
                />
                <p className="text-xs text-tenue">
                  {textoPie({ esSemana, archivos })}
                </p>
              </div>

              <section aria-label="Trabajos por localidad" className="flex flex-col gap-2">
                {cargandoPeriodo && <p className="text-sm text-tenue">Cargando los trabajos…</p>}
                {!cargandoPeriodo && grupos.length === 0 && (
                  <Vacio compacto titulo="Sin trabajos" descripcion="No hay trabajos con estos filtros." />
                )}
                <div className="scroll-fino flex max-h-[620px] flex-col gap-2 overflow-y-auto pr-1">
                  {grupos.map((g) => (
                    <details key={g.localidad} open className="rounded-card border border-borde bg-card">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-tinta">
                        <span>{g.localidad}</span>
                        <span className="text-xs font-normal text-tenue">
                          {plural(g.trabajos.length, 'trabajo', 'trabajos')}
                          {g.m2 > 0 && ` · ${formatoM2(g.m2)}`}
                        </span>
                      </summary>
                      <ul className="flex flex-col border-t border-borde">
                        {g.trabajos.map((t) => (
                          <FilaTrabajo
                            key={t.id}
                            trabajo={t}
                            dias={esSemana ? dias : null}
                            elegido={seleccion === t.id}
                            alElegir={() => setSeleccion(seleccion === t.id ? null : t.id)}
                          />
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </Pagina>
    </>
  );
}

/** Leyenda debajo del mapa. */
function textoPie({ esSemana, archivos }) {
  const base = 'Trazo punteado: ubicación automática o aproximada, todavía sin revisar.';
  if (esSemana) {
    const fuente = archivos.length ? ` Fuente: ${archivos.map((a) => a.nombre).join(' y ')}.` : '';
    return `${base} Atenuado: no se trabaja el día elegido.${fuente}`;
  }
  return `${base} Atenuado: no se trabaja la semana elegida. En un mes o un trimestre, cada lugar aparece una vez aunque se haya trabajado varias semanas. Fuente: ${plural(archivos.length, 'PDF', 'PDF')} de programación semanal.`;
}

/**
 * Un trabajo del panel. Con `dias` (vista de una semana) lleva la tira de
 * L-M-X-J-V; sin `dias` (mes o trimestre) dice cuántos días y semanas se
 * trabajó ese lugar y entre qué fechas.
 */
function FilaTrabajo({ trabajo: t, dias, elegido, alElegir }) {
  const fechas = new Set(t.fechas);
  const primera = t.fechas[0];
  const ultima = t.fechas[t.fechas.length - 1];
  return (
    <li>
      <button
        type="button"
        onClick={alElegir}
        aria-pressed={elegido}
        className={`flex w-full gap-2.5 px-3 py-2 text-left transition hover:bg-paper ${elegido ? 'bg-acento-suave' : ''}`}
      >
        <span aria-hidden="true" className={`bacheo-muestra bacheo-muestra-${t.tipo} mt-0.5 w-1 shrink-0 self-stretch rounded-full`} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium text-tinta">{t.descripcion}</span>
          <span className="text-xs text-gris">
            {/* En hormigón la «cuadrilla» es el propio tipo: no se repite. */}
            {t.tipo === 'hormigon' ? ETIQUETAS_TIPO.hormigon : `${ETIQUETAS_TIPO[t.tipo]} · ${t.cuadrilla}`}
          </span>
          {!dias && primera && (
            <span className="text-xs text-gris">
              {plural(t.fechas.length, 'día', 'días')}
              {t.semanas?.length > 1 && ` en ${t.semanas.length} semanas`}
              {' · '}
              {primera === ultima ? diaYMes(primera) : `del ${diaYMes(primera)} al ${diaYMes(ultima)}`}
            </span>
          )}
          {t.tipo === 'hormigon' && (
            <span className="text-xs text-gris">
              {dias ? textoTareas(t.tareas) : ''}
              {t.m2 ? `${dias ? ' · ' : ''}aprox. ${formatoM2(t.m2)}` : ''}
            </span>
          )}
          {(!t.geometria || esProvisoria(t.ubicacion)) && (
            <span className="text-xs text-proximo-texto">
              {ESTADOS_UBICACION[t.geometria ? t.ubicacion : 'sin_ubicar']}
              {t.nota ? `: ${t.nota}` : ''}
            </span>
          )}
          {(t.novedades ?? []).map((n) => (
            <span key={`${n.fecha}${n.texto}`} className="text-xs text-gris">
              {nombreDia(n.fecha)} {diaYMes(n.fecha)}: {n.texto}
            </span>
          ))}
        </span>
        {dias && (
          <span className="flex shrink-0 gap-0.5 self-start" aria-label={`Días: ${t.fechas.map(nombreDia).join(', ')}`}>
            {dias.map((d) => (
              <span
                key={d}
                aria-hidden="true"
                className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold ${
                  fechas.has(d) ? 'bg-superior text-superior-texto' : 'bg-paper text-tenue'
                }`}
              >
                {letraDia(d)}
              </span>
            ))}
          </span>
        )}
      </button>
    </li>
  );
}
