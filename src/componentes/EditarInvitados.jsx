import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Aviso, Boton } from './Basicos.jsx';
import { CampoArea, CampoSelect } from './Campo.jsx';
import { agregarMails } from '../datos/invitaciones.js';
import { acciones } from '../estado/tienda.js';

/** Edita solo los invitados: conserva el texto y los demás datos de la plantilla. */
export function EditarInvitados({ opciones, alCerrar }) {
  const [clave, setClave] = useState(opciones[0]?.valor ?? '');
  const [texto, setTexto] = useState(() => clave ? acciones.plantillaInvitacion(clave).invitados.join('\n') : '');
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);
  function guardar() {
    const { lista, invalidos } = agregarMails([], texto);
    if (invalidos.length) { setError(`Revisá estos correos: ${invalidos.join(', ')}`); return; }
    try {
      acciones.guardarPlantillaInvitacion(clave, { ...acciones.plantillaInvitacion(clave), invitados: lista });
      setTexto(lista.join('\n')); setError(''); setGuardado(true);
    } catch (e) { setError(e.message); }
  }
  return <Modal abierto alCerrar={alCerrar} titulo="Invitados predeterminados"
    pie={<><Boton onClick={alCerrar}>Cerrar</Boton><Boton variante="primario" disabled={!clave} onClick={guardar}>Guardar invitados</Boton></>}>
    <div className="flex flex-col gap-4">
      <CampoSelect etiqueta="Reunión" opciones={opciones} value={clave} onChange={(e) => {
        setClave(e.target.value); setTexto(acciones.plantillaInvitacion(e.target.value).invitados.join('\n')); setGuardado(false); setError('');
      }} />
      <CampoArea etiqueta="Correos de los invitados" filas={8} value={texto} error={error}
        ayuda="Uno por línea, o separados por coma o punto y coma. También podés pegar Nombre <correo>."
        onChange={(e) => { setTexto(e.target.value); setGuardado(false); setError(''); }} />
      <p className="text-sm text-gris">La lista se guarda en este navegador. No cambia reuniones existentes de Calendar ni envía invitaciones.</p>
      {guardado && <div role="status"><Aviso titulo="Invitados guardados">La lista queda disponible para las próximas reuniones.</Aviso></div>}
    </div>
  </Modal>;
}
