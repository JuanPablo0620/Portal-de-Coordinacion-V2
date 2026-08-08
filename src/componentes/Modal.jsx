import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Boton } from './Basicos.jsx';

const ANCHOS = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export function Modal({ abierto, alCerrar, titulo, descripcion, ancho = 'md', pie, children }) {
  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarConEscape = (e) => {
      if (e.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', cerrarConEscape);
    // Evita que el fondo scrollee detrás del modal
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', cerrarConEscape);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  return (
    <div className="no-imprimir fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-tinta/40 p-4 sm:p-8">
      <div
        className={`tarjeta my-auto w-full ${ANCHOS[ancho]} shadow-flotante`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <header className="flex items-start justify-between gap-3 border-b border-borde px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-tinta">{titulo}</h2>
            {descripcion && <p className="mt-0.5 text-xs text-gris">{descripcion}</p>}
          </div>
          <button
            type="button"
            onClick={alCerrar}
            className="-mr-1 shrink-0 rounded-chip p-1.5 text-tenue transition hover:bg-paper hover:text-tinta"
            aria-label="Cerrar"
          >
            <X size={17} />
          </button>
        </header>
        <div className="scroll-fino max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {pie && <footer className="flex items-center justify-end gap-2 border-t border-borde px-5 py-3">{pie}</footer>}
      </div>
    </div>
  );
}

/** Confirmación para acciones destructivas o irreversibles. */
export function ModalConfirmacion({
  abierto,
  alCerrar,
  alConfirmar,
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  variante = 'primario',
}) {
  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={titulo}
      ancho="sm"
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton
            variante={variante}
            onClick={() => {
              alConfirmar();
              alCerrar();
            }}
          >
            {textoConfirmar}
          </Boton>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-gris">{mensaje}</p>
    </Modal>
  );
}
