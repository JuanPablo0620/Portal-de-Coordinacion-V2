import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton, Chip } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoFecha, CampoTexto, GrillaCampos } from '../../componentes/Campo.jsx';
import { hoyISO } from '../../datos/selectores.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { acciones } from '../../estado/tienda.js';

const filaVacia = () => ({ clave: Math.random().toString(36).slice(2), descripcion: '', responsable: '', fecha_limite: '', area: '' });

/**
 * Los compromisos que salen de una reunión de mesa se crean con
 * `origen_tipo: 'mesa'` y van a la MISMA lista general de compromisos: no hay
 * una lista aparte por mesa.
 */
export function RegistrarReunion({ abierto, alCerrar, mesa }) {
  const hoy = hoyISO();
  const opcionesArea = useOpciones('areas');
  const [datos, setDatos] = useState({ fecha: hoy, asistentes: '', temas: '' });
  const [compromisos, setCompromisos] = useState([]);
  const [error, setError] = useState('');

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));
  const actualizarFila = (clave, campo, valor) =>
    setCompromisos((f) => f.map((x) => (x.clave === clave ? { ...x, [campo]: valor } : x)));

  async function guardar() {
    if (!datos.fecha) {
      setError('Indicá la fecha de la reunión.');
      return;
    }
    for (const c of compromisos) {
      if (c.descripcion.trim() && c.fecha_limite && c.fecha_limite < hoy) {
        setError('Las fechas límite no pueden ser anteriores a hoy.');
        return;
      }
    }
    setError('');

    await acciones.crearReunionMesa({ id_mesa: mesa.id, ...datos });

    const aCrear = compromisos
      .filter((c) => c.descripcion.trim())
      .map((c) => ({
        origen_tipo: 'mesa',
        id_origen: mesa.id,
        id_proyecto: mesa.proyectos_vinculados?.[0] ?? null,
        area: c.area || '',
        descripcion: c.descripcion.trim(),
        responsable: c.responsable.trim(),
        fecha_limite: c.fecha_limite || null,
      }));
    if (aCrear.length) await acciones.crearCompromisos(aCrear);

    alCerrar();
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="lg"
      titulo="Registrar reunión"
      descripcion={mesa.nombre}
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={guardar}>
            Guardar reunión
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <GrillaCampos columnas={2}>
          <CampoFecha etiqueta="Fecha" requerido value={datos.fecha} onChange={cambiar('fecha')} />
          <CampoTexto etiqueta="Asistentes" value={datos.asistentes} onChange={cambiar('asistentes')} placeholder="Nombres separados por coma" />
        </GrillaCampos>

        <CampoArea etiqueta="Temas tratados" filas={4} value={datos.temas} onChange={cambiar('temas')} />

        <fieldset className="rounded-chip border border-borde">
          <legend className="mx-3 flex items-center gap-2 px-1 text-xs font-semibold text-gris">
            Compromisos generados
            <Chip tono="acento">{compromisos.filter((c) => c.descripcion.trim()).length}</Chip>
          </legend>
          <div className="flex flex-col gap-2 p-3">
            {compromisos.length === 0 && (
              <p className="py-1 text-center text-xs text-tenue">
                Se integran a la lista general de compromisos del módulo Seguimiento.
              </p>
            )}
            {compromisos.map((fila) => (
              <div key={fila.clave} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_150px_130px_auto]">
                <input
                  className="campo-base py-1.5 text-sm"
                  placeholder="Acción comprometida"
                  aria-label="Acción comprometida"
                  value={fila.descripcion}
                  onChange={(e) => actualizarFila(fila.clave, 'descripcion', e.target.value)}
                />
                <input
                  className="campo-base py-1.5 text-sm"
                  placeholder="Responsable"
                  aria-label="Responsable del compromiso"
                  value={fila.responsable}
                  onChange={(e) => actualizarFila(fila.clave, 'responsable', e.target.value)}
                />
                <select
                  className="campo-base py-1.5 text-sm"
                  aria-label="Área responsable del compromiso"
                  value={fila.area}
                  onChange={(e) => actualizarFila(fila.clave, 'area', e.target.value)}
                >
                  <option value="">Área…</option>
                  {opcionesArea.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.titulo}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="campo-base py-1.5 text-sm"
                  aria-label="Fecha límite del compromiso"
                  min={hoy}
                  value={fila.fecha_limite}
                  onChange={(e) => actualizarFila(fila.clave, 'fecha_limite', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setCompromisos((f) => f.filter((x) => x.clave !== fila.clave))}
                  className="shrink-0 self-start rounded-chip p-2 text-tenue transition hover:bg-vencido-suave hover:text-vencido-texto"
                  aria-label="Quitar compromiso"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <Boton
              tamanio="sm"
              variante="fantasma"
              icono={Plus}
              onClick={() => setCompromisos((f) => [...f, filaVacia()])}
              className="self-start"
            >
              Agregar compromiso
            </Boton>
          </div>
        </fieldset>

        {error && <Aviso tono="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}
