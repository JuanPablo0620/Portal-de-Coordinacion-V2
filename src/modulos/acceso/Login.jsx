/**
 * Pantalla de ingreso.
 *
 * Es la primera pantalla que ve cualquiera: hasta que no haya sesión, el
 * portal no muestra ningún dato. Antes de esto, `config.usuario` era un campo
 * de texto libre en Configuración y no verificaba nada.
 */
import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { Aviso, Boton } from '../../componentes/Basicos.jsx';
import { CampoTexto } from '../../componentes/Campo.jsx';
import { useSesion } from '../../estado/sesion.js';
import logo3f from '../../assets/logo-3f.png';

export default function Login() {
  const entrar = useSesion((e) => e.entrar);
  const errorSesion = useSesion((e) => e.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(evento) {
    // Es un <form> de verdad, no un div con un botón: así funciona el Enter
    // desde cualquiera de los dos campos y el navegador puede ofrecer las
    // credenciales guardadas.
    evento.preventDefault();
    if (enviando) return;

    setError(null);
    setEnviando(true);
    const mensaje = await entrar(email, password);
    setEnviando(false);
    if (mensaje) setError(mensaje);
  }

  return (
    <div className="grid min-h-full place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={logo3f} alt="" className="h-14 w-14 rounded-chip" />
          <div>
            <h1 className="text-lg font-semibold text-tinta">Portal de Coordinación</h1>
            <p className="text-xs text-gris">Municipalidad de Tres de Febrero</p>
          </div>
        </div>

        <form
          onSubmit={alEnviar}
          className="flex flex-col gap-4 rounded-chip border border-borde bg-card p-5"
        >
          <CampoTexto
            etiqueta="Mail"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <CampoTexto
            etiqueta="Contraseña"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {/* El error de configuración viene del store y es distinto del de
              credenciales: uno lo arregla un administrador, el otro el usuario. */}
          {errorSesion && <Aviso tono="error">{errorSesion}</Aviso>}
          {error && <Aviso tono="error">{error}</Aviso>}

          <Boton
            variante="primario"
            type="submit"
            icono={LogIn}
            disabled={enviando || !email || !password}
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </Boton>

          <p className="text-center text-xs leading-relaxed text-tenue">
            Si no podés entrar o no recordás tu contraseña, escribile a alguien
            del equipo de Control de Gestión: el portal todavía no envía mails
            de recuperación.
          </p>
        </form>
      </div>
    </div>
  );
}
