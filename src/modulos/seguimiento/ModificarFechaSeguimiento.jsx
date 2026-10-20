import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton } from '../../componentes/Basicos.jsx';
import { CampoFecha, CampoHora, GrillaCampos } from '../../componentes/Campo.jsx';
import { acciones } from '../../estado/tienda.js';

/**
 * La reprogramación conserva el registro y sus vínculos: sólo manda fecha y
 * hora al repositorio. Calendar no comparte identificador con este registro,
 * por lo que la interfaz aclara el alcance antes de guardar.
 */
export function ModificarFechaSeguimiento({ seguimiento, alCerrar }) {
  const [fecha, setFecha] = useState(seguimiento.fecha);
  const [hora, setHora] = useState(seguimiento.hora ?? '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cerrar = () => { if (!guardando) alCerrar(); };

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
      titulo="Modificar fecha de reunión"
      descripcion={seguimiento.area}
      pie={
        <>
          <Boton onClick={cerrar} disabled={guardando} className="min-h-11">Cancelar</Boton>
          <Boton variante="primario" icono={CalendarDays} type="submit" form="modificar-fecha-seguimiento" disabled={guardando} className="min-h-11">
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </Boton>
        </>
      }
    >
      <form id="modificar-fecha-seguimiento" onSubmit={guardar} className="flex flex-col gap-3" aria-busy={guardando}>
        <GrillaCampos columnas={2}>
          <CampoFecha etiqueta="Fecha" requerido required value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={guardando} />
          <CampoHora etiqueta="Hora" ayuda="opcional" value={hora} onChange={(e) => setHora(e.target.value)} disabled={guardando} />
        </GrillaCampos>
        <p className="text-xs leading-relaxed text-gris">Se actualiza la reunión en el portal. Si ya la convocaste por Google Calendar, modificá también ese evento para avisar a los invitados.</p>
        {error && <div role="alert"><Aviso tono="error">{error}</Aviso></div>}
      </form>
    </Modal>
  );
}
