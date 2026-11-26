import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarCheck, ExternalLink, RefreshCw } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton } from '../../componentes/Basicos.jsx';
import { CampoCheck } from '../../componentes/Campo.jsx';
import { GOOGLE_CLIENT_ID, conectarGoogleCalendario, prepararConexionGoogle } from '../../datos/repositorio.js';
import { DIAS_SINCRONIZADOS, compararConCalendar, seguimientoDesdeCalendar } from '../../datos/sincronizarCalendar.js';
import { moverFecha } from '../../datos/convocatorias.js';
import { hoyISO } from '../../datos/selectores.js';
import { acciones, useBD } from '../../estado/tienda.js';
import { fecha as fFecha } from '../../utilidades/formato.js';

const cuando = (fecha, hora) => `${fFecha(fecha)}${hora ? ` · ${hora}` : ''}`;
const sinPrefijo = (area = '') => area.replace(/^Secretaría de /i, '');

/**
 * «Actualizar desde Calendar»: lee los seguimientos de los próximos
 * `DIAS_SINCRONIZADOS` días en el calendario principal de quien lo usa y
 * propone las correcciones. Se aplican sólo las que quedan tildadas.
 *
 * Calendar es de sólo lectura acá: el portal nunca mueve ni borra un evento de
 * Google. Las bajas vienen destildadas porque «no está en mi calendario» no
 * siempre es «se canceló»: puede ser una reunión a la que no te invitaron.
 * La lectura usa la cuenta de quien toca el botón, por eso la cobertura es la
 * de su agenda (JP está invitado a todos los seguimientos desde noviembre).
 */
export function SincronizarCalendar({ alCerrar }) {
  const bd = useBD();
  const activo = useRef(true);
  const [googleListo, setGoogleListo] = useState(false);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [diferencias, setDiferencias] = useState(null);
  const [elegidos, setElegidos] = useState(new Set());
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    activo.current = true;
    if (GOOGLE_CLIENT_ID) {
      prepararConexionGoogle().then(() => { if (activo.current) setGoogleListo(true); })
        .catch((e) => { if (activo.current) setError(e.message); });
    } else setError('La conexión con Google todavía no está configurada para este portal.');
    return () => { activo.current = false; };
  }, []);

  function revisar() {
    if (ocupado) return;
    // El popup tiene que abrirse en el clic, antes de cualquier espera.
    const solicitud = conectarGoogleCalendario();
    setError('');
    setResultado(null);
    setOcupado('Leyendo tu Google Calendar…');
    (async () => {
      const sesion = await solicitud;
      try {
        const hoy = hoyISO();
        const eventos = await sesion.reuniones('primary', hoy, moverFecha(hoy, DIAS_SINCRONIZADOS));
        if (!activo.current) return;
        const comparacion = compararConCalendar({
          eventos, seguimientos: bd?.seguimientos ?? [], areas: bd?.catalogos?.areas ?? [], hoy,
        });
        setCuenta(sesion.email);
        setDiferencias(comparacion);
        setElegidos(new Set([
          ...comparacion.reprogramar.map((r) => `r:${r.seguimiento.id}`),
          ...comparacion.agendar.map((a) => `a:${a.area}|${a.fecha}`),
        ]));
      } finally { sesion.cerrar(); }
    })()
      .catch((e) => { if (activo.current) setError(e.message); })
      .finally(() => { if (activo.current) setOcupado(''); });
  }

  const alternar = (clave) => setElegidos((previos) => {
    const nuevos = new Set(previos);
    if (nuevos.has(clave)) nuevos.delete(clave); else nuevos.add(clave);
    return nuevos;
  });

  async function aplicar() {
    if (ocupado || !diferencias) return;
    const tareas = [
      ...diferencias.reprogramar.filter((r) => elegidos.has(`r:${r.seguimiento.id}`)).map((r) => ({
        texto: `${sinPrefijo(r.area)}: ${cuando(r.fecha, r.hora)}`,
        hacer: () => acciones.actualizarSeguimiento(r.seguimiento.id, { fecha: r.fecha, hora: r.hora }),
      })),
      ...diferencias.agendar.filter((a) => elegidos.has(`a:${a.area}|${a.fecha}`)).map((a) => ({
        texto: `${sinPrefijo(a.area)}: ${cuando(a.fecha, a.hora)}`,
        hacer: () => acciones.crearSeguimiento(seguimientoDesdeCalendar(a)),
      })),
      ...diferencias.sinEvento.filter((s) => elegidos.has(`e:${s.seguimiento.id}`)).map((s) => ({
        texto: `${sinPrefijo(s.area)}: ${cuando(s.seguimiento.fecha, s.seguimiento.hora)}`,
        hacer: () => acciones.eliminarSeguimiento(s.seguimiento.id),
      })),
    ];
    setOcupado('Aplicando los cambios…');
    setError('');
    let hechos = 0;
    const fallidos = [];
    // De a uno: si uno falla, los demás igual se aplican y se dice cuál quedó.
    for (const tarea of tareas) {
      try { await tarea.hacer(); hechos += 1; }
      catch (e) { fallidos.push(`${tarea.texto} (${e?.message || 'error'})`); }
    }
    if (!activo.current) return;
    setResultado({ hechos, fallidos });
    setDiferencias(null);
    setOcupado('');
  }

  const cantidad = elegidos.size;
  const hayDiferencias = diferencias && (diferencias.reprogramar.length + diferencias.agendar.length + diferencias.sinEvento.length) > 0;

  let pie;
  if (diferencias && hayDiferencias) {
    pie = <>
      <Boton onClick={alCerrar} disabled={!!ocupado} className="min-h-11">Cancelar</Boton>
      <Boton variante="primario" icono={CalendarCheck} onClick={aplicar} disabled={!!ocupado || cantidad === 0} className="min-h-11">
        {ocupado || (cantidad === 1 ? 'Aplicar 1 cambio' : `Aplicar ${cantidad} cambios`)}
      </Boton>
    </>;
  } else {
    pie = <>
      <Boton onClick={alCerrar} disabled={!!ocupado} className="min-h-11">Cerrar</Boton>
      <Boton variante={diferencias || resultado ? 'secundario' : 'primario'} icono={RefreshCw} onClick={revisar} disabled={!googleListo || !!ocupado} className="min-h-11">
        {ocupado || (diferencias || resultado ? 'Revisar de nuevo' : 'Conectar y revisar')}
      </Boton>
    </>;
  }

  return (
    <Modal
      abierto
      alCerrar={() => { if (!ocupado) alCerrar(); }}
      ancho="md"
      titulo="Actualizar desde Google Calendar"
      descripcion="Compara los seguimientos agendados con tu Calendar y propone las correcciones."
      pie={pie}
    >
      <div className="flex flex-col gap-4" aria-busy={!!ocupado}>
        {!diferencias && !resultado && (
          <p className="text-sm leading-relaxed text-tinta">
            Se leen las reuniones con «seguimiento» en el título de los próximos {DIAS_SINCRONIZADOS} días en tu calendario
            principal. Google sólo da permiso de lectura: el portal no modifica ningún evento. Antes de cambiar algo, te muestra
            lo que encontró para que elijas qué aplicar.
          </p>
        )}

        {error && <div role="alert"><Aviso tono="error">{error}</Aviso></div>}

        {resultado && (
          <div role="status" className="flex flex-col gap-2">
            {resultado.hechos > 0 && (
              <Aviso titulo="Agenda actualizada">
                {resultado.hechos === 1 ? 'Se aplicó 1 cambio.' : `Se aplicaron ${resultado.hechos} cambios.`}
              </Aviso>
            )}
            {resultado.hechos === 0 && !resultado.fallidos.length && <Aviso>No se aplicó ningún cambio.</Aviso>}
            {resultado.fallidos.length > 0 && (
              <Aviso tono="error" titulo="Algunos cambios no se pudieron aplicar">
                <ul className="mt-1 list-disc pl-4">{resultado.fallidos.map((f) => <li key={f}>{f}</li>)}</ul>
                <p className="mt-1">Tocá «Revisar de nuevo» para reintentarlos.</p>
              </Aviso>
            )}
          </div>
        )}

        {diferencias && (
          <>
            <p className="text-xs text-gris">
              Calendar de <strong className="text-tinta">{cuenta || 'tu cuenta'}</strong>, del {fFecha(diferencias.desde)} al {fFecha(diferencias.hasta)}.
              {' '}{diferencias.coinciden.length === 1 ? '1 seguimiento coincide' : `${diferencias.coinciden.length} seguimientos coinciden`}.
            </p>

            {!hayDiferencias && (
              <div role="status"><Aviso titulo="Todo coincide">La agenda del portal está igual que tu Calendar. No hay nada para corregir.</Aviso></div>
            )}

            {diferencias.reprogramar.length > 0 && (
              <Grupo titulo="Cambiaron de fecha u hora" ayuda="Se actualiza la reunión del portal; conserva sus vínculos.">
                {diferencias.reprogramar.map((r) => (
                  <CampoCheck
                    key={r.seguimiento.id}
                    checked={elegidos.has(`r:${r.seguimiento.id}`)}
                    onChange={() => alternar(`r:${r.seguimiento.id}`)}
                    disabled={!!ocupado}
                    etiqueta={<span className="inline-flex flex-wrap items-center gap-1.5">
                      <strong>{sinPrefijo(r.area)}</strong>
                      <span className="text-gris line-through">{cuando(r.seguimiento.fecha, r.seguimiento.hora)}</span>
                      <ArrowRight size={13} aria-label="pasa a" />
                      <span>{cuando(r.fecha, r.hora)}</span>
                    </span>}
                    descripcion={<Titulo evento={r.evento} />}
                  />
                ))}
              </Grupo>
            )}

            {diferencias.agendar.length > 0 && (
              <Grupo titulo="Nuevos en Calendar" ayuda="No están agendados en el portal. Se agregan como seguimiento agendado.">
                {diferencias.agendar.map((a) => (
                  <CampoCheck
                    key={`${a.area}|${a.fecha}`}
                    checked={elegidos.has(`a:${a.area}|${a.fecha}`)}
                    onChange={() => alternar(`a:${a.area}|${a.fecha}`)}
                    disabled={!!ocupado}
                    etiqueta={<span><strong>{sinPrefijo(a.area)}</strong> · {cuando(a.fecha, a.hora)}</span>}
                    descripcion={<Titulo evento={a.evento} />}
                  />
                ))}
              </Grupo>
            )}

            {diferencias.sinEvento.length > 0 && (
              <Grupo
                titulo="Agendados sin evento en tu Calendar"
                ayuda="Pueden haberse cancelado, o ser reuniones a las que no estás invitado. Tildá sólo las que quieras eliminar del portal."
              >
                {diferencias.sinEvento.map((s) => (
                  <CampoCheck
                    key={s.seguimiento.id}
                    checked={elegidos.has(`e:${s.seguimiento.id}`)}
                    onChange={() => alternar(`e:${s.seguimiento.id}`)}
                    disabled={!!ocupado}
                    etiqueta={<span><strong>{sinPrefijo(s.area)}</strong> · {cuando(s.seguimiento.fecha, s.seguimiento.hora)}</span>}
                    descripcion="Eliminar del portal"
                  />
                ))}
              </Grupo>
            )}

            {diferencias.sinArea.length > 0 && (
              <details className="text-xs text-gris">
                <summary className="min-h-11 cursor-pointer py-2">
                  {diferencias.sinArea.length === 1
                    ? '1 reunión de Calendar no se pudo asociar a una secretaría'
                    : `${diferencias.sinArea.length} reuniones de Calendar no se pudieron asociar a una secretaría`}
                </summary>
                <p className="mb-1">El título no nombra una secretaría de forma única. Si alguna corresponde, agendala a mano.</p>
                <ul className="list-disc pl-4">
                  {diferencias.sinArea.map((e) => <li key={e.id}>{e.titulo || 'Sin título'} · {cuando(e.fecha, e.hora)}</li>)}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function Grupo({ titulo, ayuda, children }) {
  return (
    <fieldset className="flex flex-col gap-2.5 border-t border-borde pt-3">
      <legend className="pr-2 text-sm font-semibold text-tinta">{titulo}</legend>
      <p className="-mt-1 text-xs text-gris">{ayuda}</p>
      {children}
    </fieldset>
  );
}

function Titulo({ evento }) {
  if (!evento.enlace) return <>{evento.titulo}</>;
  return (
    <a href={evento.enlace} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
      {evento.titulo} <ExternalLink size={11} aria-hidden="true" />
      <span className="sr-only">(abre Calendar en otra pestaña)</span>
    </a>
  );
}
