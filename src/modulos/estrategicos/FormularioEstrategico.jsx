/**
 * Declaración de un proyecto como estratégico.
 *
 * El mismo formulario sirve para los tres caminos —marcar uno de la base
 * maestra, editar los datos estratégicos de uno ya declarado y promover un
 * candidato que salió de monitoreo o de seguimiento— porque los campos son los
 * mismos. Lo único que cambia es de dónde viene el proyecto, y eso queda
 * asentado en el origen.
 */
import { useState } from 'react';
import { Modal } from '../../componentes/Modal.jsx';
import { Aviso, Boton, Chip } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoFecha, CampoRadios, CampoSelect, CampoTexto, GrillaCampos } from '../../componentes/Campo.jsx';
import { SelectorProyecto } from '../../componentes/SelectorProyecto.jsx';
import { PRIORIDADES } from '../../datos/catalogos.js';
import { hoyISO } from '../../datos/selectores.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { acciones } from '../../estado/tienda.js';

const ETIQUETA_ORIGEN = {
  base: 'declarado desde la base maestra',
  monitoreo: 'promovido desde un tema de monitoreo',
  seguimiento: 'promovido desde un seguimiento',
};

/**
 * @param {object} candidato cuando la promoción viene de monitoreo o seguimiento:
 *   `{ origen_tipo, id_origen, id_proyecto, titulo, detalle }`
 * @param {object} proyecto proyecto ya cargado que se marca o se edita
 */
export function FormularioEstrategico({ abierto, alCerrar, proyecto, candidato }) {
  const esEdicion = Boolean(proyecto?.estrategico);
  const opcionesMotivo = useOpciones('motivos_estrategicos');

  const [idProyecto, setIdProyecto] = useState(proyecto?.id_proyecto ?? candidato?.id_proyecto ?? '');
  const [datos, setDatos] = useState({
    prioridad_estrategica: proyecto?.prioridad_estrategica ?? 'alta',
    motivo_estrategico: proyecto?.motivo_estrategico ?? '',
    responsable_politico: proyecto?.responsable_politico ?? '',
    compromiso_publico: proyecto?.compromiso_publico ?? candidato?.titulo ?? '',
    fecha_compromiso: proyecto?.fecha_compromiso ?? '',
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const origen = candidato?.origen_tipo ?? proyecto?.origen_estrategico ?? 'base';
  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e?.target?.value ?? e }));

  async function guardar() {
    if (!idProyecto) {
      setError('Elegí el proyecto que se declara estratégico.');
      return;
    }
    if (!datos.motivo_estrategico) {
      setError('Indicá por qué es estratégico: es lo que después justifica la prioridad.');
      return;
    }
    if (datos.fecha_compromiso && datos.fecha_compromiso < hoyISO() && !esEdicion) {
      setError('La fecha comprometida no puede ser anterior a hoy.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      const payload = { ...datos, fecha_compromiso: datos.fecha_compromiso || null };
      if (candidato) {
        await acciones.promoverAEstrategico({
          origen_tipo: candidato.origen_tipo,
          id_origen: candidato.id_origen,
          id_proyecto: idProyecto,
          ...payload,
        });
      } else {
        await acciones.marcarEstrategico(idProyecto, {
          ...payload,
          origen_estrategico: proyecto?.origen_estrategico ?? 'base',
          id_origen_estrategico: proyecto?.id_origen_estrategico ?? null,
          fecha_marcado_estrategico: proyecto?.fecha_marcado_estrategico ?? hoyISO(),
        });
      }
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
      titulo={esEdicion ? 'Editar datos estratégicos' : 'Declarar proyecto estratégico'}
      descripcion={
        esEdicion
          ? 'Los cambios quedan en el historial del proyecto.'
          : 'El proyecto no se duplica: es el mismo de la base maestra, con prioridad y seguimiento propios.'
      }
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={guardar} disabled={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Declarar estratégico'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {candidato && (
          <Aviso tono="info" titulo={`Señal ${ETIQUETA_ORIGEN[candidato.origen_tipo] ?? ''}`}>
            <p className="mt-0.5">{candidato.titulo}</p>
            {candidato.detalle && <p className="mt-0.5 text-tenue">{candidato.detalle}</p>}
          </Aviso>
        )}

        {proyecto || candidato?.id_proyecto ? (
          <div className="flex flex-wrap items-center gap-2 rounded-chip bg-paper px-3 py-2">
            <span className="text-xs text-gris">Proyecto</span>
            <Chip tono="acento">{idProyecto}</Chip>
            <span className="min-w-0 truncate text-sm text-tinta">{proyecto?.proyecto ?? candidato?.proyecto}</span>
          </div>
        ) : (
          <SelectorProyecto
            etiqueta="Proyecto de la base maestra"
            requerido
            ayuda="el tema no tiene proyecto vinculado: elegí a cuál corresponde"
            valor={idProyecto}
            alCambiar={setIdProyecto}
            maxAltura={180}
          />
        )}

        <GrillaCampos columnas={2}>
          <CampoRadios
            etiqueta="Prioridad estratégica"
            requerido
            opciones={PRIORIDADES}
            valor={datos.prioridad_estrategica}
            alCambiar={(v) => setDatos((d) => ({ ...d, prioridad_estrategica: v }))}
          />
          <CampoSelect
            etiqueta="Por qué es estratégico"
            requerido
            opciones={opcionesMotivo}
            value={datos.motivo_estrategico}
            onChange={cambiar('motivo_estrategico')}
          />
        </GrillaCampos>

        <GrillaCampos columnas={2}>
          <CampoTexto
            etiqueta="Responsable político"
            ayuda="quién responde por él"
            value={datos.responsable_politico}
            onChange={cambiar('responsable_politico')}
          />
          <CampoFecha
            etiqueta="Fecha comprometida"
            ayuda="opcional"
            value={datos.fecha_compromiso}
            onChange={cambiar('fecha_compromiso')}
          />
        </GrillaCampos>

        <CampoArea
          etiqueta="Compromiso público"
          filas={2}
          value={datos.compromiso_publico}
          onChange={cambiar('compromiso_publico')}
          placeholder="Dónde se comprometió: sesión del Concejo, audiencia vecinal, convenio con el organismo…"
        />

        <Aviso tono="alerta">
          Un proyecto estratégico se vigila más de cerca: el sistema avisa a los{' '}
          <strong>15 días sin novedades</strong>, la mitad que el resto de la cartera.
          {origen !== 'base' && ` Queda registrado que fue ${ETIQUETA_ORIGEN[origen]}.`}
        </Aviso>

        {error && <Aviso tono="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}
