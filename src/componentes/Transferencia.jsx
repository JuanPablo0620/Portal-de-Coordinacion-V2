/**
 * Bloque de transferencia de texto a campos.
 *
 * Un solo gesto, el mismo en todo el sistema: se pega el texto tal como salió
 * de la reunión, se aprieta «Transferir» y el sistema PROPONE los campos, que
 * quedan editables abajo. Nada se guarda al transferir.
 *
 * Está acá y no dentro de un módulo porque seguimiento y monitoreo lo usan
 * igual: si la carga desde texto se comporta distinto en cada pantalla, quien
 * carga tiene que aprenderla dos veces.
 */
import { ArrowDownToLine, RotateCcw } from 'lucide-react';
import { Aviso, Boton, Chip, Tarjeta } from './Basicos.jsx';
import { CampoArea } from './Campo.jsx';

export function Transferencia({
  titulo,
  descripcion,
  etiquetaCampo,
  placeholder,
  ayuda,
  texto,
  alCambiarTexto,
  alTransferir,
  transferido = false,
  resumen = '',
  filas = 8,
  deshabilitado = false,
}) {
  const sinTexto = !texto.trim();

  return (
    <Tarjeta
      titulo={titulo}
      descripcion={descripcion}
      acciones={transferido ? <Chip tono="enregla">transferido</Chip> : null}
    >
      <CampoArea
        filas={filas}
        value={texto}
        onChange={(e) => alCambiarTexto(e.target.value)}
        // Sin etiqueta visible: el título de la tarjeta ya dice qué es, pero el
        // lector de pantalla no lo lee al enfocar el campo.
        aria-label={etiquetaCampo}
        placeholder={placeholder}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borde pt-3">
        <p className="mr-auto max-w-xl text-xs text-tenue">{transferido ? resumen : ayuda}</p>
        <Boton
          variante={transferido ? 'secundario' : 'primario'}
          icono={transferido ? RotateCcw : ArrowDownToLine}
          onClick={alTransferir}
          disabled={sinTexto || deshabilitado}
        >
          {transferido ? 'Volver a transferir' : 'Transferir'}
        </Boton>
      </div>

      {transferido && (
        <div className="mt-3">
          <Aviso tono="alerta" titulo="Revisá antes de confirmar">
            Los campos de abajo son una <strong>propuesta del sistema</strong> y están todos
            editables. Volver a transferir reemplaza lo que todavía no confirmaste.
          </Aviso>
        </div>
      )}
    </Tarjeta>
  );
}
