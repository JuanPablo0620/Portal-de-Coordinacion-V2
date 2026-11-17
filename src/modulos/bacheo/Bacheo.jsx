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
import { useEffect, useMemo, useState } from 'react';
import { Construction, MapPinOff, MapPinned, Ruler, Upload } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Aviso, Boton, BotonAlternable, Metrica, Vacio } from '../../componentes/Basicos.jsx';
import { MapaLeaflet } from '../../componentes/MapaLeaflet.jsx';
import { puedeEscribir, useRol } from '../../estado/sesion.js';
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
  rotuloSemana,
  textoTareas,
} from '../../datos/bacheo/semana.js';
import { encuadreDe, formasDeTrabajos, formasDelPartido, useLimitePartido } from './formas.js';
import { CargaSemana } from './CargaSemana.jsx';

const formatoM2 = (n) => `${Math.round(n).toLocaleString('es-AR')} m²`;

export default function Bacheo() {
  const rol = useRol();
  const puedeCargar = puedeEscribir(rol);
  const [semanas, setSemanas] = useState(null);
  const [idSemana, setIdSemana] = useState('');
  const [trabajos, setTrabajos] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoSemana, setCargandoSemana] = useState(false);
  const [fecha, setFecha] = useState('');
  const [tipos, setTipos] = useState(null);
  const [seleccion, setSeleccion] = useState(null);

  const leerSemanas = async (preferida) => {
    if (!bacheoDisponible()) {
      setSemanas([]);
      return;
    }
    try {
      const lista = await listarSemanas();
      setSemanas(lista);
      setIdSemana(preferida ?? lista[0]?.id ?? '');
      setError(null);
    } catch (e) {
      setSemanas([]);
      setError(e);
    }
  };

  useEffect(() => {
    leerSemanas();
  }, []);

  useEffect(() => {
    if (!idSemana) {
      setTrabajos([]);
      return undefined;
    }
    let vivo = true;
    setCargandoSemana(true);
    trabajosDeSemana(idSemana)
      .then((t) => vivo && (setTrabajos(t), setError(null)))
      .catch((e) => vivo && setError(e))
      .finally(() => vivo && setCargandoSemana(false));
    setFecha('');
    setSeleccion(null);
    return () => {
      vivo = false;
    };
  }, [idSemana]);

  const semana = semanas?.find((s) => s.id === idSemana) ?? null;
  const dias = semana ? diasDeSemana(semana) : [];
  const tiposPresentes = useMemo(
    () => Object.keys(ETIQUETAS_TIPO).filter((t) => trabajos.some((x) => x.tipo === t)),
    [trabajos],
  );
  const visibles = useMemo(
    () => trabajos.filter((t) => pasaFiltros(t, { fecha, tipos })),
    [trabajos, fecha, tipos],
  );
  // En el mapa van los de los tipos elegidos de TODA la semana; el día solo
  // atenúa. En el panel, solo los que pasan todos los filtros.
  const enMapa = useMemo(() => trabajos.filter((t) => pasaFiltros(t, { tipos })), [trabajos, tipos]);
  const limite = useLimitePartido();
  const formas = useMemo(
    () => [...formasDelPartido(limite), ...formasDeTrabajos(enMapa, { fecha })],
    [limite, enMapa, fecha],
  );
  const grupos = useMemo(() => agruparPorLocalidad(visibles), [visibles]);
  const resumen = resumenSemana(visibles);
  const elegido = trabajos.find((t) => t.id === seleccion) ?? null;
  const encuadre = useMemo(
    () => (elegido ? verticesDe(elegido.geometria) : encuadreDe(enMapa)),
    // Se re-encuadra al cambiar de semana o de trabajo elegido, no con cada filtro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idSemana, seleccion, trabajos],
  );

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
        descripcion="Programación semanal de asfalto y hormigón, en el mapa y por localidad."
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {semanas?.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-gris">
                Semana
                <select
                  className="rounded-chip border border-borde-fuerte bg-card px-2 py-1.5 text-sm text-tinta"
                  value={idSemana}
                  onChange={(e) => setIdSemana(e.target.value)}
                >
                  {semanas.map((s) => (
                    <option key={s.id} value={s.id}>
                      {rotuloSemana(s)}
                    </option>
                  ))}
                </select>
              </label>
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

        {semana && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metrica etiqueta="Trabajos" valor={resumen.trabajos} icono={Construction} />
              <Metrica etiqueta="Localidades" valor={resumen.localidades} icono={MapPinned} />
              <Metrica etiqueta="Hormigón" valor={formatoM2(resumen.m2Hormigon)} icono={Ruler} />
              <Metrica
                etiqueta="Sin ubicar"
                valor={resumen.sinUbicar}
                icono={MapPinOff}
                detalle={resumen.provisorios ? `${resumen.provisorios} con ubicación sin revisar` : ''}
              />
            </div>

            {(semana.novedades ?? []).map((n) => (
              <Aviso key={n.fecha} tono="alerta" titulo={`${nombreDia(n.fecha)} ${diaYMes(n.fecha)}`}>
                {n.texto}
              </Aviso>
            ))}

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Día">
                <BotonAlternable activo={!fecha} onClick={() => setFecha('')}>
                  Toda la semana
                </BotonAlternable>
                {dias.map((d) => (
                  <BotonAlternable key={d} activo={fecha === d} onClick={() => setFecha(fecha === d ? '' : d)}>
                    {nombreDia(d)} {d.slice(8, 10)}
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
                  Trazo punteado: ubicación automática o aproximada, todavía sin revisar. Atenuado: no se trabaja el día
                  elegido.
                  {semana.archivos?.length > 0 && ` Fuente: ${semana.archivos.map((a) => a.nombre).join(' y ')}.`}
                </p>
              </div>

              <section aria-label="Trabajos por localidad" className="flex flex-col gap-2">
                {cargandoSemana && <p className="text-sm text-tenue">Cargando los trabajos…</p>}
                {!cargandoSemana && grupos.length === 0 && (
                  <Vacio compacto titulo="Sin trabajos" descripcion="No hay trabajos con estos filtros." />
                )}
                <div className="scroll-fino flex max-h-[620px] flex-col gap-2 overflow-y-auto pr-1">
                  {grupos.map((g) => (
                    <details key={g.localidad} open className="rounded-card border border-borde bg-card">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-tinta">
                        <span>{g.localidad}</span>
                        <span className="text-xs font-normal text-tenue">
                          {g.trabajos.length} trabajo{g.trabajos.length === 1 ? '' : 's'}
                          {g.m2 > 0 && ` · ${formatoM2(g.m2)}`}
                        </span>
                      </summary>
                      <ul className="flex flex-col border-t border-borde">
                        {g.trabajos.map((t) => (
                          <FilaTrabajo
                            key={t.id}
                            trabajo={t}
                            dias={dias}
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

function FilaTrabajo({ trabajo: t, dias, elegido, alElegir }) {
  const fechas = new Set(t.fechas);
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
          {t.tipo === 'hormigon' && (
            <span className="text-xs text-gris">
              {textoTareas(t.tareas)}
              {t.m2 ? ` · aprox. ${formatoM2(t.m2)}` : ''}
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
              {nombreDia(n.fecha)} {n.fecha.slice(8, 10)}: {n.texto}
            </span>
          ))}
        </span>
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
      </button>
    </li>
  );
}
