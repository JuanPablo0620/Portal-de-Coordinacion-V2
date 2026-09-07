/**
 * Sesión del portal — quién está usando el sistema, de verdad.
 *
 * Hasta hoy el portal no tenía login: `config.usuario` era un campo de texto
 * libre y cualquiera escribía el nombre que quisiera, así que la bitácora no
 * registraba nada verificable. Este módulo lo reemplaza por la sesión real de
 * Supabase Auth, y expone el perfil (nombre, rol) para que el resto del
 * sistema lo consulte.
 *
 * FALLA CERRADA, a propósito: si Supabase no está configurado, esto NO deja
 * pasar a nadie. La tentación es que, sin configuración, el portal vuelva al
 * comportamiento viejo sin login — y sería un error grave: bastaría con que se
 * borre una variable de entorno en Vercel para que producción quedara abierta
 * sin que nadie se entere. Es preferible que el portal no arranque.
 *
 * El almacenamiento de datos sigue siendo el del navegador mientras no se migre
 * el sistema entero (ver `supabaseClient.js`). Esto es solo la identidad.
 */
import { create } from 'zustand';
import { supabase, supabaseConfigurado } from '../datos/supabaseClient.js';

/** Columnas del perfil que le interesan al front. */
const CAMPOS_PERFIL = 'id, nombre, email, rol, area_id, activo, debe_cambiar_password';

export const useSesion = create((set, get) => ({
  /** true hasta que se resolvió si hay sesión o no. Evita el parpadeo del login. */
  cargando: true,
  /** Sesión de Supabase Auth, o null. */
  sesion: null,
  /** Fila de `perfiles` del usuario logueado, o null. */
  perfil: null,
  /** Mensaje para mostrar en pantalla. No es para errores de programación. */
  error: null,

  /**
   * Arranca la sesión y queda escuchando los cambios.
   *
   * `onAuthStateChange` cubre lo que `getSession` no: el token se renueva solo
   * cada tanto, y si el usuario cierra sesión en otra pestaña hay que enterarse.
   */
  async iniciar() {
    if (!supabaseConfigurado) {
      set({
        cargando: false,
        error:
          'El portal no está conectado a Supabase — faltan VITE_SUPABASE_URL / ' +
          'VITE_SUPABASE_ANON_KEY. Sin esa conexión no se puede verificar la ' +
          'identidad de nadie, así que el acceso queda cerrado.',
      });
      return;
    }

    const { data } = await supabase.auth.getSession();
    await get().aplicarSesion(data.session);

    supabase.auth.onAuthStateChange((_evento, sesion) => {
      get().aplicarSesion(sesion);
    });
  },

  /**
   * Traduce una sesión de Auth a un estado utilizable: sin perfil no hay
   * acceso, aunque el login de Supabase haya sido correcto.
   *
   * Eso puede pasar si a alguien se le sacó la fila de `usuarios_autorizados`
   * y después el perfil: la cuenta sigue existiendo en `auth.users` y su
   * contraseña sigue siendo válida, pero ya no le corresponde entrar.
   */
  async aplicarSesion(sesion) {
    if (!sesion) {
      set({ sesion: null, perfil: null, cargando: false });
      return;
    }

    const { data: perfil, error } = await supabase
      .from('perfiles')
      .select(CAMPOS_PERFIL)
      .eq('id', sesion.user.id)
      .maybeSingle();

    if (error) {
      set({
        sesion: null,
        perfil: null,
        cargando: false,
        error: `No se pudo leer el perfil: ${error.message}`,
      });
      await supabase.auth.signOut();
      return;
    }

    if (!perfil || !perfil.activo) {
      set({
        sesion: null,
        perfil: null,
        cargando: false,
        error: perfil
          ? 'Tu usuario está dado de baja. Pedile a un administrador que lo reactive.'
          : 'Tu cuenta no tiene un perfil asignado en el portal. Pedile a un administrador que te dé de alta.',
      });
      await supabase.auth.signOut();
      return;
    }

    set({ sesion, perfil, cargando: false, error: null });
  },

  /** Devuelve un mensaje de error, o null si entró bien. */
  async entrar(email, password) {
    if (!supabaseConfigurado) return 'El portal no está conectado a Supabase.';

    set({ error: null });
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    // El mensaje de Supabase es genérico a propósito — no distingue entre
    // "ese mail no existe" y "la contraseña está mal", para no confirmarle a
    // un desconocido qué direcciones tienen cuenta. Se traduce, no se detalla.
    if (error) {
      return error.message === 'Invalid login credentials'
        ? 'Mail o contraseña incorrectos.'
        : error.message;
    }
    return null;
  },

  async salir() {
    await supabase.auth.signOut();
    set({ sesion: null, perfil: null, error: null });
  },

  /**
   * Cambia la contraseña y baja la marca de "todavía usa la inicial".
   *
   * Son dos pasos contra dos sistemas distintos: la contraseña vive en
   * `auth.users`, que administra Supabase, y la marca en `perfiles`, que es
   * nuestra. El orden importa — si se bajara la marca primero y después
   * fallara el cambio, la persona se quedaría con la contraseña repartida a
   * mano y sin que el portal se lo vuelva a pedir.
   */
  async cambiarPassword(nueva) {
    const { error } = await supabase.auth.updateUser({ password: nueva });
    if (error) return error.message;

    const { error: errorMarca } = await supabase.rpc('marcar_password_cambiada');
    if (errorMarca) return `Se cambió la contraseña, pero quedó pendiente registrarlo: ${errorMarca.message}`;

    set((e) => ({ perfil: { ...e.perfil, debe_cambiar_password: false } }));
    return null;
  },
}));

export const usePerfil = () => useSesion((e) => e.perfil);
export const useHaySesion = () => useSesion((e) => Boolean(e.sesion && e.perfil));
export const useRol = () => useSesion((e) => e.perfil?.rol ?? null);

/**
 * Permisos derivados del rol. Es la contracara en el front de las políticas de
 * `0003_rls.sql` — sirve para no mostrar botones que la base va a rechazar,
 * NO para proteger nada. La autorización real está en la base; esto es
 * cortesía visual. Cualquier chequeo que solo viva acá es decorativo, porque
 * el usuario controla el navegador.
 */
export const puedeEscribir = (rol) => rol === 'admin' || rol === 'coordinacion';
export const puedeMarcarEstrategico = (rol) => puedeEscribir(rol) || rol === 'jefe_gabinete';
