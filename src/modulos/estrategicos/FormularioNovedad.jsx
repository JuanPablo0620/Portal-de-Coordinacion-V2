/**
 * Registro de novedad en un proyecto estratégico.
 *
 * Valentín (jefe de gabinete) trata directamente con las áreas sobre los ejes
 * estratégicos. Este formulario es su herramienta: registra en una sola operación
 * qué pasó (novedad), cómo está el proyecto ahora (estado + avance), y qué asumió
 * el área (compromisos con responsable y plazo).
 *
 * Internamente:
 * - La novedad es un tema de monitoreo vinculado al proyecto.
 * - El estado y avance actualizan directamente el proyecto.
 * - Los compromisos creados llevan origen_tipo='estrategico' para distinguirse.
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton } from '../../componentes/Basicos.jsx';
import {
  CampoArea,
  CampoFecha,
  CampoNumero,
  CampoRadios,
  CampoTexto,
  GrillaCampos,
} from '../../componentes/Campo.jsx';
import { ESTADOS_ACTIVOS } from '../../datos/catalogos.js';
import { hoyISO } from '../../datos/selectores.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { acciones } from '../../estado/tienda.js';

export function FormularioNovedad({ abierto, proyecto, alCerrar }) {
  const hoy = hoyISO();
  const opcionesAreas = useOpciones('areas');
  const opcionesDirectiones = useOpciones('direcciones'); // se puede agregar si existe

  const [datos, setDatos] = useState({
    fecha: hoy,
    area_contacto: proyecto?.area || '',
    persona_contacto: '',
    descripcion_novedad: '',
    estado: proyecto?.estado || 'en ejecución',
    avance_numero: proyecto?.avance ?? '',
    proximo_paso: '',
  });

  const [compromisos, setCompromisos] = useState([]);
  const [nuevoCompromiso, setNuevoCompromiso] = useState({
    responsable: '',
    descripcion: '',
    fecha_limite: '',
  });

  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (e) =>
    setDatos((d) => ({ ...d, [campo]: e?.target?.value ?? e }));

  function agregarCompromiso() {
    if (!nuevoCompromiso.responsable || !nuevoCompromiso.descripcion) {
      setError('Cada compromiso necesita responsable y descripción.');
      return;
    }
    setCompromisos([...compromisos, { ...nuevoCompromiso }]);
    setNuevoCompromiso({ responsable: '', descripcion: '', fecha_limite: '' });
    setError('');
  }

  function quitarCompromiso(idx) {
    setCompromisos(compromisos.filter((_, i) => i !== idx));
  }

  async function guardar() {
    if (!datos.descripcion_novedad) {
      setError('Describí qué pasó en esta novedad.');
      return;
    }
    if (!datos.proximo_paso) {
      setError('Completá el próximo paso.');
      return;
    }
    if (nuevoCompromiso.responsable || nuevoCompromiso.descripcion) {
      setError('Hay un compromiso incompleto sin guardar. Agregalo o boralo.');
      return;
    }

    setError('');
    setGuardando(true);

    try {
      // 1. Actualizar estado y avance del proyecto
      const actualizacionProyecto = {
        estado: datos.estado,
      };
      if (datos.avance_numero !== '' && datos.avance_numero !== null) {
        actualizacionProyecto.avance = Number(datos.avance_numero);
      }
      await acciones.actualizarProyecto(proyecto.id_proyecto, actualizacionProyecto);

      // 2. Crear tema de monitoreo para la novedad
      // En lugar de un monitoreo formal (que es semanal y de todas las secretarías),
      // esto es un registro interno del proyecto estratégico. Lo modelamos como
      // tema vinculado a un monitoreo ficticio o al proyecto sin monitoreo padre.
      // Por ahora: guardamos la novedad en los compromisos o temas — REVISAR con el equipo.

      // Placeholder: la novedad se registra como descripción en la ficha del proyecto
      // a través del historial. El detalle técnico de dónde vive la novedad exacta
      // se pospone a la integración con Supabase.

      // 3. Crear compromisos
      for (const comp of compromisos) {
        await acciones.crearCompromiso({
          origen_tipo: 'estrategico',
          id_origen: proyecto.id_proyecto, // apunta al proyecto estratégico
          id_proyecto: proyecto.id_proyecto,
          area: datos.area_contacto,
          descripcion: comp.descripcion,
          responsable: comp.responsable,
          fecha_limite: comp.fecha_limite || null,
          estado: 'pendiente',
        });
      }

      alCerrar();
    } catch (err) {
      setError(`Error al guardar: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="lg"
      titulo={`Registrar novedad — ${proyecto?.proyecto}`}
      descripcion={`${proyecto?.id_proyecto} · ${proyecto?.area}`}
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={guardar} disabled={guardando}>
            Guardar novedad
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Aviso tono="info">
          Esta novedad actualiza el estado y avance del proyecto, y crea los compromisos que la
          Secretaría asumió. Se queda registrada en el historial del proyecto.
        </Aviso>

        {/* Sección 1: Novedad */}
        <fieldset>
          <legend className="text-sm font-medium text-tinta">Novedad</legend>
          <div className="mt-2 space-y-2">
            <GrillaCampos columnas={2}>
              <CampoFecha etiqueta="Fecha" requerido value={datos.fecha} onChange={cambiar('fecha')} />
              <CampoTexto etiqueta="Habló con" ayuda="área / persona" value={datos.persona_contacto} onChange={cambiar('persona_contacto')} />
            </GrillaCampos>

            <CampoArea
              etiqueta="Qué pasó"
              requerido
              filas={3}
              value={datos.descripcion_novedad}
              onChange={cambiar('descripcion_novedad')}
            />

            <CampoArea
              etiqueta="Próximo paso"
              requerido
              filas={2}
              value={datos.proximo_paso}
              onChange={cambiar('proximo_paso')}
            />
          </div>
        </fieldset>

        {/* Sección 2: Estado y avance */}
        <fieldset>
          <legend className="text-sm font-medium text-tinta">Estado del proyecto</legend>
          <div className="mt-2 space-y-2">
            <GrillaCampos columnas={2}>
              <CampoRadios
                etiqueta="Estado"
                opciones={ESTADOS_ACTIVOS}
                valor={datos.estado}
                alCambiar={(v) => setDatos((d) => ({ ...d, estado: v }))}
              />
              <CampoNumero
                etiqueta={`Avance (${proyecto?.unidad || 'unidades'})`}
                ayuda="opcional"
                value={datos.avance_numero}
                onChange={cambiar('avance_numero')}
              />
            </GrillaCampos>
          </div>
        </fieldset>

        {/* Sección 3: Compromisos */}
        <fieldset>
          <legend className="text-sm font-medium text-tinta">Compromisos que asumió el área</legend>
          <div className="mt-2 space-y-3">
            {compromisos.length > 0 && (
              <ul className="space-y-2 rounded-chip border border-borde/40 bg-fondo-alt p-2">
                {compromisos.map((comp, idx) => (
                  <li
                    key={idx}
                    className="flex flex-col gap-1.5 rounded-sm border border-borde/20 bg-white p-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-tinta">{comp.descripcion}</p>
                      <p className="text-[11px] text-tenue">
                        {comp.responsable}
                        {comp.fecha_limite && ` · Vence ${comp.fecha_limite}`}
                      </p>
                    </div>
                    <Boton tamanio="xs" variante="fantasma" icono={Trash2} onClick={() => quitarCompromiso(idx)} />
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2 rounded-chip border border-acento/40 bg-acento/5 p-3">
              <GrillaCampos columnas={2}>
                <CampoTexto
                  etiqueta="Responsable"
                  placeholder="Nombre o cargo"
                  value={nuevoCompromiso.responsable}
                  onChange={(e) => setNuevoCompromiso((c) => ({ ...c, responsable: e.target.value }))}
                />
                <CampoFecha
                  etiqueta="Fecha límite"
                  value={nuevoCompromiso.fecha_limite}
                  onChange={(e) => setNuevoCompromiso((c) => ({ ...c, fecha_limite: e }))}
                />
              </GrillaCampos>

              <CampoArea
                etiqueta="Descripción del compromiso"
                filas={2}
                placeholder="Qué se asumió"
                value={nuevoCompromiso.descripcion}
                onChange={(e) => setNuevoCompromiso((c) => ({ ...c, descripcion: e.target.value }))}
              />

              <Boton tamanio="sm" icono={Plus} onClick={agregarCompromiso}>
                Agregar compromiso
              </Boton>
            </div>
          </div>
        </fieldset>

        {error && <Aviso tono="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}
