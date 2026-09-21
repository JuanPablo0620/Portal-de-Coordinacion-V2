import { useEffect, useState } from 'react';
import { Check, ChevronDown, History, MessageSquareText } from 'lucide-react';
import { Boton } from './Basicos.jsx';
import { CampoArea, CampoFecha, CampoRadios } from './Campo.jsx';
import { SelectorUnidad } from './SelectorUnidad.jsx';
import { AsignarResponsable } from './ResponsableCompromiso.jsx';
import { ESTADOS_COMPROMISO } from '../datos/catalogos.js';
import { historialCompromiso } from '../datos/repositorio.js';
import { fecha as fFecha } from '../utilidades/formato.js';

const OPCIONES_ESTADO = ESTADOS_COMPROMISO.map((valor) => ({
  valor,
  titulo: valor.replaceAll('_', ' '),
}));

/**
 * Formulario para "actualizar" un compromiso ya cargado: cambiar su estado,
 * anotar una novedad y, si hace falta, correr la fecha límite.
 *
 * A propósito NO deja reescribir la descripción original ahí mismo: antes
 * este mismo formulario (en Seguimiento y en las dos secciones de Monitoreo)
 * abría con el texto completo del compromiso en una caja editable, y para
 * dejar constancia de un avance había que reescribirlo a mano encima de lo
 * que ya decía. La descripción se muestra fija y lo que se carga acá se
 * guarda como una fila del HISTORIAL del compromiso, que se lista acá abajo.
 *
 * Hasta el 14/09/2026 esa novedad se concatenaba a la descripción y el nombre
 * del compromiso se iba llenando de anotaciones fechadas. Ahora la descripción
 * queda quieta y lo que pasa con el compromiso se lee como una serie. Ver
 * `supabase/migrations/0031_novedad_compromiso_al_historial.sql`.
 */
export function EditorCompromiso({
  compromiso,
  borrador,
  alCambiarBorrador,
  alGuardar,
  alCancelar,
  guardando = false,
  conFechaLimite = true,
  diseno = 'normal',
  pie,
  etiquetaGuardar = 'Guardar cambios',
}) {
  if (diseno === 'panel-operativo') {
    return (
      <EditorPanelOperativo
        compromiso={compromiso}
        borrador={borrador}
        alCambiarBorrador={alCambiarBorrador}
        alGuardar={alGuardar}
        alCancelar={alCancelar}
        guardando={guardando}
        conFechaLimite={conFechaLimite}
        pie={pie}
      />
    );
  }

  return (
    <div className="border-t border-dashed border-borde-fuerte/40 p-2.5">
      <AsignarResponsable key={compromiso.id} compromiso={compromiso} />
      <CampoRadios
        etiqueta="Nuevo estado"
        opciones={OPCIONES_ESTADO}
        valor={borrador?.estado ?? compromiso.estado}
        alCambiar={(v) => alCambiarBorrador({ estado: v })}
      />
      <p className="mt-2.5 whitespace-pre-line rounded-chip bg-paper p-2 text-xs text-gris">{compromiso.descripcion}</p>
      <Historial compromisoId={compromiso.id} />
      <CampoArea
        etiqueta="Agregar actualización"
        ayuda="opcional — se suma debajo de lo anterior, con la fecha de hoy"
        className="mt-2.5"
        filas={2}
        placeholder="¿Qué novedad hay sobre este compromiso?"
        value={borrador?.nuevaActualizacion ?? ''}
        onChange={(e) => alCambiarBorrador({ nuevaActualizacion: e.target.value })}
      />
      {conFechaLimite && (
        <CampoFecha
          etiqueta="Fecha límite"
          className="mt-2.5 max-w-48"
          value={borrador?.fecha_limite ?? compromiso.fecha_limite ?? ''}
          onChange={(e) => alCambiarBorrador({ fecha_limite: e.target.value })}
        />
      )}
      {/* Los compromisos cargados antes de que existiera el organigrama no
          tienen unidad, y este es el único lugar donde se les puede poner. */}
      <SelectorUnidad
        area={compromiso.area}
        idSubsecretaria={borrador?.id_subsecretaria ?? compromiso.id_subsecretaria ?? ''}
        idDireccion={borrador?.id_direccion ?? compromiso.id_direccion ?? ''}
        alCambiar={alCambiarBorrador}
      />
      <div className="mt-2 flex justify-end gap-2">
        {alCancelar && (
          <Boton tamanio="sm" onClick={alCancelar}>
            Cerrar
          </Boton>
        )}
        <Boton variante="primario" tamanio="sm" icono={Check} onClick={alGuardar} disabled={guardando}>
          {guardando ? 'Guardando…' : etiquetaGuardar}
        </Boton>
      </div>
    </div>
  );
}

/**
 * Variante para Seguimiento → Compromisos.
 *
 * En esta pantalla la tarea no es editar un registro aislado: durante una
 * reunión se leen novedades y se cargan movimientos uno detrás de otro. La
 * división lectura/formulario deja ambos contextos visibles y evita que la
 * actualización más reciente quede perdida entre metadatos y campos.
 */
function EditorPanelOperativo({
  compromiso,
  borrador,
  alCambiarBorrador,
  alGuardar,
  alCancelar,
  guardando,
  conFechaLimite,
  pie,
}) {
  return (
    <div className="overflow-hidden rounded-card border border-borde bg-card shadow-card">
      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 p-4" aria-label="Historial del compromiso">
          <HistorialOperativo compromisoId={compromiso.id} />
        </section>

        <section className="border-t border-borde bg-paper/55 p-4 lg:border-l lg:border-t-0" aria-label="Registrar novedad">
          <h3 className="text-sm font-semibold text-tinta">Registrar novedad</h3>
          <AsignarResponsable key={compromiso.id} compromiso={compromiso} />
          <p className="mt-1 text-xs leading-relaxed text-gris">
            El cambio de estado y el comentario se guardan juntos como un nuevo movimiento.
          </p>

          <CampoRadios
            etiqueta="Nuevo estado"
            className="mt-3 [&_label]:inline-flex [&_label]:min-h-11 [&_label]:items-center"
            opciones={OPCIONES_ESTADO}
            valor={borrador?.estado ?? compromiso.estado}
            alCambiar={(v) => alCambiarBorrador({ estado: v })}
          />
          <CampoArea
            etiqueta="Actualización"
            ayuda="opcional — se registra con la fecha de hoy"
            className="mt-3"
            filas={2}
            placeholder="¿Qué cambió desde la última reunión?"
            value={borrador?.nuevaActualizacion ?? ''}
            onChange={(e) => alCambiarBorrador({ nuevaActualizacion: e.target.value })}
          />
          {conFechaLimite && (
            <CampoFecha
              etiqueta="Fecha límite"
              className="mt-3"
              value={borrador?.fecha_limite ?? compromiso.fecha_limite ?? ''}
              onChange={(e) => alCambiarBorrador({ fecha_limite: e.target.value })}
            />
          )}

          {/* También se conserva acá la corrección del organigrama para los
              compromisos históricos que todavía no tienen unidad asignada. */}
          <details className="group mt-3 overflow-hidden rounded-chip border border-borde bg-card">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-medium text-gris marker:content-none hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-acento">
              Editar unidad responsable
              <ChevronDown
                size={16}
                aria-hidden="true"
                className="shrink-0 text-tenue transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <div className="border-t border-borde p-3">
              <SelectorUnidad
                area={compromiso.area}
                idSubsecretaria={borrador?.id_subsecretaria ?? compromiso.id_subsecretaria ?? ''}
                idDireccion={borrador?.id_direccion ?? compromiso.id_direccion ?? ''}
                alCambiar={alCambiarBorrador}
                columnas={1}
                compacto
              />
            </div>
          </details>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {alCancelar && (
              <Boton tamanio="sm" className="min-h-11" onClick={alCancelar} disabled={guardando}>
                Cerrar
              </Boton>
            )}
            <Boton
              variante="primario"
              tamanio="sm"
              icono={Check}
              className="min-h-11 min-w-36"
              onClick={alGuardar}
              disabled={guardando}
            >
              {guardando ? 'Guardando…' : 'Guardar movimiento'}
            </Boton>
          </div>
        </section>
      </div>

      {pie && <footer className="border-t border-borde bg-card px-4 py-2.5">{pie}</footer>}
    </div>
  );
}

/**
 * Las novedades ya cargadas, lo más nuevo primero.
 *
 * Se pide acá y no se recibe por prop para que los tres lugares que abren el
 * editor —las dos secciones de Monitoreo y el detalle de Seguimiento— lo
 * hereden sin repetir la carga en cada uno.
 *
 * Si la consulta falla no se muestra ningún cartel: es información de apoyo, y
 * romper el formulario de carga por no poder leer el historial sería peor que
 * no mostrarlo.
 */
function Historial({ compromisoId }) {
  const [filas, setFilas] = useState([]);

  useEffect(() => {
    let vigente = true;
    historialCompromiso(compromisoId)
      .then((h) => vigente && setFilas(h))
      .catch(() => vigente && setFilas([]));
    return () => {
      vigente = false;
    };
  }, [compromisoId]);

  // Los hitos automáticos del alta y la baja no aportan nada en un formulario
  // de carga: lo que importa son las novedades y los cambios de estado.
  const utiles = filas.filter((f) => f.comentarios || f.estado_anterior);
  if (utiles.length === 0) return null;

  return (
    <div className="mt-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-tenue">Actualizaciones</p>
      <ol className="mt-1 flex flex-col gap-1">
        {utiles.map((f) => (
          <li key={f.id} className="rounded-chip border border-borde px-2 py-1.5 text-xs text-gris">
            <span className="text-tenue">{fFecha(f.fecha_actualizacion)}</span>
            {f.estado_anterior && f.estado_anterior !== f.estado && (
              <span className="ml-1.5 text-tenue">
                · {f.estado_anterior} → {f.estado}
              </span>
            )}
            {f.comentarios && <p className="mt-0.5 whitespace-pre-line">{f.comentarios}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * La misma fuente del historial, presentada como información principal.
 * El primer movimiento se separa visualmente; el resto forma una cronología.
 */
function HistorialOperativo({ compromisoId }) {
  const [estado, setEstado] = useState({ cargando: true, filas: [] });

  useEffect(() => {
    let vigente = true;
    setEstado({ cargando: true, filas: [] });
    historialCompromiso(compromisoId)
      .then((filas) => vigente && setEstado({ cargando: false, filas }))
      .catch(() => vigente && setEstado({ cargando: false, filas: [] }));
    return () => {
      vigente = false;
    };
  }, [compromisoId]);

  const utiles = estado.filas.filter((f) => f.comentarios || f.estado_anterior);

  if (estado.cargando) {
    return <p role="status" className="text-xs text-tenue">Cargando actualizaciones…</p>;
  }

  if (utiles.length === 0) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center rounded-card border border-dashed border-borde-fuerte/50 bg-paper/50 px-5 text-center">
        <History size={22} className="text-tenue" />
        <h3 className="mt-2 text-sm font-semibold text-tinta">Todavía no hay actualizaciones</h3>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-gris">
          El próximo cambio de estado o comentario quedará registrado en este historial.
        </p>
      </div>
    );
  }

  const [ultima, ...anteriores] = utiles;

  return (
    <div>
      <article className="rounded-card border border-acento-medio border-l-[3px] border-l-acento bg-acento-suave p-3.5">
        <header className="flex flex-wrap items-center gap-2 text-acento-fuerte">
          <MessageSquareText size={17} aria-hidden="true" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wide">Última novedad</h3>
          <time className="tabular ml-auto text-xs text-gris" dateTime={ultima.fecha_actualizacion}>
            {fFecha(ultima.fecha_actualizacion)}
          </time>
        </header>
        <Movimiento fila={ultima} destacado />
      </article>

      {anteriores.length > 0 && (
        <div className="mt-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-tinta">
            <History size={17} aria-hidden="true" />
            Movimientos anteriores
          </h3>
          <ol className="relative mt-3 ml-1.5 border-l-2 border-acento-medio pl-5">
            {anteriores.map((fila) => (
              <li key={fila.id} className="relative pb-4 last:pb-0">
                <span
                  aria-hidden="true"
                  className="absolute -left-[1.7rem] top-1 h-3 w-3 rounded-full border-[3px] border-card bg-acento ring-1 ring-acento-medio"
                />
                <time className="tabular block text-[11px] font-medium text-tenue" dateTime={fila.fecha_actualizacion}>
                  {fFecha(fila.fecha_actualizacion)}
                </time>
                <Movimiento fila={fila} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Movimiento({ fila, destacado = false }) {
  const cambioEstado = fila.estado_anterior && fila.estado_anterior !== fila.estado;

  return (
    <div className={destacado ? 'mt-2 pl-6' : 'mt-1'}>
      {fila.comentarios ? (
        <p className={`whitespace-pre-line leading-relaxed text-tinta ${destacado ? 'text-sm' : 'text-xs'}`}>
          {fila.comentarios}
        </p>
      ) : (
        <p className="text-xs text-gris">Cambio de estado.</p>
      )}
      {cambioEstado && (
        <p className="mt-1.5 text-xs text-gris">
          <span className="capitalize">{fila.estado_anterior}</span>
          <span className="mx-1.5" aria-hidden="true">→</span>
          <span className="font-semibold capitalize text-acento-fuerte">{fila.estado}</span>
        </p>
      )}
    </div>
  );
}
