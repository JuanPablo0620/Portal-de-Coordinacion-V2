/**
 * Cambio de contraseña obligatorio en el primer ingreso.
 *
 * Las nueve cuentas se dieron de alta con una contraseña generada y repartida
 * a mano. Mientras `perfiles.debe_cambiar_password` siga en true, esta pantalla
 * es lo único que se ve: no hay menú, no hay forma de saltearla desde la
 * interfaz.
 *
 * Es una barrera de portal, no de base de datos — alguien que hable directo
 * con la API podría seguir usando la contraseña inicial. Eso está bien: el
 * objetivo no es contener a un atacante que ya tiene la credencial, es que la
 * contraseña repartida a mano deje de circular.
 */
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Aviso, Boton } from '../../componentes/Basicos.jsx';
import { CampoTexto } from '../../componentes/Campo.jsx';
import { useSesion } from '../../estado/sesion.js';

/** Mínimo de Supabase por defecto. Más abajo, la propia API la rechaza. */
const LARGO_MINIMO = 8;

export default function CambiarPassword() {
  const perfil = useSesion((e) => e.perfil);
  const cambiarPassword = useSesion((e) => e.cambiarPassword);
  const salir = useSesion((e) => e.salir);

  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const corta = nueva.length > 0 && nueva.length < LARGO_MINIMO;
  const noCoincide = repetida.length > 0 && nueva !== repetida;
  const valido = nueva.length >= LARGO_MINIMO && nueva === repetida;

  async function alEnviar(evento) {
    evento.preventDefault();
    if (enviando || !valido) return;

    setError(null);
    setEnviando(true);
    const mensaje = await cambiarPassword(nueva);
    setEnviando(false);
    if (mensaje) setError(mensaje);
    // Si salió bien no se navega a ningún lado: al bajar la marca en el store,
    // la guarda de App.jsx deja de mostrar esta pantalla y aparece el portal.
  }

  return (
    <div className="grid min-h-full place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-tinta">Elegí tu contraseña</h1>
          <p className="mt-1 text-xs leading-relaxed text-gris">
            Hola {perfil?.nombre}. Estás usando la contraseña inicial que te
            entregaron. Antes de entrar al portal, elegí una propia.
          </p>
        </div>

        <form
          onSubmit={alEnviar}
          className="flex flex-col gap-4 rounded-chip border border-borde bg-card p-5"
        >
          <CampoTexto
            etiqueta="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            required
            ayuda={`Al menos ${LARGO_MINIMO} caracteres.`}
            error={corta ? `Tiene que tener al menos ${LARGO_MINIMO} caracteres.` : null}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
          />

          <CampoTexto
            etiqueta="Repetila"
            type="password"
            autoComplete="new-password"
            required
            error={noCoincide ? 'Las dos contraseñas no coinciden.' : null}
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
          />

          {error && <Aviso tono="error">{error}</Aviso>}

          <Boton variante="primario" type="submit" icono={KeyRound} disabled={enviando || !valido}>
            {enviando ? 'Guardando…' : 'Guardar y entrar'}
          </Boton>

          <Boton variante="fantasma" tamanio="sm" onClick={salir}>
            Salir
          </Boton>
        </form>
      </div>
    </div>
  );
}
