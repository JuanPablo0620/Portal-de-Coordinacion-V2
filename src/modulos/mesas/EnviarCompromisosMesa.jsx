import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, FileCheck, Mail } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoCheck, CampoFecha, CampoSelect, CampoTexto } from '../../componentes/Campo.jsx';
import { VistaPreviaMail } from '../../componentes/VistaPreviaMail.jsx';
import {
  datosDelEvento, fechaCorta, moverFecha, reunionesRealizadas, textoCompromisosMesa, ultimoNumerado, validarFecha,
} from '../../datos/convocatorias.js';
import { GOOGLE_CLIENT_ID, conectarGoogleConvocatorias, prepararConexionGoogle } from '../../datos/repositorio.js';
import { hoyISO } from '../../datos/selectores.js';
import { acciones } from '../../estado/tienda.js';

/**
 * Compromisos de una reunión de mesa, el día siguiente, como borrador de Gmail:
 * a los invitados de la última reunión realizada en Calendar, con el último
 * documento de Compromisos en PDF y la última PPT en .pptx (pedido de JP,
 * 09/10/2026, empezando por la Mesa de Eventos).
 *
 * «Último» es el de número más alto en la carpeta: los nombres no siempre
 * llevan fecha (ver `ultimoNumerado`). Todo lo propuesto se puede cambiar
 * antes de preparar. Si en Calendar no aparece la reunión —se agendó a mano con
 * otro título—, la fecha se carga a mano y los destinatarios salen de la
 * plantilla de invitados de la mesa.
 *
 * `mesa` va en el asunto y el texto; `raiz` es la carpeta de la mesa en Drive y
 * `area` la subcarpeta con Compromisos y PPT; `patronReunion` reconoce sus
 * reuniones por el título del evento.
 */
export function EnviarCompromisosMesa({ alCerrar, mesa, clave, raiz = '', area, patronReunion }) {
  const conexion = useRef(null);
  const activo = useRef(true);
  const operando = useRef(false);
  const revision = useRef(null);
  const [googleListo, setGoogleListo] = useState(false);
  const [cuenta, setCuenta] = useState('');
  const [firma, setFirma] = useState('');
  const [firmaLeida, setFirmaLeida] = useState(null);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [incierto, setIncierto] = useState(false);
  const [calendarios, setCalendarios] = useState([]);
  const [calendario, setCalendario] = useState('');
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState('');
  const [fecha, setFecha] = useState('');
  const [destinatarios, setDestinatarios] = useState('');
  const [carpeta, setCarpeta] = useState(raiz);
  const [materiales, setMateriales] = useState(null);
  const [seleccion, setSeleccion] = useState({ compromiso: '', presentacion: '', conPresentacion: true });
  const [adjuntos, setAdjuntos] = useState(null);
  const [texto, setTexto] = useState({ asunto: '', mensaje: '' });
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

  useEffect(() => {
    if (adjuntos) revision.current?.focus();
  }, [adjuntos]);

  function invalidar() { setAdjuntos(null); setRevisado(false); }

  async function ejecutar(etiqueta, tarea) {
    if (operando.current || incierto || borrador) return;
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

  async function buscarReuniones(sesion, idCalendario) {
    const hoy = hoyISO();
    const realizadas = reunionesRealizadas(
      await sesion.reuniones(idCalendario, moverFecha(hoy, -30), moverFecha(hoy, 1), patronReunion),
    );
    if (!activo.current) return;
    setEventos(realizadas);
    if (realizadas[0]) await leerEvento(sesion, idCalendario, realizadas[0].id);
    else {
      // Sin reunión en Calendar: destinatarios de la plantilla de la mesa.
      setEventoId('');
      setDestinatarios(acciones.plantillaInvitacion(clave).invitados.join(', '));
    }
  }

  async function leerEvento(sesion, idCalendario, id) {
    const reunion = datosDelEvento(await sesion.evento(idCalendario, id));
    if (!activo.current) return;
    setEventoId(id);
    setFecha(reunion.fecha);
    setDestinatarios(reunion.destinatarios);
  }

  async function leerMateriales(sesion, idCarpeta) {
    const encontrados = await sesion.materialesMesa(idCarpeta, area);
    if (!activo.current) return;
    setMateriales(encontrados);
    setSeleccion((s) => ({
      ...s,
      compromiso: ultimoNumerado(encontrados.compromisos),
      presentacion: ultimoNumerado(encontrados.presentaciones),
    }));
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
      const leida = await sesion.firmaPredeterminada().catch(() => null);
      setFirma(leida ?? '');
      setFirmaLeida(leida);
      const disponibles = await sesion.calendarios();
      if (!activo.current) return;
      const principal = (disponibles.find((c) => c.primary) ?? disponibles[0])?.id ?? '';
      setCalendarios(disponibles);
      setCalendario(principal);
      setOcupado('Buscando la última reunión y los archivos…');
      if (principal) await buscarReuniones(sesion, principal);
      if (carpeta.trim()) await leerMateriales(sesion, carpeta.trim());
    });
  }

  function preparar() {
    ejecutar('Preparando el PDF de compromisos y la presentación…', async () => {
      if (!validarFecha(fecha)) throw new Error('Indicá la fecha de la reunión.');
      if (!seleccion.compromiso) throw new Error('Elegí el documento de compromisos.');
      if (seleccion.conPresentacion && !seleccion.presentacion) throw new Error('Elegí la presentación o sacala del mail.');
      const pdf = await conexion.current.pdfCompromisos(seleccion.compromiso);
      const pptx = seleccion.conPresentacion ? await conexion.current.pptxPresentacion(seleccion.presentacion) : null;
      if (!activo.current) return;
      setTexto(textoCompromisosMesa({ mesa, fecha, conPresentacion: Boolean(pptx) }));
      setAdjuntos(pptx ? [pdf, pptx] : [pdf]);
      setRevisado(false);
    });
  }

  function guardarBorrador() {
    ejecutar('Guardando el borrador en Gmail…', async () => {
      if (!revisado) throw new Error('Revisá el mail y los adjuntos antes de guardar.');
      const resultado = await conexion.current.crearBorrador({
        tipo: 'compromisos-mesa', fecha, destinatarios, asunto: texto.asunto, mensaje: texto.mensaje, presentacion: '', firma,
      }, adjuntos);
      if (activo.current) setBorrador(resultado);
    });
  }

  const bloqueado = Boolean(ocupado || incierto || borrador);
  const cerrar = () => { if (!operando.current) alCerrar(); };
  const opciones = (archivos) => archivos.map((a) => ({ valor: a.id, titulo: a.name }));

  return (
    <Modal abierto alCerrar={cerrar} ancho="lg" titulo="Enviar compromisos" descripcion={mesa}
      pie={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Boton disabled={Boolean(ocupado)} onClick={cerrar} className="mr-auto min-h-11">Cerrar</Boton>
          {borrador && <a className="inline-flex min-h-11 items-center gap-2 rounded-chip border border-acento bg-acento px-4 text-sm text-white"
            href={borrador.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden="true" /> Revisar y enviar en Gmail</a>}
          {!borrador && adjuntos && <Boton variante="primario" icono={Mail} className="min-h-11"
            disabled={bloqueado || !revisado} onClick={guardarBorrador}>Guardar borrador en Gmail</Boton>}
        </div>
      }>
      <div className="flex flex-col gap-5" aria-busy={Boolean(ocupado)}>
        <p className="text-sm text-gris">
          El mail lleva los compromisos de la última reunión en PDF y la presentación en .pptx, para los invitados de esa reunión.
        </p>
        {ocupado && <p role="status" className="text-sm font-medium text-acento">{ocupado}</p>}
        {error && <div role="alert"><Aviso tono="error" titulo="No se pudo completar">{error}</Aviso></div>}
        {!GOOGLE_CLIENT_ID && <Aviso titulo="Conexión con Google pendiente">
          Para preparar el mail, el administrador debe habilitar la conexión de Google del portal.
        </Aviso>}
        {borrador && <div role="status"><Aviso titulo="Compromisos guardados en Borradores">
          El borrador quedó en {borrador.email}, con los adjuntos. Abrí Gmail para verificarlo y enviarlo.
        </Aviso></div>}
        {GOOGLE_CLIENT_ID && !cuenta && <Boton icono={Mail} className="min-h-11 self-start" disabled={!googleListo || bloqueado} onClick={conectar}>
          Conectar mi cuenta de Google
        </Boton>}

        {cuenta && <>
          <div className="rounded-chip border border-borde bg-paper p-3 text-sm text-gris">El borrador se guardará en <strong className="text-tinta">{cuenta}</strong>.</div>
          {!adjuntos && <fieldset disabled={bloqueado} className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-semibold text-tinta">1. Reunión y destinatarios</legend>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
              <CampoSelect className="flex-1" etiqueta="Calendario" opciones={calendarios.map((c) => ({ valor: c.id, titulo: c.summary }))}
                value={calendario} onChange={(e) => { setCalendario(e.target.value); setEventos([]); setEventoId(''); }} />
              <Boton className="min-h-11" disabled={!calendario}
                onClick={() => ejecutar('Buscando reuniones…', () => buscarReuniones(conexion.current, calendario))}>Buscar reuniones</Boton>
            </div>
            <CampoSelect etiqueta="Reunión" value={eventoId} disabled={!eventos.length}
              opciones={eventos.map((e) => ({ valor: e.id, titulo: `${e.summary} · ${fechaCorta(e.start.dateTime.slice(0, 10))}` }))}
              placeholder={eventos.length ? 'Elegí la reunión' : 'No hay reuniones en Calendar'}
              onChange={(e) => e.target.value && ejecutar('Leyendo la reunión…', () => leerEvento(conexion.current, calendario, e.target.value))} />
            <p className="text-xs text-gris">
              Reuniones ya realizadas de los últimos 30 días; se propone la más reciente. Si no aparece, cargá la fecha:
              los destinatarios salen de los invitados guardados de la mesa.
            </p>
            <CampoFecha etiqueta="Fecha de la reunión" requerido max={hoyISO()} value={fecha}
              onChange={(e) => { setFecha(e.target.value); invalidar(); }} />
            {validarFecha(fecha) && <p className="text-xs text-gris">Fecha prevista para el envío: {fechaCorta(moverFecha(fecha, 1))} (el día siguiente).</p>}
            <CampoArea etiqueta="Destinatarios" requerido filas={3} value={destinatarios}
              onChange={(e) => setDestinatarios(e.target.value)} ayuda="Podés ajustar la lista antes de guardar." />
          </fieldset>}

          {!adjuntos && <fieldset disabled={bloqueado} className="flex flex-col gap-3 border-t border-borde pt-4">
            <legend className="mb-3 text-sm font-semibold text-tinta">2. Archivos</legend>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <CampoTexto className="flex-1" etiqueta="Carpeta de la mesa en Drive" value={carpeta}
                ayuda="enlace o ID de la carpeta" onChange={(e) => { setCarpeta(e.target.value); setMateriales(null); }} />
              <Boton className="min-h-11" disabled={!carpeta.trim()}
                onClick={() => ejecutar('Buscando los archivos…', () => leerMateriales(conexion.current, carpeta.trim()))}>Buscar archivos</Boton>
            </div>
            {materiales && <>
              <CampoSelect etiqueta="Compromisos" value={seleccion.compromiso} opciones={opciones(materiales.compromisos)}
                placeholder="Elegí el documento" onChange={(e) => setSeleccion((s) => ({ ...s, compromiso: e.target.value }))} />
              <CampoCheck etiqueta="Adjuntar la presentación (.pptx)" checked={seleccion.conPresentacion}
                onChange={(e) => setSeleccion((s) => ({ ...s, conPresentacion: e.target.checked }))} />
              {seleccion.conPresentacion && <CampoSelect etiqueta="Presentación" value={seleccion.presentacion} opciones={opciones(materiales.presentaciones)}
                placeholder="Elegí la presentación" onChange={(e) => setSeleccion((s) => ({ ...s, presentacion: e.target.value }))} />}
              <p className="text-xs text-gris">Se propone el de número más alto de cada carpeta. Si todavía no subiste el de esta reunión, subilo y volvé a buscar.</p>
              <Boton className="min-h-11 self-start" icono={FileCheck} onClick={preparar}>Preparar envío</Boton>
            </>}
          </fieldset>}

          {adjuntos && <RevisionMail
            revision={revision} bloqueado={bloqueado} texto={texto} destinatarios={destinatarios} adjuntos={adjuntos}
            firma={firma} firmaLeida={firmaLeida} revisado={revisado}
            alCambiarTexto={(campo, valor) => { setTexto((t) => ({ ...t, [campo]: valor })); setRevisado(false); }}
            alCambiarDestinatarios={(valor) => { setDestinatarios(valor); setRevisado(false); }}
            alRevisar={setRevisado} alEditar={invalidar}
          />}
        </>}
      </div>
    </Modal>
  );
}

const megas = (bytes) => `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

function RevisionMail({
  revision, bloqueado, texto, destinatarios, adjuntos, firma, firmaLeida, revisado,
  alCambiarTexto, alCambiarDestinatarios, alRevisar, alEditar,
}) {
  const idAdjuntos = useId();
  const [urlPdf, setUrlPdf] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([adjuntos[0].bytes], { type: 'application/pdf' }));
    setUrlPdf(url);
    return () => URL.revokeObjectURL(url);
  }, [adjuntos]);

  return (
    <fieldset disabled={bloqueado} className="flex flex-col gap-3 border-t border-borde pt-4">
      <legend ref={revision} tabIndex={-1} className="mb-3 text-sm font-semibold text-tinta">3. Revisar el borrador</legend>
      <Boton className="self-start" onClick={alEditar}>Cambiar reunión o archivos</Boton>
      <CampoArea etiqueta="Destinatarios" requerido filas={2} value={destinatarios} onChange={(e) => alCambiarDestinatarios(e.target.value)} />
      <CampoTexto etiqueta="Asunto" requerido value={texto.asunto} onChange={(e) => alCambiarTexto('asunto', e.target.value)} />
      <CampoArea etiqueta="Mensaje" requerido filas={7} value={texto.mensaje} onChange={(e) => alCambiarTexto('mensaje', e.target.value)}
        ayuda="**texto** va en negrita." />
      <VistaPreviaMail mensaje={texto.mensaje} firma={firma} firmaLeida={firmaLeida} />
      <div>
        <p id={idAdjuntos} className="mb-1 text-xs font-medium text-gris">Adjuntos</p>
        <ul aria-labelledby={idAdjuntos} className="flex flex-col gap-1 text-sm">
          <li><a href={urlPdf} target="_blank" rel="noopener noreferrer" className="text-acento underline">{adjuntos[0].nombre}</a>
            <span className="text-gris"> · {megas(adjuntos[0].bytes.length)}</span></li>
          {adjuntos[1] && <li className="text-tinta">{adjuntos[1].nombre}<span className="text-gris"> · {megas(adjuntos[1].bytes.length)}</span></li>}
        </ul>
      </div>
      <CampoCheck etiqueta="Revisé los destinatarios, el mensaje y los adjuntos."
        checked={revisado} onChange={(e) => alRevisar(e.target.checked)} />
    </fieldset>
  );
}
