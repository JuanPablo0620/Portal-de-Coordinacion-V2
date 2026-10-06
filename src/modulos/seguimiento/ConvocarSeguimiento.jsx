import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, FileCheck, Mail } from 'lucide-react';
import { Aviso, Boton } from '../../componentes/Basicos.jsx';
import { Modal } from '../../componentes/Modal.jsx';
import { CampoArea, CampoCheck, CampoFecha, CampoSelect, CampoTexto, GrillaCampos } from '../../componentes/Campo.jsx';
import {
  CARPETA_SEGUIMIENTOS, GOOGLE_CLIENT_ID, conectarGoogleConvocatorias, prepararConexionGoogle,
} from '../../datos/repositorio.js';
import {
  datosDelEvento, fechaCorta, fechaDelArchivo, materialesSugeridos, moverFecha, normalizarNombre, textoConvocatoria, validarConvocatoria, validarPDF,
} from '../../datos/convocatorias.js';
import { hoyISO } from '../../datos/selectores.js';
import { useSesion } from '../../estado/sesion.js';

/**
 * Una convocatoria termina en un borrador de Gmail, con el PDF y el enlace de
 * la PPT. El envío lo hace la persona después de revisarlo en Gmail.
 * La selección explícita evita asociar por inferencia una reunión o un archivo
 * de otra secretaría. Ningún mail ni token queda guardado en el navegador.
 */
export function ConvocarSeguimiento({ alCerrar, seguimiento = null }) {
  const perfil = useSesion((s) => s.perfil);
  const conexion = useRef(null);
  const activo = useRef(true);
  const operando = useRef(false);
  const revision = useRef(null);
  const archivoId = useId();
  const [googleListo, setGoogleListo] = useState(false);
  const [cuenta, setCuenta] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [incierto, setIncierto] = useState(false);
  const [calendarios, setCalendarios] = useState([]);
  const [calendario, setCalendario] = useState('');
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState('');
  const [carpetaRaiz, setCarpetaRaiz] = useState(CARPETA_SEGUIMIENTOS);
  const [carpetas, setCarpetas] = useState([]);
  const [carpeta, setCarpeta] = useState('');
  const [materiales, setMateriales] = useState(null);
  const [seleccion, setSeleccion] = useState({ modo: 'nueva', plantilla: '', presentacion: '', compromiso: '' });
  const [adjuntos, setAdjuntos] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [revisado, setRevisado] = useState(false);
  const [borrador, setBorrador] = useState(null);
  const [datos, setDatos] = useState({
    area: seguimiento?.area?.replace(/^Secretaría de /i, '') ?? '', fecha: '', hora: '', lugar: '',
    modalidad: 'presencial', entrega: '', destinatarios: '', asunto: '', mensaje: '', presentacion: '',
    firma: [perfil?.nombre ?? '', 'Dirección de Control de Gestión', 'Secretaría de Coordinación'].filter(Boolean).join('\n'),
  });

  useEffect(() => {
    activo.current = true;
    if (GOOGLE_CLIENT_ID) {
      prepararConexionGoogle().then(() => { if (activo.current) setGoogleListo(true); })
        .catch((e) => { if (activo.current) setError(e.message); });
    }
    return () => { activo.current = false; conexion.current?.cerrar(); };
  }, []);

  useEffect(() => {
    if (!adjuntos?.pdf) { setPdfUrl(''); return undefined; }
    const url = URL.createObjectURL(new Blob([adjuntos.pdf.bytes], { type: 'application/pdf' }));
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [adjuntos]);

  useEffect(() => {
    if (adjuntos) {
      revision.current?.scrollIntoView({ block: 'start' });
      revision.current?.focus({ preventScroll: true });
    }
  }, [adjuntos]);

  function invalidar() { setAdjuntos(null); setRevisado(false); }
  const cambiar = (campo) => (e) => { setRevisado(false); setDatos((d) => ({ ...d, [campo]: e.target.value })); };

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

  function conectar() {
    if (operando.current || incierto || borrador) return;
    // La llamada al popup ocurre en el clic, antes de cualquier espera.
    const solicitud = conectarGoogleConvocatorias();
    ejecutar('Conectando con Google…', async () => {
      const sesion = await solicitud;
      if (!activo.current) { sesion.cerrar(); return; }
      conexion.current = sesion;
      setCuenta(sesion.email);
      const disponibles = await sesion.calendarios();
      if (!activo.current) return;
      setCalendarios(disponibles);
      setCalendario((disponibles.find((c) => c.primary) ?? disponibles[0])?.id ?? '');
    });
  }

  function cargarReuniones() {
    invalidar(); setEventoId(''); setEventos([]);
    ejecutar('Buscando reuniones de seguimiento…', async () => {
      const desde = seguimiento?.fecha ?? hoyISO();
      const eventosGoogle = await conexion.current.reuniones(calendario, desde, moverFecha(desde, seguimiento ? 1 : 90));
      if (activo.current) setEventos(eventosGoogle);
    });
  }

  function elegirEvento(id) {
    invalidar(); setEventoId('');
    ejecutar('Leyendo invitados y datos de la reunión…', async () => {
      const evento = await conexion.current.evento(calendario, id);
      const reunion = datosDelEvento(evento);
      if (seguimiento && (reunion.fecha !== seguimiento.fecha || (seguimiento.hora && reunion.hora !== seguimiento.hora))) {
        throw new Error('El horario de Calendar no coincide con el seguimiento del portal. Revisá cuál es la reunión correcta.');
      }
      if (!activo.current) return;
      setEventoId(id);
      setDatos((d) => ({ ...d, ...reunion, entrega: moverFecha(reunion.fecha, -1), asunto: '', mensaje: '', presentacion: '' }));
    });
  }

  function cargarCarpetas() {
    invalidar(); setCarpeta(''); setMateriales(null); setCarpetas([]);
    ejecutar('Buscando las carpetas de secretarías…', async () => {
      const disponibles = await conexion.current.carpetas(carpetaRaiz);
      if (activo.current) setCarpetas(disponibles);
    });
  }

  function elegirCarpeta(id) {
    invalidar(); setMateriales(null); setCarpeta(id);
    ejecutar('Buscando presentación y compromisos…', async () => {
      const encontrados = await conexion.current.materiales(id);
      if (!activo.current) return;
      const sugeridos = materialesSugeridos(encontrados.presentaciones, encontrados.compromisos, datos.fecha);
      const area = carpetas.find((c) => c.id === id)?.name.replace(/^\d+\.\s*/, '') ?? '';
      setMateriales(encontrados);
      setSeleccion({ ...sugeridos, modo: sugeridos.presentacion ? 'existente' : 'nueva' });
      setDatos((d) => ({ ...d, area, asunto: '', mensaje: '', presentacion: '' }));
    });
  }

  function prepararMateriales() {
    ejecutar('Preparando PDF y presentación…', async () => {
      if (!eventoId || !datos.area.trim() || !datos.lugar.trim()) throw new Error('Elegí la reunión y completá secretaría y lugar.');
      if (!seleccion.compromiso) throw new Error('Elegí el documento de compromisos de la última reunión.');
      const documento = materiales.compromisos.find((a) => a.id === seleccion.compromiso);
      if (!documento || !/compromiso/.test(normalizarNombre(documento.name))) throw new Error('Elegí un documento de compromisos.');
      const fechaDocumento = fechaDelArchivo(documento, datos.fecha.slice(0, 4));
      if (fechaDocumento && fechaDocumento >= datos.fecha) throw new Error('Los compromisos deben corresponder a una reunión anterior.');
      let presentacion = materiales.presentaciones.find((a) => a.id === seleccion.presentacion);
      if (seleccion.modo === 'existente' && !presentacion) throw new Error('Elegí la presentación de la próxima reunión.');
      if (seleccion.modo === 'nueva' && !seleccion.plantilla) throw new Error('Elegí el template de presentación.');
      // Primero el PDF: si falla la conversión, no deja una PPT nueva innecesaria.
      const pdf = await conexion.current.pdfCompromisos(documento.id);
      if (seleccion.modo === 'nueva') {
        presentacion = await conexion.current.copiarPresentacion(materiales, seleccion.plantilla, datos.area, datos.fecha);
        if (activo.current && presentacion?.id) {
          setMateriales((m) => ({ ...m, presentaciones: [...m.presentaciones.filter((a) => a.id !== presentacion.id), presentacion] }));
          setSeleccion((s) => ({ ...s, modo: 'existente', presentacion: presentacion.id }));
        }
      }
      if (!presentacion?.webViewLink) throw new Error('Google no devolvió el enlace de la presentación. Revisá la copia en Drive.');
      if (!activo.current) return;
      const completos = { ...datos, presentacion: presentacion.webViewLink };
      setDatos({ ...completos, ...textoConvocatoria(completos) });
      setAdjuntos({ pdf, presentacion, documento });
      setRevisado(false);
    });
  }

  function guardarBorrador() {
    ejecutar('Guardando el borrador en Gmail…', async () => {
      if (!revisado) throw new Error('Revisá el PDF y los datos antes de guardar.');
      validarConvocatoria(datos, adjuntos?.pdf);
      const resultado = await conexion.current.crearBorrador(datos, adjuntos.pdf);
      if (activo.current) setBorrador(resultado);
    });
  }

  async function reemplazarPDF(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    ejecutar('Leyendo el PDF…', async () => {
      if (archivo.size > 8 * 1024 * 1024) throw new Error('El PDF no puede superar 8 MB.');
      const pdf = { nombre: archivo.name, bytes: new Uint8Array(await archivo.arrayBuffer()) };
      validarPDF(pdf);
      if (activo.current) { setAdjuntos((a) => ({ ...a, pdf })); setRevisado(false); }
    });
    e.target.value = '';
  }

  const bloqueado = Boolean(ocupado || incierto || borrador);
  const opciones = (archivos) => archivos.map((a) => ({ valor: a.id, titulo: a.name }));
  const cerrar = () => { if (!operando.current) alCerrar(); };

  return (
    <Modal abierto alCerrar={cerrar} ancho="lg" titulo="Enviar convocatoria"
      descripcion="Prepará un borrador para revisar y enviar desde Gmail."
      pie={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Boton disabled={Boolean(ocupado)} onClick={cerrar} className="mr-auto min-h-11">Cerrar</Boton>
          {borrador && <a className="inline-flex min-h-11 items-center gap-2 rounded-chip border border-acento bg-acento px-4 text-sm text-white"
            href={borrador.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Revisar y enviar en Gmail</a>}
          {!borrador && adjuntos && <Boton variante="primario" icono={Mail} className="min-h-11"
            disabled={bloqueado || !revisado} onClick={guardarBorrador}>Guardar borrador en Gmail</Boton>}
        </div>
      }>
      <div className="flex flex-col gap-5" aria-busy={Boolean(ocupado)}>
        <p className="text-sm text-gris">La convocatoria incluye los compromisos anteriores en PDF y el enlace de la presentación que el área debe completar.</p>
        {ocupado && <p role="status" className="text-sm font-medium text-acento">{ocupado}</p>}
        {error && <div role="alert"><Aviso tono="error" titulo="No se pudo completar la preparación">{error}</Aviso></div>}
        {!GOOGLE_CLIENT_ID && <Aviso titulo="Conexión con Google pendiente">
          El botón ya está disponible. Para guardar borradores, el administrador debe habilitar la conexión de Google del portal.
        </Aviso>}
        {borrador && <div role="status"><Aviso titulo="Convocatoria guardada en Borradores">
          El borrador quedó en {borrador.email}, con el PDF adjunto y la presentación enlazada. Abrí Gmail para verificarlo y enviarlo.
        </Aviso></div>}
        {!cuenta && <Boton icono={Mail} className="min-h-11 self-start" disabled={!googleListo || bloqueado} onClick={conectar}>
          Conectar mi cuenta de Google
        </Boton>}
        {cuenta && <>
          <div className="rounded-chip border border-borde bg-paper p-3 text-sm text-gris">El borrador se guardará en <strong className="text-tinta">{cuenta}</strong>.</div>
          {!adjuntos && <fieldset disabled={bloqueado} className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-semibold text-tinta">1. Reunión e invitados</legend>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
              <CampoSelect className="flex-1" etiqueta="Calendario" opciones={calendarios.map((c) => ({ valor: c.id, titulo: c.summary }))}
                value={calendario} onChange={(e) => { setCalendario(e.target.value); setEventos([]); setEventoId(''); invalidar(); }} />
              <Boton className="min-h-11" disabled={!calendario} onClick={cargarReuniones}>Buscar reuniones</Boton>
            </div>
            <CampoSelect etiqueta="Reunión de seguimiento" value={eventoId} disabled={!eventos.length}
              opciones={eventos.map((e) => ({ valor: e.id, titulo: `${e.summary} · ${e.start.dateTime.slice(0, 10)}` }))}
              placeholder="Elegí la reunión de Calendar" onChange={(e) => { if (e.target.value) elegirEvento(e.target.value); }} />
            <p className="text-xs text-gris">Buscamos reuniones cuyo título contenga «seguimiento». {seguimiento ? `Para el ${fechaCorta(seguimiento.fecha)}.` : 'En los próximos 90 días.'} Si no aparece, revisá el calendario seleccionado.</p>
            {eventoId && <>
              <p className="text-xs text-gris">Fecha prevista para la convocatoria: {fechaCorta(moverFecha(datos.fecha, -7))} (una semana antes).</p>
              <GrillaCampos columnas={3}>
                <CampoTexto etiqueta="Secretaría" requerido value={datos.area} onChange={(e) => { invalidar(); cambiar('area')(e); }} />
                <CampoTexto etiqueta="Fecha de reunión" value={`${fechaCorta(datos.fecha)} · ${datos.hora} hs`} readOnly />
                <CampoFecha etiqueta="Entrega de presentación" requerido max={datos.fecha} value={datos.entrega} onChange={cambiar('entrega')} />
              </GrillaCampos>
              <GrillaCampos>
                <CampoSelect etiqueta="Modalidad" value={datos.modalidad} opciones={['presencial', 'virtual', 'híbrida']} onChange={cambiar('modalidad')} />
                <CampoTexto etiqueta="Lugar o enlace de reunión" requerido value={datos.lugar} onChange={cambiar('lugar')} />
              </GrillaCampos>
              <CampoArea etiqueta="Destinatarios de Calendar" requerido filas={2} value={datos.destinatarios} onChange={cambiar('destinatarios')}
                ayuda="Podés ajustar la lista antes de guardar." />
            </>}
          </fieldset>}
          {eventoId && !adjuntos && <fieldset disabled={bloqueado} className="flex flex-col gap-3 border-t border-borde pt-4">
            <legend className="mb-3 text-sm font-semibold text-tinta">2. Presentación y compromisos</legend>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <CampoTexto className="flex-1" etiqueta="Carpeta de secretarías en Drive" value={carpetaRaiz}
                ayuda="01. Seguimiento por Secretarias" onChange={(e) => { setCarpetaRaiz(e.target.value); setCarpetas([]); setCarpeta(''); setMateriales(null); invalidar(); }} />
              <Boton className="min-h-11" disabled={!carpetaRaiz} onClick={cargarCarpetas}>Buscar carpetas</Boton>
            </div>
            <CampoSelect etiqueta="Carpeta de la secretaría" value={carpeta} opciones={opciones(carpetas)} disabled={!carpetas.length}
              onChange={(e) => { if (e.target.value) elegirCarpeta(e.target.value); }} />
            {materiales && <>
              <CampoSelect etiqueta="Presentación de la próxima reunión" value={seleccion.modo}
                opciones={[{ valor: 'existente', titulo: 'Usar una presentación existente' }, { valor: 'nueva', titulo: 'Copiar el template para esta reunión' }]}
                onChange={(e) => { invalidar(); setSeleccion((s) => ({ ...s, modo: e.target.value })); }} />
              <CampoSelect etiqueta={seleccion.modo === 'nueva' ? 'Template para copiar' : 'Presentación existente'}
                value={seleccion.modo === 'nueva' ? seleccion.plantilla : seleccion.presentacion}
                opciones={opciones(seleccion.modo === 'nueva' ? materiales.presentaciones.filter((a) => /template|plantilla/.test(normalizarNombre(a.name))) : materiales.presentaciones)}
                onChange={(e) => { invalidar(); setSeleccion((s) => ({ ...s, [s.modo === 'nueva' ? 'plantilla' : 'presentacion']: e.target.value })); }} />
              <CampoSelect etiqueta="Compromisos de la reunión anterior" value={seleccion.compromiso} opciones={opciones(materiales.compromisos)}
                onChange={(e) => { invalidar(); setSeleccion((s) => ({ ...s, compromiso: e.target.value })); }} />
              <p className="text-xs text-gris">Revisá la fecha de los archivos elegidos. Si se copia el template, se guarda en PPTS con el número siguiente y la fecha de esta reunión.</p>
              <Boton className="min-h-11 self-start" icono={FileCheck} onClick={prepararMateriales}>Preparar convocatoria</Boton>
            </>}
          </fieldset>}
          {adjuntos && <fieldset disabled={bloqueado} className="flex flex-col gap-3 border-t border-borde pt-4">
            <legend ref={revision} tabIndex={-1} className="mb-3 text-sm font-semibold text-tinta">3. Revisar el borrador</legend>
            <p className="text-sm text-gris">{datos.area} · {fechaCorta(datos.fecha)} · {datos.hora} hs · {datos.lugar}</p>
            <Boton className="self-start" onClick={invalidar}>Editar reunión o materiales</Boton>
            <CampoArea etiqueta="Destinatarios de Calendar" requerido filas={2} value={datos.destinatarios} onChange={cambiar('destinatarios')} />
            <CampoTexto etiqueta="Asunto" requerido value={datos.asunto} onChange={cambiar('asunto')} />
            <CampoArea etiqueta="Mensaje" requerido filas={12} value={datos.mensaje} onChange={cambiar('mensaje')} />
            <Boton onClick={() => { setDatos((d) => ({ ...d, ...textoConvocatoria(d) })); setRevisado(false); }} className="self-start">
              Actualizar texto con los datos de la reunión
            </Boton>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <a href={adjuntos.presentacion.webViewLink} target="_blank" rel="noopener noreferrer" className="text-acento underline">Abrir presentación</a>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-acento underline">Revisar PDF: {adjuntos.pdf.nombre}</a>
            </div>
            <div>
              <label htmlFor={archivoId} className="mb-1 block text-xs font-medium text-gris">Reemplazar PDF si necesitás corregir el formato</label>
              <input id={archivoId} type="file" accept="application/pdf,.pdf" onChange={reemplazarPDF} className="campo-base" />
            </div>
            {conexion.current?.advertenciaConversion && <Aviso>{conexion.current.advertenciaConversion}</Aviso>}
            <CampoCheck etiqueta="Revisé los destinatarios, el mensaje, la presentación y el PDF de compromisos."
              checked={revisado} onChange={(e) => setRevisado(e.target.checked)} />
          </fieldset>}
        </>}
      </div>
    </Modal>
  );
}
