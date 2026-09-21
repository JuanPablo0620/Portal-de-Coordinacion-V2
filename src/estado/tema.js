/**
 * Preferencia visual de cada navegador.
 *
 * No forma parte de los datos de gestión ni se sincroniza con Supabase: el
 * modo BlueNight es una elección de lectura personal. Este módulo concentra
 * la aplicación del atributo de tema para que ningún componente tenga que
 * tocar el documento directamente.
 */
import { create } from 'zustand';
import { escribirTema, leerTema } from '../datos/almacenamiento.js';

function aplicarTema(tema) {
  if (typeof document === 'undefined') return;
  if (tema === 'bluenight') document.documentElement.dataset.tema = 'bluenight';
  else delete document.documentElement.dataset.tema;
}

export const useTema = create((set) => ({
  tema: 'claro',
  iniciado: false,

  iniciarTema() {
    const tema = leerTema();
    aplicarTema(tema);
    set({ tema, iniciado: true });
  },

  cambiarTema(tema) {
    const siguiente = tema === 'bluenight' ? 'bluenight' : 'claro';
    escribirTema(siguiente);
    aplicarTema(siguiente);
    set({ tema: siguiente, iniciado: true });
  },
}));
