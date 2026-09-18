/** Identidades ficticias, sólo para el servidor de pruebas de equipo. */
import { create } from 'zustand';
export const useSesion = create(() => ({
  cargando: false, perfil: { id: 'p1', nombre: 'Persona Uno', rol: 'admin', activo: true },
  sesion: { user: { id: 'p1' } }, iniciar: () => {}, salir: async () => {},
}));
export const usePerfil = () => useSesion((s) => s.perfil);
export const useHaySesion = () => true;
export const useRol = () => useSesion((s) => s.perfil.rol);
export const puedeEscribir = (rol) => ['admin', 'coordinacion'].includes(rol);
export const puedeMarcarEstrategico = (rol) => puedeEscribir(rol) || rol === 'jefe_gabinete';
