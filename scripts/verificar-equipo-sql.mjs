/** PostgreSQL temporal, sin credenciales. Dependencia opcional instalada fuera del proyecto. */
import { PGlite } from '../../.tmp/portal-sql/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const ejecutarComo = async (n) => db.exec(`set role authenticated; select set_config('prueba.usuario', '${id(n)}', false);`);
try {
  // Contrato mínimo de 0001/0002/0003/0012/0036 sobre el que se aplica 0037.
  // Las políticas son las mismas restricciones relevantes de producción.
  await db.exec(`
    create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('prueba.usuario', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated;
    create table public.perfiles(id uuid primary key, nombre text, rol text, activo boolean default true);
    create function public.mi_rol() returns text language sql security definer as $$ select rol from public.perfiles where id=auth.uid() and activo $$;
    create function public.es_admin() returns boolean language sql security definer as $$ select coalesce(public.mi_rol() in ('admin','coordinacion'), false) $$;
    create type public.origen_compromiso as enum ('seguimiento','monitoreo','mesa','evento');
    create table public.compromisos (
      id uuid primary key default gen_random_uuid(), descripcion text not null, activo boolean default true,
      estado text default 'pendiente', fecha_limite date, area_id uuid,
      id_seguimiento_origen uuid, id_tema_origen uuid, id_reunion_origen uuid,
      id_monitoreo_origen uuid, id_reunion_evento_origen uuid
    );
    alter table public.compromisos enable row level security;
    create policy "lectura logueados" on public.compromisos for select to authenticated using (public.mi_rol() is not null and public.mi_rol() <> 'area');
    create policy "escritura admin" on public.compromisos for all to authenticated using(public.es_admin()) with check(public.es_admin());
    grant select, insert, update on public.compromisos to authenticated;
    grant select on public.perfiles to authenticated;
  `);
  const migracion = await readFile(new URL('../supabase/migrations/0037_equipo_y_reuniones.sql', import.meta.url), 'utf8');
  await db.exec(migracion);
  await db.exec(migracion);
  await db.exec(`insert into public.perfiles(id,nombre,rol,recibe_compromisos,organiza_secretaria) values
    ('${id(1)}','Persona Uno','admin',true,true),
    ('${id(2)}','Persona Dos','admin',true,false),
    ('${id(3)}','Persona Tres','jefe_gabinete',true,false),
    ('${id(4)}','Persona Consulta','admin',false,false);`);
  await ejecutarComo(1);
  await db.exec(`insert into public.reuniones_equipo(id,tipo,fecha) values ('${id(11)}','secretaria','2026-09-21'),('${id(12)}','direccion','2026-09-21');`);
  await db.exec(`insert into public.compromisos(id,descripcion,id_responsable) values ('${id(21)}','Acción primera','${id(1)}'),('${id(22)}','Acción segunda','${id(3)}');`);
  await assert.rejects(db.exec(`insert into public.compromisos(descripcion,id_responsable) values ('Inválido','${id(4)}')`), /habilitada/);
  await assert.rejects(db.exec(`insert into public.compromisos(descripcion) values ('Sin responsable')`), /Elegí/);
  await db.exec(`insert into public.temas_reunion_equipo(id,reunion_id,compromiso_id,titulo) values ('${id(31)}','${id(11)}','${id(21)}','Acción primera');`);
  await ejecutarComo(2);
  await assert.rejects(db.exec(`update public.temas_reunion_equipo set nota='Cambiar agenda' where id='${id(31)}'`), /organizador/);
  await db.exec(`update public.temas_reunion_equipo set acuerdo='Acuerdo del equipo', revisado=true where id='${id(31)}'`);
  await assert.rejects(db.exec(`insert into public.temas_reunion_equipo(reunion_id,titulo) values ('${id(11)}','No autorizado')`), /organizador/);
  await ejecutarComo(3);
  const ajeno = await db.query(`update public.compromisos set descripcion='No debería cambiar' where id='${id(21)}' returning id`);
  assert.equal(ajeno.rows.length, 0);
  const propio = await db.query(`update public.compromisos set estado='en_curso' where id='${id(22)}' returning id`);
  assert.equal(propio.rows.length, 1);
  await db.exec(`update public.compromisos set id_responsable='${id(2)}' where id='${id(22)}'`);
  const derivado = await db.query(`update public.compromisos set estado='cumplido' where id='${id(22)}' returning id`);
  assert.equal(derivado.rows.length, 0, 'Al derivarlo pierde el permiso individual');
  await ejecutarComo(1);
  await db.exec(`select public.cerrar_reunion_equipo('${id(12)}');`);
  assert.equal((await db.query(`select * from public.temas_reunion_equipo where reunion_id='${id(12)}'`)).rows.length, 2);
  await db.exec(`insert into public.compromisos(descripcion,id_responsable) values ('Posterior','${id(1)}')`);
  assert.equal((await db.query(`select * from public.temas_reunion_equipo where reunion_id='${id(12)}'`)).rows.length, 2);
  await assert.rejects(db.exec(`insert into public.temas_reunion_equipo(reunion_id,titulo) values ('${id(12)}','Tardío')`), /cerrado/);
  console.log('OK SQL: migración reejecutable; responsables válidos; temario sólo organizador; acuerdos compartidos; permisos individuales; cierre con lista conservada.');
} finally { await db.close(); }
