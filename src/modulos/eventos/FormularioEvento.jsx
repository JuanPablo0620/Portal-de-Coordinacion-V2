import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, BarraAvance, Boton, Chip } from '../../componentes/Basicos.jsx';
import { CampoFecha, CampoHora, CampoNumero, CampoSelect, CampoTexto, GrillaCampos } from '../../componentes/Campo.jsx';
import { SelectorProyecto } from '../../componentes/SelectorProyecto.jsx';
import { ESTADOS_EVENTO, ESTADOS_REQUERIMIENTO } from '../../datos/catalogos.js';
import { hoyISO, requerimientosDe, resumenRequerimientos } from '../../datos/selectores.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { acciones, useBD } from '../../estado/tienda.js';

const VACIO = {
  nombre: '',
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
  const [idEvento, setIdEvento] = useState(evento?.id ?? null);

  const opcionesArea = useOpciones('areas');
  const opcionesTipo = useOpciones('tipos_evento');

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  async function guardar() {
    if (!datos.nombre.trim()) return setError('El nombre es obligatorio.');
    if (!datos.fecha) return setError('La fecha es obligatoria.');
    setError('');
    const payload = { ...datos, id_proyecto: datos.id_proyecto || null };
    if (esEdicion) {
      await acciones.actualizarEvento(evento.id, payload);
      alCerrar();
    } else {
      // Se crea primero el evento para poder cargarle requerimientos sin cerrar.
      const creado = await acciones.crearEvento(payload);
      setIdEvento(creado.id);
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
            <Boton variante="primario" onClick={guardar}>
              {esEdicion ? 'Guardar cambios' : 'Crear evento'}
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
          <SeccionRequerimientos idEvento={idEvento} bd={bd} />
        ) : (
          <Aviso tono="info">
            Después de crear el evento vas a poder cargarle los requerimientos sin cerrar esta ventana.
          </Aviso>
        )}
      </div>
    </Modal>
  );
}

/** Requerimientos desde catálogo cerrado y administrable. */
export function SeccionRequerimientos({ idEvento, bd }) {
  const opcionesItem = useOpciones('items_requerimiento');
  const opcionesArea = useOpciones('areas');
  const [nuevo, setNuevo] = useState({ item: '', cantidad: '1', area_responsable: '' });

  const requerimientos = useMemo(() => (bd ? requerimientosDe(bd, idEvento) : []), [bd, idEvento]);
  const resumen = useMemo(() => (bd ? resumenRequerimientos(bd, idEvento) : null), [bd, idEvento]);

  async function agregar() {
    if (!nuevo.item) return;
    await acciones.crearRequerimiento({
      id_evento: idEvento,
      item: nuevo.item,
      cantidad: Number(nuevo.cantidad) || 1,
      area_responsable: nuevo.area_responsable,
      estado: 'solicitado',
    });
    setNuevo({ item: '', cantidad: '1', area_responsable: '' });
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
                  value={r.estado}
                  onChange={(e) => acciones.actualizarRequerimiento(r.id, { estado: e.target.value })}
                >
                  {ESTADOS_REQUERIMIENTO.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => acciones.actualizarRequerimiento(r.id, { activo: false })}
                  className="shrink-0 rounded p-1 text-tenue transition hover:bg-vencido-suave hover:text-vencido"
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
