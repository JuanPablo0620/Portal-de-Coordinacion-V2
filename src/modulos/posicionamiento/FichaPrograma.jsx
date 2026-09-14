import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FolderOpen, History, Plus } from 'lucide-react';
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
import { Modal } from '../../componentes/Modal.jsx';
import { CampoArea, CampoRadios, CampoTexto } from '../../componentes/Campo.jsx';
import { ESTADOS_PROYECTO } from '../../datos/catalogos.js';
import { compromisos as selCompromisos, hoyISO, proyectoPorId } from '../../datos/selectores.js';
import { fecha as fFecha } from '../../utilidades/formato.js';
import { acciones, useBD } from '../../estado/tienda.js';

/**
 * La ficha de un programa de posicionamiento — CIPPEC, UBA, Bloomberg, RIL.
 *
 * Son proyectos de la base maestra con programa «Posicionamiento», no filas de
 * `proyectos_posicionamiento`: por eso la ruta cuelga de este módulo pero los
 * datos salen de donde salen los de cualquier proyecto.
 *
 * Lo que agrega sobre la ficha de proyecto común es lo que el área pidió para
 * este circuito: el historial de actualizaciones entero —no sólo la última,
 * que es lo que muestra la tarjeta del tablero—, la carpeta de Drive donde
 * están los archivos del programa, y los compromisos asumidos con esa
 * contraparte.
 */
export default function FichaPrograma() {
  const { id } = useParams();
  const bd = useBD();
  const navegar = useNavigate();
  const hoy = hoyISO();
  const [cargando, setCargando] = useState(false);
  const [editandoDrive, setEditandoDrive] = useState(false);

  const proyecto = useMemo(() => (bd ? proyectoPorId(bd, id) : null), [bd, id]);
  const compromisos = useMemo(
    () => (bd ? selCompromisos(bd, { id_proyecto: id }, hoy) : []),
    [bd, id, hoy],
  );

  if (!proyecto) {
    return (
      <>
        <EncabezadoPagina titulo="Programa no encontrado" />
        <Pagina>
          <Tarjeta>
            <Vacio
              titulo="No existe un programa con ese identificador"
              descripcion="Puede haberse dado de baja, o el enlace estar mal copiado."
              accion={{
                texto: 'Volver a Posicionamiento',
                icono: ArrowLeft,
                alHacerClic: () => navegar('/posicionamiento'),
              }}
            />
          </Tarjeta>
        </Pagina>
      </>
    );
  }

  const actualizaciones = proyecto.actualizaciones ?? [];

  return (
    <>
      <EncabezadoPagina
        titulo={proyecto.proyecto}
        descripcion={`${proyecto.id_proyecto} · ${proyecto.area || 'sin área'}`}
        acciones={
          <>
            <Boton icono={ArrowLeft} onClick={() => navegar('/posicionamiento')}>
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
            <Boton variante="primario" icono={Plus} onClick={() => setCargando(true)}>
              Agregar actualización
            </Boton>
          </>
        }
      />

      <Pagina className="flex flex-col gap-4">
        <Tarjeta>
          <div className="flex flex-wrap items-center gap-2">
            <EstadoProyecto estado={proyecto.estado} />
            <Chip tono="neutro">{proyecto.programa || 'sin programa'}</Chip>
            {proyecto.referente && <Chip tono="neutro">Referente: {proyecto.referente}</Chip>}
            {proyecto.url_drive && (
              <button
                type="button"
                onClick={() => setEditandoDrive(true)}
                className="text-[11px] text-acento underline-offset-2 hover:underline"
              >
                cambiar carpeta
              </button>
            )}
          </div>
          {proyecto.observaciones && (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gris">{proyecto.observaciones}</p>
          )}
        </Tarjeta>

        <Tarjeta
          titulo={
            <span className="flex items-center gap-2">
              <History size={17} /> Actualizaciones
            </span>
          }
          descripcion="Cada carga queda fechada y no pisa la anterior: es el relato de cómo fue avanzando el programa."
          sinPadding
        >
          {actualizaciones.length === 0 ? (
            <div className="p-4">
              <Vacio
                compacto
                icono={History}
                titulo="Sin actualizaciones cargadas"
                descripcion="La primera que cargues queda como punto de partida del historial."
                accion={{ texto: 'Agregar actualización', icono: Plus, alHacerClic: () => setCargando(true) }}
              />
            </div>
          ) : (
            <ol className="divide-y divide-borde/60">
              {actualizaciones.map((a) => (
                <li key={a.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular text-xs font-semibold text-tinta">{fFecha(a.fecha)}</span>
                    {a.estado && <EstadoProyecto estado={a.estado} />}
                    {a.cantidad ? (
                      <span className="tabular text-[11px] text-tenue">
                        +{a.cantidad} {a.unidad}
                      </span>
                    ) : null}
                  </div>
                  {a.comentarios ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-gris">{a.comentarios}</p>
                  ) : (
                    <p className="text-[11px] text-tenue">Sin comentario cargado.</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Tarjeta>

        <Tarjeta
          titulo={
            <span className="flex items-center gap-2">
              <ClipboardList size={17} /> Compromisos del programa
            </span>
          }
          descripcion="Lo que se asumió con esta contraparte. Son los mismos de la lista general de Seguimiento, filtrados por proyecto."
          sinPadding
        >
          {compromisos.length === 0 ? (
            <div className="p-4">
              <Vacio compacto titulo="Sin compromisos vinculados a este programa" />
            </div>
          ) : (
            <ul className="divide-y divide-borde/60">
              {compromisos.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <div className="min-w-40 flex-1">
                    <p className="text-sm leading-tight text-tinta">{c.descripcion}</p>
                    <p className="text-[11px] text-tenue">
                      {c.area || 'sin área'} · origen: {c.origen_tipo}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-[11px] text-tenue">
                    {c.fecha_limite ? `vence ${fFecha(c.fecha_limite)}` : 'sin fecha límite'}
                  </span>
                  <Semaforo
                    nivel={c.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(c.dias_restantes)}
                    texto={c.estado_efectivo === 'alerta' ? `alerta · ${c.dias_atraso} d` : c.estado_efectivo}
                  />
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </Pagina>

      {cargando && <AgregarActualizacion proyecto={proyecto} alCerrar={() => setCargando(false)} />}
      {editandoDrive && <EditarDrive proyecto={proyecto} alCerrar={() => setEditandoDrive(false)} />}
    </>
  );
}

/**
 * La fecha no se elige: es la de hoy.
 *
 * Mismo criterio que Monitoreo — una actualización dice qué se sabe ahora, y
 * `registrarObservacion` la estampa con el día de la carga. Poder antedatarla
 * pediría otro camino de escritura para ganar poco.
 */
function AgregarActualizacion({ proyecto, alCerrar }) {
  const [estado, setEstado] = useState(proyecto.estado);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!comentario.trim()) {
      setError('Escribí la novedad: una actualización sin texto no dice nada.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      // El estado va siempre: es lo que hace que el repositorio registre una
      // observación fechada en vez de sólo pisar el campo del proyecto.
      await acciones.actualizarProyecto(proyecto.id_proyecto, {
        estado,
        observaciones: comentario.trim(),
      });
      alCerrar();
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la actualización. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      ancho="md"
      titulo="Agregar actualización"
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
        <CampoRadios etiqueta="Estado del programa" opciones={ESTADOS_PROYECTO} valor={estado} alCambiar={setEstado} />
        <CampoArea
          etiqueta="Novedad"
          requerido
          filas={4}
          placeholder="¿Qué pasó con este programa desde la última vez?"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
        <p className="text-[11px] text-tenue">Queda fechada hoy y se suma al historial, sin pisar las anteriores.</p>
        {error && <Aviso tono="error">{error}</Aviso>}
      </div>
    </Modal>
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
