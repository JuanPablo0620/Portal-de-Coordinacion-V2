# Convocatorias de Seguimiento

## Circuito acordado

1. Una semana antes de la reunión se prepara una **Convocatoria**.
2. Se dirige a las personas invitadas en el evento de Google Calendar.
3. Se copia el template de la secretaría, dentro de su carpeta de PPTS. El nombre
   lleva el número siguiente, «Seguimiento», la secretaría y la fecha de reunión.
4. Se recuperan los compromisos de la reunión anterior y se adjuntan como PDF.
5. Se pide al área completar la presentación; se comparte su enlace editable.
6. Una persona del equipo revisa el borrador y lo envía desde Gmail.

La fecha de entrega se propone para el día anterior y puede cambiarse antes de
preparar el texto. Los invitados que rechazaron Calendar siguen en la convocatoria:
la regla indicada fue convocar a quienes están agendados. Se excluyen los recursos
como salas; no se inventan correos a partir de los nombres del portal.

## Uso en el portal

1. Entrar a **Seguimiento → Enviar convocatoria**. También está en las filas
   de la vista Lista de próximos seguimientos.
2. Conectar la cuenta de Google que guardará el borrador. Esta identidad se
   muestra explícitamente y es independiente del login de Supabase.
3. Elegir el calendario y la reunión. Se consultan eventos con «seguimiento»
   en el título, a 90 días; desde una fila del portal se consulta ese día y se
   comprueba que coincida el horario. Los datos del mail usan la hora argentina.
4. Elegir la carpeta de secretaría bajo «01. Seguimiento por Secretarias».
   La carpeta de Seguimiento debe contener PPTS y Compromisos.
5. Confirmar la presentación y los compromisos propuestos por la fecha de reunión
   escrita en el nombre. No se usa la última fecha de edición. Si hay más de un
   candidato para la misma fecha, la selección queda vacía para revisión manual.
6. Preparar la convocatoria. Se puede usar una PPT existente o copiar el template.
   Se reconsulta PPTS antes de copiar para reutilizar una presentación ya existente
   de esa fecha y calcular el número siguiente.
7. Revisar y editar destinatarios, asunto y mensaje. Abrir el PDF y la presentación;
   se puede reemplazar el PDF por uno corregido. Marcar la revisión y guardar el
   borrador. Luego abrir **Borradores de Gmail** para verificarlo y enviarlo.
   En el mensaje, `**texto**` va en negrita y `[texto]` es el enlace a la PPT;
   la vista previa muestra cómo queda. Sin un `[texto]` no se puede guardar.

El borrador pertenece a la cuenta conectada. Otra persona del equipo debe preparar
la convocatoria desde su propia cuenta si será quien la revise y envíe. Esta
implementación no crea una bandeja compartida ni una aprobación entre dos cuentas.
Tampoco programa un envío automático siete días antes ni modifica el evento de
Calendar. El resultado del portal es un borrador, no una constancia de envío.

## Envío de compromisos

Es el mismo circuito hacia atrás: el día siguiente a la reunión se mandan sus
compromisos a los mismos invitados. **Seguimiento → Enviar compromisos**.

1. Al buscar reuniones se listan las ya realizadas de los últimos 30 días y se
   elige sola la más reciente. La secretaría sale del título, como en la convocatoria.
2. Al buscar carpetas se propone el documento de Compromisos con **la fecha de esa
   reunión** en el nombre (no la anterior). Si todavía no está en Drive, hay que
   subirlo y volver a buscar.
3. Asunto: `Compromisos | Seguimiento <Secretaría> <dd/mm>`. Mensaje fijo, editable,
   sin presentación ni fecha de entrega.

Comparte conexión, permisos y manejo de errores con la convocatoria: es el mismo
diálogo con `tipo="compromisos"`.

## Invitación a reuniones de mesa (desde el 09/10)

Las reuniones de mesa (empezando por la Mesa de Eventos) no existen en Calendar
hasta que el equipo las crea. **Mesas → Eventos → Invitar a la reunión**:

1. **Agendar en Calendar:** el portal crea el evento («Reunión Mesa Eventos») en
   el calendario de quien convoca, con hora, duración, lugar e invitados, y Google
   les manda la invitación en ese momento (`sendUpdates=all`, decisión de JP). No
   tiene borrador: se pide tildar una confirmación antes. El id del evento lo pone
   el portal, así que reintentar tras una respuesta perdida no lo duplica.
2. **Convocatoria por mail:** borrador de Gmail sin adjunto con el texto de la
   plantilla de la mesa (negritas y firma de Gmail incluidas), para los mismos
   invitados.

La plantilla de cada mesa (título del evento, asunto, mensaje, invitados, hora,
duración, lugar) se guarda en el navegador al usarla. La de Eventos arranca con
el texto que JP usa a mano. Antes este modal abría Calendar y Gmail con links
precargados; se reemplazó por la API porque los permisos ya se piden igual.

Prueba sin cuentas reales: `node scripts/verificar-invitacion.mjs`.

## Activación de Google

1. En el proyecto de Google Cloud destinado al portal, habilitar **Gmail API**,
   **Google Calendar API** y **Google Drive API**.
2. Configurar Google Auth Platform y crear un cliente OAuth de tipo
   **Aplicación web**. Agregar como orígenes JavaScript autorizados el origen
   de producción y los orígenes locales que se usen. El flujo es popup/token;
   no requiere secreto del cliente ni servidor de callbacks.
3. En modo Testing agregar como usuarios de prueba a quienes prepararán
   convocatorias. Como el equipo usa cuentas personales, no asumir que puede
   elegirse una audiencia Internal. Revisar las condiciones de verificación
   de Google antes de abrir el acceso fuera del equipo de prueba.
4. Configurar las variables de `.env.example` en `.env.local` y en el entorno de
   despliegue:
   - `VITE_GOOGLE_CLIENT_ID`: identificador público del cliente OAuth.
   - `VITE_GOOGLE_SEGUIMIENTO_FOLDER_ID`: carpeta «01. Seguimiento por Secretarias».
     Es opcional; si falta, el usuario puede pegar su enlace en el formulario.
5. Reconstruir el portal después de configurar las variables `VITE_*`.

No copiar las claves de la cuenta de servicio al front. La cuenta vigente de los
scripts sirve para acceder al Drive compartido, pero no tiene la casilla personal
de Gmail del integrante del equipo. Esta función necesita su autorización OAuth.
Los IDs de carpetas reales y los correos del equipo no se guardan en este documento.

Referencias de Google: [modelo de token](https://developers.google.com/identity/oauth2/web/guides/use-token-model),
[borradores de Gmail](https://developers.google.com/workspace/gmail/api/guides/drafts),
[permisos de Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth),
[importación y conversión](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

## Permisos y manejo de errores

1. Se piden `calendar.readonly`, `calendar.events` (desde el 09/10, para agendar
   reuniones de mesa), `drive` y `gmail.compose` sólo al usar la función.
   Drive requiere escritura para copiar templates de las carpetas existentes y
   convertir Word. `gmail.compose` incluye capacidad de envío según Google;
   el código de esta función llama solamente a `users.drafts.create`.
   `gmail.settings.basic` (desde el 09/10) sólo se usa para leer la firma
   predeterminada (`settings.sendAs`): un borrador creado por la API no la recibe
   sola. Los textos del portal no llevan firma propia; si la cuenta no tiene,
   el borrador sale sin firma. En la vista previa se muestra en un iframe aislado.
2. El token queda en memoria mientras el diálogo está abierto y se descarta al
   cerrarlo. No se almacena en Supabase, el navegador ni el repositorio. No se
   solicitan refresh tokens ni se renuevan autorizaciones en segundo plano.
3. Un Word se descarga y se importa como Google Docs temporal en el Drive de
   quien prepara la convocatoria. Luego se exporta a PDF y se envía esa copia
   temporal a la papelera. El documento original queda intacto. Si no se puede
   retirar la copia, se informa; una desconexión durante la creación puede dejar
   un temporal que debe revisarse en Drive.
4. El PDF se valida por cabecera y tamaño, hasta 8 MB. Conviene revisar su formato:
   una conversión automática puede cambiar la paginación de Word.
5. Si Google no confirma una escritura, se bloquea el reintento dentro del
   diálogo y se pide revisar Drive/Gmail. Crear un borrador no es idempotente;
   cerrar y reabrir el diálogo puede crear otro. No se reintentan POST a ciegas.
6. Dos personas copiando exactamente al mismo tiempo aún pueden crear dos PPTS:
   Drive no ofrece una transacción sobre la numeración. Si ocurre, seleccionar
   el archivo correcto en Drive y evitar repetir la preparación.

## Validación

1. `npm run verificar`: reglas de arquitectura, pruebas de lógica, build, humo
   y accesibilidad de las rutas existentes; incluye el montaje del diálogo.
2. `node scripts/verificar-convocatoria.mjs`: Chrome con sesión, Calendar,
   Drive y Gmail ficticios. Prueba copia del template, conversión de Word a PDF,
   revisión obligatoria, MIME adjunto y un único borrador; captura escritorio y
   móvil. No consulta ni escribe cuentas reales. Los archivos temporales del
   build se retiran al finalizar.
3. Con Google real (09/10): cliente OAuth en `bot-coordinacion`, probado en local
   con la cuenta de JP. En producción falta cargar `VITE_GOOGLE_CLIENT_ID` en
   Vercel y redesplegar sin caché de build.
