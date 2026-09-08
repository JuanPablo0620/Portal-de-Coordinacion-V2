-- 0009_rls_seguimientos.sql — permisos del módulo Seguimiento
--
-- La tabla no estaba incluida en 0003_rls.sql porque todavía no se escribía
-- desde el portal. Se habilita ahora para admin/coordinación y, de forma
-- acotada, para usuarios de área sobre su propia secretaría.

alter table public.seguimientos enable row level security;
alter table public.seguimientos_proyectos enable row level security;

drop policy if exists "seguimientos lectura" on public.seguimientos;
create policy "seguimientos lectura" on public.seguimientos
  for select to authenticated
  using (
    public.mi_rol() is not null
    and (public.mi_rol() <> 'area' or area_id = public.mi_area())
  );

drop policy if exists "seguimientos escritura admin" on public.seguimientos;
create policy "seguimientos escritura admin" on public.seguimientos
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "seguimientos escritura area" on public.seguimientos;
create policy "seguimientos escritura area" on public.seguimientos
  for all to authenticated
  using (public.mi_rol() = 'area' and area_id = public.mi_area())
  with check (public.mi_rol() = 'area' and area_id = public.mi_area());

drop policy if exists "seguimientos proyectos lectura" on public.seguimientos_proyectos;
create policy "seguimientos proyectos lectura" on public.seguimientos_proyectos
  for select to authenticated
  using (
    public.mi_rol() is not null
    and (
      public.mi_rol() <> 'area'
      or exists (
        select 1 from public.seguimientos s
        where s.id = seguimientos_proyectos.seguimiento_id
          and s.area_id = public.mi_area()
      )
    )
  );

drop policy if exists "seguimientos proyectos escritura admin" on public.seguimientos_proyectos;
create policy "seguimientos proyectos escritura admin" on public.seguimientos_proyectos
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "seguimientos proyectos escritura area" on public.seguimientos_proyectos;
create policy "seguimientos proyectos escritura area" on public.seguimientos_proyectos
  for all to authenticated
  using (
    public.mi_rol() = 'area'
    and exists (
      select 1 from public.seguimientos s
      where s.id = seguimientos_proyectos.seguimiento_id
        and s.area_id = public.mi_area()
    )
  )
  with check (
    public.mi_rol() = 'area'
    and exists (
      select 1 from public.seguimientos s
      where s.id = seguimientos_proyectos.seguimiento_id
        and s.area_id = public.mi_area()
    )
  );
