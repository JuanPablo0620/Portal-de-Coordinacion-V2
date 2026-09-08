/**
 * Doble de la sesión, sólo para la prueba de humo.
 *
 * Existe por dos motivos, y el segundo es el importante:
 *
 *  1. El mismo problema que `tienda-doble.js`: Zustand entrega el estado
 *     INICIAL al renderizar en Node, así que nada de lo que se inyecte desde
 *     afuera llegaría a los componentes.
 *
 *  2. `src/estado/sesion.js` habla con Supabase por red. En la prueba no hay
 *     ni credenciales ni conexión, así que la sesión real siempre daría "no
 *     configurado" y App.jsx devolvería la pantalla de login para TODAS las
 *     rutas. La prueba de humo dejaría de probar el portal y pasaría a probar
 *     nueve veces el mismo formulario de ingreso, sin que nadie lo note.
 *
 * Por eso el doble reporta una sesión válida de un usuario `admin` con la
 * contraseña ya cambiada: es el estado en el que el portal se ve entero.
 */
const PERFIL = {
  id: '00000000-0000-0000-0000-000000000000',
  nombre: 'Coordinación',
  email: 'humo@example.test',
  rol: 'admin',
  area_id: null,
  activo: true,
  debe_cambiar_password: false,
};

const ESTADO = {
  cargando: false,
  sesion: { user: { id: PERFIL.id } },
  perfil: PERFIL,
  error: null,
  iniciar: () => {},
  aplicarSesion: () => {},
  entrar: async () => null,
  salir: async () => {},
  cambiarPassword: async () => null,
};

export const useSesion = (selector) => (selector ? selector(ESTADO) : ESTADO);
useSesion.getState = () => ESTADO;
useSesion.setState = () => {};

export const usePerfil = () => PERFIL;
export const useHaySesion = () => true;
export const useRol = () => PERFIL.rol;

export const puedeEscribir = (rol) => rol === 'admin' || rol === 'coordinacion';
export const puedeMarcarEstrategico = (rol) => puedeEscribir(rol) || rol === 'jefe_gabinete';
