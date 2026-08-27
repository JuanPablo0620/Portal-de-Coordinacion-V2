/**
 * Alta de la base maestra de proyectos del POA — antes vivía en el módulo
 * de Proyectos, se movió acá porque la carga es un evento de principio de
 * año, no algo que pase en la pantalla donde después se filtra y se
 * consulta el día a día. Reusa el mismo formulario de siempre
 * (`FormularioProyecto`); la importación por CSV se sacó de acá.
 */
import { useState } from 'react';
import { FolderPlus, Plus } from 'lucide-react';
import { Boton, Tarjeta } from '../../componentes/Basicos.jsx';
import { FormularioProyecto } from '../proyectos/FormularioProyecto.jsx';

export function CargarProyectos() {
  const [formulario, setFormulario] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo="Cargar Proyectos POA"
        descripcion="Alta inicial de la base maestra — la carga que se hace una vez, a principio de año. Para ver, filtrar o consultar lo que ya está cargado, andá al módulo de Proyectos."
        acciones={
          <Boton variante="primario" icono={Plus} onClick={() => setFormulario(true)}>
            Nuevo proyecto
          </Boton>
        }
      >
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <FolderPlus size={28} className="text-tenue" />
          <p className="max-w-md text-sm text-gris">
            Cargá los proyectos del POA uno a la vez. Los que ya estén cargados no se tocan desde
            acá — se editan desde su ficha, en el módulo de Proyectos.
          </p>
        </div>
      </Tarjeta>

      {formulario && <FormularioProyecto abierto alCerrar={() => setFormulario(false)} proyecto={null} />}
    </div>
  );
}
