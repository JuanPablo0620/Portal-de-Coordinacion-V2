import { useMemo } from 'react';
import { CampoSelect, GrillaCampos } from './Campo.jsx';
import { direccionesDe, subsecretariasDe } from '../datos/selectores.js';
import { useBD } from '../estado/tienda.js';

/**
 * A qué unidad de la secretaría pertenece un compromiso: subsecretaría y/o
 * dirección, en cascada.
 *
 * Las dos son OPCIONALES y no dependen una de la otra: se puede cargar sólo
 * la subsecretaría, sólo la dirección, las dos, o ninguna. Lo único que hace
 * la cascada es acotar la lista de direcciones a la subsecretaría elegida
 * (ver `direccionesDe` en selectores.js).
 *
 * Si al cambiar de subsecretaría la dirección elegida deja de pertenecerle,
 * se limpia sola: dejarla sería guardar un par que el organigrama no tiene.
 */
export function SelectorUnidad({
  area,
  idSubsecretaria = '',
  idDireccion = '',
  alCambiar,
  columnas = 2,
  compacto = false,
}) {
  const bd = useBD();

  const subsecretarias = useMemo(() => subsecretariasDe(bd, area), [bd, area]);
  const direcciones = useMemo(
    () => direccionesDe(bd, area, idSubsecretaria),
    [bd, area, idSubsecretaria],
  );

  // Sin organigrama cargado para esa secretaría no hay nada que elegir: no se
  // muestran dos desplegables vacíos.
  if (!area || (!subsecretarias.length && !direcciones.length)) return null;

  const opciones = (items) => items.map((i) => ({ valor: i.id, titulo: i.nombre }));

  function cambiarSubsecretaria(valor) {
    const sigueValiendo = direccionesDe(bd, area, valor).some((d) => d.id === idDireccion);
    alCambiar({ id_subsecretaria: valor, id_direccion: sigueValiendo ? idDireccion : '' });
  }

  return (
    <GrillaCampos columnas={columnas} className={compacto ? '' : 'mt-2.5'}>
      <CampoSelect
        etiqueta="Subsecretaría"
        ayuda="opcional"
        opciones={opciones(subsecretarias)}
        value={idSubsecretaria}
        onChange={(e) => cambiarSubsecretaria(e.target.value)}
        placeholder="Sin especificar"
      />
      <CampoSelect
        etiqueta="Dirección"
        ayuda={idSubsecretaria ? 'sólo las de esa subsecretaría' : 'opcional'}
        opciones={opciones(direcciones)}
        value={idDireccion}
        onChange={(e) => alCambiar({ id_direccion: e.target.value })}
        placeholder="Sin especificar"
      />
    </GrillaCampos>
  );
}
