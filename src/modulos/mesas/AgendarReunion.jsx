import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton } from '../../componentes/Basicos.jsx';
import { CampoFecha, CampoTexto } from '../../componentes/Campo.jsx';
import { hoyISO } from '../../datos/selectores.js';
import { acciones } from '../../estado/tienda.js';

/**
 * Agendar, sin cargar todavía qué se trató ni qué compromisos salieron —eso
 * es "Registrar reunión", para cuando la reunión ya pasó.
 *
 * Sirve, sobre todo, para que los compromisos que se cargan HOY en la mesa
 * tengan a qué próxima fecha apuntar como fecha límite: sin una reunión
 * agendada, `RegistrarReunion` no tiene de dónde proponerla y el campo queda
 * en blanco, como antes de este formulario.
 */
export function AgendarReunion({ abierto, alCerrar, mesa }) {
  const hoy = hoyISO();
  const [fecha, setFecha] = useState('');
  const [urlDrive, setUrlDrive] = useState('');
  const [error, setError] = useState('');

  async function guardar() {
    if (!fecha) {
      setError('Indicá la fecha de la próxima reunión.');
      return;
    }
    if (fecha < hoy) {
      setError('Para una fecha ya pasada, usá "Registrar reunión" en vez de agendar.');
      return;
    }
    setError('');
    try {
      await acciones.crearReunionMesa({ id_mesa: mesa.id, fecha, asistentes: '', temas: '', url_drive: urlDrive });
      alCerrar();
    } catch (err) {
      setError(err?.message || 'No se pudo agendar la reunión. Probá de nuevo.');
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="sm"
      titulo="Agendar reunión"
      descripcion={mesa.nombre}
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" icono={CalendarPlus} onClick={guardar}>
            Agendar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <CampoFecha etiqueta="Fecha" requerido min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <CampoTexto
          etiqueta="Carpeta de Drive"
          ayuda="opcional — si ya existe"
          type="url"
          placeholder="https://drive.google.com/..."
          value={urlDrive}
          onChange={(e) => setUrlDrive(e.target.value)}
        />
        {error && <Aviso tono="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}
