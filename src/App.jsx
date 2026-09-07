import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './componentes/Layout.jsx';
import { sincronizarUsuario, useCargando, useTienda } from './estado/tienda.js';
import { useHaySesion, useSesion } from './estado/sesion.js';

import Login from './modulos/acceso/Login.jsx';
import CambiarPassword from './modulos/acceso/CambiarPassword.jsx';
import Dashboard from './modulos/dashboard/Dashboard.jsx';
import MisAreas from './modulos/mis-areas/MisAreas.jsx';
import Proyectos from './modulos/proyectos/Proyectos.jsx';
import FichaProyecto from './modulos/proyectos/FichaProyecto.jsx';
import Obras from './modulos/obras/Obras.jsx';
import Seguimiento from './modulos/seguimiento/Seguimiento.jsx';
import Monitoreo from './modulos/monitoreo/Monitoreo.jsx';
import Estrategicos from './modulos/estrategicos/Estrategicos.jsx';
import Posicionamiento from './modulos/posicionamiento/Posicionamiento.jsx';
import Planificacion from './modulos/planificacion/Planificacion.jsx';
import Mesas from './modulos/mesas/Mesas.jsx';
import Eventos from './modulos/eventos/Eventos.jsx';
import Reportes from './modulos/reportes/Reportes.jsx';
import Configuracion from './modulos/configuracion/Configuracion.jsx';
import VigentesSupabase from './modulos/vigentes-supabase/VigentesSupabase.jsx';

function Cargando() {
  return (
    <div className="grid h-full place-items-center">
      <p className="text-sm text-gris">Cargando…</p>
    </div>
  );
}

/**
 * Guarda de acceso.
 *
 * Tres estados excluyentes antes de mostrar nada del portal: resolviendo la
 * sesión, sin sesión, y con sesión pero todavía con la contraseña inicial.
 * Recién después se monta el sistema.
 *
 * La guarda vive acá arriba y no en cada ruta a propósito: una guarda por
 * ruta es una lista que hay que acordarse de actualizar, y la ruta que se
 * olvide queda abierta. Así, agregar una pantalla nueva no puede saltearla.
 *
 * Vale aclarar qué protege y qué no. Esto NO es seguridad: los datos que hoy
 * muestra el portal viven en el almacenamiento del navegador, en la máquina de
 * quien lo abre, y cualquiera con la consola los ve sin pasar por acá. Lo que
 * hace la guarda es dar identidad — saber quién está cargando cada cosa, que
 * es lo que `config.usuario` no podía. La seguridad real es la de la base, y
 * son las políticas de `0003_rls.sql`.
 */
export default function App() {
  const cargandoSesion = useSesion((e) => e.cargando);
  const haySesion = useHaySesion();
  const debeCambiarPassword = useSesion((e) => e.perfil?.debe_cambiar_password);

  useEffect(() => {
    useSesion.getState().iniciar();
  }, []);

  if (cargandoSesion) return <Cargando />;
  if (!haySesion) return <Login />;
  if (debeCambiarPassword) return <CambiarPassword />;

  return <Portal />;
}

/**
 * El portal propiamente dicho. Se monta recién con sesión válida, así que la
 * base local no se hidrata para alguien que no llegó a entrar.
 */
function Portal() {
  const cargando = useCargando();
  const nombre = useSesion((e) => e.perfil?.nombre);

  useEffect(() => {
    useTienda.getState().iniciar();
  }, []);

  // Corre después de hidratar, no antes: necesita leer el nombre viejo de la
  // base local para saber de dónde mudar las áreas de «Mis áreas».
  useEffect(() => {
    if (!cargando) sincronizarUsuario(nombre);
  }, [cargando, nombre]);

  if (cargando) return <Cargando />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="mis-areas" element={<MisAreas />} />
        <Route path="proyectos" element={<Proyectos />} />
        <Route path="proyectos/:id" element={<FichaProyecto />} />
        <Route path="obras" element={<Obras />} />
        <Route path="seguimiento" element={<Seguimiento />} />
        <Route path="monitoreo" element={<Monitoreo />} />
        <Route path="estrategicos" element={<Estrategicos />} />
        <Route path="posicionamiento" element={<Posicionamiento />} />
        <Route path="planificacion" element={<Planificacion />} />
        <Route path="mesas" element={<Mesas />} />
        <Route path="eventos" element={<Eventos />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="vigentes-supabase" element={<VigentesSupabase />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
