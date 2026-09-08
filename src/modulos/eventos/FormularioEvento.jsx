import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, BarraAvance, Boton, Chip } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoFecha, CampoHora, CampoNumero, CampoSelect, CampoTexto, GrillaCampos } from '../../componentes/Campo.jsx';
import { SelectorProyecto } from '../../componentes/SelectorProyecto.jsx';
import { ESTADOS_EVENTO, ESTADOS_REQUERIMIENTO } from '../../datos/catalogos.js';
import { cortesDeEvento, ubicacionDe, vigenciaDe } from '../../datos/cortes.js';
import { hoyISO, requerimientosDe, resumenRequerimientos } from '../../datos/selectores.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { acciones, useBD } from '../../estado/tienda.js';

/** Nombre del ítem de catálogo que marca «este evento necesita corte». */
const ITEM_CORTE = 'Corte de calle';

const VACIO = {
  nombre: '',
  detalle: '',
  fecha: '',
  hora: '',
  lugar: '',
  area_organizadora: '',
  tipo: '',
  id_proyecto: '',
  estado: 'previsto',
};

export function FormularioEvento({ abierto, alCerrar, evento }) {
  const bd = useBD();
  const hoy = hoyISO();
  const esEdicion = Boolean(evento);
  const [datos, setDatos] = useState(() => (evento ? { ...VACIO, ...evento } : { ...VACIO, fecha: hoy }));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [idEvento, setIdEvento] = useState(evento?.id ?? null);

  const opcionesArea = useOpciones('areas');
  const opcionesTipo = useOpciones('tipos_evento');

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  /**
   * El try/catch no es defensivo por las dudas: desde que los eventos se
   * guardan en Supabase y no en el navegador, esto FALLA de verdad —se cae la
   * red, el área elegida no está en el catálogo de la base, RLS rechaza la
   * escritura—. Sin catch, la promesa se rompe en silencio y el botón «Crear
   * evento» no hace nada ni explica por qué, que es lo peor que puede pasarle
   * a alguien cargando datos.
   */
  async function guardar() {
    if (!datos.nombre.trim()) return setError('El nombre es obligatorio.');
    if (!datos.fecha) return setError('La fecha es obligatoria.');
    if (guardando) return;

    setError('');
    setGuardando(true);
    const payload = { ...datos, id_proyecto: datos.id_proyecto || null };
    try {
      if (esEdicion) {
        await acciones.actualizarEvento(evento.id, payload);
        alCerrar();
      } else {
        // Se crea primero el evento para poder cargarle requerimientos sin cerrar.
        const creado = await acciones.crearEvento(payload);
        setIdEvento(creado.id);
      }
    } catch (e) {
      setError(e?.message ?? 'No se pudo guardar el evento.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="lg"
      titulo={esEdicion ? 'Editar evento' : 'Nuevo evento'}
      descripcion="Los requerimientos se cargan desde un catálogo cerrado y alimentan el checklist."
      pie={
        <>
          <Boton onClick={alCerrar}>{idEvento && !esEdicion ? 'Cerrar' : 'Cancelar'}</Boton>
          {(!idEvento || esEdicion) && (
            <Boton variante="primario" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear evento'}
            </Boton>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <CampoTexto
          etiqueta="Nombre del evento"
          requerido
          value={datos.nombre}
          onChange={cambiar('nombre')}
          placeholder="Ej.: Inauguración de plaza renovada"
          disabled={Boolean(idEvento) && !esEdicion}
        />

        {/* Texto libre y opcional: lo que no entra en los campos cerrados de
            abajo — de qué se trata, quién expone, qué hay que tener en cuenta.
            Va acá arriba, pegado al nombre, porque describe el evento; los
            campos que siguen son su ficha (cuándo, dónde, quién organiza). */}
        <CampoArea
          etiqueta="Detalle"
          ayuda="opcional"
          filas={3}
          value={datos.detalle}
          onChange={cambiar('detalle')}
          placeholder="De qué se trata, quiénes participan, qué hay que tener en cuenta…"
          disabled={Boolean(idEvento) && !esEdicion}
        />

        <GrillaCampos columnas={3}>
          <CampoFecha etiqueta="Fecha" requerido value={datos.fecha} onChange={cambiar('fecha')} disabled={Boolean(idEvento) && !esEdicion} />
          <CampoHora etiqueta="Hora" value={datos.hora} onChange={cambiar('hora')} disabled={Boolean(idEvento) && !esEdicion} />
          <CampoSelect etiqueta="Estado" opciones={ESTADOS_EVENTO} value={datos.estado} onChange={cambiar('estado')} placeholder="" disabled={Boolean(idEvento) && !esEdicion} />
        </GrillaCampos>

        <GrillaCampos columnas={3}>
          <CampoTexto etiqueta="Lugar" value={datos.lugar} onChange={cambiar('lugar')} disabled={Boolean(idEvento) && !esEdicion} />
          <CampoSelect etiqueta="Área organizadora" opciones={opcionesArea} value={datos.area_organizadora} onChange={cambiar('area_organizadora')} disabled={Boolean(idEvento) && !esEdicion} />
          <CampoSelect etiqueta="Tipo" opciones={opcionesTipo} value={datos.tipo} onChange={cambiar('tipo')} disabled={Boolean(idEvento) && !esEdicion} />
        </GrillaCampos>

        {(!idEvento || esEdicion) && (
          <SelectorProyecto
            etiqueta="Proyecto vinculado"
            ayuda="opcional"
            valor={datos.id_proyecto}
            alCambiar={(v) => setDatos((d) => ({ ...d, id_proyecto: v }))}
            maxAltura={160}
          />
        )}

        {error && <Aviso tono="error">{error}</Aviso>}

        {idEvento ? (
          <>
            <SeccionRequerimientos idEvento={idEvento} bd={bd} />
            <SeccionCortes idEvento={idEvento} bd={bd} alCerrar={alCerrar} />
          </>
        ) : (
          <Aviso tono="info">
            Después de crear el evento vas a poder cargarle los requerimientos sin cerrar esta ventana.
          </Aviso>
        )}
      </div>
    </Modal>
  );
}

/**
 * Cortes de calle del evento.
 *
 * El corte no se dibuja acá: se carga en el módulo de Mapa, contra el callejero
 * oficial. Esta sección hace de puente en las dos direcciones — muestra los que
 * ya están y avisa cuando el evento PIDIÓ corte como requerimiento pero nadie lo
 * marcó todavía en el mapa, que es la forma en que un corte se pierde.
 */
function SeccionCortes({ idEvento, bd, alCerrar }) {
  const cortes = useMemo(() => (bd ? cortesDeEvento(bd, idEvento) : []), [bd, idEvento]);
  const loPidio = useMemo(
    () => (bd ? requerimientosDe(bd, idEvento).some((r) => r.item === ITEM_CORTE) : false),
    [bd, idEvento],
  );

  if (!loPidio && !cortes.length) return null;

  return (
    <fieldset className="rounded-chip border border-borde">
      <legend className="mx-3 flex items-center gap-2 px-1 text-xs font-semibold text-gris">
        Cortes de calle
        <Chip tono={cortes.length ? 'enregla' : 'proximo'}>{cortes.length} cargado(s)</Chip>
      </legend>
      <div className="flex flex-col gap-2 p-3">
        {cortes.length > 0 && (
          <ul className="flex flex-col gap-1">
            {cortes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="text-tinta">{ubicacionDe(c)}</span>
                <span className="text-xs text-tenue">{vigenciaDe(c)}</span>
              </li>
            ))}
          </ul>
        )}
        {loPidio && !cortes.length && (
          <Aviso tono="alerta">
            Este evento pide corte de calle como requerimiento y todavía no hay ninguno marcado en el mapa.
          </Aviso>
        )}
        <Link
          to="/mapa"
          onClick={alCerrar}
          className="self-start text-sm font-medium text-acento underline underline-offset-2"
        >
          {cortes.length ? 'Ver en el mapa de cortes' : 'Marcar el corte en el mapa'}
        </Link>
      </div>
    </fieldset>
  );
}

/** Requerimientos desde catálogo cerrado y administrable. */
export function SeccionRequerimientos({ idEvento, bd }) {
  const opcionesItem = useOpciones('items_requerimiento');
  const opcionesArea = useOpciones('areas');
  const [nuevo, setNuevo] = useState({ item: '', cantidad: '1', area_responsable: '' });

  const requerimientos = useMemo(() => (bd ? requerimientosDe(bd, idEvento) : []), [bd, idEvento]);
  const resumen = useMemo(() => (bd ? resumenRequerimientos(bd, idEvento) : null), [bd, idEvento]);

  // Mismo motivo que en `guardar()`: los requerimientos también viajan a
  // Supabase y también pueden fallar. Sin esto, el botón «Agregar» queda mudo.
  const [error, setError] = useState('');

  async function agregar() {
    if (!nuevo.item) return;
    setError('');
    try {
      await acciones.crearRequerimiento({
        id_evento: idEvento,
        item: nuevo.item,
        cantidad: Number(nuevo.cantidad) || 1,
        area_responsable: nuevo.area_responsable,
        estado: 'solicitado',
      });
      setNuevo({ item: '', cantidad: '1', area_responsable: '' });
    } catch (e) {
      setError(e?.message ?? 'No se pudo agregar el requerimiento.');
    }
  }

  async function cambiarRequerimiento(id, cambios) {
    setError('');
    try {
      await acciones.actualizarRequerimiento(id, cambios);
    } catch (e) {
      setError(e?.message ?? 'No se pudo actualizar el requerimiento.');
    }
  }

  return (
    <fieldset className="rounded-chip border border-borde">
      <legend className="mx-3 flex items-center gap-2 px-1 text-xs font-semibold text-gris">
        Requerimientos
        <Chip tono={resumen?.pendientes ? 'proximo' : 'enregla'}>
          {resumen?.confirmados ?? 0}/{resumen?.total ?? 0} confirmados
        </Chip>
      </legend>
      <div className="flex flex-col gap-3 p-3">
        {error && <Aviso tono="error">{error}</Aviso>}
        {resumen?.total > 0 && <BarraAvance valor={resumen.porcentaje} />}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_90px_1fr_auto]">
          <CampoSelect
            etiqueta="Ítem"
            opciones={opcionesItem}
            value={nuevo.item}
            onChange={(e) => setNuevo((n) => ({ ...n, item: e.target.value }))}
          />
          <CampoNumero etiqueta="Cantidad" min={1} value={nuevo.cantidad} onChange={(e) => setNuevo((n) => ({ ...n, cantidad: e.target.value }))} />
          <CampoSelect
            etiqueta="Área responsable"
            opciones={opcionesArea}
            value={nuevo.area_responsable}
            onChange={(e) => setNuevo((n) => ({ ...n, area_responsable: e.target.value }))}
          />
          <div className="flex items-end">
            <Boton icono={Plus} onClick={agregar} disabled={!nuevo.item}>
              Agregar
            </Boton>
          </div>
        </div>

        {requerimientos.length === 0 ? (
          <p className="py-2 text-center text-xs text-tenue">
            Sin requerimientos cargados. Se eligen desde el catálogo administrable de Configuración.
          </p>
        ) : (
          <ul className="flex flex-col rounded-chip border border-borde">
            {requerimientos.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-borde/60 px-3 py-2 last:border-0">
                <span className="min-w-24 flex-1 text-sm text-tinta">{r.item}</span>
                <span className="tabular w-12 shrink-0 text-right text-xs text-gris">×{r.cantidad}</span>
                <span className="w-40 shrink-0 truncate text-[11px] text-tenue">{r.area_responsable || 'sin área'}</span>
                <select
                  className="campo-base w-32 shrink-0 py-1 text-xs"
                  // Son varios selectores idénticos en la misma lista: sin el
                  // nombre del ítem, ninguno dice de qué requerimiento es.
                  aria-label={`Estado de ${r.item}`}
                  value={r.estado}
                  onChange={(e) => cambiarRequerimiento(r.id, { estado: e.target.value })}
                >
                  {ESTADOS_REQUERIMIENTO.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => cambiarRequerimiento(r.id, { activo: false })}
                  className="shrink-0 rounded p-1 text-tenue transition hover:bg-vencido-suave hover:text-vencido-texto"
                  aria-label="Quitar requerimiento"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </fieldset>
  );
}
