/**
 * Alta y edición de una acción de posicionamiento internacional.
 *
 * El formulario está ordenado como se decide una acción de estas: primero qué
 * es y con quién, después en qué punto del embudo está, y al final con qué se
 * la respalda —los ODS a los que contribuye y los proyectos del municipio que
 * la sostienen—, que es lo que después hay que escribir en la postulación.
 */
import { useState } from 'react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton } from '../../componentes/Basicos.jsx';
import {
  CampoArea,
  CampoFecha,
  CampoNumero,
  CampoRadios,
  CampoSelect,
  CampoTexto,
  GrillaCampos,
} from '../../componentes/Campo.jsx';
import { SelectorProyecto } from '../../componentes/SelectorProyecto.jsx';
import { SelectorODS } from './SelectorODS.jsx';
import { ALCANCES_INTERNACIONAL, ESTADOS_INTERNACIONAL } from '../../datos/catalogos.js';
import { hoyISO } from '../../datos/selectores.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { acciones } from '../../estado/tienda.js';

const VACIA = {
  nombre: '',
  tipo: '',
  organismo: '',
  pais: '',
  alcance: 'bilateral',
  estado: 'identificada',
  area: '',
  referente: '',
  descripcion: '',
  fecha_inicio: '',
  fecha_limite: '',
  fecha_resolucion: '',
  financiamiento_usd: '',
  ods: [],
  ids_proyecto: [],
  resultado: '',
};

/** Estados en los que ya hubo respuesta y tiene sentido registrar el resultado. */
const RESUELTOS = ['vigente', 'cerrada', 'no prosperó'];

export function FormularioAccion({ abierto, alCerrar, accion }) {
  const esEdicion = Boolean(accion);
  const [datos, setDatos] = useState(() =>
    accion
      ? { ...VACIA, ...accion, fecha_limite: accion.fecha_limite ?? '', fecha_resolucion: accion.fecha_resolucion ?? '' }
      : { ...VACIA, fecha_inicio: hoyISO() },
  );
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const opcionesTipo = useOpciones('tipos_accion_internacional');
  const opcionesOrganismo = useOpciones('organismos_internacionales');
  const opcionesPais = useOpciones('paises_contraparte');
  const opcionesArea = useOpciones('areas');

  const cambiar = (campo) => (e) => {
    setDatos((d) => ({ ...d, [campo]: e?.target?.value ?? e }));
    setErrores((x) => ({ ...x, [campo]: undefined }));
  };

  function validar() {
    const e = {};
    if (!datos.nombre.trim()) e.nombre = 'Requerido';
    if (!datos.tipo) e.tipo = 'Requerido';
    if (!datos.estado) e.estado = 'Requerido';
    if (datos.fecha_limite && datos.fecha_inicio && datos.fecha_limite < datos.fecha_inicio) {
      e.fecha_limite = 'No puede ser anterior al inicio';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    setGuardando(true);
    try {
      const payload = {
        ...datos,
        nombre: datos.nombre.trim(),
        financiamiento_usd: Number(datos.financiamiento_usd) || 0,
        fecha_limite: datos.fecha_limite || null,
        fecha_resolucion: datos.fecha_resolucion || null,
        ods: [...datos.ods].sort((a, b) => a - b),
      };
      if (esEdicion) await acciones.actualizarAccionInternacional(accion.id, payload);
      else await acciones.crearAccionInternacional(payload);
      alCerrar();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="lg"
      titulo={esEdicion ? 'Editar acción internacional' : 'Nueva acción internacional'}
      descripcion={
        esEdicion
          ? 'Los cambios quedan registrados en el historial.'
          : 'Hermanamientos, redes, postulaciones, premios y misiones del municipio.'
      }
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={guardar} disabled={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Crear acción'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <CampoTexto
          etiqueta="Nombre de la acción"
          requerido
          value={datos.nombre}
          onChange={cambiar('nombre')}
          error={errores.nombre}
          placeholder="Ej.: Postulación al fondo de resiliencia urbana"
        />

        <GrillaCampos columnas={3}>
          <CampoSelect etiqueta="Tipo" requerido opciones={opcionesTipo} value={datos.tipo} onChange={cambiar('tipo')} error={errores.tipo} />
          <CampoSelect etiqueta="Organismo o red" opciones={opcionesOrganismo} value={datos.organismo} onChange={cambiar('organismo')} />
          <CampoSelect etiqueta="País contraparte" opciones={opcionesPais} value={datos.pais} onChange={cambiar('pais')} />
        </GrillaCampos>

        <GrillaCampos columnas={2}>
          <CampoRadios
            etiqueta="Alcance"
            opciones={ALCANCES_INTERNACIONAL}
            valor={datos.alcance}
            alCambiar={(v) => setDatos((d) => ({ ...d, alcance: v }))}
          />
          <CampoSelect
            etiqueta="Estado"
            requerido
            opciones={ESTADOS_INTERNACIONAL}
            value={datos.estado}
            onChange={cambiar('estado')}
            placeholder=""
            error={errores.estado}
          />
        </GrillaCampos>

        <GrillaCampos columnas={2}>
          <CampoSelect etiqueta="Área que la impulsa" opciones={opcionesArea} value={datos.area} onChange={cambiar('area')} />
          <CampoTexto etiqueta="Referente" value={datos.referente} onChange={cambiar('referente')} placeholder="Quién la lleva adelante" />
        </GrillaCampos>

        <fieldset className="rounded-chip border border-borde p-3">
          <legend className="px-1 text-xs font-semibold text-gris">Plazos y financiamiento</legend>
          <GrillaCampos columnas={4}>
            <CampoFecha etiqueta="Inicio de la gestión" value={datos.fecha_inicio} onChange={cambiar('fecha_inicio')} />
            <CampoFecha
              etiqueta="Cierre o fecha clave"
              ayuda="convocatoria"
              value={datos.fecha_limite}
              onChange={cambiar('fecha_limite')}
              error={errores.fecha_limite}
            />
            <CampoFecha etiqueta="Resolución" value={datos.fecha_resolucion} onChange={cambiar('fecha_resolucion')} />
            <CampoNumero
              etiqueta="Financiamiento"
              ayuda="USD"
              value={datos.financiamiento_usd}
              onChange={cambiar('financiamiento_usd')}
            />
          </GrillaCampos>
          <p className="mt-2 text-[11px] text-tenue">
            El cierre es lo único que el sistema vigila solo: avisa 30 días antes en el panel de
            alertas y en los vencimientos del inicio.
          </p>
        </fieldset>

        <SelectorODS valor={datos.ods} alCambiar={(ods) => setDatos((d) => ({ ...d, ods }))} />

        <SelectorProyecto
          multiple
          etiqueta="Proyectos que respalda"
          ayuda="opcional"
          valor={datos.ids_proyecto}
          alCambiar={(ids) => setDatos((d) => ({ ...d, ids_proyecto: ids }))}
          maxAltura={170}
        />

        <CampoArea etiqueta="Descripción" filas={3} value={datos.descripcion} onChange={cambiar('descripcion')} />

        {RESUELTOS.includes(datos.estado) ? (
          <CampoArea
            etiqueta="Resultado"
            filas={2}
            value={datos.resultado}
            onChange={cambiar('resultado')}
            placeholder="Qué se obtuvo, o por qué no prosperó"
          />
        ) : (
          <Aviso tono="info">
            El resultado se carga cuando la acción pase a <strong>vigente</strong>,{' '}
            <strong>cerrada</strong> o <strong>no prosperó</strong>. Registrar por qué NO prosperó
            es lo que permite no repetir el error en la convocatoria siguiente.
          </Aviso>
        )}
      </div>
    </Modal>
  );
}
