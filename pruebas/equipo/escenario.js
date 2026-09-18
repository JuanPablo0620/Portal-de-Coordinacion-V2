import * as repo from '../../src/datos/repositorio.js';
import { useSesion } from './sesion.js';

export async function iniciarEscenario() {
  await repo.vaciarSistema();
  const bd = await repo.obtenerBD();
  bd.config.usuario = 'Persona Uno';
  bd.equipo = [
    { id: 'p1', nombre: 'Persona Uno', activo: true, recibe_compromisos: true, organiza_secretaria: true },
    { id: 'p2', nombre: 'Persona Dos', activo: true, recibe_compromisos: true, organiza_secretaria: false },
    { id: 'p3', nombre: 'Persona Consulta', activo: true, recibe_compromisos: false, organiza_secretaria: false },
  ];
  const area = bd.catalogos.areas[0].nombre;
  bd.asignaciones_monitoreo = [{ perfil_id: 'p1', usuario: 'Persona Uno', area }];
  await repo.crearCompromiso({ id: 'c1', descripcion: 'Confirmar el cronograma de trabajo', area, fecha_limite: '2026-10-02', origen_tipo: 'seguimiento', id_origen: 's1', id_responsable: 'p1' });
  await repo.crearCompromiso({ id: 'c2', descripcion: 'Validar el informe de avance', area, fecha_limite: '2026-08-01', origen_tipo: 'seguimiento', id_origen: 's1', id_responsable: 'p2' });
  await repo.crearCompromiso({ id: 'c3', descripcion: 'Enviar el relevamiento completo', area, fecha_limite: '2026-09-01', origen_tipo: 'seguimiento', id_origen: 's1', id_responsable: 'p1', estado: 'cumplido' });
  await repo.crear('compromisos', { id: 'c4', descripcion: 'Compromiso histórico sin asignar', area, estado: 'pendiente' });
  const secretaria = await repo.crearReunionEquipo({ tipo: 'secretaria', fecha: '2026-09-21' });
  const direccion = await repo.crearReunionEquipo({ tipo: 'direccion', fecha: '2026-09-21' });
  await repo.guardarTemaReunionEquipo({ reunion_id: secretaria.id, compromiso_id: 'c1', titulo: 'Confirmar el cronograma de trabajo', nota: 'Resolver la fecha antes del próximo encuentro.', orden: 1 });
  globalThis.pruebaEquipo = {
    secretaria: secretaria.id, direccion: direccion.id,
    base: () => repo.obtenerBD(),
    cambiarUsuario(id, rol = 'admin') {
      const persona = bd.equipo.find((p) => p.id === id);
      useSesion.setState({ perfil: { ...persona, rol }, sesion: { user: { id } } });
    },
  };
}
