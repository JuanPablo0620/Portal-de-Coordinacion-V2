import { useId, useState } from 'react';
import { CalendarPlus, Mail, Save, UserPlus, X } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoFecha, CampoHora, CampoSelect, CampoTexto } from '../../componentes/Campo.jsx';
import {
  DURACIONES,
  LARGO_MAXIMO_URL,
  agregarMails,
  armarInvitacion,
  cuentaGoogleDe,
  urlGmail,
  urlGoogleCalendar,
  validarInvitacion,
} from '../../datos/invitaciones.js';
import { hoyISO } from '../../datos/selectores.js';
import { acciones } from '../../estado/tienda.js';
import { useSesion } from '../../estado/sesion.js';

/**
 * Convocar a una reunión de mesa por Google Calendar o por Gmail, con la
 * cuenta de Google de quien la manda.
 *
 * Cada mesa tiene UNA plantilla —asunto, mensaje, invitados, link de la
 * presentación, hora y duración— que se ajusta acá antes de cada convocatoria.
 * El modal no envía: abre Google con todo precargado y el envío se confirma
 * allá (el porqué, en `invitaciones.js`).
 *
 * Al abrir Calendar o Gmail, lo que quedó en el formulario pasa a ser la
 * plantilla de la mesa: si se sumó un invitado o cambió el link, la próxima
 * convocatoria ya lo trae. La fecha es lo único que no se guarda, porque es
 * de esta reunión y no de la mesa.
 */
export function InvitarReunion({ abierto, alCerrar, clave, nombre, fechaInicial = '' }) {
  const hoy = hoyISO();
  const email = useSesion((s) => s.perfil?.email);
  const [plantilla, setPlantilla] = useState(() => acciones.plantillaInvitacion(clave));
  const [fecha, setFecha] = useState(fechaInicial ?? '');
  const [errores, setErrores] = useState({});
  const [hecho, setHecho] = useState('');

  const cambiar = (campo) => (e) => setPlantilla((p) => ({ ...p, [campo]: e.target.value }));

  function guardar() {
    acciones.guardarPlantillaInvitacion(clave, plantilla);
    setHecho('guardada');
  }

  function abrir(destino) {
    const faltan = validarInvitacion(plantilla, fecha, hoy);
    setErrores(faltan);
    setHecho('');
    if (Object.keys(faltan).length) return;

    const { titulo, cuerpo } = armarInvitacion(plantilla, { nombre, fecha });
    const datos = {
      titulo,
      cuerpo,
      fecha,
      hora: plantilla.hora,
      duracionMin: plantilla.duracion_min,
      lugar: plantilla.lugar.trim(),
      invitados: plantilla.invitados,
      cuenta: cuentaGoogleDe(email),
    };
    const url = destino === 'calendar' ? urlGoogleCalendar(datos) : urlGmail(datos);
    if (url.length > LARGO_MAXIMO_URL) {
      setErrores({
        general:
          'El mensaje es demasiado largo para abrirlo desde un link y Google lo rechazaría. ' +
          'Acortá el texto o sacá algunos invitados y probá de nuevo.',
      });
      return;
    }

    acciones.guardarPlantillaInvitacion(clave, plantilla);
    window.open(url, '_blank', 'noopener,noreferrer');
    setHecho(destino);
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Invitar a la reunión"
      descripcion={nombre}
      pie={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Boton variante="fantasma" onClick={alCerrar} className="mr-auto">
            Cerrar
          </Boton>
          <Boton icono={Save} onClick={guardar}>
            Guardar plantilla
          </Boton>
          <Boton icono={Mail} onClick={() => abrir('gmail')}>
            Abrir en Gmail
          </Boton>
          <Boton variante="primario" icono={CalendarPlus} onClick={() => abrir('calendar')}>
            Abrir en Google Calendar
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CampoFecha
            etiqueta="Fecha"
            requerido
            min={hoy}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            error={errores.fecha}
          />
          <CampoHora etiqueta="Hora" requerido value={plantilla.hora} onChange={cambiar('hora')} error={errores.hora} />
          <CampoSelect
            etiqueta="Duración"
            opciones={DURACIONES}
            placeholder="Elegir…"
            value={String(plantilla.duracion_min)}
            onChange={(e) =>
              // El «Elegir…» vacío no es una duración: se queda la que estaba.
              e.target.value && setPlantilla((p) => ({ ...p, duracion_min: Number(e.target.value) }))
            }
          />
        </div>

        <CampoTexto
          etiqueta="Lugar"
          ayuda="opcional — dirección o link de la videollamada"
          value={plantilla.lugar}
          onChange={cambiar('lugar')}
        />

        <CampoTexto
          etiqueta="Presentación para completar"
          ayuda="link de Google Slides que completa cada área"
          type="url"
          placeholder="https://docs.google.com/presentation/..."
          value={plantilla.url_presentacion}
          onChange={cambiar('url_presentacion')}
          error={errores.url_presentacion}
        />

        <CampoInvitados
          invitados={plantilla.invitados}
          alCambiar={(invitados) => setPlantilla((p) => ({ ...p, invitados }))}
          error={errores.invitados}
        />

        <CampoTexto etiqueta="Asunto" requerido value={plantilla.asunto} onChange={cambiar('asunto')} error={errores.asunto} />

        <CampoArea
          etiqueta="Mensaje"
          ayuda="entre llaves se completa solo: {mesa} {fecha} {hora} {lugar} {link}"
          filas={8}
          value={plantilla.mensaje}
          onChange={cambiar('mensaje')}
        />

        <p className="text-xs leading-relaxed text-gris">
          Se abre en otra pestaña, con tu cuenta de Google, y el envío lo confirmás ahí. Al abrirlo, estos
          datos quedan como plantilla de la mesa, salvo la fecha. Por ahora la plantilla se guarda en este
          navegador: tus compañeros no ven tus cambios.
        </p>

        {errores.general && <Aviso tono="error">{errores.general}</Aviso>}
        {hecho && (
          <div role="status">
            <Aviso tono="info" titulo={AVISOS[hecho].titulo}>
              {AVISOS[hecho].texto}
            </Aviso>
          </div>
        )}
      </div>
    </Modal>
  );
}

const AVISOS = {
  calendar: {
    titulo: 'Se abrió Google Calendar en otra pestaña',
    texto: 'Revisá el evento y tocá «Guardar»: Google te va a preguntar si querés enviar las invitaciones.',
  },
  gmail: {
    titulo: 'Se abrió Gmail en otra pestaña',
    texto: 'El borrador está listo. Revisalo y tocá «Enviar».',
  },
  guardada: {
    titulo: 'Plantilla guardada',
    texto: 'La próxima invitación de esta mesa arranca con estos datos.',
  },
};

/**
 * Los invitados como lista de mails que se agregan y se quitan de a uno.
 *
 * `type="text"` con `inputMode="email"` y no `type="email"`: el teclado del
 * celular es el mismo, pero el navegador «sanea» el valor de un campo de mail
 * —le saca los saltos de línea y los espacios— y rompía pegar una lista
 * copiada de un correo o de una columna de planilla, que es la forma más común
 * de cargar invitados.
 */
function CampoInvitados({ invitados, alCambiar, error }) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const [invalidos, setInvalidos] = useState([]);

  function agregar(entrada = texto) {
    if (!entrada.trim()) return;
    const resultado = agregarMails(invitados, entrada);
    alCambiar(resultado.lista);
    setInvalidos(resultado.invalidos);
    // Lo que no era un mail queda escrito para corregirlo, no se pierde.
    setTexto(resultado.invalidos.join(', '));
  }

  const mensajeError = invalidos.length ? `No parece un mail: ${invalidos.join(', ')}` : error;
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gris">
        Invitados
        <span className="ml-0.5 text-vencido-texto">*</span>
        {invitados.length > 0 && (
          <span className="ml-1.5 font-normal text-tenue">{`${invitados.length} en la plantilla`}</span>
        )}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          className="campo-base"
          placeholder="nombre@dominio.com"
          value={texto}
          aria-describedby={mensajeError ? `${idAyuda} ${idError}` : idAyuda}
          aria-invalid={mensajeError ? true : undefined}
          onChange={(e) => {
            setTexto(e.target.value);
            setInvalidos([]);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
              e.preventDefault();
              agregar();
            }
          }}
          onPaste={(e) => {
            const pegado = e.clipboardData.getData('text');
            if (/[,;\n]/.test(pegado)) {
              e.preventDefault();
              agregar(texto + pegado);
            }
          }}
          onBlur={() => agregar()}
        />
        <Boton icono={UserPlus} onClick={() => agregar()} className="shrink-0">
          Agregar
        </Boton>
      </div>
      <p id={idAyuda} className="mt-1 text-[11px] text-tenue">
        Enter o coma para agregar. Podés pegar una lista copiada de un mail o de una planilla.
      </p>
      {mensajeError && (
        <p id={idError} className="mt-1 text-[11px] text-vencido-texto">
          {mensajeError}
        </p>
      )}

      {invitados.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Invitados de la plantilla">
          {invitados.map((mail) => (
            <li
              key={mail}
              className="inline-flex max-w-full items-center gap-0.5 rounded-chip border border-borde bg-paper py-0.5 pl-2 pr-0.5 text-xs text-tinta"
            >
              <span className="truncate">{mail}</span>
              <button
                type="button"
                onClick={() => alCambiar(invitados.filter((m) => m !== mail))}
                className="shrink-0 rounded-chip p-1 text-tenue transition hover:bg-card hover:text-vencido-texto"
                aria-label={`Quitar a ${mail}`}
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
