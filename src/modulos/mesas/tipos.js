/**
 * Configuración visual de cada tipo de mesa.
 *
 * Vive en su propio módulo —y no dentro de `Mesas.jsx`— porque la ficha
 * también la necesita: tenerla en el listado creaba una importación circular
 * entre `Mesas.jsx` y `FichaMesa.jsx`.
 */
import { Building, MapPin, Users } from 'lucide-react';

export const CONFIG_TIPO = {
  temática: {
    titulo: 'Temáticas',
    color: 'var(--color-serie-1)',
    icono: Users,
    descripcion: 'Espacios intersectoriales por tema de gestión.',
  },
  barrial: {
    titulo: 'Barriales',
    color: 'var(--color-serie-2)',
    icono: MapPin,
    descripcion: 'Espacios de participación territorial con referentes del barrio.',
  },
  'otros proyectos': {
    titulo: 'Otros proyectos',
    color: 'var(--color-serie-4)',
    icono: Building,
    descripcion: 'Convenios, planes y proyectos con seguimiento propio.',
  },
};

export const configDe = (tipo) => CONFIG_TIPO[tipo] ?? CONFIG_TIPO['temática'];

/**
 * Paleta para distinguir una mesa de otra DENTRO de su pestaña.
 *
 * El color de arriba es el del tipo y sigue siéndolo donde representa al tipo
 * —la pestaña, el cartel—. Pero en las tarjetas no servía: las tres mesas
 * barriales salían del mismo verde, así que el borde de color no distinguía
 * nada. Acá cada mesa tiene el suyo.
 *
 * El orden no es el de la variable: arranca por los más separados entre sí y
 * deja para el final los que la nota de `index.css` marca como apagados
 * (oliva y gris). Con tres o cuatro mesas por pestaña, nunca se llega a esos.
 */
const PALETA_MESA = [
  'var(--color-serie-1)', // azul
  'var(--color-serie-3)', // naranja
  'var(--color-serie-4)', // violeta
  'var(--color-serie-5)', // rojo
  'var(--color-serie-6)', // petróleo
  'var(--color-serie-2)', // verde
  'var(--color-serie-7)', // oliva
  'var(--color-serie-8)', // gris
];

/**
 * Qué color le toca a cada mesa, por pestaña.
 *
 * Se reparte por antigüedad y no por el orden en que se ven —que es
 * alfabético—: así dar de alta una «Mesa Alvear» no le cambia el color a las
 * que ya estaban. La mesa más vieja se queda con el primero mientras exista.
 */
export function coloresPorMesa(mesasDelTipo = []) {
  const porAntiguedad = [...mesasDelTipo].sort((a, b) =>
    String(a.creado_en ?? '').localeCompare(String(b.creado_en ?? '')),
  );
  return new Map(porAntiguedad.map((m, i) => [m.id, PALETA_MESA[i % PALETA_MESA.length]]));
}
