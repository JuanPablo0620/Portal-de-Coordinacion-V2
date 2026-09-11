/**
 * Carga de un monitoreo, en dos partes:
 *
 *  · TEMAS — se pega lo que pasó en el área, se aprieta «Transferir» y el
 *    sistema propone un tema por oración. Quedan como BORRADORES editables:
 *    no se persiste ninguno hasta confirmarlo. Un tema confirmado se puede
 *    seguir editando en la misma sesión —es donde se nota la corrección de
 *    lo que propuso la transferencia—, y el repositorio mantiene el
 *    compromiso asociado en sincronía.
 *  · VENTANA — proyectos y compromisos del área que corresponde repasar
 *    entre el último seguimiento y el próximo (`PanelVentana`), sin pasar
 *    por la carga de temas de arriba.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ClipboardCheck,
  Pencil,
  Plus,
  Radar,
  Trash2,
  X,
} from 'lucide-react';
import { BarraAvance, Boton, Aviso, Chip, Criticidad, EstadoProyecto, Semaforo, Tarjeta, Vacio, nivelPorDias } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoCheck, CampoFecha, CampoNumero, CampoRadios, CampoSelect, GrillaCampos } from '../../componentes/Campo.jsx';
import { EditorCompromiso } from '../../componentes/EditorCompromiso.jsx';
import { SelectorProyecto } from '../../componentes/SelectorProyecto.jsx';
import { SelectorUnidad } from '../../componentes/SelectorUnidad.jsx';
import { Transferencia } from '../../componentes/Transferencia.jsx';
import { separarTemas } from '../../datos/minutas/separarTemas.js';
import { CRITICIDADES, ESTADOS_COMPROMISO, ESTADOS_PROYECTO } from '../../datos/catalogos.js';
import {
  compromisos as selCompromisos,
  compromisosEnVentana,
  compromisosSueltosVentana,
  hoyISO,
  proyectos as selProyectos,
  ventanaSeguimiento,
} from '../../datos/selectores.js';
import { fecha as fFecha, numero } from '../../utilidades/formato.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { acciones, useBD } from '../../estado/tienda.js';

const TEMA_VACIO = {
  categoria: '',
  id_proyecto: '',
  // Compromiso ya existente del proyecto vinculado, del que este tema es una
  // novedad — distinto de "requiere_accion", que genera uno nuevo. Los dos
  // son excluyentes: ver `compromiso_existente` más abajo.
  id_compromiso: '',
  compromiso_existente: false,
  // Sólo tiene sentido junto a `compromiso_existente`: cuando está tildado,
  // "Actualizar compromiso" edita estado y descripción del compromiso
  // vinculado sin salir del tema. No se persiste en el tema — se consume al
  // guardar (ver `persistir`/`guardarEdicion`).
  actualizar_compromiso: false,
  compromiso_nuevo_estado: '',
  compromiso_nueva_descripcion: '',
  descripcion: '',
  // Descripción propia del compromiso que "Crear nuevo compromiso" genera —
  // distinta de la del tema, ver `descripcion_compromiso` en `aPersistir`.
  descripcion_compromiso: '',
  criticidad: 'media',
  requiere_accion: false,
  fecha_limite: '',
};

const EJEMPLO =
  'Ej.: Se completó el operativo de bacheo en el barrio Norte. Falta la partida para pagarle al ' +
  'proveedor de materiales. Ferreyra va a elevar el expediente antes del 15/09.';

/** Cómo se rotula de dónde salió cada borrador: la propuesta tiene que ser auditable. */
const ORIGEN = {
  compromiso: { tono: 'proximo', texto: 'acción comprometida' },
  problema: { tono: 'vencido', texto: 'traba detectada' },
  avance: { tono: 'enregla', texto: 'avance informado' },
};

const nuevaClave = () => Math.random().toString(36).slice(2);

/**
 * Corrige el scroll de `#contenido` para que `el` quede a la vista —sólo si
 * hace falta—, sin tocar nada fuera de ese contenedor. A propósito no usa
 * `el.scrollIntoView()`: esa API recorre TODOS los ancestros con scroll,
 * ventana del navegador incluida aunque tenga `overflow: hidden` (ver la
 * nota en Layout.jsx) — acá el único contenedor que puede scrollear es
 * `#contenido`, así que se corrige ese solo, a mano.
 */
function scrollDentroDelContenido(el) {
  const contenedor = document.getElementById('contenido');
  if (!el || !contenedor) return;
  const rEl = el.getBoundingClientRect();
  const rCont = contenedor.getBoundingClientRect();
  if (rEl.top < rCont.top) {
    contenedor.scrollTop -= rCont.top - rEl.top;
  } else if (rEl.bottom > rCont.bottom) {
    contenedor.scrollTop += rEl.bottom - rCont.bottom;
  }
}

/** Validación §8.6, compartida por los tres caminos de carga de un tema. */
function validarTema(tema, hoy) {
  if (!tema.categoria) return 'Elegí la categoría del tema.';
  if (!tema.descripcion.trim()) return 'Describí el tema.';
  if (tema.requiere_accion && tema.fecha_limite && tema.fecha_limite < hoy) {
    return 'La fecha límite no puede ser anterior a hoy.';
  }
  return '';
}

/** Lo que espera el repositorio, sin los campos que sólo viven en la pantalla. */
const aPersistir = (tema) => ({
  categoria: tema.categoria,
  descripcion: tema.descripcion.trim(),
  criticidad: tema.criticidad,
  requiere_accion: tema.requiere_accion,
  descripcion_compromiso: tema.requiere_accion ? tema.descripcion_compromiso.trim() : '',
  id_proyecto: tema.id_proyecto || null,
  id_compromiso: tema.id_compromiso || null,
  compromiso_existente: Boolean(tema.id_compromiso),
  fecha_limite: (tema.requiere_accion && tema.fecha_limite) || null,
});

/** `areaInicial` viene de la hoja de una secretaría: llegar con el área ya elegida. */
/**
 * @param monitoreoInicial  Monitoreo ya creado que se viene a retomar, desde el
 *   boton «Continuar» de la lista. Con esto la pantalla saltea el paso 1 —crear
 *   la cabecera— y abre directo la carga, que es lo que quedo a medias.
 *
 *   Un monitoreo abierto es trabajo sin terminar: alguien lo empezo, se
 *   distrajo y quedo ahi. Sin forma de volver a el, la unica salida era crear
 *   otro para la misma area y el mismo dia, que ensucia la serie y hace que la
 *   cadencia mienta.
 */
export function CargarMonitoreo({ alTerminar, areaInicial = '', monitoreoInicial = null }) {
  const hoy = hoyISO();
  const opcionesArea = useOpciones('areas');
  const opcionesCategoria = useOpciones('categorias_tema');

  const [cabecera, setCabecera] = useState({
    fecha: monitoreoInicial?.fecha ?? hoy,
    area: monitoreoInicial?.area ?? areaInicial,
  });
  const [monitoreo, setMonitoreo] = useState(monitoreoInicial);
  const [temasCargados, setTemasCargados] = useState([]);
  const [huboActualizacionProyecto, setHuboActualizacionProyecto] = useState(false);

  const [texto, setTexto] = useState('');
  const [transferido, setTransferido] = useState(false);
  const [borradores, setBorradores] = useState([]);

  const [editando, setEditando] = useState(null);

  // Un mensaje por formulario: con un único error compartido, confirmar el
  // tercer borrador pintaba el aviso arriba del primero.
  const [errores, setErrores] = useState({});
  const [trabajando, setTrabajando] = useState(false);

  const marcar = (clave, mensaje) => setErrores((e) => ({ ...e, [clave]: mensaje }));

  async function iniciar() {
    if (!cabecera.area || !cabecera.fecha) {
      marcar('cabecera', 'Indicá la fecha y el área del monitoreo.');
      return;
    }
    marcar('cabecera', '');
    setTrabajando(true);
    try {
      setMonitoreo(await acciones.crearMonitoreo(cabecera));
    } catch (err) {
      // Sin esto el boton no hacia nada: la promesa se rechazaba y nadie la
      // atendia. Es el mismo error que ya tenia el alta de temas, dos
      // funciones mas abajo, y que ahi si estaba resuelto.
      marcar('cabecera', 'No se pudo iniciar el monitoreo: ' + err.message);
    } finally {
      setTrabajando(false);
    }
  }

  function transferir() {
    const propuestos = separarTemas(texto, { hoy, categorias: opcionesCategoria });
    setBorradores(propuestos.map((t) => ({ ...t, clave: nuevaClave() })));
    setTransferido(true);
    setErrores({});
  }

  const editarBorrador = (clave, parcial) =>
    setBorradores((bs) => bs.map((b) => (b.clave === clave ? { ...b, ...parcial } : b)));

  /** Persiste un tema y lo mueve a la lista de confirmados. */
  async function persistir(datos) {
    const { tema: creado, compromiso } = await acciones.enLote(async () => {
      const resultado = await acciones.agregarTema(monitoreo.id, aPersistir(datos));
      await aplicarActualizarCompromiso(datos);
      return resultado;
    });
    setTemasCargados((t) => [...t, { ...creado, generoCompromiso: Boolean(compromiso) }]);
  }

  /**
   * "Actualizar compromiso": si además de vincular el tema a un compromiso
   * existente se pidió corregirle estado y descripción, se aplica en el mismo
   * acto de guardar — sin esto habría que ir a Seguimiento aparte.
   */
  function aplicarActualizarCompromiso(datos) {
    if (!datos.actualizar_compromiso || !datos.compromiso_existente || !datos.id_compromiso) return null;
    return acciones.actualizarEstadoCompromiso(datos.id_compromiso, {
      estado: datos.compromiso_nuevo_estado,
      descripcion: datos.compromiso_nueva_descripcion,
    });
  }

  async function confirmarBorrador(borrador) {
    const problema = validarTema(borrador, hoy);
    if (problema) return marcar(borrador.clave, problema);
    marcar(borrador.clave, '');
    setTrabajando(true);
    try {
      await persistir(borrador);
      setBorradores((bs) => bs.filter((b) => b.clave !== borrador.clave));
    } catch (err) {
      marcar(borrador.clave, `No se pudo guardar el tema: ${err.message}`);
    } finally {
      setTrabajando(false);
    }
  }

  async function confirmarTodos() {
    const fallados = {};
    for (const b of borradores) {
      const problema = validarTema(b, hoy);
      if (problema) fallados[b.clave] = problema;
    }
    if (Object.keys(fallados).length) {
      setErrores({ ...fallados, lote: 'Hay borradores incompletos. Corregilos y volvé a confirmar.' });
      return;
    }
    setErrores({});
    setTrabajando(true);
    try {
      // Una sola escritura para toda la tanda: confirmar diez temas de a uno
      // repinta la pantalla diez veces con el monitoreo a medio cargar.
      await acciones.enLote(async () => {
        for (const b of borradores) await persistir(b);
      });
      setBorradores([]);
    } catch (err) {
      marcar('lote', `No se pudo confirmar el monitoreo: ${err.message}`);
    } finally {
      setTrabajando(false);
    }
  }

  async function guardarEdicion() {
    const problema = validarTema(editando, hoy);
    if (problema) return marcar('edicion', problema);
    marcar('edicion', '');
    setTrabajando(true);
    try {
      const actualizado = await acciones.enLote(async () => {
        const resultado = await acciones.actualizarTema(editando.id, aPersistir(editando));
        await aplicarActualizarCompromiso(editando);
        return resultado;
      });
      setTemasCargados((ts) =>
        ts.map((t) =>
          t.id === editando.id
            ? {
                ...t,
                ...actualizado,
                generoCompromiso: Boolean(actualizado.id_compromiso) && !actualizado.compromiso_existente,
              }
            : t,
        ),
      );
      setEditando(null);
    } catch (err) {
      marcar('edicion', `No se pudo guardar la edición: ${err.message}`);
    } finally {
      setTrabajando(false);
    }
  }

  async function finalizar() {
    if (!huboActualizacionProyecto) {
      marcar('cierre', 'Guardá al menos una actualización de proyecto antes de finalizar.');
      return;
    }
    setTrabajando(true);
    try {
      await acciones.finalizarMonitoreo(monitoreo.id);
      alTerminar?.();
    } catch (e) {
      marcar('cierre', e.message);
    } finally {
      setTrabajando(false);
    }
  }

  /* ── Paso 1: crear el monitoreo ─────────────────────────────────── */

  if (!monitoreo) {
    return (
      <Tarjeta titulo="Nuevo monitoreo" descripcion="Fecha y área. Después se cargan los temas, transferidos o a mano.">
        <GrillaCampos columnas={2} className="max-w-2xl">
          <CampoFecha
            etiqueta="Fecha"
            requerido
            value={cabecera.fecha}
            onChange={(e) => setCabecera((c) => ({ ...c, fecha: e.target.value }))}
          />
          <CampoSelect
            etiqueta="Área"
            requerido
            opciones={opcionesArea}
            value={cabecera.area}
            onChange={(e) => setCabecera((c) => ({ ...c, area: e.target.value }))}
          />
        </GrillaCampos>
        {errores.cabecera && (
          <div className="mt-3 max-w-2xl">
            <Aviso tono="error">{errores.cabecera}</Aviso>
          </div>
        )}
        <div className="mt-4">
          <Boton variante="primario" icono={Radar} onClick={iniciar} disabled={trabajando}>
            Iniciar monitoreo
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  /* ── Paso 2: temas ──────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta>
        <div className="flex flex-wrap items-center gap-3">
          <Chip tono="acento">{fFecha(monitoreo.fecha)}</Chip>
          <span className="text-sm font-medium text-tinta">{monitoreo.area}</span>
          <span className="text-xs text-gris">
            {huboActualizacionProyecto ? 'Actualización de proyecto registrada' : 'Sin actualizaciones todavía'}
          </span>
          <Boton
            variante="primario"
            icono={ClipboardCheck}
            onClick={finalizar}
            disabled={trabajando || !huboActualizacionProyecto}
            className="ml-auto"
          >
            Finalizar monitoreo
          </Boton>
        </div>
        {!huboActualizacionProyecto && (
          <p className="mt-2 text-xs text-tenue">Guardá al menos una actualización de proyecto para poder finalizar.</p>
        )}
        {errores.cierre && (
          <div className="mt-3">
            <Aviso tono="error">{errores.cierre}</Aviso>
          </div>
        )}
      </Tarjeta>

      {false && <>
      {/* Compatibilidad con el flujo anterior de temas; el portal actual actualiza proyectos. */}
      <Transferencia
        titulo="Transferir desde texto"
        descripcion="Pegá lo que pasó en el área y transferilo: sale un tema por oración, editable."
        etiquetaCampo="Texto del monitoreo"
        placeholder={EJEMPLO}
        ayuda="Cada oración se convierte en un tema con categoría y criticidad propuestas. Nada se guarda todavía."
        texto={texto}
        alCambiarTexto={setTexto}
        alTransferir={transferir}
        transferido={transferido}
        resumen={
          borradores.length
            ? `${borradores.length} tema(s) propuesto(s) esperando confirmación abajo.`
            : 'No quedan borradores: los confirmaste o los descartaste todos.'
        }
        filas={6}
      />

      {/* Borradores transferidos, todos editables */}
      {borradores.length > 0 && (
        <Tarjeta
          titulo={`Temas transferidos · ${borradores.length} sin confirmar`}
          descripcion="Corregí lo que haga falta. Cada uno se guarda recién al confirmarlo."
          acciones={
            <Boton variante="primario" tamanio="sm" icono={Check} onClick={confirmarTodos} disabled={trabajando}>
              Confirmar los {borradores.length}
            </Boton>
          }
        >
          {errores.lote && (
            <div className="mb-3">
              <Aviso tono="error">{errores.lote}</Aviso>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {borradores.map((borrador, i) => {
              const origen = ORIGEN[borrador.clase] ?? ORIGEN.avance;
              return (
                <fieldset key={borrador.clave} className="rounded-chip border border-borde p-3">
                  <legend className="mx-2 flex items-center gap-2 px-1 text-xs font-semibold text-gris">
                    Tema propuesto {i + 1}
                    <Chip tono={origen.tono}>{origen.texto}</Chip>
                  </legend>

                  <FormularioTema
                    tema={borrador}
                    alCambiar={(parcial) => editarBorrador(borrador.clave, parcial)}
                    opcionesCategoria={opcionesCategoria}
                    hoy={hoy}
                  />

                  {errores[borrador.clave] && (
                    <div className="mt-3">
                      <Aviso tono="error">{errores[borrador.clave]}</Aviso>
                    </div>
                  )}

                  <div className="mt-3 flex justify-end gap-2 border-t border-borde pt-3">
                    <Boton
                      tamanio="sm"
                      icono={Trash2}
                      onClick={() => setBorradores((bs) => bs.filter((b) => b.clave !== borrador.clave))}
                    >
                      Descartar
                    </Boton>
                    <Boton
                      variante="primario"
                      tamanio="sm"
                      icono={Check}
                      onClick={() => confirmarBorrador(borrador)}
                      disabled={trabajando}
                    >
                      Confirmar tema
                    </Boton>
                  </div>
                </fieldset>
              );
            })}
          </div>
        </Tarjeta>
      )}

      {/* Edición de un tema ya confirmado */}
      {editando && (
        <Tarjeta titulo="Editar tema confirmado" descripcion="Los cambios se guardan sobre el tema y su compromiso.">
          <FormularioTema
            tema={editando}
            alCambiar={(parcial) => setEditando((t) => ({ ...t, ...parcial }))}
            opcionesCategoria={opcionesCategoria}
            hoy={hoy}
          />
          {errores.edicion && (
            <div className="mt-3">
              <Aviso tono="error">{errores.edicion}</Aviso>
            </div>
          )}
          <div className="mt-3 flex justify-end gap-2 border-t border-borde pt-3">
            <Boton tamanio="sm" icono={X} onClick={() => setEditando(null)}>
              Cancelar
            </Boton>
            <Boton variante="primario" tamanio="sm" icono={Check} onClick={guardarEdicion} disabled={trabajando}>
              Guardar cambios
            </Boton>
          </div>
        </Tarjeta>
      )}

      {/* Temas ya confirmados */}
      {temasCargados.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {temasCargados.map((t, i) => (
            <article key={t.id} className="tarjeta flex flex-col gap-2 p-3.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-enregla-suave text-enregla-texto">
                  <CheckCircle2 size={14} />
                </span>
                <span className="text-xs font-semibold text-tinta">Tema {i + 1}</span>
                <Criticidad nivel={t.criticidad} />
                <button
                  type="button"
                  onClick={() => {
                    setEditando({
                      ...TEMA_VACIO,
                      ...t,
                      id_proyecto: t.id_proyecto ?? '',
                      id_compromiso: t.id_compromiso ?? '',
                      compromiso_existente: t.compromiso_existente ?? false,
                      fecha_limite: t.fecha_limite ?? '',
                      descripcion_compromiso: t.descripcion_compromiso ?? '',
                    });
                    marcar('edicion', '');
                  }}
                  className="ml-auto rounded-chip p-1.5 text-tenue transition hover:bg-acento-suave hover:text-acento-fuerte"
                  aria-label={`Editar tema ${i + 1}`}
                >
                  <Pencil size={14} />
                </button>
              </div>
              <p className="text-sm leading-snug text-tinta">{t.descripcion}</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip tono="neutro">{t.categoria}</Chip>
                {t.id_proyecto && <Chip tono="acento">{t.id_proyecto}</Chip>}
                {t.generoCompromiso && <Chip tono="proximo">Genera compromiso</Chip>}
                {t.compromiso_existente && <Chip tono="acento">Vinculado a compromiso</Chip>}
              </div>
              {t.requiere_accion && t.fecha_limite && (
                <p className="text-[11px] text-tenue">vence {fFecha(t.fecha_limite)}</p>
              )}
            </article>
          ))}
        </div>
      )}

      </>}

      {/* Proyectos y compromisos de la ventana entre seguimientos — camino
          aparte de la transferencia de texto de arriba: repasar y
          actualizar proyectos y compromisos sin escribir un tema. */}
      <PanelVentana
        area={monitoreo.area}
        monitoreoId={monitoreo.id}
        hoy={hoy}
        alActualizarProyecto={() => setHuboActualizacionProyecto(true)}
      />
    </div>
  );
}

/**
 * Parte 2 de la carga de un monitoreo: los proyectos del área y sus
 * compromisos vigentes con fecha límite dentro de la ventana entre el último
 * seguimiento realizado y el próximo agendado (`ventanaSeguimiento`) — la
 * franja que este monitoreo semanal cubre. Cada secretaría agenda sus
 * seguimientos por su cuenta, así que esta ventana varía de área en área.
 *
 * Se puede actualizar el estado y la descripción de un proyecto, o de
 * cualquiera de sus compromisos, o crear un compromiso nuevo — sin salir de
 * acá ni pasar por Seguimiento.
 *
 * Se exporta por el mismo motivo que `FormularioTema`: vive detrás del
 * estado local de "monitoreo iniciado", así que ninguna URL lo alcanza y sin
 * esto no entraría en el render de control (ver `pruebas/humo/entrada.jsx`).
 */
export function PanelVentana({ area, monitoreoId, hoy, alActualizarProyecto }) {
  const bd = useBD();

  const ventana = useMemo(
    () => (bd ? ventanaSeguimiento(bd, area, hoy) : { ultimo: null, proximo: null }),
    [bd, area, hoy],
  );
  const proyectosArea = useMemo(
    () => (bd ? selProyectos(bd, { area, solo_activos: true }) : []),
    [bd, area],
  );
  const compromisosSueltos = useMemo(
    () => (bd ? compromisosSueltosVentana(bd, area, ventana, hoy) : []),
    [bd, area, ventana, hoy],
  );

  const [abiertoProyecto, setAbiertoProyecto] = useState(null);
  const [borradorProyecto, setBorradorProyecto] = useState(null);
  const [abiertoCompromiso, setAbiertoCompromiso] = useState(null);
  const [borradorCompromiso, setBorradorCompromiso] = useState(null);
  const [creandoCompromiso, setCreandoCompromiso] = useState(false);
  const [nuevoCompromiso, setNuevoCompromiso] = useState(null);
  /**
   * Error de la ultima accion, ATADO al proyecto donde ocurrio.
   *
   * Era un string suelto que se le pasaba a todas las tarjetas, asi que un
   * fallo en un proyecto pintaba el mismo cartel rojo en los otros tres de la
   * secretaria. Parecia que se habia roto todo cuando en realidad habia fallado
   * uno. Ahora es { idProyecto, mensaje } y cada tarjeta muestra solo el suyo.
   */
  const [errorAccion, setErrorAccion] = useState(null);
  const [guardando, setGuardando] = useState(false);

  function alternarProyecto(p) {
    if (abiertoProyecto === p.id_proyecto) {
      setAbiertoProyecto(null);
      setBorradorProyecto(null);
    } else {
      setAbiertoProyecto(p.id_proyecto);
      setBorradorProyecto({ estado: p.estado, observaciones: p.observaciones ?? '', avance: p.avance ?? 0 });
    }
    setAbiertoCompromiso(null);
    setBorradorCompromiso(null);
    setCreandoCompromiso(false);
    setNuevoCompromiso(null);
  }

  async function guardarProyecto(p) {
    setErrorAccion(null);
    setGuardando(true);
    try {
      await acciones.actualizarProyecto(
        p.id_proyecto,
        { ...borradorProyecto, avance: Number(borradorProyecto.avance) || 0 },
        // Deja registrado que este avance se informo en ESTA reunion, que es lo
        // que despues muestra la pestania de ultimos monitoreos.
        { monitoreoId: monitoreoId },
      );
      alActualizarProyecto?.();
      setAbiertoProyecto(null);
      setBorradorProyecto(null);
    } catch (error) {
      setErrorAccion({ idProyecto: p.id_proyecto, mensaje: `No se pudo guardar el proyecto: ${error.message}` });
    } finally {
      setGuardando(false);
    }
  }

  function alternarCompromiso(c) {
    if (abiertoCompromiso === c.id) {
      setAbiertoCompromiso(null);
      setBorradorCompromiso(null);
    } else {
      setAbiertoCompromiso(c.id);
      setBorradorCompromiso({ estado: c.estado, fecha_limite: c.fecha_limite ?? '' });
    }
  }

  /**
   * Guardar los cambios de un compromiso ya cargado.
   *
   * Sin el try/catch el boton no hacia NADA cuando fallaba: la promesa se
   * rompia en silencio, no se cerraba el formulario y no aparecia ningun
   * mensaje. Es el mismo agujero que tenian los formularios de eventos antes de
   * que los datos vivieran en Supabase, donde guardar no fallaba nunca.
   */
  async function guardarCompromiso(c, p) {
    setErrorAccion(null);
    setGuardando(true);
    try {
      await acciones.actualizarEstadoCompromiso(c.id, borradorCompromiso);
      setAbiertoCompromiso(null);
      setBorradorCompromiso(null);
    } catch (error) {
      setErrorAccion({
        idProyecto: p?.id_proyecto ?? null,
        mensaje: `No se pudo guardar el compromiso: ${error.message}`,
      });
    } finally {
      setGuardando(false);
    }
  }

  function abrirNuevoCompromiso() {
    setCreandoCompromiso(true);
    setNuevoCompromiso({ descripcion: '', fecha_limite: '', id_subsecretaria: '', id_direccion: '' });
  }

  async function guardarNuevoCompromiso(p) {
    setErrorAccion(null);
    setGuardando(true);
    try {
      await acciones.crearCompromisoDirecto({
        id_origen: monitoreoId,
        id_proyecto: p.id_proyecto,
        area: p.area,
        id_subsecretaria: nuevoCompromiso.id_subsecretaria || null,
        id_direccion: nuevoCompromiso.id_direccion || null,
        descripcion: nuevoCompromiso.descripcion.trim(),
        fecha_limite: nuevoCompromiso.fecha_limite || null,
      });
      setCreandoCompromiso(false);
      setNuevoCompromiso(null);
    } catch (error) {
      setErrorAccion({ idProyecto: p.id_proyecto, mensaje: `No se pudo crear el compromiso: ${error.message}` });
    } finally {
      setGuardando(false);
    }
  }

  // Estado aparte del de arriba: "crear nuevo compromiso" de un proyecto vive
  // adentro de SU acordeón, y esto no tiene acordeón de proyecto que lo
  // contenga — compartir el mismo estado haría que abrir uno mostrara
  // también el formulario del otro.
  const [creandoSuelto, setCreandoSuelto] = useState(false);
  const [nuevoSuelto, setNuevoSuelto] = useState(null);

  function abrirNuevoSuelto() {
    setCreandoSuelto(true);
    setNuevoSuelto({ descripcion: '', fecha_limite: '', id_subsecretaria: '', id_direccion: '' });
  }

  async function guardarNuevoSuelto() {
    setErrorAccion(null);
    setGuardando(true);
    try {
      await acciones.crearCompromisoDirecto({
        id_origen: monitoreoId,
        id_proyecto: null,
        area,
        id_subsecretaria: nuevoSuelto.id_subsecretaria || null,
        id_direccion: nuevoSuelto.id_direccion || null,
        descripcion: nuevoSuelto.descripcion.trim(),
        fecha_limite: nuevoSuelto.fecha_limite || null,
      });
      setCreandoSuelto(false);
      setNuevoSuelto(null);
    } catch (error) {
      setErrorAccion({ idProyecto: null, mensaje: `No se pudo crear el compromiso: ${error.message}` });
    } finally {
      setGuardando(false);
    }
  }

    return (
      <Tarjeta
      titulo="Proyectos y compromisos de esta ventana"
      descripcion="Lo que corresponde repasar en este monitoreo, según el calendario de seguimiento del área."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-chip border border-acento/40 bg-acento-suave p-2.5 text-xs text-acento-fuerte">
        <Calendar size={15} className="shrink-0" />
        <span>
          Ventana de este monitoreo:{' '}
          <b>{ventana.ultimo ? fFecha(ventana.ultimo.fecha) : 'sin seguimiento anterior'}</b>
          {' → '}
          <b>{ventana.proximo ? fFecha(ventana.proximo.fecha) : 'sin próximo seguimiento agendado'}</b>
        </span>
        <span className="ml-auto text-acento">{area}</span>
      </div>

      {/* Compromisos vigentes del área en esta ventana que no están atados a
          ningún proyecto puntual de la Base maestra — los que salen de un
          seguimiento y no corresponden a una obra o proyecto del catálogo
          (p. ej. "coordinar la visita de Roco al predio"). Sin esto quedaban
          invisibles: `compromisosEnVentana` sólo los busca DENTRO de la
          tarjeta de un proyecto. */}
      <div className="mb-3 rounded-card border border-borde bg-card p-3">
        {errorAccion?.idProyecto === null && <Aviso tono="error">{errorAccion.mensaje}</Aviso>}
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-tinta">
          <ClipboardCheck size={13} className="text-acento" />
          Compromisos sin proyecto asociado ({compromisosSueltos.length})
        </p>
        {compromisosSueltos.length === 0 && !creandoSuelto && (
          <p className="text-[11px] text-tenue">Ninguno vigente en esta ventana.</p>
        )}
        <div className="flex flex-col gap-1.5">
          {compromisosSueltos.map((c) => {
            const cAbierto = abiertoCompromiso === c.id;
            const nivel = c.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(c.dias_restantes);
            return (
              <div key={c.id} className={`rounded-chip border ${cAbierto ? 'border-acento' : 'border-borde'}`}>
                <button
                  type="button"
                  onClick={() => alternarCompromiso(c)}
                  className="flex w-full items-center gap-2 p-2.5 text-left"
                >
                  <Semaforo nivel={nivel} soloPunto texto={c.estado_efectivo} />
                  <span className="text-sm text-tinta">{c.descripcion}</span>
                  <span className="ml-auto text-[11px] text-tenue">{fFecha(c.fecha_limite)}</span>
                  <ChevronDown size={14} className={`shrink-0 text-tenue transition-transform ${cAbierto ? 'rotate-180' : ''}`} />
                </button>
                {cAbierto && (
                  <EditorCompromiso
                    compromiso={c}
                    borrador={borradorCompromiso}
                    alCambiarBorrador={(parcial) => setBorradorCompromiso((b) => ({ ...b, ...parcial }))}
                    alGuardar={() => guardarCompromiso(c, null)}
                  />
                )}
              </div>
            );
          })}
        </div>

        {creandoSuelto ? (
          <div className="mt-2.5 rounded-chip border border-acento bg-acento-suave/40 p-2.5">
            <p className="mb-2 text-xs font-semibold text-acento-fuerte">Crear nuevo compromiso sin proyecto asociado</p>
            <CampoArea
              etiqueta="Descripción"
              requerido
              filas={2}
              value={nuevoSuelto?.descripcion ?? ''}
              onChange={(e) => setNuevoSuelto((n) => ({ ...n, descripcion: e.target.value }))}
            />
            <CampoFecha
              etiqueta="Fecha límite"
              min={hoy}
              value={nuevoSuelto?.fecha_limite ?? ''}
              onChange={(e) => setNuevoSuelto((n) => ({ ...n, fecha_limite: e.target.value }))}
              className="mt-2.5"
            />
            <SelectorUnidad
              area={area}
              idSubsecretaria={nuevoSuelto?.id_subsecretaria ?? ''}
              idDireccion={nuevoSuelto?.id_direccion ?? ''}
              alCambiar={(parcial) => setNuevoSuelto((n) => ({ ...n, ...parcial }))}
            />
            <p className="mt-2 text-[11px] text-tenue">Se crea con estado <b>pendiente</b>.</p>
            <div className="mt-2 flex justify-end gap-2">
              <Boton
                tamanio="sm"
                onClick={() => {
                  setCreandoSuelto(false);
                  setNuevoSuelto(null);
                }}
              >
                Cancelar
              </Boton>
              <Boton
                variante="primario"
                tamanio="sm"
                icono={Check}
                onClick={guardarNuevoSuelto}
                disabled={guardando || !nuevoSuelto?.descripcion?.trim()}
              >
                Crear compromiso
              </Boton>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={abrirNuevoSuelto}
            className="mt-2.5 flex w-full items-center gap-2 rounded-chip border border-dashed border-acento/50 p-2.5 text-xs font-medium text-acento transition hover:bg-acento-suave/40"
          >
            <Plus size={14} /> Crear nuevo compromiso sin proyecto asociado
          </button>
        )}
      </div>

      {proyectosArea.length === 0 ? (
        <Vacio
          icono={Calendar}
          compacto
          titulo="Sin proyectos activos en esta área"
          descripcion="Los proyectos de la Base maestra que pertenecen a esta secretaría van a aparecer acá."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {proyectosArea.map((p) => (
            <TarjetaProyectoVentana
              key={p.id_proyecto}
              proyecto={p}
              bd={bd}
              ventana={ventana}
              hoy={hoy}
              abierto={abiertoProyecto === p.id_proyecto}
              alAlternar={() => alternarProyecto(p)}
              borrador={borradorProyecto}
              alCambiarBorrador={(parcial) => setBorradorProyecto((b) => ({ ...b, ...parcial }))}
              alGuardar={() => guardarProyecto(p)}
              abiertoCompromiso={abiertoCompromiso}
              alAlternarCompromiso={alternarCompromiso}
              borradorCompromiso={borradorCompromiso}
              alCambiarBorradorCompromiso={(parcial) => setBorradorCompromiso((b) => ({ ...b, ...parcial }))}
              alGuardarCompromiso={(c) => guardarCompromiso(c, p)}
              creandoCompromiso={creandoCompromiso}
              alAbrirNuevoCompromiso={abrirNuevoCompromiso}
              alCerrarNuevoCompromiso={() => {
                setCreandoCompromiso(false);
                setNuevoCompromiso(null);
              }}
              nuevoCompromiso={nuevoCompromiso}
              alCambiarNuevoCompromiso={(parcial) => setNuevoCompromiso((n) => ({ ...n, ...parcial }))}
              alGuardarNuevoCompromiso={() => guardarNuevoCompromiso(p)}
              errorAccion={errorAccion}
              guardando={guardando}
            />
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

/** Una tarjeta-acordeón por proyecto, con sus compromisos de la ventana adentro. */
function TarjetaProyectoVentana({
  proyecto,
  bd,
  ventana,
  hoy,
  abierto,
  alAlternar,
  borrador,
  alCambiarBorrador,
  alGuardar,
  abiertoCompromiso,
  alAlternarCompromiso,
  borradorCompromiso,
  alCambiarBorradorCompromiso,
  alGuardarCompromiso,
  creandoCompromiso,
  alAbrirNuevoCompromiso,
  alCerrarNuevoCompromiso,
  nuevoCompromiso,
  alCambiarNuevoCompromiso,
  alGuardarNuevoCompromiso,
  errorAccion,
  guardando,
}) {
  const compromisosVentana = useMemo(
    () => (bd ? compromisosEnVentana(bd, proyecto.id_proyecto, ventana, hoy) : []),
    [bd, proyecto.id_proyecto, ventana, hoy],
  );

  // Abrir un proyecto, un compromiso o el formulario de "crear nuevo" agrega
  // bastante alto DEBAJO de donde se hizo clic — sin esto, el scroll se queda
  // clavado donde estaba y lo que se abrió termina fuera de vista, como si la
  // pantalla se hubiera corrido sola. Mueve sólo #contenido (nunca la
  // ventana): a diferencia de `element.scrollIntoView()`, que recorre TODOS
  // los ancestros con scroll —incluida la ventana, aunque esté con
  // `overflow: hidden`— esto no toca nada fuera de #contenido. No mueve
  // nada si ya está a la vista: sólo corrige cuando el contenido nuevo lo tapa.
  const cardRef = useRef(null);
  const compromisoRefs = useRef(new Map());
  const formNuevoRef = useRef(null);

  useEffect(() => {
    if (abierto) scrollDentroDelContenido(cardRef.current);
  }, [abierto]);

  useEffect(() => {
    if (abiertoCompromiso) scrollDentroDelContenido(compromisoRefs.current.get(abiertoCompromiso));
  }, [abiertoCompromiso]);

  useEffect(() => {
    if (creandoCompromiso) scrollDentroDelContenido(formNuevoRef.current);
  }, [creandoCompromiso]);

  return (
    <div ref={cardRef} className={`rounded-card border ${abierto ? 'border-acento' : 'border-borde'} bg-card`}>
      <button
        type="button"
        onClick={alAlternar}
        className="flex w-full flex-wrap items-center gap-2.5 p-3 text-left"
      >
      {errorAccion?.idProyecto === proyecto.id_proyecto && (
        <Aviso tono="error">{errorAccion.mensaje}</Aviso>
      )}
        <span className="text-sm font-semibold text-tinta">
          {proyecto.proyecto} <span className="text-xs font-normal text-acento">· {proyecto.id_proyecto}</span>
        </span>
        <EstadoProyecto estado={proyecto.estado} />
        <div className="w-24">
          <BarraAvance valor={proyecto.porcentaje_avance} compacta />
        </div>
        {compromisosVentana.length > 0 && (
          <Chip tono="neutro">
            {compromisosVentana.length} compromiso{compromisosVentana.length === 1 ? '' : 's'} en la ventana
          </Chip>
        )}
        <ChevronDown size={16} className={`ml-auto shrink-0 text-tenue transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="border-t border-dashed border-acento/30 p-3 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-tinta">
            <Pencil size={13} className="text-acento" /> Actualizar proyecto
          </p>
          <CampoRadios
            etiqueta="Nuevo estado"
            opciones={ESTADOS_PROYECTO}
            valor={borrador?.estado}
            // "Finalizado" completa solo el avance al objetivo: no tiene
            // sentido pedir que alguien calcule a mano el número exacto que
            // da 100% cuando ya está diciendo que el proyecto se terminó.
            // Se puede corregir el número igual si hace falta.
            alCambiar={(v) =>
              alCambiarBorrador({ estado: v, ...(v === 'finalizado' ? { avance: proyecto.objetivo } : {}) })
            }
          />
          <CampoNumero
            etiqueta="Avance"
            ayuda={`de ${numero(proyecto.objetivo)} ${proyecto.unidad ?? ''}`}
            className="mt-2.5 max-w-40"
            value={borrador?.avance ?? ''}
            onChange={(e) => alCambiarBorrador({ avance: e.target.value })}
          />
          <CampoArea
            etiqueta="Descripción / observaciones"
            className="mt-2.5"
            filas={2}
            value={borrador?.observaciones ?? ''}
            onChange={(e) => alCambiarBorrador({ observaciones: e.target.value })}
          />
          <div className="mt-2 flex justify-end">
              <Boton variante="primario" tamanio="sm" icono={Check} onClick={alGuardar} disabled={guardando}>
              Guardar cambios del proyecto
            </Boton>
          </div>

          <p className="mb-2 mt-4 border-t border-borde pt-3 text-xs font-semibold text-tinta">
            Compromisos en esta ventana ({compromisosVentana.length})
          </p>
          {compromisosVentana.length === 0 && (
            <p className="text-[11px] text-tenue">Ningún compromiso vigente de este proyecto vence en esta ventana.</p>
          )}
          <div className="flex flex-col gap-1.5">
            {compromisosVentana.map((c) => {
              const cAbierto = abiertoCompromiso === c.id;
              const nivel = c.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(c.dias_restantes);
              return (
                <div
                  key={c.id}
                  ref={(el) => {
                    if (el) compromisoRefs.current.set(c.id, el);
                    else compromisoRefs.current.delete(c.id);
                  }}
                  className={`rounded-chip border ${cAbierto ? 'border-acento' : 'border-borde'}`}
                >
                  <button
                    type="button"
                    onClick={() => alAlternarCompromiso(c)}
                    className="flex w-full items-center gap-2 p-2.5 text-left"
                  >
                    <Semaforo nivel={nivel} soloPunto texto={c.estado_efectivo} />
                    <span className="text-sm text-tinta">{c.descripcion}</span>
                    <span className="ml-auto text-[11px] text-tenue">{fFecha(c.fecha_limite)}</span>
                    <ChevronDown size={14} className={`shrink-0 text-tenue transition-transform ${cAbierto ? 'rotate-180' : ''}`} />
                  </button>
                  {cAbierto && (
                    <EditorCompromiso
                      compromiso={c}
                      borrador={borradorCompromiso}
                      alCambiarBorrador={alCambiarBorradorCompromiso}
                      alGuardar={() => alGuardarCompromiso(c)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {creandoCompromiso ? (
            <div ref={formNuevoRef} className="mt-2.5 rounded-chip border border-acento bg-acento-suave/40 p-2.5">
              <p className="mb-2 text-xs font-semibold text-acento-fuerte">Crear nuevo compromiso para este proyecto</p>
              <CampoArea
                etiqueta="Descripción"
                requerido
                filas={2}
                value={nuevoCompromiso?.descripcion ?? ''}
                onChange={(e) => alCambiarNuevoCompromiso({ descripcion: e.target.value })}
              />
              <CampoFecha
                etiqueta="Fecha límite"
                min={hoy}
                value={nuevoCompromiso?.fecha_limite ?? ''}
                onChange={(e) => alCambiarNuevoCompromiso({ fecha_limite: e.target.value })}
                className="mt-2.5"
              />
              <SelectorUnidad
                area={proyecto.area}
                idSubsecretaria={nuevoCompromiso?.id_subsecretaria ?? ''}
                idDireccion={nuevoCompromiso?.id_direccion ?? ''}
                alCambiar={alCambiarNuevoCompromiso}
              />
              <p className="mt-2 text-[11px] text-tenue">Se crea con estado <b>pendiente</b>.</p>
              <div className="mt-2 flex justify-end gap-2">
                <Boton tamanio="sm" onClick={alCerrarNuevoCompromiso}>
                  Cancelar
                </Boton>
                <Boton
                  variante="primario"
                  tamanio="sm"
                  icono={Check}
                  onClick={() => alGuardarNuevoCompromiso(proyecto)}
                  disabled={guardando || !nuevoCompromiso?.descripcion?.trim()}
                >
                  Crear compromiso
                </Boton>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={alAbrirNuevoCompromiso}
              className="mt-2.5 flex w-full items-center gap-2 rounded-chip border border-dashed border-acento/50 p-2.5 text-xs font-medium text-acento transition hover:bg-acento-suave/40"
            >
              <Plus size={14} /> Crear nuevo compromiso para este proyecto
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * El formulario de UN tema. Uno solo para los tres caminos —borrador
 * transferido, carga a mano y edición— porque la promesa del módulo es que
 * todos los temas tienen la misma estructura: dos formularios distintos se
 * despegarían en la primera corrección.
 *
 * Se exporta para la prueba de humo: vive detrás de estado local, así que
 * ninguna URL lo alcanza y sin esto no entraría en el render de control.
 */
export function FormularioTema({ tema, alCambiar, opcionesCategoria, hoy }) {
  const bd = useBD();

  // Compromisos vigentes del proyecto vinculado, para elegir uno del que
  // este tema sea una novedad — en vez de duplicar con "Crear nuevo
  // compromiso" algo que ya existe.
  const compromisosDelProyecto = useMemo(
    () =>
      bd && tema.id_proyecto
        ? selCompromisos(bd, { id_proyecto: tema.id_proyecto, solo_vigentes: true }, hoy)
        : [],
    [bd, tema.id_proyecto, hoy],
  );

  /** Cambiar (o sacar) el proyecto vuelve a dejar en blanco a qué compromiso
   * de ESE proyecto estaba vinculado el tema — no tiene sentido conservarlo. */
  function cambiarProyecto(id_proyecto) {
    alCambiar({
      id_proyecto,
      id_compromiso: '',
      compromiso_existente: false,
      actualizar_compromiso: false,
      compromiso_nuevo_estado: '',
      compromiso_nueva_descripcion: '',
    });
  }

  function elegirCompromiso(id_compromiso) {
    const yaElegido = tema.id_compromiso === id_compromiso;
    alCambiar({
      id_compromiso: yaElegido ? '' : id_compromiso,
      compromiso_existente: !yaElegido,
      // Uno de los dos: si se vincula a uno que ya existe, "Crear nuevo
      // compromiso" deja de tener sentido para este tema.
      requiere_accion: yaElegido ? tema.requiere_accion : false,
      // Cambiar de compromiso vuelve a dejar en blanco cualquier corrección
      // de estado/descripción que se hubiera empezado a cargar para el
      // anterior — no tiene sentido aplicársela a otro.
      actualizar_compromiso: false,
      compromiso_nuevo_estado: '',
      compromiso_nueva_descripcion: '',
    });
  }

  /** Tilda "Actualizar compromiso" y precarga sus campos con lo que ya tiene el compromiso elegido. */
  function alternarActualizarCompromiso(checked) {
    if (!checked) {
      alCambiar({ actualizar_compromiso: false });
      return;
    }
    const actual = compromisosDelProyecto.find((c) => c.id === tema.id_compromiso);
    alCambiar({
      actualizar_compromiso: true,
      compromiso_nuevo_estado: actual?.estado ?? 'pendiente',
      compromiso_nueva_descripcion: actual?.descripcion ?? '',
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <GrillaCampos columnas={2}>
        <CampoSelect
          etiqueta="Categoría"
          requerido
          opciones={opcionesCategoria}
          value={tema.categoria}
          onChange={(e) => alCambiar({ categoria: e.target.value })}
        />
        <CampoRadios
          etiqueta="Criticidad"
          requerido
          opciones={CRITICIDADES}
          valor={tema.criticidad}
          alCambiar={(v) => alCambiar({ criticidad: v })}
        />
      </GrillaCampos>

      <SelectorProyecto
        etiqueta="Proyecto vinculado"
        ayuda="opcional"
        valor={tema.id_proyecto}
        alCambiar={cambiarProyecto}
        maxAltura={160}
      />

      {tema.id_proyecto && (
        <div className="rounded-chip border border-borde p-3">
          <p className="mb-0.5 text-xs font-semibold text-tinta">Compromisos de este proyecto</p>
          <p className="mb-2.5 text-[11px] text-tenue">
            Elegí uno si este tema es una novedad sobre un compromiso que ya existe — así no se
            duplica. Si ninguno aplica, dejalo sin marcar.
          </p>
          {compromisosDelProyecto.length === 0 ? (
            <p className="text-[11px] text-tenue">Este proyecto todavía no tiene compromisos cargados.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {compromisosDelProyecto.map((c) => {
                const elegido = tema.id_compromiso === c.id;
                const nivel = c.estado_efectivo === 'cumplido' ? 'enregla' : nivelPorDias(c.dias_restantes);
                return (
                  <div
                    key={c.id}
                    className={`rounded-chip border p-2.5 transition ${
                      elegido ? 'border-acento bg-acento-suave/60' : 'border-borde'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => elegirCompromiso(c.id)}
                      className={`flex w-full items-start gap-2.5 text-left ${elegido ? '' : 'hover:opacity-80'}`}
                    >
                      <span
                        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                          elegido ? 'border-acento' : 'border-borde-fuerte'
                        }`}
                      >
                        {elegido && <span className="h-2 w-2 rounded-full bg-acento" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-tinta">{c.descripcion}</span>
                        <span className="block text-[11px] text-tenue">vence {fFecha(c.fecha_limite)}</span>
                        <span className="mt-1 inline-block">
                          <Semaforo
                            nivel={nivel}
                            texto={
                              c.estado_efectivo === 'vencido' ? `vencido · ${c.dias_atraso} d` : c.estado_efectivo
                            }
                          />
                        </span>
                      </span>
                    </button>

                    {elegido && (
                      <div className="mt-2.5 border-t border-borde-fuerte/30 pt-2.5">
                        <CampoCheck
                          etiqueta="Actualizar compromiso"
                          descripcion="Corregir estado y descripción de este compromiso sin salir del tema."
                          checked={tema.actualizar_compromiso}
                          onChange={(e) => alternarActualizarCompromiso(e.target.checked)}
                        />
                        {tema.actualizar_compromiso && (
                          <div className="mt-2.5 flex flex-col gap-2.5">
                            <CampoRadios
                              etiqueta="Nuevo estado"
                              opciones={ESTADOS_COMPROMISO}
                              valor={tema.compromiso_nuevo_estado}
                              alCambiar={(v) => alCambiar({ compromiso_nuevo_estado: v })}
                            />
                            <CampoArea
                              etiqueta="Descripción"
                              filas={2}
                              value={tema.compromiso_nueva_descripcion}
                              onChange={(e) => alCambiar({ compromiso_nueva_descripcion: e.target.value })}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <CampoArea
        etiqueta="Descripción"
        requerido
        filas={3}
        value={tema.descripcion}
        onChange={(e) => alCambiar({ descripcion: e.target.value })}
        placeholder="Ej.: Demora en la entrega de materiales por parte del proveedor."
      />

      <div className="rounded-chip border border-borde p-3">
        <CampoCheck
          etiqueta="Crear nuevo compromiso"
          checked={tema.requiere_accion}
          disabled={tema.compromiso_existente}
          onChange={(e) => alCambiar({ requiere_accion: e.target.checked })}
        />
        {tema.requiere_accion && (
          <>
            <CampoFecha
              etiqueta="Fecha límite"
              min={hoy}
              value={tema.fecha_limite}
              onChange={(e) => alCambiar({ fecha_limite: e.target.value })}
              className="mt-3"
            />
            <CampoArea
              etiqueta="Descripción del compromiso"
              ayuda="opcional — si no se completa, se usa la del tema"
              className="mt-3"
              filas={2}
              value={tema.descripcion_compromiso}
              onChange={(e) => alCambiar({ descripcion_compromiso: e.target.value })}
            />
          </>
        )}
      </div>
    </div>
  );
}
