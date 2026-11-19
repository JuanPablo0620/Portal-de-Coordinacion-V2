/**
 * Selector de período de Bacheo: semana, mes o trimestre, en un mini
 * calendario que se abre sobre la pantalla.
 *
 * Reemplaza al desplegable de semanas, que con un año entero cargado era una
 * lista de 36 renglones sin forma de saltar a «octubre» o al «3.er trimestre»
 * (a pedido de JP, 19/11/2026).
 *
 * Decisiones:
 *  - En la vista «Semana» se elige la FILA entera del calendario, no un día:
 *    la unidad de la programación es la semana y elegir un miércoles para
 *    terminar viendo de lunes a viernes confunde.
 *  - Las semanas, meses y trimestres sin programación cargada quedan
 *    deshabilitados, no ocultos: así se ve el hueco (febrero, la del 27/07) y
 *    nadie piensa que el calendario está roto.
 *  - Las flechas al lado del botón saltan al período anterior o siguiente CON
 *    datos, del mismo tipo, sin abrir el calendario.
 *  - Escape y el clic afuera cierran; al cerrar, el foco vuelve al botón.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Conmutador } from '../../componentes/Basicos.jsx';
import { nombreMes } from '../../utilidades/formato.js';
import { diaYMes } from '../../datos/bacheo/semana.js';
import {
  MESES_CORTOS,
  conteoPorPeriodo,
  filasDelMes,
  mesDe,
  mesesDelTrimestre,
  nombreTrimestre,
  periodoVecino,
  rangoPeriodo,
  rotuloPeriodo,
  sumarDias,
} from '../../datos/bacheo/periodo.js';

const VISTAS = [
  { valor: 'semana', titulo: 'Semana' },
  { valor: 'mes', titulo: 'Mes' },
  { valor: 'trimestre', titulo: 'Trimestre' },
];
const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const claseFlecha =
  'flex h-8 w-8 items-center justify-center rounded-chip text-gris transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40';

/** Año y mes (0-11) de una fecha ISO. */
const anioMes = (s) => ({ anio: Number(s.slice(0, 4)), mes: Number(s.slice(5, 7)) - 1 });

export function SelectorPeriodo({ semanas, periodo, alCambiar, hoy }) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState(periodo.tipo);
  const [cursor, setCursor] = useState(() => anioMes(rangoPeriodo(periodo).desde));
  const contenedor = useRef(null);
  const disparador = useRef(null);
  const panel = useRef(null);

  const conDatos = useMemo(() => new Set(semanas.map((s) => s.lunes)), [semanas]);
  // Límites de navegación: del mes de la semana más vieja al de la más nueva.
  const limites = useMemo(() => {
    const lunes = semanas.map((s) => s.lunes).sort();
    if (!lunes.length) return null;
    return { primero: mesDe(lunes[0]), ultimo: mesDe(sumarDias(lunes[lunes.length - 1], 4)) };
  }, [semanas]);

  const anterior = periodoVecino(semanas, periodo, -1);
  const siguiente = periodoVecino(semanas, periodo, 1);

  const abrir = () => {
    setVista(periodo.tipo);
    setCursor(anioMes(rangoPeriodo(periodo).desde));
    setAbierto(true);
  };
  const cerrar = (devolverFoco) => {
    setAbierto(false);
    if (devolverFoco) disparador.current?.focus();
  };
  const elegir = (p) => {
    alCambiar(p);
    cerrar(true);
  };

  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cerrar(true);
      }
    };
    const alApretar = (e) => {
      if (!contenedor.current?.contains(e.target)) cerrar(false);
    };
    document.addEventListener('keydown', alTeclear);
    document.addEventListener('mousedown', alApretar);
    // El foco entra en lo elegido; si no hay nada elegido en esta vista, al panel.
    const objetivo = panel.current?.querySelector('[data-elegido="true"]') ?? panel.current;
    objetivo?.focus();
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.removeEventListener('mousedown', alApretar);
    };
    // Solo al abrir y cerrar: `cerrar` es estable en lo que importa (setAbierto y una ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const moverMes = (paso) => {
    const d = new Date(Date.UTC(cursor.anio, cursor.mes + paso, 1));
    setCursor({ anio: d.getUTCFullYear(), mes: d.getUTCMonth() });
  };
  const moverAnio = (paso) => setCursor((c) => ({ ...c, anio: c.anio + paso }));

  const claveCursor = `${cursor.anio}-${String(cursor.mes + 1).padStart(2, '0')}`;
  const anioLimite = (lado) => Number(limites?.[lado].slice(0, 4));
  const puedeAtras = vista === 'semana' ? claveCursor > (limites?.primero ?? '') : cursor.anio > anioLimite('primero');
  const puedeAdelante = vista === 'semana' ? claveCursor < (limites?.ultimo ?? '') : cursor.anio < anioLimite('ultimo');

  const rotulo = rotuloPeriodo(periodo, semanas);

  return (
    <div ref={contenedor} className="relative flex items-center gap-1">
      <button
        type="button"
        className={claseFlecha}
        disabled={!anterior}
        onClick={() => anterior && alCambiar(anterior)}
        aria-label={anterior ? `Anterior: ${rotuloPeriodo(anterior, semanas)}` : 'No hay un período anterior cargado'}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        ref={disparador}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={`Período: ${rotulo}. Cambiar`}
        onClick={() => (abierto ? cerrar(false) : abrir())}
        className="inline-flex min-w-[14rem] items-center justify-between gap-2 rounded-chip border border-borde-fuerte bg-card px-3 py-1.5 text-sm text-tinta transition hover:bg-paper"
      >
        <CalendarDays size={15} className="shrink-0 text-gris" aria-hidden="true" />
        <span className="flex-1 text-left">{rotulo}</span>
        <ChevronDown size={15} className={`shrink-0 text-gris transition ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={claseFlecha}
        disabled={!siguiente}
        onClick={() => siguiente && alCambiar(siguiente)}
        aria-label={siguiente ? `Siguiente: ${rotuloPeriodo(siguiente, semanas)}` : 'No hay un período siguiente cargado'}
      >
        <ChevronRight size={16} />
      </button>

      {abierto && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Elegir período"
          tabIndex={-1}
          className="absolute top-full right-0 z-30 mt-2 flex w-[19.5rem] flex-col gap-3 rounded-card border border-borde bg-card p-3 shadow-flotante"
        >
          <Conmutador
            opciones={VISTAS}
            valor={vista}
            alCambiar={setVista}
            etiqueta="Ver por"
            className="[&>button]:flex-1 [&>button]:justify-center"
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              className={claseFlecha}
              disabled={!puedeAtras}
              onClick={() => (vista === 'semana' ? moverMes(-1) : moverAnio(-1))}
              aria-label={vista === 'semana' ? 'Mes anterior' : 'Año anterior'}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-tinta" aria-live="polite">
              {vista === 'semana' ? nombreMes(cursor.anio, cursor.mes) : cursor.anio}
            </span>
            <button
              type="button"
              className={claseFlecha}
              disabled={!puedeAdelante}
              onClick={() => (vista === 'semana' ? moverMes(1) : moverAnio(1))}
              aria-label={vista === 'semana' ? 'Mes siguiente' : 'Año siguiente'}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {vista === 'semana' && (
            <VistaSemanas
              anio={cursor.anio}
              mes={cursor.mes}
              conDatos={conDatos}
              elegida={periodo.tipo === 'semana' ? periodo.valor : ''}
              hoy={hoy}
              alElegir={(lunes) => elegir({ tipo: 'semana', valor: lunes })}
            />
          )}
          {vista !== 'semana' && (
            <VistaGrilla
              tipo={vista}
              celdas={conteoPorPeriodo(semanas, vista, cursor.anio)}
              elegido={periodo.tipo === vista ? periodo.valor : ''}
              alElegir={(valor) => elegir({ tipo: vista, valor })}
            />
          )}

          <p className="text-xs text-tenue">Lo que aparece apagado no tiene programación cargada.</p>
        </div>
      )}
    </div>
  );
}

function VistaSemanas({ anio, mes, conDatos, elegida, hoy, alElegir }) {
  const filas = filasDelMes(anio, mes);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="grid grid-cols-7 px-1 text-center text-[11px] font-semibold text-tenue" aria-hidden="true">
        {LETRAS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      {filas.map(({ lunes, dias }) => {
        const hay = conDatos.has(lunes);
        const activa = lunes === elegida;
        return (
          <button
            key={lunes}
            type="button"
            disabled={!hay}
            aria-pressed={activa}
            data-elegido={activa}
            aria-label={`Semana del ${diaYMes(lunes)} al ${diaYMes(sumarDias(lunes, 4))}${hay ? '' : ', sin programación cargada'}`}
            onClick={() => alElegir(lunes)}
            className={`grid h-8 grid-cols-7 items-center rounded-chip border px-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
              activa
                ? 'border-acento bg-acento-suave font-semibold text-acento-fuerte'
                : 'border-transparent text-tinta enabled:hover:bg-paper'
            }`}
          >
            {dias.map(({ fecha, delMes }, i) => (
              <span
                key={fecha}
                aria-hidden="true"
                className={`text-center ${!delMes || i > 4 ? 'text-tenue' : ''} ${
                  fecha === hoy ? 'underline decoration-2 underline-offset-2' : ''
                }`}
              >
                {Number(fecha.slice(8, 10))}
              </span>
            ))}
          </button>
        );
      })}
    </div>
  );
}

function VistaGrilla({ tipo, celdas, elegido, alElegir }) {
  return (
    <div className={`grid gap-1.5 ${tipo === 'mes' ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {celdas.map(({ valor, numero, semanas }) => {
        const activo = valor === elegido;
        const titulo = tipo === 'mes' ? MESES_CORTOS[numero - 1] : nombreTrimestre(numero);
        const detalle = `${tipo === 'trimestre' ? `${mesesDelTrimestre(numero)} · ` : ''}${
          semanas ? `${semanas} sem.` : 'sin datos'
        }`;
        return (
          <button
            key={valor}
            type="button"
            disabled={!semanas}
            aria-pressed={activo}
            data-elegido={activo}
            onClick={() => alElegir(valor)}
            className={`flex flex-col items-center gap-0.5 rounded-chip border px-2 py-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${
              activo
                ? 'border-acento bg-acento-suave text-acento-fuerte'
                : 'border-borde text-tinta enabled:hover:bg-paper'
            }`}
          >
            <span className="text-sm font-semibold">{titulo}</span>
            <span className={`text-[11px] ${activo ? '' : 'text-tenue'}`}>{detalle}</span>
          </button>
        );
      })}
    </div>
  );
}
