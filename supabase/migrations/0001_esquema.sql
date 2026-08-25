-- =============================================================================
-- 0001_esquema.sql — Gestion 3F 2.0
--
-- Fusion del nucleo de Coordinacion-3f (v1, 03/08/2026 — catalogos, roles,
-- actualizaciones fechadas, serie historica, auditoria) con los modulos que
-- Coordinacion3F2.0 (v2, 08/08/2026) agrego y v1 nunca tuvo: seguimientos,
-- compromisos de origen polimorfico, monitoreos, mesas, eventos con
-- requerimientos, planificacion anual, posicionamiento internacional.
--
-- Correccion sobre v1 (no heredada, decidida con datos reales — ver la
-- auditoria de las 8 planillas del 16/08/2026): `objetivo` pasa a nullable.
-- En la practica real, buena parte de las observaciones cuantitativas son
-- indicadores/contadores sin meta formal, no proyectos con objetivo
-- comprometido (Trabajo y Produccion 107/107 filas sin objetivo, Obras
-- 36/36, Seguridad 162/163). Sin objetivo no hay % de avance ni banda de
-- cumplimiento, y el dato se carga igual.
--
-- Sin tildes ni ñ en identificadores ni en literales SQL (convencion
-- heredada de v1, mantenida por consistencia).
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.rol_usuario as enum
  ('intendencia', 'jefe_gabinete', 'coordinacion', 'admin', 'area');

create type public.tipo_actualizacion as enum
  ('cualitativa', 'cuantitativa', 'comparativa');

-- 'direccion' y 'ninguna' se comportan igual a efectos de inclusion: solo el
-- Informe Secretaria (o el modulo Reportes que lo reemplaza) mira este campo.
create type public.derivacion as enum
  ('direccion', 'secretaria', 'ambas', 'ninguna');

create type public.estado_general as enum ('vigente', 'finalizado');

create type public.origen_carga as enum ('monitoreo', 'seguimiento');

create type public.aplica_estado as enum ('cualitativa', 'cuantitativa', 'ambas');

create type public.metrica_serie as enum ('cantidad', 'ingresados', 'resueltos');

-- Nuevos de v2, sin equivalente en v1.
create type public.tipo_seguimiento as enum ('programado', 'realizado');

create type public.origen_compromiso as enum ('seguimiento', 'monitoreo', 'mesa');

create type public.estado_compromiso as enum ('pendiente', 'en_curso', 'cumplido');

create type public.criticidad_tema as enum ('alta', 'media', 'baja');

create type public.tipo_mesa as enum ('tematica', 'barrial', 'otros_proyectos');

create type public.estado_mesa as enum ('activa', 'latente', 'cerrada');

create type public.estado_requerimiento as enum
  ('solicitado', 'confirmado', 'entregado');

-- ---------------------------------------------------------------------------
-- Catalogos — reemplazan las listas hardcodeadas de catalogos.js de v2 y la
-- pestaña `Desplegables` de los Sheets. Que sean tablas es lo que hace
-- imposible volver a cargar un "." o un valor sin sentido.
-- ---------------------------------------------------------------------------
create table public.areas (
  id     uuid primary key default gen_random_uuid(),
  slug   text not null unique,
  nombre text not null,
  prefijo text,              -- para el id de proyecto tipo SEC-AAAA-NNN (v2)
  orden  int  not null default 0,
  activa boolean not null default true
);

create table public.ejes (
  id     uuid primary key default gen_random_uuid(),
  slug   text not null unique,
  nombre text not null,
  orden  int  not null default 0,
  activo boolean not null default true
);

create table public.estados (
  id       uuid primary key default gen_random_uuid(),
  slug     text not null unique,
  nombre   text not null,
  color    text not null,
  orden    int  not null default 0,
  aplica_a public.aplica_estado not null default 'ambas'
);

create table public.unidades (
  id     uuid primary key default gen_random_uuid(),
  slug   text not null unique,
  nombre text not null
);

create table public.tipos_proyecto (
  id     uuid primary key default gen_random_uuid(),
  slug   text not null unique,
  nombre text not null,       -- obra, servicio, programa social, gestion interna, adquisicion
  activo boolean not null default true
);

create table public.categorias_tema (
  id     uuid primary key default gen_random_uuid(),
  slug   text not null unique,
  nombre text not null,
  activo boolean not null default true
);

create table public.items_requerimiento (
  id     uuid primary key default gen_random_uuid(),
  slug   text not null unique,
  nombre text not null,       -- sonido, escenario, sillas, vallado, banos, seguridad...
  activo boolean not null default true
);

create table public.motivos_estrategicos (
  id     uuid primary key default gen_random_uuid(),
  slug   text not null unique,
  nombre text not null,
  activo boolean not null default true
);

-- Rediseño del 21/08/2026 (a pedido de JP, revisando el DER en Lucidchart):
-- reemplaza a `organismos_internacionales` — nombre simplificado, mismas dos
-- columnas. `paises_contraparte` se elimina del todo: era exclusiva de
-- `acciones_internacionales` (campo `pais_id`), que este mismo cambio saca del
-- esquema — ver la nota junto a `proyectos_posicionamiento` más abajo.
create table public.organismos (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Usuarios (v1). Con Supabase real desde el arranque, roles y RLS entran
-- desde el dia uno — ya no es una pregunta abierta como en el boceto v2.
-- ---------------------------------------------------------------------------
create table public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  email      text not null,
  rol        public.rol_usuario not null,
  area_id    uuid references public.areas(id),
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- area_id NULL = ve todas las areas. Solo el rol 'area' lo lleva cargado.
  constraint perfiles_area_solo_rol_area
    check (area_id is null or rol = 'area')
);

-- ---------------------------------------------------------------------------
-- Maestro (v1 + bloque estrategico ampliado de v2)
-- ---------------------------------------------------------------------------
create table public.programas (
  id          uuid primary key default gen_random_uuid(),
  area_id     uuid not null references public.areas(id),
  nombre      text not null,
  descripcion text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (area_id, nombre)
);

create table public.proyectos (
  id                      uuid primary key default gen_random_uuid(),
  id_legible              text unique,        -- formato SEC-AAAA-NNN de v2, cosmetico: NO es la PK (ver D-nn)
  programa_id             uuid not null references public.programas(id),
  nombre                  text not null,
  eje_id                  uuid not null references public.ejes(id),
  tipo_id                 uuid references public.tipos_proyecto(id),
  estado_general          public.estado_general not null default 'vigente',
  responsable             text,
  prioridad               text,               -- alta | media | baja, texto libre por ahora
  fecha_inicio            date,
  fecha_fin_proyectada    date,
  fecha_fin_real          date,
  causa_atraso            text,
  es_obra                 boolean not null default false,
  monto_planificado       numeric,
  monto_ejecutado         numeric,
  zona                    text,
  latitud                 double precision,
  longitud                double precision,
  observaciones           text,
  -- El corazon del rediseño de v1: absorbe Ejes_Estrategicos, Interes de
  -- Roco y "Puntuales estrategicos" en un solo flag. Bloque ampliado con los
  -- campos que v2 ya habia agregado (motivo/compromiso/origen).
  es_estrategico          boolean not null default false,
  estrategico_marcado_por uuid references public.perfiles(id),
  estrategico_marcado_en  timestamptz,
  estrategico_nota        text,
  prioridad_estrategica   text,               -- alta | media
  motivo_estrategico_id   uuid references public.motivos_estrategicos(id),
  responsable_politico    text,
  compromiso_publico      text,
  fecha_compromiso        date,
  origen_estrategico      public.origen_carga,
  creado_por              uuid references public.perfiles(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (programa_id, nombre),
  -- Latitud y longitud van juntas o ninguna (regla ya validada en el
  -- formulario de v2: media coordenada no ubica nada).
  constraint proyectos_coordenadas_juntas
    check ((latitud is null) = (longitud is null))
);

create index proyectos_estrategico_idx
  on public.proyectos (es_estrategico) where es_estrategico;

-- ---------------------------------------------------------------------------
-- Monitoreo (v1) — el nucleo que resuelve Periodo, Derivacion y una sola
-- columna de cantidad sin ambiguedad con "avance". `actualizaciones` es una
-- fila por observacion, fechada, nunca se pisa: cargar la de junio no borra
-- la de mayo.
-- ---------------------------------------------------------------------------
create table public.actualizaciones (
  id                  uuid primary key default gen_random_uuid(),
  proyecto_id         uuid not null references public.proyectos(id) on delete cascade,
  tipo                public.tipo_actualizacion not null,
  fecha_actualizacion date not null,
  periodo_inicio      date,
  periodo_fin         date,
  estado_id           uuid not null references public.estados(id),
  estado_calculado    boolean not null default false,
  derivacion          public.derivacion not null default 'ninguna',
  comentarios         text,
  origen              public.origen_carga not null default 'monitoreo',
  cargado_por         uuid references public.perfiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Cuanti y comparativa miden un tramo; cualitativa no.
  constraint actualizaciones_periodo_segun_tipo check (
    (tipo = 'cualitativa' and periodo_inicio is null and periodo_fin is null)
    or (tipo <> 'cualitativa' and periodo_inicio is not null and periodo_fin is not null)
  ),
  constraint actualizaciones_periodo_ordenado
    check (periodo_inicio is null or periodo_inicio <= periodo_fin)
);

create index actualizaciones_fecha_idx on public.actualizaciones (fecha_actualizacion);
create index actualizaciones_proyecto_idx on public.actualizaciones (proyecto_id);
create index actualizaciones_derivacion_idx on public.actualizaciones (derivacion);

create table public.act_cuantitativas (
  actualizacion_id  uuid primary key
                    references public.actualizaciones(id) on delete cascade,
  cantidad          numeric not null,
  unidad_id         uuid references public.unidades(id),
  -- Nullable a proposito (correccion sobre v1, ver cabecera del archivo):
  -- no toda observacion cuantitativa tiene una meta formal.
  objetivo          numeric,
  porcentaje_avance numeric generated always as (
    case when objetivo is null or objetivo = 0 then null
         else (cantidad / objetivo) * 100 end
  ) stored
);

create table public.act_comparativas (
  actualizacion_id      uuid primary key
                        references public.actualizaciones(id) on delete cascade,
  ingresados            integer not null check (ingresados >= 0),
  resueltos             integer not null check (resueltos >= 0),
  porcentaje_resolucion numeric generated always as (
    case when ingresados = 0 then null else (resueltos::numeric / ingresados) * 100 end
  ) stored
);

-- ---------------------------------------------------------------------------
-- Umbrales y series (v1) — resuelve "Cantidad [año anterior]" de forma
-- generica: sirve tanto para cuantitativas (metrica='cantidad') como para
-- comparativas (metrica='ingresados'/'resueltos').
-- ---------------------------------------------------------------------------
create table public.objetivos (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fin    date not null,
  valor          numeric not null,
  umbral_critico numeric not null default 65,
  umbral_minimo  numeric not null default 80,
  umbral_supera  numeric not null default 110,
  unique (proyecto_id, periodo_inicio, periodo_fin)
);

create table public.serie_historica (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fin    date not null,
  metrica        public.metrica_serie not null,
  valor          numeric not null,
  unique (proyecto_id, periodo_inicio, periodo_fin, metrica)
);

-- ---------------------------------------------------------------------------
-- Puntuales (nuevo, 25/08/2026) — lo que no estaba previsto en el POA.
--
-- El POA define Programas, y de los Programas salen Proyectos (ej. programa
-- "Obras en plazas" -> proyectos "Obra plaza Murialdo", "Obra plaza
-- Churruca"). Un Puntual es otra cosa: surge en el momento ("Zoonosis se
-- lleno de ratas, hay que coordinar la desratizacion") y no cuelga de ningun
-- programa — por eso no es una fila de `proyectos` con eje='puntual', es su
-- propia tabla, con `area_id` directo (no via programa, que no tiene).
--
-- Sigue absorbiendo el bloque estrategico completo: v1 ya unificaba
-- "Puntuales estrategicos" junto con Ejes_Estrategicos e Interes de Roco en
-- un solo flag (ver el comentario de `proyectos.es_estrategico` mas arriba)
-- — separar Puntuales de `proyectos` no cambia que un puntual pueda seguir
-- siendo estrategico.
--
-- Seguimiento simple a proposito (mismo criterio que
-- `actualizaciones_posicionamiento`, sin `act_cuantitativas`/
-- `act_comparativas`): no hay evidencia todavia de un puntual con metrica
-- numerica real. Si aparece, se agrega ahi, no antes.
-- ---------------------------------------------------------------------------
create table public.puntuales (
  id                      uuid primary key default gen_random_uuid(),
  id_legible              text unique,
  area_id                 uuid not null references public.areas(id),
  nombre                  text not null,
  estado_general          public.estado_general not null default 'vigente',
  responsable             text,
  prioridad               text,
  fecha_inicio            date,
  fecha_fin_proyectada    date,
  fecha_fin_real          date,
  causa_atraso            text,
  observaciones           text,
  es_estrategico          boolean not null default false,
  estrategico_marcado_por uuid references public.perfiles(id),
  estrategico_marcado_en  timestamptz,
  estrategico_nota        text,
  prioridad_estrategica   text,
  motivo_estrategico_id   uuid references public.motivos_estrategicos(id),
  responsable_politico    text,
  compromiso_publico      text,
  fecha_compromiso        date,
  origen_estrategico      public.origen_carga,
  creado_por              uuid references public.perfiles(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (area_id, nombre)
);

create index puntuales_estrategico_idx
  on public.puntuales (es_estrategico) where es_estrategico;

-- Historico simple, una fila por observacion fechada — nunca se pisa, mismo
-- patron que `actualizaciones_posicionamiento`. Reusa el catalogo `estados`
-- (no un texto libre) para que un puntual entre al mismo semaforo y a los
-- mismos informes Direccion/Secretaria que un proyecto del POA.
create table public.actualizaciones_puntuales (
  id                   uuid primary key default gen_random_uuid(),
  puntual_id           uuid not null references public.puntuales(id) on delete cascade,
  fecha_actualizacion  date not null,
  estado_id            uuid not null references public.estados(id),
  derivacion           public.derivacion not null default 'ninguna',
  comentarios          text,
  origen               public.origen_carga not null default 'monitoreo',
  cargado_por          uuid references public.perfiles(id),
  created_at           timestamptz not null default now()
);

create index actualizaciones_puntuales_fecha_idx
  on public.actualizaciones_puntuales (fecha_actualizacion);
create index actualizaciones_puntuales_puntual_idx
  on public.actualizaciones_puntuales (puntual_id);

-- ---------------------------------------------------------------------------
-- Resto del circuito heredado de v1
-- ---------------------------------------------------------------------------
create table public.actividades (
  id                uuid primary key default gen_random_uuid(),
  proyecto_id       uuid not null references public.proyectos(id) on delete cascade,
  nombre            text not null,
  direccion         text,
  barrio            text,
  lat               double precision,
  lng               double precision,
  fecha_inicio      date,
  fecha_fin         date,
  estado_cronograma text
);

create table public.pedidos_roco (
  id            uuid primary key default gen_random_uuid(),
  area_id       uuid references public.areas(id),
  descripcion   text not null,
  -- Puede contener el nombre de un vecino: fuera del grant de select por
  -- defecto en 0003_rls.sql. Ley 25.326.
  solicitante   text,
  fecha_ingreso date not null,
  estado        text not null default 'abierto',
  fecha_cierre  date,
  comentarios   text,
  cargado_por   uuid references public.perfiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Eventos: fusion de la version simple de v1 con los campos que v2 agrego
-- (area organizadora explicita, tipo, proyecto vinculado opcional, estado).
create table public.eventos (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  fecha                 date not null,
  hora                  time,
  lugar                 text,
  area_organizadora_id  uuid references public.areas(id),
  tipo                  text,
  proyecto_id           uuid references public.proyectos(id),
  estado                text,
  descripcion           text,
  activo                boolean not null default true,
  creado_por            uuid references public.perfiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.requerimientos_evento (
  id                   uuid primary key default gen_random_uuid(),
  evento_id            uuid not null references public.eventos(id) on delete cascade,
  item_id              uuid not null references public.items_requerimiento(id),
  cantidad             numeric,
  area_responsable_id  uuid references public.areas(id),
  estado               public.estado_requerimiento not null default 'solicitado'
);

create table public.adjuntos (
  id           uuid primary key default gen_random_uuid(),
  programa_id  uuid references public.programas(id) on delete cascade,
  proyecto_id  uuid references public.proyectos(id) on delete cascade,
  nombre       text not null,
  storage_path text not null,
  subido_por   uuid references public.perfiles(id),
  created_at   timestamptz not null default now(),
  constraint adjuntos_cuelga_de_uno check (
    (programa_id is not null and proyecto_id is null)
    or (programa_id is null and proyecto_id is not null)
  )
);

-- ---------------------------------------------------------------------------
-- Seguimiento (nuevo de v2). Reuniones periodicas con un area; pueden tocar
-- varios proyectos a la vez, de ahi la tabla puente.
-- ---------------------------------------------------------------------------
create table public.seguimientos (
  id                uuid primary key default gen_random_uuid(),
  area_id           uuid not null references public.areas(id),
  fecha             date not null,
  hora              time,
  tipo              public.tipo_seguimiento not null default 'programado',
  participantes     text,
  texto_crudo       text,
  resumen           text,
  estado_reportado  text,
  activo            boolean not null default true,
  creado_por        uuid references public.perfiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.seguimientos_proyectos (
  seguimiento_id uuid not null references public.seguimientos(id) on delete cascade,
  proyecto_id    uuid not null references public.proyectos(id) on delete cascade,
  primary key (seguimiento_id, proyecto_id)
);

-- ---------------------------------------------------------------------------
-- Compromisos (nuevo de v2) — origen polimorfico real, con FK dura: nacen de
-- un seguimiento, de un tema de monitoreo con accion requerida, o de una
-- reunion de mesa. Exactamente una de las tres columnas de origen va cargada
-- (o ninguna, si se creo a mano) — CHECK abajo, en 0002_logica.sql.
-- ---------------------------------------------------------------------------
create table public.monitoreos (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null,
  area_id    uuid not null references public.areas(id),
  cerrado    boolean not null default false,
  activo     boolean not null default true,
  creado_por uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.temas_monitoreo (
  id               uuid primary key default gen_random_uuid(),
  monitoreo_id     uuid not null references public.monitoreos(id) on delete cascade,
  proyecto_id      uuid references public.proyectos(id),
  -- Un tema de monitoreo tambien puede salir de un Puntual, no solo de un
  -- proyecto del POA — mismo criterio de vinculo opcional y excluyente que
  -- compromisos, mas abajo.
  puntual_id       uuid references public.puntuales(id),
  categoria_id     uuid not null references public.categorias_tema(id),
  descripcion      text not null,
  criticidad       public.criticidad_tema not null default 'media',
  requiere_accion  boolean not null default false,
  responsable      text,
  fecha_limite     date,
  resuelto         boolean not null default false,
  activo           boolean not null default true,
  creado_por       uuid references public.perfiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint temas_monitoreo_vinculo_unico check (
    num_nonnulls(proyecto_id, puntual_id) <= 1
  )
);

create table public.mesas (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  tipo         public.tipo_mesa not null,
  descripcion  text,
  referente    text,
  periodicidad text,
  estado       public.estado_mesa not null default 'activa',
  activo       boolean not null default true,
  creado_por   uuid references public.perfiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.reuniones_mesa (
  id         uuid primary key default gen_random_uuid(),
  mesa_id    uuid not null references public.mesas(id) on delete cascade,
  fecha      date not null,
  asistentes text,
  temas      text,
  activo     boolean not null default true,
  creado_por uuid references public.perfiles(id),
  created_at timestamptz not null default now()
);

create table public.mesas_proyectos (
  mesa_id     uuid not null references public.mesas(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  primary key (mesa_id, proyecto_id)
);

create table public.compromisos (
  id                     uuid primary key default gen_random_uuid(),
  origen_tipo            public.origen_compromiso,
  id_seguimiento_origen  uuid references public.seguimientos(id) on delete set null,
  id_tema_origen         uuid references public.temas_monitoreo(id) on delete set null,
  id_reunion_origen      uuid references public.reuniones_mesa(id) on delete set null,
  proyecto_id            uuid references public.proyectos(id),
  -- Un compromiso puede colgar de un Puntual en vez de un proyecto del POA
  -- ("hablar con Sistemas porque un CAPS no tiene internet" no es de ningun
  -- proyecto puntual; puede ser del puntual "Zoonosis" o de ninguno de los
  -- dos). Lo unico obligatorio siempre es el area — ver mas abajo.
  puntual_id             uuid references public.puntuales(id),
  area_id                uuid not null references public.areas(id),
  descripcion            text not null,
  responsable            text,
  fecha_limite           date,
  estado                 public.estado_compromiso not null default 'pendiente',
  fecha_cumplimiento     date,
  activo                 boolean not null default true,
  creado_por             uuid references public.perfiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- Exactamente una columna de origen no nula, o ninguna (compromiso creado
  -- a mano, sin origen registrado).
  constraint compromisos_origen_unico check (
    num_nonnulls(id_seguimiento_origen, id_tema_origen, id_reunion_origen) <= 1
  ),
  -- Proyecto y puntual son excluyentes: es de uno, del otro, o de ninguno.
  constraint compromisos_vinculo_unico check (
    num_nonnulls(proyecto_id, puntual_id) <= 1
  )
);

-- ---------------------------------------------------------------------------
-- Planificacion anual (nuevo de v2)
-- ---------------------------------------------------------------------------
create table public.planificacion_anual (
  id                 uuid primary key default gen_random_uuid(),
  proyecto_id        uuid not null references public.proyectos(id) on delete cascade,
  anio               int not null,
  meta_anual         numeric,
  monto_planificado  numeric,
  activo             boolean not null default true,
  creado_por         uuid references public.perfiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (proyecto_id, anio)
);

create table public.planificacion_trimestres (
  id                uuid primary key default gen_random_uuid(),
  planificacion_id  uuid not null references public.planificacion_anual(id) on delete cascade,
  trimestre         int not null check (trimestre between 1 and 4),
  meta              numeric,
  unique (planificacion_id, trimestre)
);

create table public.hitos_planificacion (
  id                uuid primary key default gen_random_uuid(),
  planificacion_id  uuid not null references public.planificacion_anual(id) on delete cascade,
  nombre            text not null,
  fecha             date,
  cumplido          boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Posicionamiento internacional — rediseñado el 21/08/2026 (a pedido de JP,
-- revisando el DER en Lucidchart). Reemplaza por completo la version anterior
-- (`acciones_internacionales` + sus dos tablas puente): se van tipo, pais_id,
-- alcance, fecha_inicio, fecha_limite, fecha_resolucion, resultado,
-- descripcion y referente — ninguno confirmado contra el dato real relevado
-- de Coordinacion_db (ver docs/der-esquema-datos.md). Tambien se va el
-- vinculo M:N con `proyectos`: un proyecto de posicionamiento ya no depende
-- de la tabla general de proyectos, es su propia entidad.
--
-- OJO — sin confirmar contra el sheet real (mismo aviso que ya se hizo antes
-- por ODS): `organismo_id`, `area_id` y `financiamiento_usd` tampoco
-- aparecieron en la pestaña "Estado de proyectos" que se relevo el
-- 19/08/2026 (los 8 proyectos reales: CIPPEC, UBA, CIIAR, etc. solo traian
-- Programa/Proyecto/Estado/Comentarios/Fecha). Son campos heredados del
-- diseño original de v2, no verificados — igual que ODS, que por eso se
-- elimino del esquema en este mismo cambio.
-- ---------------------------------------------------------------------------
create table public.proyectos_posicionamiento (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  organismo_id        uuid references public.organismos(id),
  estado              text,
  area_id             uuid references public.areas(id),
  financiamiento_usd  numeric,
  -- Lo que se espera conseguir o realizar (texto, no numerico: un
  -- hermanamiento o una certificacion no se mide con un objetivo/avance
  -- como los proyectos de la cartera general).
  objetivo            text,
  activo              boolean not null default true,
  creado_por          uuid references public.perfiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Una fila por observacion fechada — mismo patron que `actualizaciones` de la
-- cartera general: nunca se pisa una carga vieja, se acumulan en el tiempo.
create table public.actualizaciones_posicionamiento (
  id                            uuid primary key default gen_random_uuid(),
  proyecto_posicionamiento_id  uuid not null
                                references public.proyectos_posicionamiento(id) on delete cascade,
  fecha_actualizacion          date not null,
  estado                       text,
  comentarios                  text,
  cargado_por                  uuid references public.perfiles(id),
  created_at                   timestamptz not null default now()
);

create index actualizaciones_posicionamiento_proyecto_idx
  on public.actualizaciones_posicionamiento (proyecto_posicionamiento_id);

create table public.reportes_guardados (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  filtros           jsonb,
  bloques_incluidos jsonb,
  creado_por        uuid references public.perfiles(id),
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sistema (v1) — auditoria por trigger generico, no por bitacora de
-- aplicacion: un UPDATE hecho desde el editor SQL de Supabase queda
-- registrado igual que uno hecho desde la pantalla. Reemplaza a `historial`
-- de v2, que era app-level y no capturaba cambios fuera de la UI.
-- ---------------------------------------------------------------------------
create table public.auditoria (
  id            bigserial primary key,
  tabla         text not null,
  registro_id   text not null,   -- text, no uuid: cubre PK compuestas de tablas puente
  accion        text not null,
  usuario_id    uuid,
  datos_antes   jsonb,
  datos_despues jsonb,
  ts            timestamptz not null default now()
);

create index auditoria_tabla_registro_idx on public.auditoria (tabla, registro_id);

create table public.auditoria_consultas (
  id         bigserial primary key,
  usuario_id uuid,
  tipo       text not null,
  parametros jsonb,
  ts         timestamptz not null default now()
);

create table public.alertas (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null,
  severidad    text not null default 'media',
  proyecto_id  uuid references public.proyectos(id) on delete cascade,
  puntual_id   uuid references public.puntuales(id) on delete cascade,
  area_id      uuid references public.areas(id),
  mensaje      text not null,
  creada_en    timestamptz not null default now(),
  resuelta_en  timestamptz,
  resuelta_por uuid references public.perfiles(id)
);

create table public.migracion_cuarentena (
  id             bigserial primary key,
  origen_sheet   text not null,
  origen_pestana text not null,
  origen_fila    int not null,
  payload        jsonb not null,
  motivo         text not null,
  resuelto       boolean not null default false,
  resuelto_en    timestamptz
);

create table public.renglon_overrides (
  id             uuid primary key default gen_random_uuid(),
  informe        text not null,
  periodo_inicio date not null,
  periodo_fin    date not null,
  area_id        uuid not null references public.areas(id),
  programa_id    uuid not null references public.programas(id),
  estado_id      uuid not null references public.estados(id),
  motivo         text not null,
  puesto_por     uuid references public.perfiles(id),
  created_at     timestamptz not null default now(),
  unique (informe, periodo_inicio, periodo_fin, area_id, programa_id)
);

-- ---------------------------------------------------------------------------
-- Catalogos iniciales — las 7 areas confirmadas + los ejes reales.
-- ---------------------------------------------------------------------------
insert into public.areas (slug, nombre, prefijo, orden) values
  ('ambiente',              'Ambiente',               'AMB', 1),
  ('capital_humano',        'Capital Humano',         'CAH', 2),
  ('obras',                 'Obras',                  'OBR', 3),
  ('salud',                 'Salud',                  'SAL', 4),
  ('seguridad',             'Seguridad',              'SEG', 5),
  ('trabajo_y_produccion',  'Trabajo y Produccion',   'TYP', 6),
  ('coordinacion',          'Coordinacion',           'COR', 7);

-- 'puntual' queda en el catalogo por compatibilidad con carga historica,
-- pero desde el alta de la tabla `puntuales` (25/08/2026) ningun proyecto
-- nuevo deberia usar este eje: un Puntual ya no es una fila de `proyectos`.
insert into public.ejes (slug, nombre, orden) values
  ('poa',                      'POA',                            1),
  ('compromisos',              'Compromisos',                    2),
  ('puntual',                  'Puntual',                        3),
  ('mesa_esperanza',           'Mesa Esperanza',                 4),
  ('mesa_edla',                'Mesa EDLA',                      5),
  ('mesa_favelita_libertador', 'Mesa Favelita / El Libertador',  6),
  ('posicionamiento',          'Posicionamiento',                7);

insert into public.estados (slug, nombre, color, orden, aplica_a) values
  ('en_ejecucion',      'En ejecucion',      '#4886C6', 1, 'ambas'),
  ('alerta',            'Alerta',            '#F6B07B', 2, 'ambas'),
  ('critico',           'Critico',           '#E73743', 3, 'ambas'),
  ('pendiente',         'Pendiente',         '#B8C2C9', 4, 'ambas'),
  ('finalizado',        'Finalizado',        '#B8D491', 5, 'ambas'),
  ('programado',        'Programado',        '#C9B8D4', 6, 'cualitativa'),
  ('objetivo_cumplido', 'Objetivo cumplido', '#B8D491', 7, 'cuantitativa'),
  ('supera_objetivo',   'Supera Objetivo',   '#7FB069', 8, 'cuantitativa');

insert into public.tipos_proyecto (slug, nombre) values
  ('obra',              'Obra'),
  ('servicio',          'Servicio'),
  ('programa_social',   'Programa social'),
  ('gestion_interna',   'Gestion interna'),
  ('adquisicion',       'Adquisicion');

insert into public.motivos_estrategicos (slug, nombre) values
  ('compromiso_publico',     'Compromiso publico de gestion'),
  ('alto_impacto_vecinal',   'Alto impacto vecinal'),
  ('monto_escala',           'Monto o escala excepcional'),
  ('financiamiento_externo', 'Financiamiento externo comprometido'),
  ('articulacion_provincia', 'Articulacion con provincia o nacion'),
  ('innovacion',             'Innovacion institucional'),
  ('riesgo_atraso',          'Riesgo alto si se atrasa'),
  ('posicionamiento_intl',   'Posicionamiento internacional');
