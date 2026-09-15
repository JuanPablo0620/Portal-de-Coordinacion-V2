/**
 * La ficha de un proyecto estratégico.
 *
 * Página propia y no una ventana sobre el tablero, por el mismo criterio que
 * `/proyectos/:id` y `/posicionamiento/:id`: la dirección se puede pasar a
 * alguien, el botón «atrás» funciona, y hay lugar para las dos columnas sin
 * apretar nada.
 *
 * Se llega desde el tablero haciendo clic en un compromiso o en un
 * recordatorio. El que se eligió viaja en la dirección (`?compromiso=` o
 * `?nota=`) y queda marcado al llegar — sin eso, quien entra desde una lista de
 * ocho filas tiene que volver a buscar cuál era.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, ClipboardList, FolderOpen, NotebookPen, Plus, Trash2, XCircle } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import {
  Aviso,
  Boton,
  Chip,
  EstadoProyecto,
  Semaforo,
  Tarjeta,
  Vacio,
  nivelPorDias,
} from '../../componentes/Basicos.jsx';
import { CampoArea, CampoFecha, CampoTexto } from '../../componentes/Campo.jsx';
import { EditorCompromiso } from '../../componentes/EditorCompromiso.jsx';
import { Modal, ModalConfirmacion } from '../../componentes/Modal.jsx';
import {
  compromisos as selCompromisos,
  diasHasta,
  hoyISO,
  notasDeProyecto,
  proyectoPorId,
} from '../../datos/selectores.js';
import { fecha as fFecha } from '../../utilidades/formato.js';
import { acciones, useBD } from '../../estado/tienda.js';

/** Prioridad del proyecto, con el color de la escala del portal. */
const NIVEL_PRIORIDAD = { alta: 'vencido', media: 'proximo', baja: 'enregla' };

export default function FichaEstrategico() {
  const { id } = useParams();
  const bd = useBD();
  const navegar = useNavigate();
  const hoy = hoyISO();
  const [parametros] = useSearchParams();
  // Dos estados y no uno: «se está preguntando» y «se está guardando» son
  // momentos distintos, y mezclarlos en una variable con dos tipos de valor es
  // de lo que después nadie se acuerda.
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const [errorQuitar, setErrorQuitar] = useState(null);
  const [editandoDrive, setEditandoDrive] = useState(false);

  const marcado = parametros.get('compromiso') || parametros.get('nota') || '';

  const proyecto = useMemo(() => (bd ? proyectoPorId(bd, id) : null), [bd, id]);
  const compromisos = useMemo(
    () => (bd ? selCompromisos(bd, { id_proyecto: id }, hoy) : []),
    [bd, id, hoy],
  );
  const notas = useMemo(() => (bd ? notasDeProyecto(bd, id) : []), [bd, id]);

  /*
   * Sacar el proyecto de la cartera. NO lo borra ni lo da de baja como
   * proyecto: sigue en la base maestra y se sigue monitoreando como cualquier
   * otro. Lo que se pierde es la vigilancia mas estrecha de lo estrategico.
   *
   * `ModalConfirmacion` no espera la promesa —llama y cierra—, asi que el
   * error se atiende aca o se pierde.
   */
  async function quitarDeLaCartera() {
    setQuitando(true);
    setErrorQuitar(null);
    try {
      await acciones.quitarEstrategico(id);
      navegar('/estrategicos');
    } catch (e) {
      setErrorQuitar(e?.message ?? 'No se pudo sacar el proyecto de la cartera.');
    } finally {
      setQuitando(false);
    }
  }

  if (!proyecto) {
    return (
      <>
        <EncabezadoPagina titulo="Proyecto no encontrado" />
        <Pagina>
          <Tarjeta>
            <Vacio
              titulo="No existe un proyecto con ese identificador"
              descripcion="Puede haberse dado de baja, o el enlace estar mal copiado."
              accion={{
                texto: 'Volver a Proyectos estratégicos',
                icono: ArrowLeft,
                alHacerClic: () => navegar('/estrategicos'),
              }}
            />
          </Tarjeta>
        </Pagina>
      </>
    );
  }

  const vencidos = compromisos.filter((c) => c.estado_efectivo === 'alerta').length;

  return (
    <>
      <EncabezadoPagina
        titulo={proyecto.proyecto}
        descripcion={proyecto.observaciones || undefined}
        acciones={
          <>
            <Boton icono={ArrowLeft} onClick={() => navegar('/estrategicos')}>
              Volver
            </Boton>
            {proyecto.url_drive ? (
              <Boton
                icono={FolderOpen}
                onClick={() => window.open(proyecto.url_drive, '_blank', 'noopener,noreferrer')}
              >
                Carpeta de Drive
              </Boton>
            ) : (
              <Boton icono={FolderOpen} onClick={() => setEditandoDrive(true)}>
                Agregar carpeta
              </Boton>
            )}
            <Boton icono={XCircle} onClick={() => setConfirmandoBaja(true)} disabled={quitando}>
              Sacar de la cartera
            </Boton>
          </>
        }
      />

      <Pagina className="flex flex-col gap-4">
        {errorQuitar && <Aviso tono="error">{errorQuitar}</Aviso>}

        <Tarjeta>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tono="acento">{proyecto.id_proyecto}</Chip>
            {proyecto.prioridad && (
              <Semaforo
                nivel={NIVEL_PRIORIDAD[proyecto.prioridad] ?? 'sindato'}
                texto={`Prioridad ${proyecto.prioridad}`}
              />
            )}
            <EstadoProyecto estado={proyecto.estado} />
            {/* Un proyecto sin secretaría muestra un guion, no un hueco: el
                espacio en blanco se lee como un error de carga. */}
            <Chip tono="neutro">{proyecto.area || '—'}</Chip>
            {proyecto.url_drive && (
              <button
                type="button"
                onClick={() => setEditandoDrive(true)}
                className="text-[11px] text-acento underline-offset-2 hover:underline"
              >
                cambiar carpeta
              </button>
            )}
            {vencidos > 0 && (
              <Chip tono="vencido">
                {vencidos} compromiso{vencidos === 1 ? '' : 's'} vencido{vencidos === 1 ? '' : 's'}
              </Chip>
            )}
          </div>
        </Tarjeta>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          <PanelCompromisos compromisos={compromisos} marcado={marcado} proyecto={proyecto} />
          <PanelNotas notas={notas} idProyecto={id} marcado={marcado} hoy={hoy} />
        </div>
      </Pagina>

      <ModalConfirmacion
        abierto={confirmandoBaja}
        alCerrar={() => setConfirmandoBaja(false)}
        alConfirmar={quitarDeLaCartera}
        titulo="Sacar de la cartera estratégica"
        mensaje={`«${proyecto.proyecto}» vuelve a seguirse como cualquier otro proyecto. No se borra nada: el motivo, los compromisos y las notas quedan, y se puede volver a declarar cuando haga falta.`}
        textoConfirmar="Sacar de la cartera"
      />

      {editandoDrive && <EditarDrive proyecto={proyecto} alCerrar={() => setEditandoDrive(false)} />}
    </>
  );
}

function EditarDrive({ proyecto, alCerrar }) {
  const [url, setUrl] = useState(proyecto.url_drive ?? '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError('');
    setGuardando(true);
    try {
      await acciones.actualizarProyecto(proyecto.id_proyecto, { url_drive: url.trim() });
      alCerrar();
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la carpeta. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      ancho="md"
      titulo="Carpeta de Drive"
      descripcion={proyecto.proyecto}
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={guardar} disabled={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <CampoTexto
          etiqueta="Dirección de la carpeta"
          ayuda="pegá el enlace de Drive"
          placeholder="https://drive.google.com/drive/folders/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <p className="text-[11px] text-tenue">Dejalo vacío para sacar el enlace.</p>
        {error && <Aviso tono="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}

/* ── Compromisos ────────────────────────────────────────────────────── */

function PanelCompromisos({ compromisos, marcado, proyecto }) {
  // Si se llegó desde un compromiso, se abre ya expandido: quien hizo clic
  // venía a actualizarlo, y pedirle un clic más para llegar donde ya iba no
  // aporta nada.
  const [expandidoId, setExpandidoId] = useState(marcado || null);
  const [borrador, setBorrador] = useState(marcado ? {} : null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [nuevo, setNuevo] = useState(null);
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [errorNuevo, setErrorNuevo] = useState(null);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);

  async function crearCompromiso() {
    if (!nuevaDescripcion.trim()) {
      setErrorNuevo('Describí qué se comprometió.');
      return;
    }
    setGuardandoNuevo(true);
    setErrorNuevo(null);
    try {
      await acciones.crearCompromiso({
        origen_tipo: 'estrategico',
        id_origen: proyecto.id_proyecto,
        id_proyecto: proyecto.id_proyecto,
        area: proyecto.area,
        descripcion: nuevaDescripcion.trim(),
        fecha_limite: nuevaFecha || null,
        estado: 'pendiente',
      });
      setNuevo(false);
      setNuevaDescripcion('');
      setNuevaFecha('');
    } catch (e) {
      setErrorNuevo(e?.message ?? 'No se pudo crear el compromiso.');
    } finally {
      setGuardandoNuevo(false);
    }
  }

  function alternar(c) {
    if (expandidoId === c.id) {
      setExpandidoId(null);
      setBorrador(null);
      return;
    }
    setExpandidoId(c.id);
    setBorrador({ estado: c.estado });
    setError(null);
  }

  async function guardar(c) {
    setGuardando(true);
    setError(null);
    try {
      await acciones.actualizarEstadoCompromiso(c.id, { estado: c.estado, ...borrador });
      setExpandidoId(null);
      setBorrador(null);
    } catch (e) {
      setError(e?.message ?? 'No se pudo guardar el compromiso.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Compromisos del proyecto"
      descripcion="Se pueden cargar directamente acá, sin pasar por Monitoreo ni Seguimiento — es el circuito propio de Valentín. La descripción queda quieta y la novedad se guarda como una fila del historial, con su fecha."
      acciones={
        !nuevo && (
          <Boton tamanio="sm" icono={Plus} onClick={() => setNuevo(true)}>
            Nuevo compromiso
          </Boton>
        )
      }
    >
      {error && (
        <div className="mb-3">
          <Aviso tono="error">{error}</Aviso>
        </div>
      )}

      {nuevo && (
        <div className="mb-3 space-y-2 rounded-chip border border-acento/40 bg-acento/5 p-3">
          <CampoArea
            etiqueta="Qué se comprometió"
            filas={2}
            placeholder="Descripción del compromiso"
            value={nuevaDescripcion}
            onChange={(e) => setNuevaDescripcion(e.target.value)}
          />
          <CampoFecha
            etiqueta="Fecha límite"
            ayuda="opcional"
            value={nuevaFecha}
            onChange={(e) => setNuevaFecha(e.target.value)}
          />
          {errorNuevo && <Aviso tono="error">{errorNuevo}</Aviso>}
          <div className="flex justify-end gap-2">
            <Boton
              tamanio="sm"
              onClick={() => {
                setNuevo(false);
                setErrorNuevo(null);
              }}
            >
              Cancelar
            </Boton>
            <Boton tamanio="sm" variante="primario" onClick={crearCompromiso} disabled={guardandoNuevo}>
              Guardar compromiso
            </Boton>
          </div>
        </div>
      )}

      {compromisos.length === 0 ? (
        <Vacio
          compacto
          icono={ClipboardList}
          titulo="Sin compromisos"
          descripcion="Cargá uno con el botón de arriba, o llega solo si sale de un monitoreo, un seguimiento o una reunión de mesa."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {compromisos.map((c) => {
            const abierto = expandidoId === c.id;
            const nivel =
              c.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(c.dias_restantes);
            return (
              <li
                key={c.id}
                ref={c.id === marcado ? Marcar : undefined}
                className={`rounded-chip border ${
                  c.id === marcado ? 'border-acento bg-acento/5 ring-2 ring-acento/40' : 'border-borde'
                }`}
              >
                <div className="flex items-start gap-2 p-2.5">
                  <span className="mt-0.5">
                    <Semaforo nivel={nivel} soloPunto texto={c.estado_efectivo} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-tight text-tinta">{c.descripcion}</p>
                    <p className="mt-0.5 text-[11px] text-tenue">{leyendaPlazo(c)}</p>
                  </div>
                  {c.id === marcado && <Chip tono="acento">seleccionado</Chip>}
                  <button
                    type="button"
                    onClick={() => alternar(c)}
                    className="shrink-0 text-[11px] font-medium text-acento"
                  >
                    {abierto ? 'Cerrar' : 'Actualizar'}
                  </button>
                </div>

                {abierto && (
                  <EditorCompromiso
                    compromiso={c}
                    borrador={borrador}
                    alCambiarBorrador={(parcial) => setBorrador((b) => ({ ...b, ...parcial }))}
                    alGuardar={() => guardar(c)}
                    alCancelar={() => alternar(c)}
                    guardando={guardando}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}

/** Deja el elemento marcado a la vista al entrar desde el tablero. */
function Marcar(elemento) {
  if (elemento) elemento.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function leyendaPlazo(c) {
  if (c.estado_efectivo === 'cumplido') {
    return c.fecha_cumplimiento ? `Cumplido el ${fFecha(c.fecha_cumplimiento)}` : 'Cumplido';
  }
  if (!c.fecha_limite) return 'Sin fecha límite';
  if (c.dias_restantes < 0) {
    return `Venció el ${fFecha(c.fecha_limite)} · ${Math.abs(c.dias_restantes)} días de atraso`;
  }
  return `Vence el ${fFecha(c.fecha_limite)} · en ${c.dias_restantes} días`;
}

/* ── Notas y recordatorios ──────────────────────────────────────────── */

function PanelNotas({ notas, idProyecto, marcado, hoy }) {
  const [texto, setTexto] = useState('');
  const [fecha, setFecha] = useState('');
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

  async function guardar() {
    const limpio = texto.trim();
    if (!limpio) return;
    setGuardando(true);
    setError(null);
    try {
      if (editando) {
        await acciones.actualizarNota(editando, { texto: limpio, fecha_recordatorio: fecha });
      } else {
        await acciones.crearNota({ id_proyecto: idProyecto, texto: limpio, fecha_recordatorio: fecha });
      }
      setTexto('');
      setFecha('');
      setEditando(null);
    } catch (e) {
      setError(e?.message ?? 'No se pudo guardar la nota.');
    } finally {
      setGuardando(false);
    }
  }

  function editar(n) {
    setEditando(n.id);
    setTexto(n.texto);
    setFecha(n.fecha_recordatorio || '');
    setError(null);
  }

  function cancelar() {
    setEditando(null);
    setTexto('');
    setFecha('');
  }

  return (
    <>
      <Tarjeta
        titulo="Notas y recordatorios"
        descripcion="No cuelgan de ningún compromiso: son del proyecto. Una nota con fecha es un recordatorio y sube al panel del tablero."
      >
        {error && (
          <div className="mb-3">
            <Aviso tono="error">{error}</Aviso>
          </div>
        )}

        {notas.length === 0 ? (
          <Vacio
            compacto
            icono={NotebookPen}
            titulo="Sin notas"
            descripcion="Anotá acá lo que haya que tener a mano la próxima vez que se mire este proyecto."
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {notas.map((n) => (
              <li
                key={n.id}
                ref={n.id === marcado ? Marcar : undefined}
                className={`rounded-chip border border-l-[3px] px-2.5 py-2 ${colorNota(n, hoy)} ${
                  n.id === marcado ? 'ring-2 ring-acento/40' : ''
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  {n.fecha_recordatorio ? (
                    <>
                      <Semaforo
                        nivel={nivelPorDias(diasHasta(n.fecha_recordatorio, hoy))}
                        texto={leyendaRecordatorio(n, hoy)}
                      />
                      <span className="tabular text-[11px] text-tenue">
                        para el {fFecha(n.fecha_recordatorio)}
                      </span>
                    </>
                  ) : (
                    <span className="tabular text-[11px] text-tenue">
                      Anotada el {fFecha(n.creado_en)}
                    </span>
                  )}
                  {n.id === marcado && <Chip tono="acento">seleccionado</Chip>}
                  <button
                    type="button"
                    onClick={() => editar(n)}
                    className="ml-auto text-[11px] font-medium text-acento"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setABorrar(n)}
                    aria-label={`Dar de baja la nota: ${n.texto}`}
                    className="rounded p-0.5 text-tenue transition hover:bg-vencido-suave hover:text-vencido-texto"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="whitespace-pre-line text-xs leading-relaxed text-gris">{n.texto}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 border-t border-borde pt-3">
          <CampoArea
            etiqueta={editando ? 'Editar nota' : 'Agregar nota'}
            filas={3}
            placeholder="Algo para tener a mano la próxima vez que se mire este proyecto…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <CampoFecha
              etiqueta="Recordar el"
              className="max-w-48"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            <p className="min-w-36 flex-1 text-[11px] leading-relaxed text-tenue">
              Con fecha, es un recordatorio y sube al panel del tablero. Sin fecha, queda como
              nota del proyecto.
            </p>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            {editando && (
              <Boton tamanio="sm" onClick={cancelar}>
                Cancelar
              </Boton>
            )}
            <Boton
              variante="primario"
              tamanio="sm"
              icono={editando ? Check : Plus}
              onClick={guardar}
              disabled={!texto.trim() || guardando}
            >
              {editando ? 'Guardar cambios' : 'Guardar nota'}
            </Boton>
          </div>
        </div>
      </Tarjeta>

      <ModalConfirmacion
        abierto={Boolean(aBorrar)}
        alCerrar={() => setABorrar(null)}
        alConfirmar={() => acciones.bajaNota(aBorrar.id)}
        titulo="Dar de baja la nota"
        mensaje="Deja de listarse en la ficha y en el tablero. No se borra de la base: queda registrada en la bitácora como cualquier otro cambio."
        textoConfirmar="Dar de baja"
      />
    </>
  );
}

/** El borde izquierdo repite el semáforo del plazo; sin fecha, queda neutro. */
function colorNota(n, hoy) {
  if (!n.fecha_recordatorio) return 'border-borde';
  const nivel = nivelPorDias(diasHasta(n.fecha_recordatorio, hoy));
  return {
    vencido: 'border-borde border-l-vencido',
    proximo: 'border-borde border-l-proximo',
    atencion: 'border-borde border-l-atencion',
    enregla: 'border-borde border-l-enregla',
  }[nivel] ?? 'border-borde';
}

function leyendaRecordatorio(n, hoy) {
  const dias = diasHasta(n.fecha_recordatorio, hoy);
  if (dias === null) return 'sin fecha';
  if (dias < 0) return `venció hace ${Math.abs(dias)} días`;
  if (dias === 0) return 'vence hoy';
  return `vence en ${dias} días`;
}
