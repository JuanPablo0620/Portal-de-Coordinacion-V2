/**
 * Alta de la base maestra de proyectos del POA — antes vivía en el módulo
 * de Proyectos, se movió acá porque la carga es un evento de principio de
 * año, no algo que pase en la pantalla donde después se filtra y se
 * consulta el día a día. Reusa el mismo formulario y el mismo importador de
 * siempre (`FormularioProyecto`, `ImportarProyectos`), nada de eso cambió.
 */
import { useState } from 'react';
import { FolderPlus, Plus, Upload } from 'lucide-react';
import { Boton, Tarjeta } from '../../componentes/Basicos.jsx';
import { FormularioProyecto } from '../proyectos/FormularioProyecto.jsx';
import { ImportarProyectos } from '../proyectos/ImportarProyectos.jsx';

export function CargarProyectos() {
  const [formulario, setFormulario] = useState(false);
  const [importando, setImportando] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo="Proyectos del POA"
        descripcion="Alta inicial de la base maestra — la carga que se hace una vez, a principio de año. Para ver, filtrar o consultar lo que ya está cargado, andá al módulo de Proyectos."
        acciones={
          <>
            <Boton icono={Upload} onClick={() => setImportando(true)}>
              Importar CSV
            </Boton>
            <Boton variante="primario" icono={Plus} onClick={() => setFormulario(true)}>
              Nuevo proyecto
            </Boton>
          </>
        }
      >
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <FolderPlus size={28} className="text-tenue" />
          <p className="max-w-md text-sm text-gris">
            Cargá un proyecto a la vez o importá todos los del POA de una desde un CSV. Los que ya
            estén cargados no se tocan desde acá — se editan desde su ficha, en el módulo de
            Proyectos.
          </p>
        </div>
      </Tarjeta>

      {formulario && <FormularioProyecto abierto alCerrar={() => setFormulario(false)} proyecto={null} />}
      {importando && <ImportarProyectos abierto alCerrar={() => setImportando(false)} />}
    </div>
  );
}
