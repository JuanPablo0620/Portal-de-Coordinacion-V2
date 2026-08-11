/**
 * Envoltura de Recharts con el estilo del sistema.
 *
 * Los colores salen de las variables `--color-serie-*`: ningún gráfico define
 * un hex propio, así que cambiar la paleta en `@theme` cambia todos a la vez.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Vacio } from './Basicos.jsx';

const SERIES = [
  'var(--color-serie-1)',
  'var(--color-serie-2)',
  'var(--color-serie-3)',
  'var(--color-serie-4)',
  'var(--color-serie-5)',
  'var(--color-serie-6)',
  'var(--color-serie-7)',
  'var(--color-serie-8)',
];

const colorSerie = (i) => SERIES[i % SERIES.length];

const EJE = { fontSize: 11, fill: 'var(--color-gris)' };

const ESTILO_TOOLTIP = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-borde)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--color-tinta)',
};

function Marco({ alto = 260, datos, children, mensajeVacio = 'Sin datos para graficar' }) {
  if (!datos?.length) return <Vacio compacto titulo={mensajeVacio} />;
  return (
    <div style={{ width: '100%', height: alto }}>
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  );
}

/** Barras verticales u horizontales, con una o varias series. */
export function GraficoBarras({
  datos,
  clave = 'nombre',
  series = [{ clave: 'cantidad', titulo: 'Cantidad' }],
  horizontal = false,
  alto = 260,
  formato,
  anchoEtiqueta = 150,
  // Los conteos no tienen medios temas: sin esto, seis categorías de un tema
  // cada una dibujan un eje 0 · 0,25 · 0,5 · 0,75 · 1.
  decimales = false,
}) {
  return (
    <Marco alto={alto} datos={datos}>
      <BarChart
        data={datos}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ left: 4, right: 12, top: 8, bottom: horizontal ? 4 : 40 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-borde)" vertical={!horizontal} horizontal={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={EJE} tickFormatter={formato} allowDecimals={decimales} />
            <YAxis type="category" dataKey={clave} width={anchoEtiqueta} tick={EJE} />
          </>
        ) : (
          <>
            <XAxis dataKey={clave} tick={EJE} angle={-35} textAnchor="end" height={70} interval={0} />
            <YAxis tick={EJE} tickFormatter={formato} allowDecimals={decimales} />
          </>
        )}
        <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v, n) => [formato ? formato(v) : v, n]} cursor={{ fill: 'var(--color-paper)' }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, i) => (
          <Bar
            key={s.clave}
            dataKey={s.clave}
            name={s.titulo}
            fill={s.color ?? colorSerie(i)}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={38}
          >
            {s.colorPorItem &&
              datos.map((d, j) => <Cell key={j} fill={s.colorPorItem(d)} />)}
          </Bar>
        ))}
      </BarChart>
    </Marco>
  );
}

export function GraficoLineas({ datos, clave = 'fecha', series = [], alto = 260, formato }) {
  return (
    <Marco alto={alto} datos={datos}>
      <LineChart data={datos} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-borde)" />
        <XAxis dataKey={clave} tick={EJE} />
        <YAxis tick={EJE} tickFormatter={formato} />
        <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v, n) => [formato ? formato(v) : v, n]} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, i) => (
          <Line
            key={s.clave}
            type="monotone"
            dataKey={s.clave}
            name={s.titulo}
            stroke={s.color ?? colorSerie(i)}
            strokeWidth={2}
            dot={{ r: 2.5 }}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </Marco>
  );
}

/**
 * `colorPorItem` existe porque en algunas tortas el color NO es decorativo: en
 * la distribución de criticidad, rojo/naranja/verde son la información. Sin
 * esto el color sale por posición y «media» hereda el de «alta» cuando «alta»
 * está en cero.
 */
export function GraficoTorta({ datos, clave = 'nombre', valor = 'cantidad', alto = 260, formato, colorPorItem }) {
  return (
    <Marco alto={alto} datos={datos}>
      <PieChart>
        <Pie data={datos} dataKey={valor} nameKey={clave} innerRadius="45%" outerRadius="72%" paddingAngle={2}>
          {datos.map((d, i) => (
            <Cell key={i} fill={colorPorItem ? colorPorItem(d) : colorSerie(i)} stroke="var(--color-card)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v, n) => [formato ? formato(v) : v, n]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </Marco>
  );
}
