import { useState } from 'react';
import { acciones, useBD } from '../estado/tienda.js';
import { usePerfil } from '../estado/sesion.js';
import { nombreResponsable, puedeGestionarCompromiso, responsablesEquipo } from '../datos/equipo.js';
import { CampoSelect } from './Campo.jsx';
import { Aviso, Boton } from './Basicos.jsx';

export function SelectorResponsable({ valor, alCambiar, requerido = true, disabled = false }) {
  const bd = useBD();
  const opciones = responsablesEquipo(bd).map((p) => ({ valor: p.id, titulo: p.nombre }));
  if (valor && !opciones.some((o) => o.valor === valor)) opciones.push({ valor, titulo: nombreResponsable(bd, valor) });
  return <CampoSelect etiqueta="Responsable en Coordinación" requerido={requerido}
    opciones={opciones} value={valor ?? ''} onChange={(e) => alCambiar(e.target.value)} disabled={disabled}
    ayuda={opciones.length ? undefined : 'Configurá los responsables en Configuración → Equipo.'} />;
}

/** La derivación se guarda sola; no exige inventar una novedad del compromiso. */
export function AsignarResponsable({ compromiso }) {
  const bd = useBD();
  const perfil = usePerfil();
  const [seleccion, setSeleccion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const valor = seleccion ?? compromiso.id_responsable ?? '';
  if (!puedeGestionarCompromiso(perfil, compromiso)) return <p className="text-sm text-gris">Responsable: {nombreResponsable(bd, compromiso.id_responsable)}</p>;
  async function guardar() {
    setGuardando(true); setError(''); setConfirmacion('');
    try {
      await acciones.asignarCompromiso(compromiso.id, valor);
      setSeleccion(null);
      setConfirmacion(`Asignado a ${nombreResponsable(bd, valor)}.`);
    } catch (e) { setError(e.message ?? 'No se pudo guardar la asignación.'); }
    finally { setGuardando(false); }
  }
  return <div className="my-3 rounded-card border border-borde bg-card p-3">
    <SelectorResponsable valor={valor} alCambiar={(v) => { setSeleccion(v); setConfirmacion(''); }} disabled={guardando} />
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-gris">Aparecerá en el seguimiento de esta persona.</p>
      <Boton tamanio="sm" className="min-h-11" onClick={guardar}
        disabled={guardando || !valor || valor === compromiso.id_responsable}>
        {guardando ? 'Asignando…' : compromiso.id_responsable ? 'Derivar compromiso' : 'Asignar compromiso'}
      </Boton>
    </div>
    {error && <Aviso tono="error">{error}</Aviso>}
    {confirmacion && <p role="status" className="mt-2 text-xs text-gris">{confirmacion}</p>}
  </div>;
}
