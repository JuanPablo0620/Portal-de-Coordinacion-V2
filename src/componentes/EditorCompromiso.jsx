import { Check } from 'lucide-react';
import { Boton } from './Basicos.jsx';
import { CampoArea, CampoFecha, CampoRadios } from './Campo.jsx';
import { SelectorUnidad } from './SelectorUnidad.jsx';
import { ESTADOS_COMPROMISO } from '../datos/catalogos.js';

/**
 * Formulario para "actualizar" un compromiso ya cargado: cambiar su estado,
 * anotar una novedad y, si hace falta, correr la fecha límite.
 *
 * A propósito NO deja reescribir la descripción original ahí mismo: antes
 * este mismo formulario (en Seguimiento y en las dos secciones de Monitoreo)
 * abría con el texto completo del compromiso en una caja editable, y para
 * dejar constancia de un avance había que reescribirlo a mano encima de lo
 * que ya decía. La descripción se muestra fija y lo que se carga acá se
 * agrega debajo, con fecha (`actualizarEstadoCompromiso` en repositorio.js
 * es quien arma ese agregado) — nunca se pierde lo que ya estaba escrito.
 */
export function EditorCompromiso({
  compromiso,
  borrador,
  alCambiarBorrador,
  alGuardar,
  alCancelar,
  guardando = false,
  conFechaLimite = true,
}) {
  return (
    <div className="border-t border-dashed border-borde-fuerte/40 p-2.5">
      <CampoRadios
        etiqueta="Nuevo estado"
        opciones={ESTADOS_COMPROMISO}
        valor={borrador?.estado ?? compromiso.estado}
        alCambiar={(v) => alCambiarBorrador({ estado: v })}
      />
      <p className="mt-2.5 whitespace-pre-line rounded-chip bg-paper p-2 text-xs text-gris">{compromiso.descripcion}</p>
      <CampoArea
        etiqueta="Agregar actualización"
        ayuda="opcional — se suma debajo de lo anterior, con la fecha de hoy"
        className="mt-2.5"
        filas={2}
        placeholder="¿Qué novedad hay sobre este compromiso?"
        value={borrador?.nuevaActualizacion ?? ''}
        onChange={(e) => alCambiarBorrador({ nuevaActualizacion: e.target.value })}
      />
      {conFechaLimite && (
        <CampoFecha
          etiqueta="Fecha límite"
          className="mt-2.5 max-w-48"
          value={borrador?.fecha_limite ?? compromiso.fecha_limite ?? ''}
          onChange={(e) => alCambiarBorrador({ fecha_limite: e.target.value })}
        />
      )}
      {/* Los compromisos cargados antes de que existiera el organigrama no
          tienen unidad, y este es el único lugar donde se les puede poner. */}
      <SelectorUnidad
        area={compromiso.area}
        idSubsecretaria={borrador?.id_subsecretaria ?? compromiso.id_subsecretaria ?? ''}
        idDireccion={borrador?.id_direccion ?? compromiso.id_direccion ?? ''}
        alCambiar={alCambiarBorrador}
      />
      <div className="mt-2 flex justify-end gap-2">
        {alCancelar && (
          <Boton tamanio="sm" onClick={alCancelar}>
            Cerrar
          </Boton>
        )}
        <Boton variante="primario" tamanio="sm" icono={Check} onClick={alGuardar} disabled={guardando}>
          Guardar cambios
        </Boton>
      </div>
    </div>
  );
}
