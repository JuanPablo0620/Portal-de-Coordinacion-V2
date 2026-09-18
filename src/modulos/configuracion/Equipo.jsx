import { useState } from 'react';
import { acciones, useBD } from '../../estado/tienda.js';
import { usePerfil } from '../../estado/sesion.js';
import { puedeEditarEquipo } from '../../datos/equipo.js';
import { Aviso, Boton, Tarjeta } from '../../componentes/Basicos.jsx';
import { CampoCheck } from '../../componentes/Campo.jsx';

/** Se configuran capacidades de cuentas existentes, nunca nombres en código. */
export function Equipo() {
  const bd = useBD();
  const perfil = usePerfil();
  if (!puedeEditarEquipo(perfil)) return null;
  return <Tarjeta titulo="Equipo" descripcion="Tener usuario no implica recibir compromisos. Habilitá a quienes correspondan y elegí quién prepara Secretaría.">
    {!bd?.equipo?.length && <Aviso tono="info">Todavía no está disponible la configuración del equipo.</Aviso>}
    <div className="grid gap-3 md:grid-cols-2">
      {(bd?.equipo ?? []).filter((p) => p.activo).map((p) => <Integrante key={`${p.id}-${p.recibe_compromisos}-${p.organiza_secretaria}`} persona={p} />)}
    </div>
  </Tarjeta>;
}

function Integrante({ persona }) {
  const [datos, setDatos] = useState({ recibe_compromisos: persona.recibe_compromisos, organiza_secretaria: persona.organiza_secretaria });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const cambiado = datos.recibe_compromisos !== persona.recibe_compromisos || datos.organiza_secretaria !== persona.organiza_secretaria;
  async function guardar() {
    setGuardando(true); setError('');
    try { await acciones.configurarIntegrante(persona.id, datos); }
    catch (e) { setError(e.message ?? 'No se pudo guardar.'); }
    finally { setGuardando(false); }
  }
  return <div className="rounded-card border border-borde p-3">
    <h3 className="mb-2 font-semibold text-tinta">{persona.nombre}</h3>
    <CampoCheck etiqueta="Puede recibir compromisos" checked={datos.recibe_compromisos} disabled={guardando}
      onChange={(e) => setDatos({ ...datos, recibe_compromisos: e.target.checked })} />
    <CampoCheck etiqueta="Prepara el temario de Secretaría" checked={datos.organiza_secretaria} disabled={guardando}
      onChange={(e) => setDatos({ ...datos, organiza_secretaria: e.target.checked })} />
    <Boton className="mt-2 min-h-11" tamanio="sm" disabled={guardando || !cambiado} onClick={guardar}>
      {guardando ? 'Guardando…' : 'Guardar permisos de equipo'}
    </Boton>
    {error && <Aviso tono="error">{error}</Aviso>}
  </div>;
}
