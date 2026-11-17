/**
 * Carga de una semana de Bacheo: subir los PDF → revisar → publicar.
 *
 * Todo pasa en el navegador hasta «Publicar», que escribe la semana entera de
 * una vez (`publicar_semana_bacheo`). No hay borradores en la base a
 * propósito: la revisión lleva unos minutos y una semana a medio revisar en
 * Supabase sería una semana que el resto del portal podría ver incompleta.
 *
 * La revisión ordena los trabajos por lo que necesitan: primero los que no se
 * pudieron ubicar, después los aproximados, después los automáticos y al
 * final los que ya estaban revisados de otra semana. Lo que una persona marca
 * o confirma acá pasa a la memoria de lugares y no se vuelve a preguntar.
 */
import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, FileUp, MapPin, Trash2, Undo2, Upload } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Aviso, Boton, Chip } from '../../componentes/Basicos.jsx';
import { MapaLeaflet } from '../../componentes/MapaLeaflet.jsx';
import { hoyISO } from '../../datos/tiempo.js';
import { leerProgramacion } from '../../datos/bacheo/leerPdf.js';
import { ETIQUETAS_TIPO, unirProgramaciones } from '../../datos/bacheo/programacion.js';
import { ubicarTodos } from '../../datos/bacheo/ubicar.js';
import { deLeaflet, verticesDe } from '../../datos/bacheo/geometria.js';
import { cargarLugares, publicarSemana } from '../../datos/supabaseBacheo.js';
import { ESTADOS_UBICACION, armarPublicacion, nombreDia, rotuloSemana, textoTareas } from '../../datos/bacheo/semana.js';
import { encuadreDe, formasDeTrabajos, formasDelPartido, useLimitePartido } from './formas.js';

const PRIORIDAD = { sin_ubicar: 0, aproximada: 1, automatica: 2, manual: 3, revisada: 4 };
const QUE_DIBUJAR = {
  esquina: 'Tocá el mapa en la esquina.',
  tramo: 'Tocá el mapa a lo largo de la calle, de una punta a la otra, y después «Listo».',
  area: 'Tocá las esquinas del área en orden, siguiendo las calles, y después «Listo».',
};

export function CargaSemana({ semanas, alCancelar, alPublicar }) {
  const [archivos, setArchivos] = useState([]);
  const [paso, setPaso] = useState('archivos');
  const [error, setError] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [semana, setSemana] = useState(null);
  const [lecturas, setLecturas] = useState([]);
  const [trabajos, setTrabajos] = useState([]);
  const [elegido, setElegido] = useState(null);
  const [dibujo, setDibujo] = useState(null);
  const entrada = useRef(null);

  const sumarArchivos = (lista) => {
    const pdfs = [...lista].filter((f) => /\.pdf$/i.test(f.name));
    setArchivos((previos) => [...previos, ...pdfs].slice(-2));
    setError(null);
  };

  const procesar = async () => {
    setError(null);
    try {
      setPaso('leyendo');
      const hoy = hoyISO();
      const leidas = [];
      for (const archivo of archivos) leidas.push(await leerProgramacion(archivo, hoy));
      const tipos = leidas.map((l) => l.tipo);
      if (new Set(tipos).size < tipos.length) {
        throw new Error('Subiste dos programaciones del mismo tipo: tiene que ser una de asfalto y una de hormigón.');
      }
      const unida = unirProgramaciones(leidas);
      setLecturas(leidas);
      setSemana(unida);
      setPaso('ubicando');
      const lugares = await cargarLugares();
      const ubicados = await ubicarTodos(unida.trabajos, lugares, (hechos, total) => setProgreso({ hechos, total }));
      setTrabajos(
        ubicados.map((t, i) => ({
          ...t,
          clave: String(i),
          geometria: t.ubicacion.geometria,
          forma: t.ubicacion.forma,
          ubicacion: t.ubicacion.estado,
          nota: t.ubicacion.nota,
          recordar: false,
        })),
      );
      setPaso('revision');
    } catch (e) {
      setError(e);
      setPaso('archivos');
    }
  };

  const ordenados = useMemo(
    () => [...trabajos].sort((a, b) => PRIORIDAD[a.ubicacion] - PRIORIDAD[b.ubicacion] || a.orden - b.orden),
    [trabajos],
  );
  const actual = trabajos.find((t) => t.clave === elegido) ?? null;
  const cambiar = (clave, cambios) => setTrabajos((ts) => ts.map((t) => (t.clave === clave ? { ...t, ...cambios } : t)));

  const terminarDibujo = () => {
    if (!dibujo || !actual) return;
    const { puntos } = dibujo;
    const geometria =
      actual.forma === 'esquina'
        ? deLeaflet.punto(puntos[0])
        : actual.forma === 'tramo'
          ? deLeaflet.lineas([puntos])
          : deLeaflet.poligono(puntos);
    cambiar(actual.clave, { geometria, ubicacion: 'manual', nota: '', recordar: true });
    setDibujo(null);
  };
  const minimoPuntos = actual?.forma === 'esquina' ? 1 : actual?.forma === 'tramo' ? 2 : 3;

  const limite = useLimitePartido();
  const formas = useMemo(() => {
    const base = formasDeTrabajos(
      trabajos.filter((t) => !dibujo || t.clave !== elegido),
      { idClave: 'clave' },
    );
    if (dibujo?.puntos.length && actual) {
      const tipo = actual.forma === 'esquina' || dibujo.puntos.length === 1 ? 'punto' : actual.forma === 'area' && dibujo.puntos.length >= 3 ? 'poligono' : 'linea';
      base.push({
        id: 'dibujo',
        tipo,
        puntos: tipo === 'punto' ? dibujo.puntos[0] : [dibujo.puntos],
        clase: `bacheo-${actual.tipo} ${tipo === 'poligono' ? 'bacheo-area' : ''} corte-sel`,
        interactiva: false,
      });
    }
    return [...formasDelPartido(limite), ...base];
  }, [limite, trabajos, dibujo, elegido, actual]);

  const encuadre = useMemo(
    () => (actual?.geometria ? verticesDe(actual.geometria) : encuadreDe(trabajos)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [elegido, paso],
  );

  const publicar = async () => {
    setError(null);
    setPaso('publicando');
    try {
      const id = await publicarSemana(armarPublicacion({ semana, trabajos, archivos: lecturas }));
      await alPublicar(id);
    } catch (e) {
      setError(e);
      setPaso('revision');
    }
  };

  const yaPublicada = semana && semanas.some((s) => s.lunes === semana.lunes);
  const pendientes = trabajos.filter((t) => !t.geometria).length;

  return (
    <>
      <EncabezadoPagina
        titulo="Cargar semana de Bacheo"
        descripcion="Subí los PDF de programación de asfalto y de hormigón de la misma semana."
        acciones={
          <Boton variante="fantasma" icono={ArrowLeft} onClick={alCancelar} disabled={paso === 'publicando'}>
            Volver sin publicar
          </Boton>
        }
      />
      <Pagina className="flex flex-col gap-4">
        {error && (
          <Aviso tono="error" titulo="No se pudo completar la carga">
            {String(error.message ?? error)}
          </Aviso>
        )}

        {(paso === 'archivos' || paso === 'leyendo' || paso === 'ubicando') && (
          <div className="flex flex-col gap-3">
            <div
              className="flex flex-col items-center gap-3 rounded-card border-2 border-dashed border-borde-fuerte bg-card px-6 py-8 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                sumarArchivos(e.dataTransfer.files);
              }}
            >
              <FileUp size={28} className="text-gris" aria-hidden="true" />
              <p className="text-sm text-tinta">Arrastrá acá los dos PDF, o elegilos desde la computadora.</p>
              <input
                ref={entrada}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="sr-only"
                aria-label="Elegir los PDF de programación"
                onChange={(e) => sumarArchivos(e.target.files)}
              />
              <Boton icono={Upload} onClick={() => entrada.current?.click()} disabled={paso !== 'archivos'}>
                Elegir PDF
              </Boton>
              {archivos.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm text-gris">
                  {archivos.map((a) => (
                    <li key={a.name}>{a.name}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Boton variante="primario" onClick={procesar} disabled={!archivos.length || paso !== 'archivos'}>
                Leer y ubicar
              </Boton>
              {archivos.length > 0 && paso === 'archivos' && (
                <Boton variante="fantasma" onClick={() => setArchivos([])}>
                  Quitar los archivos
                </Boton>
              )}
              {paso === 'leyendo' && <span className="text-sm text-tenue">Leyendo los PDF…</span>}
              {paso === 'ubicando' && (
                <span className="text-sm text-tenue" role="status">
                  Ubicando en el callejero oficial{progreso ? ` (${progreso.hechos} de ${progreso.total})` : ''}…
                </span>
              )}
            </div>
          </div>
        )}

        {(paso === 'revision' || paso === 'publicando') && semana && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-tinta">
                <b>Semana {rotuloSemana(semana)}</b> · {trabajos.length} trabajos ·{' '}
                {lecturas.map((l) => (l.tipo === 'asfalto' ? 'asfalto' : 'hormigón')).join(' y ')}
              </div>
              <Boton variante="primario" icono={Check} onClick={publicar} disabled={paso === 'publicando'}>
                {paso === 'publicando' ? 'Publicando…' : yaPublicada ? 'Publicar y reemplazar' : 'Publicar semana'}
              </Boton>
            </div>
            {yaPublicada && (
              <Aviso tono="alerta" titulo="Esta semana ya está publicada">
                Al publicar se reemplazan sus trabajos por los de estos PDF. Pasa cuando el área reprograma a mitad de
                semana.
              </Aviso>
            )}
            {pendientes > 0 && (
              <Aviso tono="info">
                {pendientes} trabajo{pendientes === 1 ? '' : 's'} sin ubicar. Se puede publicar igual: figuran en la
                lista pero no en el mapa.
              </Aviso>
            )}
            {semana.avisos.map((a) => (
              <Aviso key={a} tono="alerta">
                {a}
              </Aviso>
            ))}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
              <div className="flex flex-col gap-2">
                <MapaLeaflet
                  formas={formas}
                  seleccionada={dibujo ? null : elegido}
                  alSeleccionar={dibujo ? undefined : setElegido}
                  alClicMapa={
                    dibujo
                      ? (p) =>
                          setDibujo((d) => ({ puntos: actual?.forma === 'esquina' ? [p] : [...d.puntos, p] }))
                      : undefined
                  }
                  encuadrar={encuadre}
                  alto={600}
                  etiqueta="Mapa para revisar la programación de Bacheo"
                />
                {dibujo && actual && (
                  <div className="flex flex-wrap items-center gap-2 rounded-chip border border-acento-medio bg-acento-suave px-3 py-2 text-sm">
                    <span className="flex-1">{QUE_DIBUJAR[actual.forma]}</span>
                    <Boton
                      tamanio="sm"
                      icono={Undo2}
                      onClick={() => setDibujo((d) => ({ puntos: d.puntos.slice(0, -1) }))}
                      disabled={!dibujo.puntos.length}
                    >
                      Deshacer
                    </Boton>
                    <Boton tamanio="sm" variante="fantasma" onClick={() => setDibujo(null)}>
                      Cancelar
                    </Boton>
                    <Boton
                      tamanio="sm"
                      variante="primario"
                      onClick={terminarDibujo}
                      disabled={dibujo.puntos.length < minimoPuntos}
                    >
                      Listo
                    </Boton>
                  </div>
                )}
              </div>

              <ul className="scroll-fino flex max-h-[640px] flex-col gap-1.5 overflow-y-auto pr-1" aria-label="Trabajos a revisar">
                {ordenados.map((t) => (
                  <li key={t.clave}>
                    <div
                      className={`flex flex-col gap-1 rounded-chip border px-3 py-2 ${
                        elegido === t.clave ? 'border-acento bg-acento-suave' : 'border-borde bg-card'
                      }`}
                    >
                      <button
                        type="button"
                        className="flex items-start gap-2 text-left"
                        onClick={() => !dibujo && setElegido(t.clave)}
                        aria-pressed={elegido === t.clave}
                      >
                        <span aria-hidden="true" className={`bacheo-muestra bacheo-muestra-${t.tipo} mt-1 h-2.5 w-2.5 shrink-0 rounded-full`} />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-sm font-medium text-tinta">{t.descripcion}</span>
                          <span className="text-xs text-gris">
                            {ETIQUETAS_TIPO[t.tipo]} · {t.localidad || t.localidad_planilla || 'Sin localidad'} ·{' '}
                            {t.fechas.map((f) => `${nombreDia(f)} ${f.slice(8, 10)}`).join(', ')}
                          </span>
                          {t.tipo === 'hormigon' && <span className="text-xs text-gris">{textoTareas(t.tareas)}</span>}
                        </span>
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip tono={t.geometria ? (t.ubicacion === 'revisada' || t.ubicacion === 'manual' ? 'enregla' : 'atencion') : 'proximo'}>
                          {ESTADOS_UBICACION[t.geometria ? t.ubicacion : 'sin_ubicar']}
                        </Chip>
                        {elegido === t.clave && !dibujo && (
                          <>
                            {t.geometria && (t.ubicacion === 'automatica' || t.ubicacion === 'aproximada') && (
                              <Boton
                                tamanio="sm"
                                icono={Check}
                                onClick={() => cambiar(t.clave, { ubicacion: 'revisada', recordar: true })}
                              >
                                Confirmar
                              </Boton>
                            )}
                            <Boton tamanio="sm" icono={MapPin} onClick={() => setDibujo({ puntos: [] })}>
                              {t.geometria ? 'Marcar de nuevo' : 'Marcar en el mapa'}
                            </Boton>
                            {t.geometria && (
                              <Boton
                                tamanio="sm"
                                variante="fantasma"
                                icono={Trash2}
                                onClick={() => cambiar(t.clave, { geometria: null, ubicacion: 'sin_ubicar', recordar: false })}
                              >
                                Quitar
                              </Boton>
                            )}
                          </>
                        )}
                      </div>
                      {t.nota && <p className="text-xs text-gris">{t.nota}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </Pagina>
    </>
  );
}
