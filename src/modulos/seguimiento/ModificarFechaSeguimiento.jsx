import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Trash2 } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton } from '../../componentes/Basicos.jsx';
import { CampoFecha, CampoHora, GrillaCampos } from '../../componentes/Campo.jsx';
import { acciones } from '../../estado/tienda.js';
import { fecha as fFecha } from '../../utilidades/formato.js';

/**
 * La reprogramación conserva el registro y sus vínculos: sólo manda fecha y
 * hora al repositorio. Calendar no comparte identificador con este registro,
 * por lo que la interfaz aclara el alcance antes de guardar.
 * Las reuniones agendadas admiten baja lógica para corregir duplicados;
 * los seguimientos realizados conservan su registro y sus compromisos.
 */
export function ModificarFechaSeguimiento({ seguimiento, alCerrar, alEliminar }) {
  const [fecha, setFecha] = useState(seguimiento.fecha);
  const [hora, setHora] = useState(seguimiento.hora ?? '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmandoEliminacion, setConfirmandoEliminacion] = useState(false);
  const contenido = useRef(null);
  const cerrar = () => { if (!guardando) alCerrar(); };

  useEffect(() => {
    const destino = contenido.current?.querySelector('input') ?? contenido.current;
    destino?.focus();
  }, [confirmandoEliminacion]);

  function confirmarEliminacion(valor) {
    setError('');
    setConfirmandoEliminacion(valor);
  }

  async function eliminar() {
    if (guardando) return;
    setError('');
    setGuardando(true);
    try {
      await acciones.eliminarSeguimiento(seguimiento.id);
      alEliminar?.();
      alCerrar();
    } catch (err) {
      setError(err?.message || 'No se pudo eliminar el seguimiento. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  async function guardar(e) {
    e.preventDefault();
    if (guardando) return;
    setError('');
    setGuardando(true);
    try {
      await acciones.actualizarSeguimiento(seguimiento.id, { fecha, hora });
      alCerrar();
    } catch (err) {
      setError(err?.message || 'No se pudo modificar la fecha. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      alCerrar={cerrar}
      ancho="sm"
      titulo={confirmandoEliminacion ? 'Eliminar seguimiento' : 'Modificar fecha de reunión'}
      descripcion={seguimiento.area}
      pie={
        confirmandoEliminacion ? <>
          <Boton onClick={() => confirmarEliminacion(false)} disabled={guardando} className="min-h-11">Volver</Boton>
          <Boton variante="peligro" icono={Trash2} onClick={eliminar} disabled={guardando} className="min-h-11">
            {guardando ? 'Eliminando…' : 'Sí, eliminar'}
          </Boton>
        </> : <>
          <Boton onClick={cerrar} disabled={guardando} className="min-h-11">Cancelar</Boton>
          <Boton variante="primario" icono={CalendarDays} type="submit" form="modificar-fecha-seguimiento" disabled={guardando} className="min-h-11">
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </Boton>
        </>
      }
    >
      {confirmandoEliminacion ? (
        <div ref={contenido} tabIndex={-1} className="flex flex-col gap-3" aria-busy={guardando}>
          <p className="text-sm leading-relaxed text-tinta">¿Querés eliminar el seguimiento de {seguimiento.area} del {fFecha(seguimiento.fecha)}{seguimiento.hora ? ` a las ${seguimiento.hora}` : ''}?</p>
          <p className="text-xs leading-relaxed text-gris">Esta reunión dejará de aparecer en el calendario y en las listas del portal. Las demás reuniones se conservan. Si existe un evento en Google Calendar, tenés que cancelarlo por separado.</p>
          {error && <div role="alert"><Aviso tono="error">{error}</Aviso></div>}
        </div>
      ) : <form ref={contenido} id="modificar-fecha-seguimiento" onSubmit={guardar} className="flex flex-col gap-3" aria-busy={guardando}>
        <GrillaCampos columnas={2}>
          <CampoFecha etiqueta="Fecha" requerido required value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={guardando} />
          <CampoHora etiqueta="Hora" ayuda="opcional" value={hora} onChange={(e) => setHora(e.target.value)} disabled={guardando} />
        </GrillaCampos>
        <p className="text-xs leading-relaxed text-gris">Se actualiza la reunión en el portal. Si ya la convocaste por Google Calendar, modificá también ese evento para avisar a los invitados.</p>
        {error && <div role="alert"><Aviso tono="error">{error}</Aviso></div>}
        {seguimiento.tipo === 'programado' && (
          <div className="border-t border-borde pt-3">
            <Boton icono={Trash2} onClick={() => confirmarEliminacion(true)} disabled={guardando} className="min-h-11 text-vencido-texto">
              Eliminar seguimiento
            </Boton>
          </div>
        )}
      </form>}
    </Modal>
  );
}
