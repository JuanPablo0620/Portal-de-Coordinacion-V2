# Compromisos que nacen de un evento

**Fecha:** 14/09/2026
**Estado: APLICADA al SQL y al DER** (`supabase/migrations/0001_esquema.sql`,
`docs/der-esquema-datos.md` punto 12). El esquema en sí sigue **sin migrar a
Supabase** — eso no cambió, ver la sección 5 del DER. El movimiento de
navegación de Eventos a una pestaña de Mesas de trabajo (mismo día, ver
`docs/registro-de-cambios.md`) es independiente de esto: fue solo interfaz,
sin `reuniones_evento` ni selector de compromisos por evento detrás todavía
en el prototipo.

## 1. El hueco

El módulo Eventos hoy tiene `eventos` + `requerimientos_evento`, pero
`compromisos` no puede nacer de un evento: el enum `origen_compromiso` solo
admite `seguimiento | monitoreo | mesa`, y el CHECK `compromisos_origen_unico`
solo contempla esas tres FK.

La realidad que falta modelar:

1. Hay una **reunión de eventos** periódica, con representantes de varias
   áreas, donde se revisa la agenda próxima, la planificación y las
   necesidades. Es un circuito propio, del mismo rango que el Monitoreo
   (semanal) y el Seguimiento (cada 6 semanas) del glosario.
2. Cada evento **está a cargo de un área** (ya existe:
   `eventos.area_organizadora_id`).
3. Esa área **le pide cosas a otras áreas**, y esos pedidos son compromisos
   con responsable y fecha límite, no ítems de checklist. Ejemplo real:
   Zoonosis (Salud) organiza una jornada con mascotas en una plaza; Ambiente
   se compromete a limpiar el lugar los días previos; Seguridad se compromete
   a calcular cuántos efectivos aporta.
4. **No todos los eventos generan compromisos.** El vínculo tiene que ser
   opcional en los dos sentidos.

## 2. Compromiso vs. requerimiento — la distinción que define el diseño

Son dos cosas distintas y conviven:

| | `requerimientos_evento` | `compromisos` |
|---|---|---|
| Qué es | ítem catalogado con cantidad (vallas, batería sanitaria, móviles) | acción acordada, con responsable y fecha límite |
| Ciclo de vida | `solicitado → confirmado → entregado` | `pendiente → en_curso → cumplido` (+ `Alerta` deducida al vencer) |
| Dónde se ve | checklist de preparación del evento | tablero de compromisos del área, junto a los de seguimiento y mesa |
| Ejemplo | "20 vallas — Seguridad — confirmado" | "Seguridad calcula la dotación de efectivos — 20/09" |

La propuesta **no los fusiona**: los conecta. Un requerimiento puede escalar a
compromiso cuando hace falta seguirlo con fecha (`compromisos.requerimiento_id`),
pero la mayoría de los requerimientos se resuelve sin generar ninguno.

## 3. Cambios propuestos al esquema

### 3.1 Tabla nueva: `reuniones_evento`

La reunión donde se acuerdan los compromisos. Sin ella, un compromiso de
evento no tiene dónde "nacer" y rompe la simetría con los otros tres orígenes
(que son todos instancias de reunión).

```sql
create table public.reuniones_evento (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null,
  asistentes text,
  temas      text,
  activo     boolean not null default true,
  creado_por uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Agenda de la reunion: que eventos se trataron. M:N — una reunion mira
-- varios eventos y un evento se trata en varias reuniones sucesivas.
create table public.reuniones_evento_eventos (
  reunion_evento_id uuid not null references public.reuniones_evento(id) on delete cascade,
  evento_id         uuid not null references public.eventos(id) on delete cascade,
  primary key (reunion_evento_id, evento_id)
);
```

Mismo patrón que `seguimientos` + `seguimientos_proyectos`.

### 3.2 `compromisos`: cuarto origen + objeto

```sql
alter type public.origen_compromiso add value 'evento';

alter table public.compromisos
  add column id_reunion_evento_origen uuid references public.reuniones_evento(id) on delete set null,
  add column evento_id                uuid references public.eventos(id) on delete set null,
  add column requerimiento_id         uuid;

alter table public.compromisos
  drop constraint compromisos_origen_unico,
  add constraint compromisos_origen_unico check (
    num_nonnulls(id_seguimiento_origen, id_tema_origen,
                 id_reunion_origen, id_reunion_evento_origen) <= 1
  );
```

Dos columnas distintas a propósito, y no una sola:

- `id_reunion_evento_origen` es el **origen** (dónde nació), y entra en el
  CHECK de origen único junto a las otras tres.
- `evento_id` es el **objeto** (sobre qué evento es), exactamente igual que
  `proyecto_id` hoy. Queda fuera del CHECK.

Eso permite los tres casos reales: compromiso de evento acordado en reunión
(los dos campos), compromiso de evento cargado a mano fuera de reunión (solo
`evento_id`), y acuerdo general de la reunión que no es de ningún evento
puntual (solo el origen).

El área que debe cumplirlo ya tiene dónde ir: `compromisos.area_id`, que es
`not null`. El área que lo pide sale del evento
(`eventos.area_organizadora_id`), así que no hace falta duplicarla.

### 3.3 Coherencia requerimiento ↔ evento, por FK compuesta

Si un compromiso apunta a un requerimiento, ese requerimiento tiene que ser
del mismo evento. Un CHECK no puede mirar otra tabla, pero una FK compuesta
sí:

```sql
alter table public.requerimientos_evento
  add constraint requerimientos_evento_id_evento_uk unique (id, evento_id);

alter table public.compromisos
  add constraint compromisos_requerimiento_fk
    foreign key (requerimiento_id, evento_id)
    references public.requerimientos_evento(id, evento_id) on delete set null;
```

Con `evento_id` nulo la FK no se evalúa, así que un compromiso sin evento
sigue siendo válido. El motor garantiza que nunca haya un compromiso colgado
del requerimiento de otro evento — no depende de que la UI lo valide bien.
Es el mismo criterio del punto 5 de la sección 2 del DER: FK dura antes que
`tipo + id` de texto libre.

### 3.4 Higiene de las dos tablas de eventos

Arrastran deuda menor respecto del resto del esquema:

```sql
alter table public.eventos
  add column id_legible text unique;          -- coherencia con proyectos

alter table public.requerimientos_evento
  add column observaciones       text,
  add column area_solicitante_id uuid references public.areas(id),
  add column activo     boolean not null default true,
  add column creado_por uuid references public.perfiles(id),
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();
```

`requerimientos_evento` es hoy la única tabla del esquema sin columnas de
auditoría: sin ellas el trigger genérico de `auditoria` no tiene con qué
fechar los cambios del checklist.

También conviene pasar `eventos.estado` y `eventos.tipo` de `text` libre a
catálogo (`tipos_evento` ya existe como catálogo en el prototipo,
`src/datos/catalogos.js`), por el mismo motivo que el resto del esquema: un
desplegable en tabla es lo que impide que se cargue un ".".

## 4. Alternativa descartada: reusar `mesas`

Se podría modelar la reunión de eventos como una fila de `mesas` con
`tipo = 'tematica'` y usar `reuniones_mesa` + el origen `mesa` que ya existe.
El delta sería de una sola columna (`compromisos.evento_id`).

No se propone porque en el vocabulario institucional "mesa" significa **mesa
de barrio popular** (Esperanza, EDLA, Favelita — ver el glosario). Meter la
reunión de eventos ahí mezcla dos circuitos distintos en la misma tabla, y
después todo filtro por mesa tiene que acordarse de excluirla. La tabla propia
cuesta dos tablas y evita ese problema para siempre.

## 5. Impacto

| Capa | Qué hay que tocar |
|---|---|
| `0001_esquema.sql` | 2 tablas nuevas, 3 columnas en `compromisos`, 1 valor de enum, 1 CHECK reescrito, higiene de 3.4 |
| DER (`docs/der-esquema-datos.md`) | sección 3 (catálogo de entidades), diagrama mermaid, punto 5 de la sección 2 (origen polimórfico pasa de 3 a 4) |
| Prototipo | `src/datos/` (colección `reuniones_evento`, selector de compromisos por evento), `src/modulos/eventos/` (pestaña de compromisos del evento), pantallas que listan compromisos por origen |
| Alertas | `EVENTO_INCOMPLETO` (`src/datos/alertas.js`) hoy solo mira requerimientos sin confirmar; sumar compromisos vencidos del evento |

## 6. Pendientes de definición

1. ~~**Periodicidad de la reunión de eventos**~~ — **resuelto (JP,
   14/09/2026): no tiene cadencia fija**, a diferencia de Monitoreo
   (semanal) y Seguimiento (6 semanas). No hace falta ninguna columna nueva
   para esto: `reuniones_evento` no tiene (ni necesita) un campo de
   periodicidad esperada, a diferencia de `mesas.periodicidad` — cada fila
   es simplemente la fecha en que se hizo. Vale la pena sumarlo al glosario
   institucional (`contexto/glosario.md`, repo `Trabajo`) junto a Monitoreo
   y Seguimiento, para que quede documentado igual que los otros dos.
2. ~~**Quién la coordina**~~ — **resuelto (JP, 14/09/2026): Coordinación.**
   Por eso `reuniones_evento` no lleva `area_id`: al ser siempre la misma
   área, agregarlo sería una columna constante sin valor informativo — igual
   criterio que ya se aplicó en otras tablas del esquema donde el área sale
   del contexto en vez de cargarse a mano.
3. **Asistentes como texto o como tabla** — `reuniones_evento.asistentes text`
   copia lo que ya hace `reuniones_mesa`. Si en algún momento se quiere
   reportar qué áreas participan y cuáles faltan, hay que normalizarlo a una
   puente `reuniones_evento_areas`. Se deja en texto por ahora, igual que en
   mesas. Sigue abierto.
