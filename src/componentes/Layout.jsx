import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import logo3f from '../assets/logo-3f.png';
import { usePerfil, useSesion } from '../estado/sesion.js';
import { acciones } from '../estado/tienda.js';
import {
  CalendarCheck,
  CalendarDays,
  CloudCog,
  FileBarChart,
  FolderKanban,
  Gem,
  Globe2,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  MapPinned,
  Radar,
  Settings,
  Target,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

const MODULOS = [
  { ruta: '/', titulo: 'Inicio', icono: LayoutDashboard, exacta: true },
  { ruta: '/mis-areas', titulo: 'Mis áreas', icono: UserCheck },
  { ruta: '/proyectos', titulo: 'Proyectos y Puntuales', icono: FolderKanban },
  { ruta: '/obras', titulo: 'Obras', icono: HardHat },
  { ruta: '/seguimiento', titulo: 'Seguimiento', icono: CalendarCheck },
  { ruta: '/monitoreo', titulo: 'Monitoreo', icono: Radar },
  { ruta: '/estrategicos', titulo: 'Proyectos estratégicos', icono: Gem },
  { ruta: '/posicionamiento', titulo: 'Posicionamiento', icono: Globe2 },
  { ruta: '/planificacion', titulo: 'Planificación', icono: Target },
  { ruta: '/mesas', titulo: 'Mesas de trabajo', icono: Users },
  { ruta: '/eventos', titulo: 'Eventos', icono: CalendarDays },
  { ruta: '/mapa', titulo: 'Mapa de cortes', icono: MapPinned },
  { ruta: '/reportes', titulo: 'Reportes', icono: FileBarChart },
  { ruta: '/vigentes-supabase', titulo: 'Vigentes (Supabase)', icono: CloudCog },
];

function Navegacion({ alNavegar }) {
  const clase = ({ isActive }) =>
    `flex items-center gap-2.5 rounded-chip border-l-2 px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'border-acento bg-acento-suave text-acento-fuerte'
        : 'border-transparent text-gris hover:bg-paper hover:text-tinta'
    }`;

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
      {MODULOS.map((m) => (
        <NavLink key={m.ruta} to={m.ruta} end={m.exacta} className={clase} onClick={alNavegar}>
          <m.icono size={17} className="shrink-0" />
          {m.titulo}
        </NavLink>
      ))}
      <div className="mt-auto pt-2">
        <NavLink to="/configuracion" className={clase} onClick={alNavegar}>
          <Settings size={17} className="shrink-0" />
          Configuración
        </NavLink>
        <UsuarioSesion />
      </div>
    </nav>
  );
}

/**
 * Nombre del rol tal como se dice en el municipio. El valor guardado en la
 * base es el técnico (`jefe_gabinete`); mostrarlo crudo en pantalla sería
 * filtrar vocabulario de la implementación a una interfaz institucional.
 */
const ROTULO_ROL = {
  admin: 'Control de Gestión',
  coordinacion: 'Control de Gestión',
  jefe_gabinete: 'Jefatura de Gabinete',
  intendencia: 'Intendencia',
  area: 'Secretaría',
};

function UsuarioSesion() {
  const perfil = usePerfil();
  const salir = useSesion((e) => e.salir);
  if (!perfil) return null;

  return (
    <div className="mt-2 border-t border-borde px-3 pt-3">
      <p className="truncate text-sm font-medium leading-tight text-tinta">{perfil.nombre}</p>
      <p className="truncate text-[11px] leading-tight text-tenue">
        {ROTULO_ROL[perfil.rol] ?? perfil.rol}
      </p>
      <button
        type="button"
        onClick={salir}
        className="mt-2 flex items-center gap-1.5 text-xs font-medium text-gris transition hover:text-tinta"
      >
        <LogOut size={14} className="shrink-0" />
        Salir
      </button>
    </div>
  );
}

function Marca() {
  return (
    <div className="flex items-center gap-2.5 border-b border-borde px-4 py-3.5">
      <img src={logo3f} alt="" className="h-9 w-9 shrink-0 rounded-chip" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight text-tinta">Coordinación</p>
        <p className="truncate text-[11px] leading-tight text-tenue">Municipio de Tres de Febrero</p>
      </div>
    </div>
  );
}

/**
 * Cada cuanto, como mucho, se vuelve a traer todo de la base al cambiar de
 * pantalla. Sin un piso, ir y volver entre dos pantallas dispararia una docena
 * de consultas por cada clic. Treinta segundos es bastante menos que lo que
 * tarda alguien en cargar algo del otro lado, que es el caso que esto resuelve.
 */
const MINIMO_ENTRE_REFRESCOS = 30_000;

export function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { pathname } = useLocation();
  const ultimo = useRef(0);

  /*
   * Traer lo fresco al entrar a una pantalla ERA la estrategia declarada de
   * concurrencia del sistema (ver `refrescar()` en repositorio.js), pero solo
   * dos de las catorce pantallas la aplicaban: Proyectos y Eventos. En el
   * resto se veia lo que hubiera al abrir la pestania, asi que lo que cargaba
   * un companiero no aparecia hasta recargar la pagina entera — y nadie tiene
   * por que saber que hay que hacer eso.
   *
   * Va aca y no en cada modulo para que valga para todos, incluidos los que se
   * agreguen despues. Los errores no se muestran: cada pantalla que le importe
   * ya los lee con `estadoRemoto()`, y un cartel global por una carga de fondo
   * seria ruido en catorce lugares.
   */
  useEffect(() => {
    const ahora = Date.now();
    if (ahora - ultimo.current < MINIMO_ENTRE_REFRESCOS) return;
    ultimo.current = ahora;
    acciones.refrescar().catch(() => {});
  }, [pathname]);

  return (
    <div className="layout-app flex h-full">
      {/* Primer elemento alcanzable con el teclado: sin esto, cada pantalla
          empieza con diez tabulaciones por la navegación antes de llegar al
          contenido, y hay que repetirlas en cada página. */}
      <a href="#contenido" className="saltar-al-contenido no-imprimir">
        Saltar al contenido
      </a>

      {/* Barra lateral fija — escritorio */}
      <aside className="barra-lateral no-imprimir hidden w-60 shrink-0 flex-col border-r border-borde bg-card lg:flex">
        <Marca />
        <Navegacion />
      </aside>

      {/* Barra lateral desplegable — tablet */}
      {menuAbierto && (
        <div className="no-imprimir fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-tinta/40"
            onClick={() => setMenuAbierto(false)}
            aria-label="Cerrar menú"
          />
          <aside className="absolute inset-y-0 left-0 flex w-60 flex-col border-r border-borde bg-card shadow-flotante">
            <Marca />
            <Navegacion alNavegar={() => setMenuAbierto(false)} />
          </aside>
        </div>
      )}

      {/* min-h-0: sin esto, un flex item en columna no se achica por debajo
          de la altura natural de su contenido (default `min-height: auto`
          de flexbox). Con una pantalla con mucho contenido —como "Proyectos
          y compromisos de esta ventana" en Monitoreo, que puede crecer
          bastante al abrir un proyecto o un compromiso— este div terminaba
          estirándose para darle lugar a #contenido en vez de dejarlo
          scrollear solo, y aparecía un segundo scroll: el de la ventana del
          navegador entera, encima del de #contenido. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          className="no-imprimir flex items-center gap-2 border-b border-borde bg-card px-4 py-2.5 text-sm
            font-medium text-tinta lg:hidden"
        >
          {menuAbierto ? <X size={18} /> : <Menu size={18} />}
          Menú
        </button>
        <main id="contenido" tabIndex={-1} className="area-contenido scroll-fino min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Encabezado de página: título, descripción y acciones a la derecha. */
export function EncabezadoPagina({ titulo, descripcion, acciones, children }) {
  return (
    <div className="border-b border-borde bg-card px-4 py-3.5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight text-tinta">{titulo}</h1>
          {descripcion && <p className="mt-0.5 text-sm text-gris">{descripcion}</p>}
        </div>
        {/* ml-auto (no solo justify-between del padre): cuando el título+descripción
            ocupan toda la línea y las acciones envuelven solas a la línea de abajo,
            justify-between no tiene con qué "repartir" espacio con un solo bloque en
            esa línea y las deja pegadas a la izquierda. ml-auto sí empuja el bloque
            entero al margen derecho aunque quede solo en su línea. */}
        {acciones && <div className="no-imprimir flex flex-wrap items-center gap-2 ml-auto">{acciones}</div>}
      </div>
      {children}
    </div>
  );
}

/** Contenedor del cuerpo de una página. */
export function Pagina({ children, className = '' }) {
  return <div className={`px-4 py-4 sm:px-6 ${className}`}>{children}</div>;
}
