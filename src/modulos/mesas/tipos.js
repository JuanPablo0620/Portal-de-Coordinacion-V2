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
