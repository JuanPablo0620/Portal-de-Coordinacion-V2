import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import logo3f from '../assets/logo-3f.png';
import { usePerfil, useSesion } from '../estado/sesion.js';
import { useTema } from '../estado/tema.js';
import { acciones } from '../estado/tienda.js';
import {
  CalendarCheck,
  FileBarChart,
  FolderKanban,
  Gem,
  Globe2,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  MapPinned,
  Moon,
  Radar,
  Settings,
  Sun,
  Target,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

/**
 * Estructura con el estilo del Sistema de Gestión de Flota (09/10/2026):
 *
 *  - Barra superior navy: la marca a la izquierda y la sesión a la derecha.
 *  - Lateral claro con los módulos agrupados por rótulos. El activo lleva
 *    filete naranja, fondo, peso y texto navy: el color solo no alcanza para
 *    decir dónde está uno (ver los tokens `--color-lateral-*`).
 *
 * De flota se tomó el estilo, no la arquitectura: allá la barra superior tiene
 * los módulos y el lateral las vistas del módulo actual. Acá el lateral sigue
 * listando los módulos y las vistas siguen siendo pestañas de cada pantalla
 * —decisión de JP, para no cambiar cómo navega el equipo—.
 *
 * En escritorio el lateral es un riel de íconos que se despliega al pasar el
 * cursor y se pliega al sacarlo (pedido de JP, 09/10/2026). Se despliega POR
 * ENCIMA del contenido —el riel reserva su ancho fijo— para que la pantalla no
 * se reacomode cada vez que el cursor cruza el borde. Abre con un retardo
 * corto para no dispararse al pasar de largo. Con teclado se abre por
 * `:focus-visible` y no por `:focus-within`: con el mouse, el enlace cliqueado
 * conserva el foco y el lateral quedaba trabado abierto.
 *
 * Por debajo de 1024 px no hay cursor que pasar: el lateral se esconde y se
 * abre entero con el botón de menú.
 */
const GRUPOS = [
  {
    titulo: null,
    modulos: [
      { ruta: '/', titulo: 'Inicio', icono: LayoutDashboard, exacta: true },
      { ruta: '/mi-trabajo', titulo: 'Mi trabajo', icono: UserCheck },
    ],
  },
  {
    titulo: 'Seguimiento de gestión',
    modulos: [
      { ruta: '/seguimiento', titulo: 'Seguimiento', icono: CalendarCheck },
      { ruta: '/monitoreo', titulo: 'Monitoreo', icono: Radar },
      // Eventos ya no es un ítem propio: es una pestaña más de Mesas de trabajo
      // (ver `src/modulos/mesas/Mesas.jsx`), junto a Temáticas/Barriales/Otros
      // proyectos — decisión del 14/09/2026.
      { ruta: '/mesas', titulo: 'Mesas de trabajo', icono: Users },
    ],
  },
  {
    titulo: 'Proyectos',
    modulos: [
      { ruta: '/proyectos', titulo: 'Proyectos y Puntuales', icono: FolderKanban },
      { ruta: '/obras', titulo: 'Obras', icono: HardHat },
      { ruta: '/estrategicos', titulo: 'Proyectos estratégicos', icono: Gem },
      { ruta: '/posicionamiento', titulo: 'Posicionamiento', icono: Globe2 },
      { ruta: '/planificacion', titulo: 'Planificación', icono: Target },
    ],
  },
  {
    titulo: 'Herramientas',
    modulos: [
      { ruta: '/mapa', titulo: 'Mapa de cortes', icono: MapPinned },
      { ruta: '/reportes', titulo: 'Reportes', icono: FileBarChart },
    ],
  },
];

const claseItem = (activo) =>
  `flex min-h-11 w-full items-center gap-2.5 overflow-hidden rounded-chip px-3 py-2 text-sm whitespace-nowrap transition lg:min-h-10 ${
    activo
      ? 'bg-lateral-activo font-semibold text-lateral-activo-texto shadow-[inset_3px_0_var(--color-filete)] [&_svg]:text-lateral-activo-texto'
      : 'font-medium text-lateral-texto hover:bg-lateral-hover hover:text-lateral-activo-texto [&_svg]:text-lateral-icono'
  }`;

/**
 * Lo que sólo se ve con el lateral desplegado. Queda en el DOM —transparente,
 * no oculto—: el lector de pantalla sigue leyendo el nombre de cada módulo
 * aunque el riel muestre sólo el ícono.
 */
const SOLO_DESPLEGADO = 'lg:opacity-0 lg:transition-opacity lg:duration-150 lg:group-hover/lateral:opacity-100 lg:group-has-[:focus-visible]/lateral:opacity-100';

function Rotulo({ children }) {
  return (
    <p className={`truncate px-3 pt-4 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-gris uppercase ${SOLO_DESPLEGADO}`}>
      {children}
    </p>
  );
}

function Lateral({ abierto, alNavegar }) {
  return (
    // El contenedor reserva el ancho del riel; el lateral se despliega encima.
    <div className="relative shrink-0 lg:w-16">
      <aside
        id="lateral"
        aria-label="Módulos del portal"
        // `invisible` cuando está cerrado en pantallas chicas: fuera de la
        // pantalla igual recibiría el foco con Tab, y el teclado se perdería en
        // enlaces que no se ven. La visibilidad cambia al final del
        // deslizamiento, así que la animación de salida se ve entera.
        className={`group/lateral no-imprimir fixed top-14 bottom-0 left-0 z-30 flex w-[260px] flex-col overflow-hidden border-r border-borde
          bg-lateral transition-[translate,visibility] duration-200
          lg:visible lg:absolute lg:top-0 lg:w-16 lg:translate-x-0 lg:transition-[width,box-shadow] lg:delay-100
          lg:hover:w-60 lg:hover:shadow-flotante lg:hover:delay-150
          lg:has-[:focus-visible]:w-60 lg:has-[:focus-visible]:shadow-flotante lg:has-[:focus-visible]:delay-0 ${
            abierto ? 'visible translate-x-0 shadow-flotante' : 'invisible -translate-x-full'
          }`}
      >
        <nav aria-label="Módulos" className="scroll-fino flex-1 overflow-y-auto px-2.5 pt-2 pb-3">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo ?? 'principal'}>
              {grupo.titulo && <Rotulo>{grupo.titulo}</Rotulo>}
              <div className="flex flex-col gap-0.5">
                {grupo.modulos.map((m) => (
                  <NavLink key={m.ruta} to={m.ruta} end={m.exacta} onClick={alNavegar} className={({ isActive }) => claseItem(isActive)}>
                    <m.icono size={17} className="shrink-0" aria-hidden="true" />
                    <span className={`truncate ${SOLO_DESPLEGADO}`}>{m.titulo}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="flex flex-col gap-0.5 border-t border-borde px-2.5 pt-2.5 pb-3">
          <SelectorTema />
          <NavLink to="/configuracion" onClick={alNavegar} className={({ isActive }) => claseItem(isActive)}>
            <Settings size={17} className="shrink-0" aria-hidden="true" />
            <span className={`truncate ${SOLO_DESPLEGADO}`}>Configuración</span>
          </NavLink>
        </div>
      </aside>
    </div>
  );
}

/** Control de apariencia personal; BlueNight no se comparte con otras cuentas. */
function SelectorTema() {
  const tema = useTema((estado) => estado.tema);
  const cambiarTema = useTema((estado) => estado.cambiarTema);
  const activo = tema === 'bluenight';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={activo ? 'Desactivar modo BlueNight' : 'Activar modo BlueNight'}
      onClick={() => cambiarTema(activo ? 'claro' : 'bluenight')}
      className={`interruptor-tema ${claseItem(false)}`}
    >
      {activo ? <Moon size={17} className="shrink-0" aria-hidden="true" /> : <Sun size={17} className="shrink-0" aria-hidden="true" />}
      <span className={`flex-1 text-left ${SOLO_DESPLEGADO}`}>BlueNight</span>
      <span className={`interruptor-tema-pista ${SOLO_DESPLEGADO}`} aria-hidden="true">
        <span className="interruptor-tema-perilla" />
      </span>
    </button>
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
    <div className="flex min-w-0 items-center gap-2 border-l border-superior-hover pl-3 md:gap-3 md:pl-4">
      <div className="hidden min-w-0 text-right md:block">
        <p className="truncate text-sm font-semibold leading-tight">{perfil.nombre}</p>
        <p className="truncate text-[11px] leading-tight text-superior-tenue">{ROTULO_ROL[perfil.rol] ?? perfil.rol}</p>
      </div>
      <button
        type="button"
        onClick={salir}
        aria-label="Salir del portal"
        title="Salir"
        className="flex min-h-10 items-center gap-1.5 rounded-chip px-2.5 text-sm font-medium text-superior-texto transition hover:bg-superior-hover"
      >
        <LogOut size={16} className="shrink-0" aria-hidden="true" />
        <span className="max-sm:hidden">Salir</span>
      </button>
    </div>
  );
}

function BarraSuperior({ menuAbierto, alternarMenu }) {
  return (
    <header className="barra-superior no-imprimir relative z-40 flex h-14 shrink-0 items-center justify-between gap-3 bg-superior px-3 text-superior-texto md:px-4">
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={alternarMenu}
          aria-expanded={menuAbierto}
          aria-controls="lateral"
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          className="grid h-10 w-10 place-items-center rounded-chip text-white transition hover:bg-superior-hover lg:hidden"
        >
          {menuAbierto ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Fondo blanco: el logo tiene navy y sobre la barra se perdería. */}
          <img src={logo3f} alt="" width="36" height="36" className="h-9 w-9 shrink-0 rounded-chip bg-card p-[3px]" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold leading-tight text-white">Coordinación</p>
            <p className="truncate text-[11px] leading-tight text-superior-tenue max-[380px]:hidden">Municipio de Tres de Febrero</p>
          </div>
        </div>
      </div>
      <UsuarioSesion />
    </header>
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
  const iniciarTema = useTema((estado) => estado.iniciarTema);

  useEffect(() => {
    iniciarTema();
  }, [iniciarTema]);

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

  // En tablet y celular el menú se cierra al navegar y con Escape.
  useEffect(() => setMenuAbierto(false), [pathname]);
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') setMenuAbierto(false); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [menuAbierto]);

  return (
    <div className="layout-app flex h-full flex-col">
      {/* Primer elemento alcanzable con el teclado: sin esto, cada pantalla
          empieza con quince tabulaciones por la navegación antes de llegar al
          contenido, y hay que repetirlas en cada página. */}
      <a href="#contenido" className="saltar-al-contenido no-imprimir">
        Saltar al contenido
      </a>

      <BarraSuperior menuAbierto={menuAbierto} alternarMenu={() => setMenuAbierto((v) => !v)} />

      <div className="flex min-h-0 min-w-0 flex-1">
        <Lateral abierto={menuAbierto} alNavegar={() => setMenuAbierto(false)} />
        {menuAbierto && (
          <button
            type="button"
            aria-label="Cerrar menú"
            tabIndex={-1}
            onClick={() => setMenuAbierto(false)}
            className="no-imprimir fixed inset-0 top-14 z-20 bg-tinta/40 lg:hidden"
          />
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
          <main id="contenido" tabIndex={-1} className="area-contenido scroll-fino min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
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
