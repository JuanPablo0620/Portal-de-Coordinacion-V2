import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './componentes/Layout.jsx';
import { useCargando, useTienda } from './estado/tienda.js';

import Dashboard from './modulos/dashboard/Dashboard.jsx';
import Proyectos from './modulos/proyectos/Proyectos.jsx';
import FichaProyecto from './modulos/proyectos/FichaProyecto.jsx';
import Seguimiento from './modulos/seguimiento/Seguimiento.jsx';
import Monitoreo from './modulos/monitoreo/Monitoreo.jsx';
import Estrategicos from './modulos/estrategicos/Estrategicos.jsx';
import Posicionamiento from './modulos/posicionamiento/Posicionamiento.jsx';
import Planificacion from './modulos/planificacion/Planificacion.jsx';
import Mesas from './modulos/mesas/Mesas.jsx';
import Eventos from './modulos/eventos/Eventos.jsx';
import Reportes from './modulos/reportes/Reportes.jsx';
import Configuracion from './modulos/configuracion/Configuracion.jsx';

export default function App() {
  const cargando = useCargando();

  useEffect(() => {
    useTienda.getState().iniciar();
  }, []);

  if (cargando) {
    return (
      <div className="grid h-full place-items-center">
        <p className="text-sm text-gris">Cargando…</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="proyectos" element={<Proyectos />} />
        <Route path="proyectos/:id" element={<FichaProyecto />} />
        <Route path="seguimiento" element={<Seguimiento />} />
        <Route path="monitoreo" element={<Monitoreo />} />
        <Route path="estrategicos" element={<Estrategicos />} />
        <Route path="posicionamiento" element={<Posicionamiento />} />
        <Route path="planificacion" element={<Planificacion />} />
        <Route path="mesas" element={<Mesas />} />
        <Route path="eventos" element={<Eventos />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
