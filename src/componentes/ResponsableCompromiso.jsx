/**
 * ─────────────────────────────────────────────────────────────────────
 * RESPONSABLE DE UN COMPROMISO — selector de alta y panel de derivación.
 *
 * Son dos piezas porque son dos momentos distintos: `SelectorResponsable`
 * es un campo más del formulario de alta, y `AsignarResponsable` es el
 * control que aparece en la ficha de un compromiso que ya existe.
 *
 * Van juntas en un archivo para que la ficha se vea igual en Seguimiento,
 * Monitoreo, Mesas y Mi trabajo. Antes de esto no había dónde ponerlo: el
 * compromiso tenía área y plazo pero no dueño.
 *
 * Lo que se ve acá es cortesía visual, no autorización: quien manda es la
 * policy `responsable actualiza su compromiso` de 0037. Si esto y la base
 * discrepan, la base rechaza y el panel muestra el error.
 * ─────────────────────────────────────────────────────────────────────
 */
import { useState } from 'react';
import { acciones, useBD } from '../estado/tienda.js';
import { usePerfil } from '../estado/sesion.js';
import { nombreResponsable, puedeGestionarCompromiso, responsablesEquipo } from '../datos/equipo.js';
import { CampoSelect } from './Campo.jsx';
import { Aviso, Boton } from './Basicos.jsx';

/**
 * `requerido` se deduce del padrón en vez de estar fijo: mientras no haya
 * nadie habilitado el compromiso se puede cargar sin responsable —es lo que
 * deja seguir trabajando con los 137 que ya están cargados sin dueño— y marcar
 * como obligatorio un campo sin una sola opción no dejaría avanzar. Quien
 * decide de verdad es `validarResponsable()`, que espeja el trigger; acá sólo
 * se dibuja el asterisco.
 */
export function SelectorResponsable({ valor, alCambiar, requerido, disabled = false }) {
  const bd = useBD();
  const opciones = responsablesEquipo(bd).map((p) => ({ valor: p.id, titulo: p.nombre }));
  // Si el compromiso ya apunta a alguien que salió del padrón, su nombre se
  // agrega igual: sin esto el desplegable aparecería vacío y guardar lo
  // reasignaría en silencio a otra persona.
  if (valor && !opciones.some((o) => o.valor === valor)) {
    opciones.push({ valor, titulo: nombreResponsable(bd, valor) });
  }
  return (
    <CampoSelect
      etiqueta="Responsable en Coordinación"
      requerido={requerido ?? opciones.length > 0}
      opciones={opciones}
      value={valor ?? ''}
      onChange={(e) => alCambiar(e.target.value)}
      disabled={disabled}
      ayuda={opciones.length ? undefined : 'Configurá los responsables en Configuración → Equipo.'}
    />
  );
}

/**
 * Derivar se guarda solo y no pide escribir una novedad: pasarle algo a otra
 * persona no es un avance del compromiso, y obligar a redactar algo llevaba
 * a llenar el historial con «se deriva».
 */
export function AsignarResponsable({ compromiso }) {
  const bd = useBD();
  const perfil = usePerfil();
  const [seleccion, setSeleccion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmacion, setConfirmacion] = useState('');

  if (!puedeGestionarCompromiso(perfil, compromiso)) {
    return (
      <p className="text-sm text-gris">
        Responsable: {nombreResponsable(bd, compromiso.id_responsable)}
      </p>
    );
  }

  const valor = seleccion ?? compromiso.id_responsable ?? '';
  const yaEs = valor === compromiso.id_responsable;

  async function guardar() {
    setGuardando(true);
    setError('');
    setConfirmacion('');
    try {
      await acciones.asignarCompromiso(compromiso.id, valor);
      setSeleccion(null);
      setConfirmacion(`Queda a cargo de ${nombreResponsable(bd, valor)}.`);
    } catch (e) {
      setError(e.message ?? 'No se pudo guardar la asignación.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="my-3 rounded-card border border-borde bg-card p-3">
      <SelectorResponsable
        valor={valor}
        alCambiar={(v) => { setSeleccion(v); setConfirmacion(''); setError(''); }}
        disabled={guardando}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gris">Va a aparecer en Mi trabajo de esa persona.</p>
        <Boton
          tamanio="sm"
          className="min-h-11"
          onClick={guardar}
          disabled={guardando || !valor || yaEs}
        >
          {guardando
            ? 'Guardando…'
            : compromiso.id_responsable ? 'Derivar compromiso' : 'Asignar compromiso'}
        </Boton>
      </div>
      {error && <Aviso tono="error">{error}</Aviso>}
      {confirmacion && <p role="status" className="mt-2 text-xs text-gris">{confirmacion}</p>}
    </div>
  );
}
