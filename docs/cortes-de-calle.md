# Cortes de calle — especificación funcional

**Pedido de:** el jefe de JP, 07/09/2026.
**Estado:** **v1 construida y andando** en el prototipo (módulo `Mapa`), sobre
`localStorage` como todo el resto del sistema. Lo que queda pendiente es
llevarla a Supabase, que implica escritura y por lo tanto auth y RLS — ver
secciones 7 y 10.
**Decisiones tomadas:** ver sección 8. **Supuesto pendiente:** sección 9.

---

## 1. Para qué

Cada vez que un área se contacta con el jefe para organizar algo en un lugar,
él necesita saber si en ese lugar y en esa fecha va a haber un corte de calle,
y por cuánto tiempo. Y necesita poder avisarle del cierre a las otras áreas.

Hoy **nadie en el municipio lleva un registro consolidado de cortes**: la
información llega a Coordinación área por área, suelta. El portal es el
consolidador, no un competidor de otro sistema — no hay que integrarse con
nadie, hay que ser el primero en tenerlo.

La pregunta que la pantalla tiene que contestar en un vistazo es:

> ¿qué está cortado hoy, qué se corta el sábado, y a quién hay que avisar?

## 2. Tres definiciones que ordenan el diseño

1. **Un corte no es un punto, es un tramo.** Un pin dice "acá pasa algo"; no
   dice por dónde no se pasa. Se cargan las dos formas —punto y tramo entre
   esquinas—, pero el tramo es el caso normal.
2. **El corte vive sin evento.** Muchos cortes no salen de un evento propio:
   obra, manifestación, accidente, suceso externo informado. Por eso es tabla
   propia con `evento_id` opcional, y no un campo dentro de `eventos`. Al
   revés también: un evento puede tener **varios** cortes (una feria que cierra
   la vuelta de la manzana son cuatro tramos, cada uno con su calle).
3. **El valor está en el eje temporal.** Sin vigencia y sin alguien que
   levante el corte, el mapa se llena de cortes viejos y en dos meses nadie lo
   mira. Es el modo más común en que este tipo de mapa muere.

## 3. El hallazgo: el geoportal municipal resuelve la carga

`https://geoportal.tresdefebrero.gob.ar/` es el geoportal oficial del
municipio. Corre sobre **GeoNode + GeoServer** y está **abierto**. Verificado
el 07/09/2026 contra `https://geoportal.tresdefebrero.gob.ar/gs/ows`:

| Qué | Resultado |
|---|---|
| `geonode:intersecciones_callejero` | **3.885 esquinas** como punto, cada una con el nombre de las **dos calles** que se cruzan (`nombre_cal`, `nombre_cal_2`) |
| `geonode:callejero_normalizado` | **6.787 segmentos** de calle con `nombre_cal`, alturas par/impar, `sen_circ_v` (sentido de circulación), `n_carriles`, `localidad` |
| Formato | GeoJSON con `outputFormat=application/json&srsName=EPSG:4326` — el mismo lat/lon que ya usa el portal |
| CORS | **Hace falta un proxy de mismo origen.** El servicio manda el header `access-control-allow-origin` DOS veces (lo agregan GeoServer y el nginx que tiene delante) y el navegador rechaza la respuesta por eso: *«contains multiple values '\*, \*'»*. Con `curl` no se nota. Resuelto con el proxy de Vite en desarrollo y un rewrite en `vercel.json` en producción, los dos sobre la ruta `/geo`. |
| Filtros | acepta `CQL_FILTER` (ej. `nombre_cal ILIKE '%San Mart%'`) → autocompletado de calles |
| Capa base | `GetMap` de WMS devuelve PNG → usable como fondo en Leaflet |

**Consecuencia práctica:** no hace falta dibujar los cortes a mano sobre un
mapa. La carga es *elegir la calle y las dos esquinas* de una lista oficial, y
el sistema arma el tramo. Se cargan más rápido, salen bien escritos y quedan
comparables entre sí.

El header duplicado convendría reportárselo a quien administra el geoportal:
mientras esté así, **ninguna aplicación web del municipio puede consultarlo
desde el navegador sin poner un proxy en el medio**. No nos bloquea, pero es un
problema de ellos que hoy paga cada quien lo quiera usar.

Capas que además sirven para responder "a quién hay que avisar":
`Recorridos_de_colectivos_DPE_OD`, `paradas_municipales`, `Corredores_Escolares`,
`Puertas_Escolares`, `Instituciones_educativas`, `centros_de_atencion_primaria`,
`Comisarias_3F`, `RED_DE_TRANSITO_PESADO`, `jerarquizacion_vial_2023`.

**Riesgo asumido:** el geoportal es de otra dirección y puede caerse o cambiar.
Mitigación: cada corte guarda sus **coordenadas propias y el texto de las
calles**, no solo los ids del geoportal — así el corte se sigue dibujando y
leyendo aunque el servicio no responda. La capa base cae a OpenStreetMap.

Hay además un par de detalles de configuración del geoportal que conviene
comentarle a quien lo administra. No van escritos acá: este repositorio es
público y son de otra dirección, no nuestros.

## 4. Modelo de datos

```sql
create type public.forma_corte   as enum ('punto', 'tramo');
create type public.alcance_corte as enum ('total', 'media_calzada', 'desvio');
create type public.motivo_corte  as enum ('evento', 'obra', 'operativo', 'externo', 'otro');
create type public.estado_corte  as enum ('previsto', 'confirmado', 'levantado', 'suspendido');

create table public.cortes (
  id                    uuid primary key default gen_random_uuid(),

  -- Origen. `evento_id` nulo = corte sin evento (obra, externo, operativo).
  evento_id             uuid references public.eventos(id) on delete set null,
  motivo                public.motivo_corte not null,
  detalle_motivo        text,
  area_solicitante_id   uuid references public.areas(id),

  -- Geometria. GeoJSON en EPSG:4326 con todas las lineas del corte.
  forma                 public.forma_corte not null,
  geometria             jsonb not null,

  -- Las cuadras elegidas y su agrupacion por calle. Se guardan enteras —con su
  -- geometria— y no solo por id: asi el corte se sigue dibujando y se puede
  -- volver a editar aunque el geoportal no responda.
  cuadras               jsonb not null default '[]',
  tramos                jsonb not null default '[]',

  -- Referencia legible del PRIMER tramo. Es lo que se lee en una lista y lo que
  -- se copia a un WhatsApp: un mapa que no se puede decir en voz alta no sirve
  -- para avisar. Con varias calles, la descripcion completa sale de `tramos`.
  calle                 text not null,
  esquina_desde         text,
  esquina_hasta         text,
  localidad             text,

  -- Trazabilidad al callejero oficial (ver seccion 3).
  id_calle_geoportal    bigint,
  fid_esquina_desde     integer,
  fid_esquina_hasta     integer,

  alcance               public.alcance_corte not null default 'total',

  -- Vigencia. Un solo modelo cubre los tres casos reales (ver 4.1).
  vigencia_desde        date not null,
  vigencia_hasta        date,
  hora_desde            time,
  hora_hasta            time,
  dias_semana           smallint[],      -- null = todos los dias del rango
  fechas_excluidas      date[],

  estado                public.estado_corte not null default 'previsto',
  observaciones         text,

  creado_por            uuid references public.perfiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Un tramo necesita sus dos esquinas; un punto, ninguna.
  constraint cortes_tramo_con_esquinas check (
    forma <> 'tramo' or (esquina_desde is not null and esquina_hasta is not null)
  ),
  constraint cortes_rango_coherente check (
    vigencia_hasta is null or vigencia_hasta >= vigencia_desde
  )
);

create index cortes_vigencia_idx on public.cortes (vigencia_desde, vigencia_hasta);
create index cortes_evento_idx   on public.cortes (evento_id) where evento_id is not null;
```

### 4.1 Por qué la vigencia se modela así

Hay cortes recurrentes (ferias, operativos fijos), así que hacía falta
repetición. Las dos alternativas habituales tienen problemas: guardar la regla
como JSON no se puede consultar con SQL simple, y generar una fila por cada
domingo del año obliga a editar 52 filas cuando la feria cambia de horario.

Con estos seis campos los casos reales entran en un solo modelo:

| Caso | Cómo se carga |
|---|---|
| Corte de un día, unas horas | `vigencia_desde = vigencia_hasta = la fecha`, más `hora_desde` / `hora_hasta` |
| Corte continuo de varios días (obra) | rango de fechas, `dias_semana` y horas en null |
| Feria de todos los domingos | rango largo, `dias_semana = {0}`, horas de la feria |
| El domingo que no hay feria | esa fecha en `fechas_excluidas` |

Caso a validar en la implementación: el corte que cruza la medianoche
(`hora_desde` 22:00, `hora_hasta` 02:00).

### 4.2 `estado` guarda cuatro valores; "vigente" se deduce

Mismo criterio que ya usa el portal con los compromisos, documentado en
[`src/datos/catalogos.js`](../src/datos/catalogos.js): `alerta` no se persiste
porque nadie lo va a marcar cuando cambia el día. Acá igual — **"vigente" es
una cuenta contra el reloj**, no algo que alguien tilda:

```
estaVigente(corte, momento) =
     fecha(momento) dentro de [vigencia_desde, vigencia_hasta]
  && (dias_semana es null || incluye el dia de la semana)
  && (horas en null || hora(momento) dentro de [hora_desde, hora_hasta])
  && fecha(momento) no esta en fechas_excluidas
  && estado no es 'levantado' ni 'suspendido'
```

Va junto a `estadoCompromiso()` en `src/datos/selectores.js`.

## 5. Interfaz

### 5.1 Sección nueva "Cortes"

Dos pestañas, siguiendo el patrón de `src/modulos/eventos/Eventos.jsx`:

1. **Mapa** — Leaflet con el callejero del geoportal como base. Arriba, un
   **selector de fecha que arranca en hoy**, con paso rápido a mañana y a esta
   semana. Es la pantalla que contesta la pregunta del jefe.
2. **Lista** — los mismos cortes en tabla, con filtros por área solicitante,
   motivo, localidad y estado, usando `Tabla.jsx` y `Filtros.jsx`.

Más un **buscador por calle**: se escribe "San Martín" y dice si hay o va a
haber corte ahí, con fechas. Ese es el uso literal que describió el jefe.

### 5.2 Ficha de un corte

Además de sus datos, un bloque **"A quién avisar"**: se consulta el geoportal
con un bbox alrededor de la geometría del corte y se lista qué toca —recorrido
de colectivo, puerta de escuela, CAPS, comisaría, red de tránsito pesado— y por
lo tanto a qué área le corresponde el aviso.

Debajo, un botón **"Copiar aviso"** que arma el texto listo para pegar en un
mail o un WhatsApp:

> Corte de calle — Av. San Martín entre Lavalle y Hornos (Caseros).
> Domingo 13/09 de 08:00 a 14:00. Corte total. Motivo: feria.
> Afecta el recorrido de la línea 237 y la puerta de la EP 02.

Es un aviso manual, no un sistema de notificaciones: resuelve casi toda la
necesidad con muy poco código y deja la notificación automática para cuando el
uso lo justifique.

### 5.3 Carga: elegir las calles con el cursor

**Un corte se arma seleccionando cuadras sobre el mapa** (pedido de JP,
07/09/2026, reemplaza al formulario de dos esquinas de la primera versión).

```
[ + Agregar corte ]
        |
        v
  El mapa se acerca solo y se pinta el callejero municipal encima:
  cada CUADRA es clickeable.

  Clic  -> la cuadra queda elegida (azul lleno)
  Clic de nuevo -> se quita
  Se eligen todas las que haga falta, de una calle o de varias.

  Panel lateral:  Paso 1 - Elegí las calles a cortar
                  Arévalo    2 cuadras · Caseros Norte   [1904 a 1985] [2018 a 2081]
                  Asamblea   1 cuadra  · Caseros Norte   [4455 a 4540]
                  [ Continuar con 3 cuadra(s) ]
        |
        v
  Módulo de datos:
     Calles seleccionadas   Arévalo entre Wenceslao de Tata y Bonifacini
                            Asamblea entre Zavatarro y Santa María de Oro
                            [ Volver a elegir calles ]
     Motivo del corte       por qué se corta · alcance · detalle · área · evento
     Tiempo                 desde / hasta · horas · se repite
     Observaciones
```

Por qué así y no con dos desplegables de esquina:

1. **Es la unidad que el municipio ya usa.** El callejero publica una fila por
   cuadra, con su nombre de calle y su rango de alturas: lo clickeable es
   exactamente el dato oficial, no una división inventada por el portal.
2. **Un corte de varias calles deja de ser un problema.** Cerrar la vuelta de
   una manzana son cuatro tramos de un mismo corte, y se cargan igual de fácil
   que uno solo.
3. **El orden sigue a la cabeza de quien carga**: primero se señala lo que está
   cortado, después se explica por qué.

Las esquinas se resuelven **al continuar**, no en cada clic: las cuadras
elegidas se agrupan por calle, se buscan las dos puntas del grupo y se consulta
el callejero por la esquina más cercana a cada una, exigiendo que sea una
esquina de esa misma calle. De ahí sale «Arévalo entre Wenceslao de Tata y
Bonifacini». Si el geoportal no contesta, el tramo se describe por altura
(«Arévalo al 1900»), que es la otra forma en que el municipio nombra un lugar.

Sólo se piden las cuadras que entran en pantalla, y a partir de zoom 16: el
partido tiene 6.787 y traerlas todas sería un par de megabytes para dibujar
doscientas.

### 5.4 Enganche con el evento

Falta el ítem **"Corte de calle"** en el catálogo `items_requerimiento` (hoy
están Vallado y Seguridad, nada más — `src/datos/catalogos.js`). Agregarlo
sirve como bandera: cuando un evento lo pide como requerimiento pero no tiene
ningún corte cargado, el motor de alertas que ya existe lo marca igual que hoy
marca los requerimientos sin confirmar (`TIPOS_ALERTA.EVENTO_INCOMPLETO` en
`src/datos/alertas.js`). Es el puente entre "este evento necesita corte" y "el
corte está dibujado".

### 5.5 Nada que dependa de `hover`

El portal hoy es de escritorio, pero JP quiere hacerlo responsive pronto. En un
mapa la tentación es poner el dato en el tooltip, y en un celular el tooltip no
existe. Todo lo que aparezca al pasar el mouse tiene que estar también a un tap
de distancia (panel lateral o ficha inferior).

## 6. Qué queda afuera de la v1

Explícito, para no discutirlo después:

1. **Vista pública para vecinos.** Sube muchísimo la exigencia: dato validado,
   actualizado en el día y alguien responsable de levantar el corte. Si un dato
   sale mal, el desvío se lo come un vecino. Fase 2, cuando el registro interno
   demuestre que se mantiene al día.
2. **Notificaciones automáticas a las áreas.** Por ahora, "Copiar aviso".
3. **Polígonos y recorridos libres.** Una feria se carga como varios tramos, y
   de hecho queda mejor descrita así: cada tramo con su calle.
4. **Detección automática de solapamientos** (dos cortes pisándose en fecha y
   lugar). Requiere PostGIS y consultas espaciales. Con pocos cortes por semana
   el ojo alcanza; cuando no alcance, se activa la extensión en Supabase y las
   consultas van por RPC — recordar que desde la red del municipio Postgres
   directo está bloqueado pero PostgREST anda, ver
   `docs/traspaso-04-09-supabase-en-vivo.md`.
5. **Migrar `MapaObras` a Leaflet.** El mapa de obras hoy es un plano de puntos
   sin cartografía, decidido cuando el portal no tenía backend. Ese motivo ya no
   corre —las tiles las pide el navegador del que mira, por HTTPS—, así que a
   futuro conviene unificar los dos mapas en un componente. No en esta v1.

## 7. Lo que hay que resolver antes de escribir código

**Escritura en Supabase.** Hoy el portal lee con RLS de solo lectura y clave
`anon`, y no tiene autenticación real (`config.usuario` es texto). Cargar cortes
es escritura: hacen falta auth, un rol y políticas RLS. Es justo el salto que
quedó pendiente el 04/09 — esta funcionalidad puede ser la excusa para darlo,
pero **es terreno de Tomás y hay que alinearlo con él antes**, no después.

## 8. Decisiones tomadas (JP, 07/09/2026)

1. Se cargan seleccionando cuadras en el mapa (07/09/2026, reemplaza al
   formulario de dos esquinas). Un corte puede abarcar varias calles. Sin
   polígonos: una feria que cierra una manzana son sus cuatro tramos.
2. La v1 la ve y la carga **solo Coordinación**.
3. Alcance v1: visor + carga manual.
4. Se carga desde el evento y también de forma independiente.
5. Hay cortes recurrentes: la repetición entra en la v1.
6. Volumen esperado: pocos cortes por semana.
7. Nada que dependa de `hover` (el portal va a ser responsive).

## 9. Supuesto pendiente de confirmar

**Quién levanta el corte y cuándo.** Se asume que el corte se deduce levantado
cuando pasa su `vigencia_hasta`, más un botón "Levantar ahora" para cuando
termina antes de lo previsto. Si en la práctica los cortes se estiran sin fecha
cierta, `vigencia_hasta` no puede ser obligatoria y el mapa necesita una
categoría **"sin fecha de levantamiento"** bien visible — porque un corte sin
fecha de fin es exactamente el que le arruina la agenda al jefe.

## 10. Qué está construido (07/09/2026)

La v1 quedó andando sobre `localStorage`, igual que el resto del prototipo. Se
probó de punta a punta contra el geoportal real: se carga una calle, llegan sus
esquinas, se traza el tramo y la ficha lista los recorridos de colectivo
afectados.

| Archivo | Qué hace |
|---|---|
| `src/datos/geoportal.js` | Cliente del WFS municipal: busca calles, esquinas, tramos y capas de contexto. Concentra las dos trampas de coordenadas y la tolerancia a fallas del servicio. |
| `src/datos/cortes.js` | Parte pura: ocurrencia, estado derivado, vigencia en texto y el texto del aviso. |
| `src/componentes/MapaLeaflet.jsx` | El mapa. Leaflet se importa dentro del efecto, no arriba del archivo: toca `window` y rompería la prueba de humo entera. |
| `src/modulos/mapa/Mapa.jsx` | La pantalla: métricas, control de período, mapa, lista y ficha. |
| `src/modulos/mapa/FormularioCorte.jsx` | El paso 2: motivo, tiempo y las calles ya elegidas. |
| `src/modulos/mapa/periodoCortes.js` | El control de período, aparte y puro. |
| `src/modulos/mapa/seleccionCuadras.js` | De cuadras elegidas a tramos con nombre: agrupar por calle y resolver las esquinas de cada punta. |
| `pruebas/cortes.test.mjs` | 36 pruebas: vigencia, período, agrupación de cuadras y descripción de tramos. |

Fuera del módulo: la colección `cortes` en `esquema.js`, las cuatro acciones en
`repositorio.js`, el ítem «Corte de calle» en el catálogo de requerimientos, los
estilos del mapa en `index.css`, el proxy en `vite.config.js` y `vercel.json`, y
la sección de cortes en el formulario de evento.

Lo que NO cambió: `MapaObras` sigue como estaba, y ninguna pantalla existente
cambió de comportamiento.
