import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { EncabezadoPagina, Pagina } from '../../componentes/Layout.jsx';
import { Boton, Tarjeta } from '../../componentes/Basicos.jsx';
import { Calendario, useMesVisible } from '../../componentes/Calendario.jsx';
import { hoyISO, itemsCalendario } from '../../datos/selectores.js';
import { useBD } from '../../estado/tienda.js';
import { useFiltrosUrl } from '../../utilidades/filtrosUrl.js';

const CAPAS = ['seguimientos', 'eventos', 'mesas'];
const DEFAULTS = { seguimientos: true, eventos: true, mesas: true };

/** Agenda amplia del portal: usa la misma fuente que Inicio y filtros compartibles por URL. */
export default function CalendarioGeneral() {
  const bd = useBD();
  const navegar = useNavigate();
  const hoy = hoyISO();
  const mes = useMesVisible(hoy);
  const [filtros, setFiltros] = useFiltrosUrl(DEFAULTS);
  const capas = useMemo(() => ({
    seguimientos: filtros.seguimientos !== false,
    eventos: filtros.eventos !== false,
    mesas: filtros.mesas !== false,
    vencimientos: false,
  }), [filtros.seguimientos, filtros.eventos, filtros.mesas]);
  const items = useMemo(() => bd ? itemsCalendario(bd, capas, ...mes.rango) : [], [bd, capas, mes.rango]);
  return <>
    <EncabezadoPagina titulo="Calendario general" descripcion="Seguimientos, eventos y reuniones de mesa en una sola agenda."
      acciones={<Boton icono={ArrowLeft} onClick={() => navegar('/')}>Volver a Inicio</Boton>} />
    <Pagina>
      <Tarjeta>
        <Calendario anio={mes.anio} mes={mes.mes} hoy={hoy} items={items} capas={capas}
          capasDisponibles={CAPAS} alCambiarCapas={({ seguimientos, eventos, mesas }) => setFiltros({ seguimientos, eventos, mesas })}
          alMover={mes.mover} alVolverAHoy={mes.volverAHoy} />
        <p role="status" className="mt-3 text-sm text-gris">{items.length
          ? `${items.length} actividades en el mes con los filtros elegidos.`
          : 'No hay actividades en este mes con los filtros elegidos.'}</p>
      </Tarjeta>
    </Pagina>
  </>;
}
