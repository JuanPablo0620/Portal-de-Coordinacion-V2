/**
 * ─────────────────────────────────────────────────────────────────────
 * MAPA DE OBRAS — plano de coordenadas, sin cartografía de base.
 *
 * Dibuja cada obra en el lugar que dicen su `latitud` y su `longitud`. NO hay
 * mapa de calles debajo, y es a propósito: el sistema no tiene backend ni
 * puede pedir tiles a un servidor externo, y una silueta del partido dibujada
 * a mano sería geografía inventada presentada como dato. Lo que sí es exacto es
 * la posición RELATIVA entre obras y la escala: dos puntos que se ven cerca
 * están cerca, y la barra de abajo dice cuánto.
 *
 * La proyección es equirectangular con corrección por coseno de la latitud —a
 * esta latitud y en un partido de doce kilómetros, el error es despreciable— y
 * el encuadre se estira hasta la proporción del lienzo, nunca al revés: si se
 * ajustara la escala de cada eje por separado, un partido más ancho que alto se
 * vería cuadrado y las distancias mentirían.
 * ─────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState } from 'react';
import { MapPinOff } from 'lucide-react';
import { Chip, Vacio } from './Basicos.jsx';
import { ALTO, ANCHO, encuadrar, escalaDe } from './proyeccionMapa.js';

const COLOR_NIVEL = {
  vencido: 'var(--color-vencido)',
  proximo: 'var(--color-proximo)',
  atencion: 'var(--color-atencion)',
  enregla: 'var(--color-enregla)',
  sindato: 'var(--color-sindato)',
};

export const LEYENDA_NIVEL = [
  ['vencido', 'Fin previsto pasado'],
  ['proximo', 'Vence en ≤ 3 días'],
  ['atencion', 'Vence en ≤ 15 días'],
  ['enregla', 'En plazo o finalizada'],
  ['sindato', 'Suspendida o sin fecha'],
];

export function MapaObras({ obras = [], seleccionada, alSeleccionar, alto = 460 }) {
  const [encima, setEncima] = useState(null);

  const puntos = useMemo(() => obras.filter((o) => o.ubicada), [obras]);
  const vista = useMemo(() => encuadrar(puntos), [puntos]);

  /**
   * Rótulo de cada zona: centrado en sus obras y por ENCIMA de la más alta.
   * Sobre el centroide, el rótulo caía justo sobre un punto en cuanto la zona
   * tenía dos obras, y tapaba el color —que es el dato— con el nombre.
   */
  const zonas = useMemo(() => {
    if (!vista) return [];
    const grupos = new Map();
    for (const p of puntos) {
      const clave = p.zona || 'Sin zona';
      if (!grupos.has(clave)) grupos.set(clave, { zona: clave, sumaLon: 0, n: 0, latMaxima: -Infinity });
      const g = grupos.get(clave);
      g.sumaLon += p.longitud;
      g.n += 1;
      g.latMaxima = Math.max(g.latMaxima, p.latitud);
    }
    return [...grupos.values()].map((g) => ({
      zona: g.zona,
      n: g.n,
      x: vista.x(g.sumaLon / g.n),
      y: vista.y(g.latMaxima) - 20,
    }));
  }, [puntos, vista]);

  if (!vista) {
    return (
      <Vacio
        icono={MapPinOff}
        titulo="Ninguna obra tiene coordenadas cargadas"
        descripcion="El mapa dibuja las obras que tengan latitud y longitud en su ficha. Se cargan a mano o por CSV, en las columnas «latitud» y «longitud»."
      />
    );
  }

  const escala = escalaDe(vista.gradosAlto);
  const activa = encima ?? seleccionada ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-chip border border-borde bg-paper" style={{ height: alto }}>
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="img"
          aria-label={`Plano con ${puntos.length} obra(s) ubicada(s), agrupadas en ${zonas.length} zona(s).`}
        >
          {/* Retícula de referencia: no son calles, es una grilla de encuadre. */}
          <g stroke="var(--color-borde)" strokeWidth="1" opacity="0.7">
            {[1, 2, 3, 4, 5].map((i) => (
              <line key={`v${i}`} x1={(ANCHO / 6) * i} y1="0" x2={(ANCHO / 6) * i} y2={ALTO} />
            ))}
            {[1, 2, 3].map((i) => (
              <line key={`h${i}`} x1="0" y1={(ALTO / 4) * i} x2={ANCHO} y2={(ALTO / 4) * i} />
            ))}
          </g>

          {/* El halo del mismo color que el fondo es lo que mantiene legible el
              rótulo cuando dos zonas quedan cerca y el nombre cruza un punto
              ajeno: sin él, el texto se pierde adentro del círculo. */}
          {zonas.map((z) => (
            <text
              key={z.zona}
              x={z.x}
              y={z.y}
              textAnchor="middle"
              fill="var(--color-tenue)"
              stroke="var(--color-paper)"
              strokeWidth="4"
              paintOrder="stroke"
              style={{ fontSize: 15, fontWeight: 600 }}
            >
              {z.zona}
            </text>
          ))}

          {puntos.map((o) => {
            const x = vista.x(o.longitud);
            const y = vista.y(o.latitud);
            const esActiva = activa?.id_proyecto === o.id_proyecto;
            const radio = o.prioridad === 'alta' ? 11 : 8;
            return (
              <g
                key={o.id_proyecto}
                role="button"
                tabIndex={0}
                aria-label={`${o.proyecto}, ${o.estado}, ${o.porcentaje_avance}% de avance`}
                className="cursor-pointer"
                onClick={() => alSeleccionar?.(o)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  alSeleccionar?.(o);
                }}
                onMouseEnter={() => setEncima(o)}
                onMouseLeave={() => setEncima(null)}
                onFocus={() => setEncima(o)}
                onBlur={() => setEncima(null)}
              >
                <title>{`${o.proyecto} · ${o.zona || 'sin zona'} · ${o.estado} · ${o.porcentaje_avance}%`}</title>
                {esActiva && <circle cx={x} cy={y} r={radio + 7} fill={COLOR_NIVEL[o.nivel]} opacity="0.25" />}
                <circle
                  cx={x}
                  cy={y}
                  r={radio}
                  fill={COLOR_NIVEL[o.nivel] ?? COLOR_NIVEL.sindato}
                  stroke="var(--color-card)"
                  strokeWidth="2.5"
                />
                {/* La prioridad alta no viaja sólo en el tamaño: un punto un poco
                    más grande no se distingue si no hay otro al lado. */}
                {o.prioridad === 'alta' && (
                  <circle cx={x} cy={y} r={radio - 4} fill="var(--color-card)" opacity="0.9" />
                )}
              </g>
            );
          })}

          {/* Barra de escala */}
          <g transform={`translate(${ANCHO - escala.px - 28}, ${ALTO - 26})`}>
            <line x1="0" y1="0" x2={escala.px} y2="0" stroke="var(--color-tinta)" strokeWidth="3" />
            <line x1="0" y1="-5" x2="0" y2="5" stroke="var(--color-tinta)" strokeWidth="3" />
            <line x1={escala.px} y1="-5" x2={escala.px} y2="5" stroke="var(--color-tinta)" strokeWidth="3" />
            <text x={escala.px / 2} y="-10" textAnchor="middle" className="fill-[var(--color-gris)]" style={{ fontSize: 15 }}>
              {escala.km < 1 ? `${escala.km * 1000} m` : `${escala.km} km`}
            </text>
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {LEYENDA_NIVEL.map(([nivel, titulo]) => {
          const cantidad = puntos.filter((o) => o.nivel === nivel).length;
          if (!cantidad) return null;
          return (
            <span key={nivel} className="flex items-center gap-1.5 text-[11px] text-gris">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_NIVEL[nivel] }} />
              {titulo} <span className="tabular text-tenue">({cantidad})</span>
            </span>
          );
        })}
        <span className="flex items-center gap-1.5 text-[11px] text-gris">
          <span className="grid h-2.5 w-2.5 place-items-center rounded-full bg-[var(--color-gris)]">
            <span className="h-1 w-1 rounded-full bg-card" />
          </span>
          Prioridad alta
        </span>
        {activa && <Chip tono="acento">{activa.proyecto}</Chip>}
      </div>

      <p className="text-[11px] text-tenue">
        Plano de coordenadas, sin cartografía de base: las posiciones relativas y la escala son
        reales; el fondo es una retícula de encuadre, no el trazado de calles.
      </p>
    </div>
  );
}
