# 04/09/2026 — Supabase como backend, y por qué arrancó en solo lectura

> Extraído de `docs/traspaso-04-09-supabase-en-vivo.md` el 08/09/2026 para que la
> decisión no viva solamente dentro de un traspaso. Si algo quedó mal resumido,
> manda el traspaso.

---

## Contexto

El portal era un prototipo sin backend: todo en `localStorage`. El 04/09 el jefe
de JP pidió tener los compromisos vigentes en el portal *ya*, Tomás no estaba, y
la alternativa era seguir esperando a una migración completa que es trabajo de
días.

## Decisión 1 — Supabase, y la conexión se hace acotada

Se desplegó la base real en Supabase (proyecto `PortalCoordinacion`, cuenta
`datoscoordinacion3f@gmail.com`) y se conectó el portal **por una sola pantalla,
solo lectura**: `src/modulos/vigentes-supabase/`.

**Por qué acotada y no completa:** migrar el sistema entero implica cambiar cada
función de `repositorio.js` de síncrona a async y revisar sus ~40 consumidores,
que asumen respuesta inmediata. Eso no correspondía hacerlo sin que Tomás lo
revisara. La pantalla nueva resuelve el pedido sin comprometer el resto.

**Consecuencia que sigue vigente:** el portal tiene dos fuentes de datos a la vez.
No asumir que Supabase es la fuente de verdad — todavía no lo es.

## Decisión 2 — Solo lectura hasta que hubiera login real

La clave `anon` viaja en el bundle del frontend: es pública de hecho, la vea quien
la vea. Habilitar escritura con ella, sin verificar identidad, dejaba cualquier
compromiso o proyecto municipal editable por cualquiera con el link del portal.

Se aplicó una política de RLS que permite `SELECT` y nada más, sobre las 9 tablas
del núcleo (`supabase/datos/carga-inicial/05-politica-rls-lectura.sql`).

Esta decisión **quedó superada el 07/09** al implementarse la autenticación — ver
`2026-09-07-autenticacion-y-roles.md`. Se documenta igual porque explica por qué
las cosas están como están y por qué el orden fue ése y no otro.

## Decisión 3 — Todo contra Supabase va por API REST

Se probaron los tres connection strings que ofrece Supabase —conexión directa
(5432), transaction pooler (6543), session pooler (5432)— y **los tres dieron
timeout desde la red del municipio**. El firewall bloquea saliente cualquier
puerto de Postgres; el 443 sale libre.

**No se puede usar** `psql`, un ORM con conexión directa, ni ninguna herramienta
que hable el protocolo Postgres nativo, desde la red municipal. Se usa la API REST
(PostgREST, sobre HTTPS) para todo, incluida la carga de datos.

Se confirmó desde las dos máquinas, la de JP y la de Tomás. No es un problema de
una computadora: es la red.

## Decisión 4 — Los puntuales son filas de `proyectos`, no una tabla propia

Tomás había revertido `puntuales` como tabla propia el 01/09 (PR #4, `63226a4`).
La carga inicial siguió ese revert: los 8 puntuales entraron como filas de
`proyectos` con `eje_id = 'Puntual'`.

## Hallazgo que corrigió el modelo

El generador del paquete de carga asignaba `es_obra` **por secretaría entera** —
todo lo que cargaba Obras quedaba marcado como obra— en vez de por si el proyecto
es una obra física. Se corrigieron 8 filas en caliente vía API REST.

Quedó una inconsistencia abierta: esas 8 siguen con `tipo_id = 'Obra'`, y como el
formulario del front autocompleta `es_obra` a partir del tipo, van a volver a
quedar mal si alguien las edita. Está anotado en `docs/traspaso-actual.md` §3.
