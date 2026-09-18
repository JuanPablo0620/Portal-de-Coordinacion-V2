/**
 * Altas confirmadas por JP para el Informe de Secretaría.
 *
 * No provienen de una planilla: son los temas que deben estar disponibles para
 * seguimiento. El programa se deja vacío deliberadamente; el cargador los
 * asienta en el programa visible «Sin programa» de cada área hasta que se
 * confirme su clasificación.
 */

export const SECRETARIAS_INFORME_SECRETARIA = [
  {
    area: { id: 'ar_r_obras', nombre: 'Secretaría de Obras', prefijo: 'OBR' },
    tipoDefault: 'Obra',
    datos: [
      { programa: '', proyecto: 'Intervención en puntos estratégicos', estado: '', comentarios: '' },
      { programa: '', proyecto: 'Los Rusos', estado: '', comentarios: '' },
      { programa: '', proyecto: 'Movilización de suelo', estado: '', comentarios: '' },
    ],
  },
  {
    area: { id: 'ar_coord', nombre: 'Coordinación', prefijo: 'COR' },
    tipoDefault: 'Gestión interna',
    datos: [
      { programa: '', proyecto: 'Suministro de cartelería', estado: '', comentarios: '' },
    ],
  },
  {
    area: { id: 'ar_salud', nombre: 'Secretaría de Salud', prefijo: 'SAL' },
    tipoDefault: 'Servicio',
    datos: [
      { programa: '', proyecto: 'CAPS 10', estado: '', comentarios: '' },
    ],
  },
  {
    area: { id: 'ar_r_capital', nombre: 'Secretaría de Capital Humano', prefijo: 'CAH' },
    tipoDefault: 'Programa social',
    datos: [
      { programa: '', proyecto: 'SISU', estado: '', comentarios: '' },
      { programa: '', proyecto: 'Bunker Libertador', estado: '', comentarios: '' },
    ],
  },
];
