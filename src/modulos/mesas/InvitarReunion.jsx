import { useEffect, useId, useRef, useState } from 'react';
import { CalendarPlus, ExternalLink, Mail, Save, UserPlus, X } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoCheck, CampoFecha, CampoHora, CampoSelect, CampoTexto } from '../../componentes/Campo.jsx';
import { VistaPreviaMail } from '../../componentes/VistaPreviaMail.jsx';
import { DURACIONES, agregarMails, armarInvitacion, horarioEvento, validarInvitacion } from '../../datos/invitaciones.js';
import { GOOGLE_CLIENT_ID, conectarGoogleConvocatorias, prepararConexionGoogle } from '../../datos/repositorio.js';
import { hoyISO } from '../../datos/selectores.js';
import { acciones } from '../../estado/tienda.js';

/**
 * Convocar a una reunión de mesa en dos pasos, con la cuenta de Google de
 * quien convoca:
 *
 *  1. Agendar en Calendar: el portal crea el evento con los invitados y Google
 *     les manda la invitación en ese momento (decisión de JP, 09/10/2026). No
 *     hay borrador posible, por eso se pide confirmación explícita antes.
 *  2. Convocatoria por mail: un borrador de Gmail con el texto de la plantilla
 *     y la firma predeterminada; se revisa y se envía desde Gmail.
 *
 * Los dos pasos son independientes: si el evento ya se creó a mano, se puede
 * preparar sólo el mail.
 *
 * Cada mesa tiene UNA plantilla —título del evento, asunto, mensaje,
 * invitados, link de la presentación, hora, duración y lugar— que se ajusta acá
 * antes de cada convocatoria y queda guardada al usarla. La fecha es lo único
 * que no se guarda, porque es de esta reunión y no de la mesa.
 */
export function InvitarReunion({ abierto, alCerrar, clave, nombre, fechaInicial = '' }) {
  const hoy = hoyISO();
  const [plantilla, setPlantilla] = useState(() => acciones.plantillaInvitacion(clave));
  const [fecha, setFecha] = useState(fechaInicial ?? '');
  const [errores, setErrores] = useState({});
  const [guardada, setGuardada] = useState(false);

  // Conexión con Google: el token vive sólo mientras el modal está abierto.
  const conexion = useRef(null);
  const activo = useRef(true);
  const operando = useRef(false);
  // Id propio del evento: un reintento tras una respuesta perdida no lo duplica.
  const idEvento = useRef(`portal${crypto.randomUUID().replace(/-/g, '')}`);
  const [googleListo, setGoogleListo] = useState(false);
  const [cuenta, setCuenta] = useState('');
  const [firma, setFirma] = useState('');
  const [firmaLeida, setFirmaLeida] = useState(null);
  const [calendarios, setCalendarios] = useState([]);
  const [calendario, setCalendario] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [incierto, setIncierto] = useState(false);
  const [confirmaEnvio, setConfirmaEnvio] = useState(false);
  const [evento, setEvento] = useState(null);
  const [revisado, setRevisado] = useState(false);
  const [borrador, setBorrador] = useState(null);

  useEffect(() => {
    activo.current = true;
    if (GOOGLE_CLIENT_ID) {
      prepararConexionGoogle().then(() => { if (activo.current) setGoogleListo(true); })
        .catch((e) => { if (activo.current) setError(e.message); });
    }
    return () => { activo.current = false; conexion.current?.cerrar(); };
  }, []);

  const cambiar = (campo) => (e) => {
    setPlantilla((p) => ({ ...p, [campo]: e.target.value }));
    setRevisado(false);
  };
  const { titulo, cuerpo, tituloEvento } = armarInvitacion(plantilla, { nombre, fecha });

  async function ejecutar(etiqueta, tarea) {
    if (operando.current || incierto) return;
    operando.current = true;
    setOcupado(etiqueta);
    setError('');
    try { await tarea(); }
    catch (e) {
      if (activo.current) { setError(e.message); if (e.resultadoIncierto) setIncierto(true); }
    } finally {
      operando.current = false;
      if (activo.current) setOcupado('');
    }
  }

  function conectar() {
    if (operando.current) return;
    // La llamada al popup ocurre en el clic, antes de cualquier espera.
    const solicitud = conectarGoogleConvocatorias();
    ejecutar('Conectando con Google…', async () => {
      const sesion = await solicitud;
      if (!activo.current) { sesion.cerrar(); return; }
      conexion.current = sesion;
      setCuenta(sesion.email);
      // Sin firma el borrador igual sirve: un error al leerla no bloquea nada.
      const leida = await sesion.firmaPredeterminada().catch(() => null);
      if (!activo.current) return;
      setFirma(leida ?? '');
      setFirmaLeida(leida);
      const disponibles = await sesion.calendarios();
      if (!activo.current) return;
      // Sólo los calendarios donde se puede crear: los de lectura darían 403.
      const propios = disponibles.filter((c) => ['owner', 'writer'].includes(c.accessRole));
      setCalendarios(propios);
      setCalendario((propios.find((c) => c.primary) ?? propios[0])?.id ?? '');
    });
  }

  function validar() {
    const faltan = validarInvitacion(plantilla, fecha, hoy);
    setErrores(faltan);
    return !Object.keys(faltan).length;
  }

  function guardar() {
    acciones.guardarPlantillaInvitacion(clave, plantilla);
    setGuardada(true);
  }

  function agendar() {
    if (!validar()) return;
    ejecutar('Creando el evento en Calendar…', async () => {
      if (!confirmaEnvio) throw new Error('Confirmá que Google les va a mandar la invitación a los invitados.');
      const link = plantilla.url_presentacion.trim();
      const creado = await conexion.current.crearEvento(calendario, idEvento.current, {
        summary: tituloEvento,
        location: plantilla.lugar.trim() || undefined,
        description: link ? `Presentación: ${link}` : undefined,
        ...horarioEvento(fecha, plantilla.hora, plantilla.duracion_min),
        attendees: plantilla.invitados.map((email) => ({ email })),
      });
      acciones.guardarPlantillaInvitacion(clave, plantilla);
      if (activo.current) setEvento(creado);
    });
  }

  function prepararMail() {
    if (!validar()) return;
    ejecutar('Guardando el borrador en Gmail…', async () => {
      if (!revisado) throw new Error('Revisá el mail antes de guardarlo.');
      const resultado = await conexion.current.crearBorrador({
        tipo: 'invitacion', fecha, destinatarios: plantilla.invitados.join(', '),
        asunto: titulo, mensaje: cuerpo, presentacion: '', firma,
      }, null);
      acciones.guardarPlantillaInvitacion(clave, plantilla);
      if (activo.current) setBorrador(resultado);
    });
  }

  const bloqueado = Boolean(ocupado || incierto);
  const cerrar = () => { if (!operando.current) alCerrar(); };
  const invitados = plantilla.invitados.length;

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrar}
      ancho="lg"
      titulo="Invitar a la reunión"
      descripcion={nombre}
      pie={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Boton variante="fantasma" onClick={cerrar} disabled={Boolean(ocupado)} className="mr-auto">
            Cerrar
          </Boton>
          <Boton icono={Save} onClick={guardar} disabled={bloqueado}>
            Guardar plantilla
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-4" aria-busy={Boolean(ocupado)}>
        <p className="text-sm text-gris">
          Agendá la reunión en tu Google Calendar —Google les manda la invitación a los invitados— y prepará la
          convocatoria por mail como borrador de Gmail.
        </p>
        {ocupado && <p role="status" className="text-sm font-medium text-acento">{ocupado}</p>}
        {error && <div role="alert"><Aviso tono="error" titulo="No se pudo completar">{error}</Aviso></div>}
        {!GOOGLE_CLIENT_ID && (
          <Aviso titulo="Conexión con Google pendiente">
            Para agendar y preparar el mail, el administrador debe habilitar la conexión de Google del portal.
          </Aviso>
        )}
        {GOOGLE_CLIENT_ID && !cuenta && (
          <Boton icono={Mail} className="min-h-11 self-start" disabled={!googleListo || bloqueado} onClick={conectar}>
            Conectar mi cuenta de Google
          </Boton>
        )}
        {cuenta && (
          <div className="rounded-chip border border-borde bg-paper p-3 text-sm text-gris">
            Se agenda y se guarda el borrador con <strong className="text-tinta">{cuenta}</strong>.
          </div>
        )}

        <fieldset disabled={bloqueado} className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-semibold text-tinta">Reunión</legend>
          <CampoTexto
            etiqueta="Título del evento en Calendar"
            requerido
            value={plantilla.titulo_evento}
            onChange={cambiar('titulo_evento')}
            error={errores.titulo_evento}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CampoFecha
              etiqueta="Fecha"
              requerido
              min={hoy}
              value={fecha}
              onChange={(e) => { setFecha(e.target.value); setRevisado(false); }}
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
            ayuda="dirección, sala o link de la videollamada"
            value={plantilla.lugar}
            onChange={cambiar('lugar')}
          />
          <CampoTexto
            etiqueta="Presentación para completar"
            ayuda="opcional — link de Google Slides que completa cada área"
            type="url"
            placeholder="https://docs.google.com/presentation/..."
            value={plantilla.url_presentacion}
            onChange={cambiar('url_presentacion')}
            error={errores.url_presentacion}
          />
          <CampoInvitados
            invitados={plantilla.invitados}
            alCambiar={(lista) => { setPlantilla((p) => ({ ...p, invitados: lista })); setRevisado(false); }}
            error={errores.invitados}
          />
        </fieldset>

        <fieldset disabled={bloqueado || !cuenta} className="flex flex-col gap-3 border-t border-borde pt-4">
          <legend className="mb-3 text-sm font-semibold text-tinta">1. Agendar en Calendar</legend>
          {evento ? (
            <div role="status">
              <Aviso tono="info" titulo="Evento creado y enviado a los invitados">
                Google ya les mandó la invitación de Calendar.{' '}
                {evento.htmlLink && (
                  <a href={evento.htmlLink} target="_blank" rel="noopener noreferrer" className="font-medium text-acento underline">
                    Abrir el evento en Calendar
                  </a>
                )}
              </Aviso>
            </div>
          ) : (
            <>
              {calendarios.length > 1 && (
                <CampoSelect
                  etiqueta="Calendario"
                  opciones={calendarios.map((c) => ({ valor: c.id, titulo: c.summary }))}
                  value={calendario}
                  onChange={(e) => setCalendario(e.target.value)}
                />
              )}
              <CampoCheck
                etiqueta={`Revisé fecha, hora e invitados: al crear el evento, Google les manda la invitación a ${invitados} ${invitados === 1 ? 'persona' : 'personas'}.`}
                checked={confirmaEnvio}
                onChange={(e) => setConfirmaEnvio(e.target.checked)}
              />
              <Boton variante="primario" icono={CalendarPlus} className="min-h-11 self-start" disabled={!confirmaEnvio || !calendario} onClick={agendar}>
                Agendar en Calendar
              </Boton>
            </>
          )}
        </fieldset>

        <fieldset disabled={bloqueado || !cuenta || Boolean(borrador)} className="flex flex-col gap-3 border-t border-borde pt-4">
          <legend className="mb-3 text-sm font-semibold text-tinta">2. Convocatoria por mail</legend>
          <CampoTexto etiqueta="Asunto" requerido value={plantilla.asunto} onChange={cambiar('asunto')} error={errores.asunto} />
          <CampoArea
            etiqueta="Mensaje"
            ayuda="**texto** va en negrita. Entre llaves se completa solo: {fecha_corta} {dia} {hora} {lugar} {mesa} {link}"
            filas={9}
            value={plantilla.mensaje}
            onChange={cambiar('mensaje')}
          />
          <p className="text-xs text-gris">Asunto: <strong className="text-tinta">{titulo || '—'}</strong> · Para los {invitados} invitados</p>
          <VistaPreviaMail mensaje={cuerpo} firma={firma} firmaLeida={cuenta ? firmaLeida : ''} />
          {borrador ? (
            <div role="status">
              <Aviso tono="info" titulo="Convocatoria guardada en Borradores">
                El borrador quedó en {borrador.email}.{' '}
                <a href={borrador.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-acento underline">
                  <ExternalLink size={14} aria-hidden="true" /> Revisar y enviar en Gmail
                </a>
              </Aviso>
            </div>
          ) : (
            <>
              <CampoCheck
                etiqueta="Revisé el asunto, el mensaje y los destinatarios."
                checked={revisado}
                onChange={(e) => setRevisado(e.target.checked)}
              />
              <Boton icono={Mail} className="min-h-11 self-start" disabled={!revisado} onClick={prepararMail}>
                Guardar borrador en Gmail
              </Boton>
            </>
          )}
        </fieldset>

        {guardada && (
          <div role="status">
            <Aviso tono="info" titulo="Plantilla guardada">
              La próxima invitación de esta mesa arranca con estos datos. Por ahora se guarda en este navegador.
            </Aviso>
          </div>
        )}
      </div>
    </Modal>
  );
}

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
