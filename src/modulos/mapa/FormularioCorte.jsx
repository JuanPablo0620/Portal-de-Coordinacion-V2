/**
 * ─────────────────────────────────────────────────────────────────────
 * DATOS DEL CORTE — el segundo paso de la carga.
 *
 * El primero es elegir las calles con el cursor sobre el mapa (ver
 * `PanelSeleccion` en Mapa.jsx). Acá ya no se dibuja nada: llegan las cuadras
 * elegidas, agrupadas por calle y con sus esquinas resueltas contra el
 * callejero oficial, y sólo falta decir POR QUÉ se corta y CUÁNDO.
 *
 * Esos dos son los campos que el módulo necesita de verdad. Todo lo demás
 * —alcance, área que lo pide, evento, observaciones— es opcional y está abajo,
 * porque un corte que se carga a las apuradas con motivo y horario ya sirve.
 * ─────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState } from 'react';
import { MapPin, Pencil, Trash2 } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton, Chip } from '../../componentes/Basicos.jsx';
import {
  CampoArea,
  CampoCheck,
  CampoFecha,
  CampoHora,
  CampoSelect,
  CampoTexto,
  GrillaCampos,
} from '../../componentes/Campo.jsx';
import { MapaLeaflet } from '../../componentes/MapaLeaflet.jsx';
import { ALCANCES_CORTE, MOTIVOS_CORTE } from '../../datos/catalogos.js';
import {
  DIA_CORTO,
  TEXTO_ALCANCE,
  TEXTO_MOTIVO,
  descripcionTramo,
  lineasDeCorte,
  tramosDe,
} from '../../datos/cortes.js';
import { hoyISO } from '../../datos/tiempo.js';
import { acciones, useBD } from '../../estado/tienda.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { datosDeSeleccion } from './seleccionCuadras.js';

const vacio = (hoy) => ({
  alcance: 'total',
  motivo: 'evento',
  detalle_motivo: '',
  area_solicitante: '',
  id_evento: '',
  vigencia_desde: hoy,
  vigencia_hasta: hoy,
  hora_desde: '',
  hora_hasta: '',
  dias_semana: [],
  fechas_excluidas: [],
  observaciones: '',
  estado: 'previsto',
});

/**
 * @param {object} seleccion  `{ cuadras, tramos }` recién elegidos en el mapa.
 * @param {object} corte      corte existente, cuando se está editando.
 */
export function FormularioCorte({ abierto, alCerrar, corte, seleccion, alVolverAElegir, eventoInicial = '' }) {
  const bd = useBD();
  const hoy = hoyISO();
  const esEdicion = Boolean(corte);
  const [datos, setDatos] = useState(() =>
    corte ? { ...vacio(hoy), ...corte } : { ...vacio(hoy), id_evento: eventoInicial },
  );
  // Los tramos se pueden podar acá (quitar una calle que sobró) sin volver al
  // mapa, que es la corrección más frecuente.
  // `tramosDe` y no `corte.tramos`: un corte cargado antes de la selección por
  // cuadras guarda su única calle en campos sueltos y hay que mostrarla igual.
  const [tramos, setTramos] = useState(() => seleccion?.tramos ?? tramosDe(corte));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const opcionesArea = useOpciones('areas');
  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  /** Las cuadras que siguen en juego después de podar tramos. */
  const cuadras = useMemo(() => {
    const todas = seleccion?.cuadras ?? corte?.cuadras ?? [];
    const vigentes = new Set(tramos.flatMap((t) => t.fids ?? []));
    // Un corte viejo puede no tener `fids`: ahí no hay nada que filtrar.
    return vigentes.size ? todas.filter((c) => vigentes.has(c.fid)) : todas;
  }, [seleccion, corte, tramos]);

  const formas = useMemo(() => {
    const conLineas = tramos.filter((t) => t.lineas?.length);
    // Un corte viejo no tiene la geometría partida por tramo, sólo entera.
    if (!conLineas.length && corte) {
      return [{ id: 'corte', tipo: 'linea', puntos: lineasDeCorte(corte), clase: 'corte-acento' }];
    }
    return conLineas.map((t, i) => ({
      id: `tramo:${i}`,
      tipo: 'linea',
      puntos: t.lineas,
      clase: 'corte-acento',
      titulo: descripcionTramo(t),
    }));
  }, [tramos, corte]);

  const encuadre = useMemo(() => formas.flatMap((f) => (f.puntos ?? []).flat()), [formas]);

  const eventos = useMemo(
    () =>
      (bd?.eventos ?? [])
        .filter((e) => e.activo !== false)
        .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
        .slice(0, 60)
        .map((e) => ({ valor: e.id, titulo: `${e.fecha ?? 's/f'} — ${e.nombre}` })),
    [bd],
  );

  const repite = datos.dias_semana?.length > 0;

  async function guardar() {
    if (!tramos.length) return setError('No quedó ninguna calle seleccionada.');
    if (!datos.vigencia_desde) return setError('La fecha de inicio es obligatoria.');
    if (datos.vigencia_hasta && datos.vigencia_hasta < datos.vigencia_desde) {
      return setError('La fecha de fin no puede ser anterior a la de inicio.');
    }
    if (datos.hora_desde && datos.hora_hasta && datos.hora_hasta <= datos.hora_desde) {
      return setError(
        'La hora de fin tiene que ser posterior a la de inicio. Un corte que cruza la medianoche se carga como dos.',
      );
    }

    setError('');
    setGuardando(true);
    try {
      // Sin cuadras no hay geometría que recalcular: es un corte viejo que se
      // está editando sólo en sus datos, y pisarle la geometría con una vacía
      // lo borraría del mapa.
      const geometria = cuadras.length ? datosDeSeleccion(cuadras, tramos) : { tramos };
      const payload = { ...datos, ...geometria };
      if (esEdicion) await acciones.actualizarCorte(corte.id, payload);
      else await acciones.crearCorte(payload);
      alCerrar();
    } catch (e) {
      // Habia un try sin catch: si la base rechazaba el corte, el error se
      // perdia y el modal quedaba abierto sin decir nada, como si el boton no
      // hubiera hecho nada. Quien lo cargaba se iba pensando que quedo.
      setError(e?.message ?? 'No se pudo guardar el corte. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="xl"
      titulo={esEdicion ? 'Editar corte de calle' : 'Datos del corte'}
      descripcion="Las calles ya están elegidas. Falta por qué se corta y por cuánto tiempo."
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={guardar} disabled={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Cargar corte'}
          </Boton>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* ── Calles seleccionadas ──────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-tinta">Calles seleccionadas</h3>
            {/* Un corte viejo no tiene cuadras contadas: mejor no decir «0». */}
            {cuadras.length > 0 && (
              <Chip tono="enregla">
                {cuadras.length} cuadra{cuadras.length === 1 ? '' : 's'}
              </Chip>
            )}
          </div>

          {tramos.length === 0 ? (
            <Aviso tono="error">Quitaste todas las calles. Volvé al mapa para elegir de nuevo.</Aviso>
          ) : (
            <ul className="flex flex-col rounded-chip border border-borde">
              {tramos.map((t, i) => (
                <li
                  key={`${t.calle}-${i}`}
                  className="flex items-start gap-2 border-b border-borde/60 px-3 py-2 last:border-0"
                >
                  <MapPin size={14} className="mt-0.5 shrink-0 text-acento" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-tight text-tinta">{descripcionTramo(t)}</span>
                    <span className="text-[11px] text-tenue">
                      {t.fids?.length ? `${t.fids.length} cuadra${t.fids.length === 1 ? '' : 's'}` : ''}
                      {t.fids?.length && t.localidad ? ' · ' : ''}
                      {t.localidad ?? ''}
                      {t.sentido ? ` · sentido ${t.sentido.replace(/^\d+\.\s*/, '').toLowerCase()}` : ''}
                    </span>
                  </span>
                  {tramos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTramos((lista) => lista.filter((_, j) => j !== i))}
                      className="shrink-0 rounded p-1 text-tenue transition hover:bg-vencido-suave hover:text-vencido-texto"
                      aria-label={`Quitar ${descripcionTramo(t)}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {alVolverAElegir && (
            <Boton icono={Pencil} onClick={alVolverAElegir}>
              Volver a elegir calles
            </Boton>
          )}

          <MapaLeaflet formas={formas} encuadrar={encuadre} alto={230} />
        </div>

        {/* ── Motivo y tiempo ───────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <fieldset className="rounded-chip border border-borde p-3">
            <legend className="px-1 text-xs font-semibold text-gris">Motivo del corte</legend>
            <div className="flex flex-col gap-3">
              <GrillaCampos columnas={2}>
                <CampoSelect
                  etiqueta="Por qué se corta"
                  opciones={MOTIVOS_CORTE.map((m) => ({ valor: m, titulo: TEXTO_MOTIVO[m] }))}
                  value={datos.motivo}
                  onChange={cambiar('motivo')}
                  placeholder=""
                />
                <CampoSelect
                  etiqueta="Alcance"
                  opciones={ALCANCES_CORTE.map((a) => ({ valor: a, titulo: TEXTO_ALCANCE[a] }))}
                  value={datos.alcance}
                  onChange={cambiar('alcance')}
                  placeholder=""
                />
              </GrillaCampos>
              <CampoTexto
                etiqueta="Detalle"
                ayuda="lo que va a leer el área a la que se le avisa"
                value={datos.detalle_motivo ?? ''}
                onChange={cambiar('detalle_motivo')}
                placeholder="Ej.: feria de emprendedores"
              />
              <GrillaCampos columnas={2}>
                <CampoSelect
                  etiqueta="Área solicitante"
                  opciones={opcionesArea}
                  value={datos.area_solicitante ?? ''}
                  onChange={cambiar('area_solicitante')}
                />
                <CampoSelect
                  etiqueta="Evento vinculado"
                  ayuda="opcional"
                  opciones={eventos}
                  value={datos.id_evento ?? ''}
                  onChange={cambiar('id_evento')}
                />
              </GrillaCampos>
            </div>
          </fieldset>

          <fieldset className="rounded-chip border border-borde p-3">
            <legend className="px-1 text-xs font-semibold text-gris">Tiempo</legend>
            <div className="flex flex-col gap-3">
              <GrillaCampos columnas={2}>
                <CampoFecha
                  etiqueta="Desde"
                  requerido
                  value={datos.vigencia_desde}
                  onChange={cambiar('vigencia_desde')}
                />
                <CampoFecha
                  etiqueta="Hasta"
                  ayuda={datos.vigencia_hasta ? '' : 'sin fecha de levantamiento'}
                  value={datos.vigencia_hasta ?? ''}
                  onChange={cambiar('vigencia_hasta')}
                />
              </GrillaCampos>
              <GrillaCampos columnas={2}>
                <CampoHora etiqueta="Hora de inicio" value={datos.hora_desde} onChange={cambiar('hora_desde')} />
                <CampoHora etiqueta="Hora de fin" value={datos.hora_hasta} onChange={cambiar('hora_hasta')} />
              </GrillaCampos>

              <CampoCheck
                etiqueta="Se repite todas las semanas"
                descripcion="Para ferias y operativos fijos: se carga una vez y aparece cada semana."
                checked={repite}
                onChange={(e) =>
                  setDatos((d) => ({ ...d, dias_semana: e.target.checked ? [new Date().getDay()] : [] }))
                }
              />
              {repite && (
                <SelectorDias
                  valor={datos.dias_semana}
                  alCambiar={(dias) => setDatos((d) => ({ ...d, dias_semana: dias }))}
                />
              )}
            </div>
          </fieldset>

          <CampoArea
            etiqueta="Observaciones"
            filas={3}
            value={datos.observaciones ?? ''}
            onChange={cambiar('observaciones')}
            placeholder="Lo que haga falta aclarar en el aviso a las áreas."
          />

          {error && <Aviso tono="error">{error}</Aviso>}
        </div>
      </div>
    </Modal>
  );
}

function SelectorDias({ valor = [], alCambiar }) {
  const alternar = (dia) =>
    alCambiar(valor.includes(dia) ? valor.filter((d) => d !== dia) : [...valor, dia].sort());
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Días de la semana en que se repite">
      {DIA_CORTO.map((titulo, dia) => (
        <button
          key={dia}
          type="button"
          onClick={() => alternar(dia)}
          aria-pressed={valor.includes(dia)}
          className={`h-8 w-10 rounded-chip border text-xs font-medium transition ${
            valor.includes(dia)
              ? 'border-acento bg-acento-suave text-acento-fuerte'
              : 'border-borde text-gris hover:text-tinta'
          }`}
        >
          {titulo}
        </button>
      ))}
    </div>
  );
}
