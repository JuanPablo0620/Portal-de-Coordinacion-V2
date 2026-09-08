-- 0010_rls_monitoreos.sql — permisos del módulo Monitoreo

alter table public.categorias_tema enable row level security;
alter table public.monitoreos enable row level security;
alter table public.temas_monitoreo enable row level security;

drop policy if exists "categorias tema lectura" on public.categorias_tema;
create policy "categorias tema lectura" on public.categorias_tema
  for select to authenticated using (public.mi_rol() is not null);

drop policy if exists "monitoreos lectura" on public.monitoreos;
create policy "monitoreos lectura" on public.monitoreos
  for select to authenticated using (public.mi_rol() is not null);

drop policy if exists "monitoreos escritura admin" on public.monitoreos;
create policy "monitoreos escritura admin" on public.monitoreos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "temas monitoreo lectura" on public.temas_monitoreo;
create policy "temas monitoreo lectura" on public.temas_monitoreo
  for select to authenticated using (public.mi_rol() is not null);

drop policy if exists "temas monitoreo escritura admin" on public.temas_monitoreo;
create policy "temas monitoreo escritura admin" on public.temas_monitoreo
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
