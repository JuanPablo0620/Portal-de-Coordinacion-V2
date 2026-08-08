import { useState } from 'react';
import { Modal } from '../../componentes/Modal.jsx';
import { Boton } from '../../componentes/Basicos.jsx';
import { CampoArea, CampoRadios, CampoSelect, CampoTexto, GrillaCampos } from '../../componentes/Campo.jsx';
import { SelectorProyecto } from '../../componentes/SelectorProyecto.jsx';
import { ESTADOS_MESA, TIPOS_MESA } from '../../datos/catalogos.js';
import { useOpciones } from '../../utilidades/catalogos.js';
import { acciones } from '../../estado/tienda.js';

const VACIO = {
  nombre: '',
  tipo: 'temática',
  descripcion: '',
  referente: '',
  periodicidad: 'mensual',
  estado: 'activa',
  proyectos_vinculados: [],
};

export function FormularioMesa({ abierto, alCerrar, mesa, tipoInicial }) {
  const esEdicion = Boolean(mesa);
  const [datos, setDatos] = useState(() => (mesa ? { ...VACIO, ...mesa } : { ...VACIO, tipo: tipoInicial ?? 'temática' }));
  const [error, setError] = useState('');
  const opcionesPeriodicidad = useOpciones('periodicidades');

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  async function guardar() {
    if (!datos.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    const payload = {
      nombre: datos.nombre.trim(),
      tipo: datos.tipo,
      descripcion: datos.descripcion,
      referente: datos.referente,
      periodicidad: datos.periodicidad,
      estado: datos.estado,
      proyectos_vinculados: datos.proyectos_vinculados,
    };
    if (esEdicion) await acciones.actualizarMesa(mesa.id, payload);
    else await acciones.crearMesa(payload);
    alCerrar();
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="md"
      titulo={esEdicion ? 'Editar mesa' : 'Nueva mesa de trabajo'}
      descripcion="El tipo define en qué pestaña aparece: la separación es estructural, no un filtro."
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={guardar}>
            {esEdicion ? 'Guardar cambios' : 'Crear mesa'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <CampoTexto
          etiqueta="Nombre"
          requerido
          value={datos.nombre}
          onChange={cambiar('nombre')}
          placeholder="Ej.: Mesa de Movilidad Urbana"
          error={error}
        />

        <CampoRadios
          etiqueta="Tipo"
          requerido
          opciones={TIPOS_MESA}
          valor={datos.tipo}
          alCambiar={(v) => setDatos((d) => ({ ...d, tipo: v }))}
        />

        <CampoArea
          etiqueta="Descripción"
          filas={3}
          value={datos.descripcion}
          onChange={cambiar('descripcion')}
          placeholder="Qué articula esta mesa y con quiénes."
        />

        <GrillaCampos columnas={3}>
          <CampoTexto etiqueta="Referente" value={datos.referente} onChange={cambiar('referente')} />
          <CampoSelect
            etiqueta="Periodicidad"
            ayuda="define el aviso"
            opciones={opcionesPeriodicidad}
            value={datos.periodicidad}
            onChange={cambiar('periodicidad')}
            placeholder=""
          />
          <CampoSelect etiqueta="Estado" opciones={ESTADOS_MESA} value={datos.estado} onChange={cambiar('estado')} placeholder="" />
        </GrillaCampos>

        <SelectorProyecto
          multiple
          etiqueta="Proyectos vinculados"
          ayuda="opcional"
          valor={datos.proyectos_vinculados}
          alCambiar={(v) => setDatos((d) => ({ ...d, proyectos_vinculados: v }))}
          maxAltura={180}
        />
      </div>
    </Modal>
  );
}
