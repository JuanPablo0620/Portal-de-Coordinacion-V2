import { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoFecha, CampoTexto } from '../../componentes/Campo.jsx';
import { acciones } from '../../estado/tienda.js';

/**
 * Corrige una reunión ya cargada. Nace, sobre todo, para sumar el link a la
 * carpeta de Drive: casi nunca existe todavía el mismo día de la reunión, así
 * que obligar a cargarlo al registrarla dejaría a la mayoría sin ninguno.
 *
 * No toca los compromisos de la reunión — esos se corrigen desde su propio
 * editor (`EditorCompromiso`), no desde acá.
 */
export function EditarReunion({ abierto, alCerrar, reunion }) {
  const [datos, setDatos] = useState({
    fecha: reunion.fecha,
    temas: reunion.temas ?? '',
    url_drive: reunion.url_drive ?? '',
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  async function guardar() {
    if (!datos.fecha) {
      setError('La fecha es obligatoria.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await acciones.actualizarReunionMesa(reunion.id, datos);
      alCerrar();
    } catch (err) {
      setError(err?.message || 'No se pudo guardar. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="md"
      titulo="Editar reunión"
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" icono={Check} onClick={guardar} disabled={guardando}>
            Guardar cambios
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <CampoFecha etiqueta="Fecha" requerido value={datos.fecha} onChange={cambiar('fecha')} />
        <CampoArea etiqueta="Temas tratados" filas={4} value={datos.temas} onChange={cambiar('temas')} />
        <CampoTexto
          etiqueta="Carpeta de Drive"
          ayuda="opcional"
          type="url"
          placeholder="https://drive.google.com/..."
          value={datos.url_drive}
          onChange={cambiar('url_drive')}
        />
        {error && <Aviso tono="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}
