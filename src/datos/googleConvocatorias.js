/**
 * Google con la cuenta de quien prepara la convocatoria. El token dura sólo
 * mientras está abierto el diálogo; no se escribe en la base ni en el disco.
 * Gmail sólo tiene una salida: drafts.create. No hay una operación de envío.
 * Las consultas no eligen reuniones ni documentos ambiguos por el usuario.
 */
import {
  MIME_CARPETA, MIME_DOC, MIME_DOCX, MIME_PPT, MIME_PPTX, MAX_PDF,
  aBase64, fechaDelArchivo, idDeDrive, mensajeMime, normalizarNombre, nombrePresentacion, rawGmail, validarPDF,
} from './convocatorias.js';

export const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID ?? '';
export const CARPETA_SEGUIMIENTOS = import.meta.env?.VITE_GOOGLE_SEGUIMIENTO_FOLDER_ID ?? '';
export const PERMISOS_CONVOCATORIA = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.compose',
];
let cargaBiblioteca;

export function prepararConexionGoogle() {
  if (!GOOGLE_CLIENT_ID) return Promise.reject(new Error('La conexión con Google todavía no está configurada para este portal.'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (cargaBiblioteca) return cargaBiblioteca;
  cargaBiblioteca = new Promise((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const tiempo = setTimeout(() => {
      script.remove();
      rechazar(new Error('Google tardó demasiado en cargar. Volvé a abrir la convocatoria.'));
    }, 15000);
    script.onload = () => { clearTimeout(tiempo); resolver(); };
    script.onerror = () => {
      clearTimeout(tiempo);
      script.remove();
      rechazar(new Error('No se pudo cargar la conexión con Google. Revisá la conexión a Internet.'));
    };
    document.head.appendChild(script);
  }).catch((error) => { cargaBiblioteca = null; throw error; });
  return cargaBiblioteca;
}

/** Llamar desde el clic, con la biblioteca ya cargada: evita bloquear el popup. */
export function conectarGoogleConvocatorias() {
  return new Promise((resolver, rechazar) => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.oauth2) {
      rechazar(new Error('La conexión con Google no está lista.'));
      return;
    }
    const oauth = window.google.accounts.oauth2;
    const cliente = oauth.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: PERMISOS_CONVOCATORIA.join(' '),
      include_granted_scopes: false,
      error_callback: () => rechazar(new Error('No se conectó la cuenta. Podés volver a intentarlo.')),
      callback: async (respuesta) => {
        if (respuesta.error || !respuesta.access_token || !oauth.hasGrantedAllScopes(respuesta, ...PERMISOS_CONVOCATORIA)) {
          rechazar(new Error('Google necesita los permisos de Calendar, Drive y borradores de Gmail para preparar la convocatoria.'));
          return;
        }
        const duracion = Number(respuesta.expires_in);
        if (!Number.isFinite(duracion) || duracion < 60 || duracion > 7200) {
          rechazar(new Error('Google no devolvió una conexión válida. Volvé a conectar.'));
          return;
        }
        const sesion = crearClienteConvocatorias(respuesta.access_token, Date.now() + duracion * 1000);
        try {
          const perfil = await sesion.perfil();
          sesion.email = perfil.emailAddress;
          resolver(sesion);
        } catch (error) { sesion.cerrar(); rechazar(error); }
      },
    });
    cliente.requestAccessToken({ prompt: 'select_account' });
  });
}

/** Inyección de fetch para probar el contrato sin tocar cuentas ni archivos reales. */
export function crearClienteConvocatorias(tokenInicial, vence, consultar = globalThis.fetch) {
  let token = tokenInicial;
  let borradorIntentado = false;
  const bases = {
    calendar: 'https://www.googleapis.com/calendar/v3/',
    drive: 'https://www.googleapis.com/drive/v3/',
    upload: 'https://www.googleapis.com/upload/drive/v3/',
    gmail: 'https://gmail.googleapis.com/gmail/v1/users/me/',
  };

  async function pedir(servicio, ruta, { metodo = 'GET', datos, binario = false, tipo = 'application/json' } = {}) {
    if (!token || Date.now() >= vence - 30000) throw new Error('La conexión con Google venció. Cerrá esta ventana y volvé a conectar.');
    let respuesta;
    try {
      respuesta = await consultar(bases[servicio] + ruta, {
        method: metodo,
        headers: { Authorization: `Bearer ${token}`, ...(datos !== undefined ? { 'Content-Type': tipo } : {}) },
        ...(datos !== undefined ? { body: tipo === 'application/json' ? JSON.stringify(datos) : datos } : {}),
        signal: AbortSignal.timeout(60000),
        redirect: 'error',
      });
    } catch {
      const error = new Error(metodo === 'GET'
        ? 'No se pudo consultar Google. Revisá la conexión y volvé a intentarlo.'
        : 'Google no confirmó el resultado. Revisá Drive o Borradores de Gmail antes de volver a crear el material.');
      error.resultadoIncierto = metodo !== 'GET';
      throw error;
    }
    if (!respuesta.ok) {
      const error = new Error(respuesta.status === 401 ? 'La conexión con Google venció. Volvé a conectar.'
        : respuesta.status === 403 ? 'Tu cuenta no tiene permiso para este archivo o falta habilitar la API de Google.'
          : respuesta.status === 404 ? 'No se encontró el archivo o calendario con esta cuenta.'
            : 'Google no pudo completar la operación. Revisá la conexión y los permisos.');
      error.resultadoIncierto = metodo !== 'GET' && respuesta.status >= 500;
      throw error;
    }
    if (respuesta.status === 204) return null;
    try {
      if (binario) {
        const longitud = Number(respuesta.headers.get('content-length'));
        if (longitud > MAX_PDF) throw new Error('El archivo supera el límite de 8 MB.');
        const bytes = new Uint8Array(await respuesta.arrayBuffer());
        if (bytes.length > MAX_PDF) throw new Error('El archivo supera el límite de 8 MB.');
        return bytes;
      }
      return await respuesta.json();
    } catch (causa) {
      if (binario) throw causa;
      const error = new Error('Google devolvió una respuesta incompleta. Revisá el resultado antes de repetir.');
      error.resultadoIncierto = metodo !== 'GET';
      throw error;
    }
  }

  async function paginas(servicio, ruta, parametros, propiedad) {
    const elementos = [];
    let pagina = '';
    do {
      const consulta = new URLSearchParams({ ...parametros, ...(pagina ? { pageToken: pagina } : {}) });
      const datos = await pedir(servicio, `${ruta}?${consulta}`);
      elementos.push(...(datos[propiedad] ?? []));
      pagina = datos.nextPageToken ?? '';
    } while (pagina);
    return elementos;
  }

  async function archivos(carpeta) {
    const id = idDeDrive(carpeta);
    return paginas('drive', 'files', {
      q: `'${id}' in parents and trashed = false`, pageSize: '100',
      fields: 'nextPageToken,files(id,name,mimeType,webViewLink,appProperties)',
      supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
    }, 'files');
  }

  async function metadatos(id) {
    return pedir('drive', `files/${encodeURIComponent(idDeDrive(id))}?fields=id,name,mimeType,webViewLink&supportsAllDrives=true`);
  }

  const cliente = {
    email: '',
    cerrar() { token = ''; },
    perfil: () => pedir('gmail', 'profile'),
    calendarios: () => paginas('calendar', 'users/me/calendarList', { maxResults: '100', minAccessRole: 'reader' }, 'items'),
    reuniones: (calendario, fechaDesde, fechaHasta) => paginas('calendar', `calendars/${encodeURIComponent(calendario)}/events`, {
      timeMin: `${fechaDesde}T00:00:00-03:00`, timeMax: `${fechaHasta}T00:00:00-03:00`,
      singleEvents: 'true', orderBy: 'startTime', maxResults: '250', timeZone: 'America/Argentina/Buenos_Aires',
    }, 'items').then((items) => items.filter((e) => e.status !== 'cancelled' && e.start?.dateTime && /seguimiento/.test(normalizarNombre(e.summary)))),
    evento: (calendario, evento) => pedir('calendar', `calendars/${encodeURIComponent(calendario)}/events/${encodeURIComponent(evento)}`),
    async carpetas(carpeta) {
      const raiz = await metadatos(carpeta);
      if (raiz.mimeType !== MIME_CARPETA) throw new Error('El enlace de Drive debe ser una carpeta.');
      return (await archivos(raiz.id)).filter((a) => a.mimeType === MIME_CARPETA);
    },
    async materiales(carpeta) {
      const hijos = await archivos(carpeta);
      const candidatos = hijos.filter((a) => a.mimeType === MIME_CARPETA && /seguimiento/.test(normalizarNombre(a.name)));
      if (candidatos.length !== 1) throw new Error('Esta secretaría debe tener una única carpeta de Seguimiento. Revisá el enlace elegido.');
      const subcarpetas = await archivos(candidatos[0].id);
      const ppts = subcarpetas.filter((a) => a.mimeType === MIME_CARPETA && /ppt|presentacion/.test(normalizarNombre(a.name)));
      const compromisos = subcarpetas.filter((a) => a.mimeType === MIME_CARPETA && /compromiso/.test(normalizarNombre(a.name)));
      if (ppts.length !== 1 || compromisos.length !== 1) throw new Error('No se pudieron identificar las carpetas de PPTS y Compromisos.');
      const [presentaciones, documentos] = await Promise.all([archivos(ppts[0].id), archivos(compromisos[0].id)]);
      return {
        carpetaPPTS: ppts[0].id,
        presentaciones: presentaciones.filter((a) => [MIME_PPT, MIME_PPTX].includes(a.mimeType)),
        compromisos: documentos.filter((a) => [MIME_DOC, MIME_DOCX, 'application/pdf'].includes(a.mimeType)),
      };
    },
    async copiarPresentacion(materiales, plantillaId, area, fecha) {
      const plantilla = materiales.presentaciones.find((a) => a.id === plantillaId);
      if (!plantilla) throw new Error('Elegí el template de presentación.');
      // Reconsulta antes de numerar: otro integrante puede haber preparado la PPT.
      const actuales = await archivos(materiales.carpetaPPTS);
      const marca = `${materiales.carpetaPPTS}:${fecha}`;
      const existentes = actuales.filter((a) => [MIME_PPT, MIME_PPTX].includes(a.mimeType) &&
        (a.appProperties?.convocatoria === marca || fechaDelArchivo(a, fecha.slice(0, 4)) === fecha));
      if (existentes.length === 1) return existentes[0];
      if (existentes.length > 1) throw new Error('Hay más de una presentación para esta convocatoria. Elegí la correcta en Drive.');
      return pedir('drive', `files/${encodeURIComponent(plantilla.id)}/copy?fields=id,name,mimeType,webViewLink&supportsAllDrives=true`, {
        metodo: 'POST', datos: {
          name: nombrePresentacion(actuales, area, fecha, plantilla), parents: [materiales.carpetaPPTS],
          appProperties: { convocatoria: marca },
        },
      });
    },
    async pdfCompromisos(id) {
      const archivo = await metadatos(id);
      const nombre = archivo.name.replace(/\.docx$/i, '').replace(/\.pdf$/i, '') + '.pdf';
      let temporal = null;
      let advertencia = '';
      try {
        let bytes;
        if (archivo.mimeType === 'application/pdf') {
          bytes = await pedir('drive', `files/${encodeURIComponent(archivo.id)}?alt=media&supportsAllDrives=true`, { binario: true });
        } else if (archivo.mimeType === MIME_DOC) {
          bytes = await pedir('drive', `files/${encodeURIComponent(archivo.id)}/export?mimeType=application%2Fpdf`, { binario: true });
        } else if (archivo.mimeType === MIME_DOCX) {
          // Word no admite files.export: se importa una copia temporal como Doc.
          const original = await pedir('drive', `files/${encodeURIComponent(archivo.id)}?alt=media&supportsAllDrives=true`, { binario: true });
          const limite = `importacion_${crypto.randomUUID()}`;
          const cuerpo = [
            `--${limite}`, 'Content-Type: application/json; charset=UTF-8', '',
            JSON.stringify({ name: 'Conversión temporal de compromisos', mimeType: MIME_DOC, appProperties: { conversionConvocatoria: 'temporal' } }),
            `--${limite}`, `Content-Type: ${MIME_DOCX}`, 'Content-Transfer-Encoding: base64', '',
            aBase64(original), `--${limite}--`, '',
          ].join('\r\n');
          temporal = await pedir('upload', 'files?uploadType=multipart&fields=id', {
            metodo: 'POST', tipo: `multipart/related; boundary=${limite}`, datos: cuerpo,
          });
          if (!temporal?.id) throw new Error('Google no confirmó la conversión del documento.');
          bytes = await pedir('drive', `files/${encodeURIComponent(temporal.id)}/export?mimeType=application%2Fpdf`, { binario: true });
        } else throw new Error('Elegí un documento Word, Google Docs o PDF de compromisos.');
        const pdf = { nombre, bytes };
        validarPDF(pdf);
        return pdf;
      } finally {
        if (temporal?.id) {
          try {
            await pedir('drive', `files/${encodeURIComponent(temporal.id)}`, { metodo: 'PATCH', datos: { trashed: true } });
          } catch {
            advertencia = 'Quedó una copia de conversión temporal en tu Drive. Podés enviarla a la papelera.';
          }
          cliente.advertenciaConversion = advertencia;
        }
      }
    },
    async crearBorrador(datos, pdf) {
      // Una respuesta perdida puede haber guardado el borrador: nunca reintentar a ciegas.
      if (borradorIntentado) throw new Error('Revisá Borradores de Gmail antes de volver a crear esta convocatoria.');
      const raw = rawGmail(mensajeMime(datos, pdf, cliente.email));
      borradorIntentado = true;
      try {
        const borrador = await pedir('gmail', 'drafts', { metodo: 'POST', datos: { message: { raw } } });
        if (!borrador?.id) {
          const error = new Error('Google no confirmó el borrador. Revisá Borradores de Gmail.');
          error.resultadoIncierto = true;
          throw error;
        }
        return { id: borrador.id, email: cliente.email, url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(cliente.email)}#drafts` };
      } catch (error) {
        if (!error.resultadoIncierto) borradorIntentado = false;
        throw error;
      }
    },
  };
  return cliente;
}
