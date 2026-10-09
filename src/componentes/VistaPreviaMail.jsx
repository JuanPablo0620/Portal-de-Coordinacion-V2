import { segmentosMensaje } from '../datos/convocatorias.js';

/**
 * Cómo va a quedar el mail en Gmail: negritas, enlace a la presentación y la
 * firma predeterminada de quien lo prepara. La comparten la convocatoria de
 * seguimiento, el envío de compromisos y la invitación a reuniones de mesa, para
 * que lo que se revisa sea siempre lo mismo que sale.
 *
 * `firmaLeida`: null si Google no la devolvió, '' si la cuenta no tiene firma.
 */
export function VistaPreviaMail({ mensaje, presentacion = '', firma = '', firmaLeida = null }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gris">Vista previa del mail</p>
      <div className="whitespace-pre-line rounded-chip border border-borde bg-paper p-3 text-sm leading-relaxed text-tinta">
        {segmentosMensaje(mensaje).map((s, i) => (
          s.tipo === 'negrita' ? <strong key={i}>{s.texto}</strong>
            : s.tipo === 'enlace' && presentacion ? <a key={i} href={presentacion} target="_blank" rel="noopener noreferrer" className="text-acento underline">{s.texto}</a>
              : <span key={i}>{s.tipo === 'enlace' ? `[${s.texto}]` : s.texto}</span>
        ))}
        {/* La firma es HTML de Gmail: se muestra aislada, sin scripts ni acceso a la página. */}
        {firma && <iframe title="Firma de Gmail" sandbox="" srcDoc={firma} className="mt-3 block h-36 w-full rounded-chip border-0 bg-white" />}
      </div>
      <p className="mt-1 text-xs text-gris">{firma ? 'Al final va tu firma predeterminada de Gmail.'
        : firmaLeida === '' ? 'Tu cuenta de Gmail no tiene firma predeterminada: el borrador sale sin firma.'
          : 'No se pudo leer tu firma de Gmail: el borrador sale sin firma y podés agregarla en Gmail antes de enviar.'}</p>
    </div>
  );
}
