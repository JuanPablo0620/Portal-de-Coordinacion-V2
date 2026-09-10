-- ---------------------------------------------------------------------------
-- 0022_asignaciones_monitoreo.sql — «Mis áreas» deja de vivir en una sola
-- computadora.  10/09/2026
--
-- Es la ultima coleccion del portal sin tabla. Guarda que secretarias eligio
-- seguir cada persona en Configuracion → «Mis areas».
--
-- Se habia dejado para el final por ser preferencia personal y no dato
-- institucional, y eso sigue siendo cierto -- pero preferencia personal no
-- quiere decir atada a una maquina. Hoy alguien arma sus areas en la
-- computadora de la oficina, abre el portal desde otra y le aparece vacio.
--
-- La clave es el PERFIL, no el nombre de texto libre como en la version local:
-- `guardarAsignacionesMonitoreo` guardaba contra `config.usuario`, que era lo
-- que hubiera tipeado la persona. Con login real hay un id que no se puede
-- confundir ni duplicar.
--
-- Es re-ejecutable.
-- ---------------------------------------------------------------------------

create table if not exists public.asignaciones_monitoreo (
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  area_id   uuid not null references public.areas(id) on delete cascade,
  primary key (perfil_id, area_id)
);

comment on table public.asignaciones_monitoreo is
  'Que secretarias eligio seguir cada persona en «Mis areas». Preferencia '
  'personal, no dato institucional -- pero sigue a la persona entre maquinas.';


-- ---------------------------------------------------------------------------
-- Permisos: cada uno ve y edita SOLO lo suyo
--
-- Distinto del resto de las tablas, donde lee cualquiera con sesion. Aca no
-- corresponde: que areas elige seguir alguien es asunto suyo, y ademas no le
-- sirve a nadie mas.
--
-- `es_admin()` no entra: un admin tampoco tiene por que editarle las
-- preferencias a otro. Si hiciera falta dar de baja a alguien, se borra su
-- perfil y el `on delete cascade` limpia esto solo.
-- ---------------------------------------------------------------------------
alter table public.asignaciones_monitoreo enable row level security;

drop policy if exists "cada uno lo suyo" on public.asignaciones_monitoreo;
create policy "cada uno lo suyo" on public.asignaciones_monitoreo
  for all to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());

notify pgrst, 'reload schema';
