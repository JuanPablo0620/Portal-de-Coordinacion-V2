import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Boton } from './Basicos.jsx';
import { CampoArea, CampoFecha, CampoRadios } from './Campo.jsx';
import { SelectorUnidad } from './SelectorUnidad.jsx';
import { ESTADOS_COMPROMISO } from '../datos/catalogos.js';
import { historialCompromiso } from '../datos/repositorio.js';
import { fecha as fFecha } from '../utilidades/formato.js';

/**
 * Formulario para "actualizar" un compromiso ya cargado: cambiar su estado,
 * anotar una novedad y, si hace falta, correr la fecha límite.
 *
 * A propósito NO deja reescribir la descripción original ahí mismo: antes
 * este mismo formulario (en Seguimiento y en las dos secciones de Monitoreo)
 * abría con el texto completo del compromiso en una caja editable, y para
 * dejar constancia de un avance había que reescribirlo a mano encima de lo
 * que ya decía. La descripción se muestra fija y lo que se carga acá se
 * guarda como una fila del HISTORIAL del compromiso, que se lista acá abajo.
 *
 * Hasta el 14/09/2026 esa novedad se concatenaba a la descripción y el nombre
 * del compromiso se iba llenando de anotaciones fechadas. Ahora la descripción
 * queda quieta y lo que pasa con el compromiso se lee como una serie. Ver
 * `supabase/migrations/0031_novedad_compromiso_al_historial.sql`.
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
      <Historial compromisoId={compromiso.id} />
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

/**
 * Las novedades ya cargadas, lo más nuevo primero.
 *
 * Se pide acá y no se recibe por prop para que los tres lugares que abren el
 * editor —las dos secciones de Monitoreo y el detalle de Seguimiento— lo
 * hereden sin repetir la carga en cada uno.
 *
 * Si la consulta falla no se muestra ningún cartel: es información de apoyo, y
 * romper el formulario de carga por no poder leer el historial sería peor que
 * no mostrarlo.
 */
function Historial({ compromisoId }) {
  const [filas, setFilas] = useState([]);

  useEffect(() => {
    let vigente = true;
    historialCompromiso(compromisoId)
      .then((h) => vigente && setFilas(h))
      .catch(() => vigente && setFilas([]));
    return () => {
      vigente = false;
    };
  }, [compromisoId]);

  // Los hitos automáticos del alta y la baja no aportan nada en un formulario
  // de carga: lo que importa son las novedades y los cambios de estado.
  const utiles = filas.filter((f) => f.comentarios || f.estado_anterior);
  if (utiles.length === 0) return null;

  return (
    <div className="mt-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-tenue">Actualizaciones</p>
      <ol className="mt-1 flex flex-col gap-1">
        {utiles.map((f) => (
          <li key={f.id} className="rounded-chip border border-borde px-2 py-1.5 text-xs text-gris">
            <span className="text-tenue">{fFecha(f.fecha_actualizacion)}</span>
            {f.estado_anterior && f.estado_anterior !== f.estado && (
              <span className="ml-1.5 text-tenue">
                · {f.estado_anterior} → {f.estado}
              </span>
            )}
            {f.comentarios && <p className="mt-0.5 whitespace-pre-line">{f.comentarios}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
