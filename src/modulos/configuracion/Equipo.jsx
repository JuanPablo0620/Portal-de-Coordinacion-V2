/**
 * El padrón: quién puede recibir compromisos.
 *
 * Se configuran capacidades de cuentas que ya existen, nunca nombres escritos
 * en el código — este repositorio es público y las identidades reales viven
 * en `supabase/datos/usuarios-autorizados.local.sql`, que no se versiona.
 *
 * Arranca vacío, y mientras lo esté el portal se comporta como hasta hoy: los
 * compromisos se pueden cargar sin responsable. Eso es lo que permite convivir
 * con los 137 que ya están cargados sin dueño.
 *
 * Habilitar a la primera persona es lo que ENCIENDE el circuito: desde ese
 * momento todo compromiso nuevo exige responsable (regla (c) del trigger de
 * 0037). No es una preferencia, es el interruptor.
 */
import { useState } from 'react';
import { acciones, useBD } from '../../estado/tienda.js';
import { usePerfil } from '../../estado/sesion.js';
import { puedeEditarEquipo } from '../../datos/equipo.js';
import { Aviso, Boton, Tarjeta } from '../../componentes/Basicos.jsx';
import { CampoCheck } from '../../componentes/Campo.jsx';

export function SeccionEquipo() {
  const bd = useBD();
  const perfil = usePerfil();
  if (!puedeEditarEquipo(perfil)) return null;

  const integrantes = (bd?.equipo ?? []).filter((p) => p.activo);
  const habilitados = integrantes.filter((p) => p.recibe_compromisos).length;

  return (
    <Tarjeta
      titulo="Equipo"
      descripcion="Tener usuario no implica recibir compromisos. Habilitá a quienes se hagan cargo de impulsarlos."
    >
      {!integrantes.length && (
        <Aviso tono="info">Todavía no está disponible la configuración del equipo.</Aviso>
      )}
      {integrantes.length > 0 && habilitados === 0 && (
        <Aviso tono="alerta" titulo="Nadie habilitado todavía">
          Mientras el padrón esté vacío, los compromisos se siguen cargando sin responsable,
          como hasta ahora. Apenas habilites a la primera persona, el alta va a pedirlo siempre.
        </Aviso>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {integrantes.map((p) => (
          <Integrante key={`${p.id}-${p.recibe_compromisos}`} persona={p} />
        ))}
      </div>
    </Tarjeta>
  );
}

function Integrante({ persona }) {
  const [recibe, setRecibe] = useState(persona.recibe_compromisos);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const cambiado = recibe !== persona.recibe_compromisos;

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      await acciones.configurarIntegrante(persona.id, { recibe_compromisos: recibe });
    } catch (e) {
      setError(e.message ?? 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-card border border-borde p-3">
      <h3 className="mb-2 font-semibold text-tinta">{persona.nombre}</h3>
      <CampoCheck
        etiqueta="Puede recibir compromisos"
        checked={recibe}
        disabled={guardando}
        onChange={(e) => setRecibe(e.target.checked)}
      />
      <Boton className="mt-2 min-h-11" tamanio="sm" disabled={guardando || !cambiado} onClick={guardar}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </Boton>
      {error && <Aviso tono="error">{error}</Aviso>}
    </div>
  );
}
