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
import { CampoArea } from '../../componentes/Campo.jsx';
import { SelectorProyecto } from '../../componentes/SelectorProyecto.jsx';
import { hoyISO } from '../../datos/selectores.js';
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

  const [idProyecto, setIdProyecto] = useState(proyecto?.id_proyecto ?? candidato?.id_proyecto ?? '');
  const [datos, setDatos] = useState({
    descripcion_estrategica: proyecto?.descripcion_estrategica ?? '',
    compromiso_publico: proyecto?.compromiso_publico ?? candidato?.titulo ?? '',
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
    if (!datos.descripcion_estrategica) {
      setError('Describí el proyecto: es lo que después explica por qué está en la cartera.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      const payload = { ...datos };
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
    } catch (err) {
      setError(`No se pudo guardar el proyecto estratégico: ${err.message}`);
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
          : 'El proyecto no se duplica: es el mismo de la base maestra, con seguimiento propio.'
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

        <CampoArea
          etiqueta="Descripción del proyecto"
          requerido
          filas={3}
          value={datos.descripcion_estrategica}
          onChange={cambiar('descripcion_estrategica')}
          placeholder="En qué consiste y por qué está en la cartera estratégica"
        />

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
