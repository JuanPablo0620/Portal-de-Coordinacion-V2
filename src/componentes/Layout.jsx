import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import logo3f from '../assets/logo-3f.png';
import {
  CalendarCheck,
  CalendarDays,
  FileBarChart,
  FolderKanban,
  Gem,
  Globe2,
  HardHat,
  LayoutDashboard,
  Menu,
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
  { ruta: '/proyectos', titulo: 'Proyectos', icono: FolderKanban },
  { ruta: '/obras', titulo: 'Obras', icono: HardHat },
  { ruta: '/seguimiento', titulo: 'Seguimiento', icono: CalendarCheck },
  { ruta: '/monitoreo', titulo: 'Monitoreo', icono: Radar },
  { ruta: '/estrategicos', titulo: 'Proyectos estratégicos', icono: Gem },
  { ruta: '/posicionamiento', titulo: 'Posicionamiento', icono: Globe2 },
  { ruta: '/planificacion', titulo: 'Planificación', icono: Target },
  { ruta: '/mesas', titulo: 'Mesas de trabajo', icono: Users },
  { ruta: '/eventos', titulo: 'Eventos', icono: CalendarDays },
  { ruta: '/reportes', titulo: 'Reportes', icono: FileBarChart },
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
      </div>
    </nav>
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

export function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);

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

      <div className="flex min-w-0 flex-1 flex-col">
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
        {acciones && <div className="no-imprimir flex flex-wrap items-center gap-2">{acciones}</div>}
      </div>
      {children}
    </div>
  );
}

/** Contenedor del cuerpo de una página. */
export function Pagina({ children, className = '' }) {
  return <div className={`px-4 py-4 sm:px-6 ${className}`}>{children}</div>;
}
