# DER del backend — Coordinacion3F2.0

Contexto y contenido del modelo de datos relacional diseñado para el backend
real (Supabase/Postgres) del portal de Coordinación. Pensado para pasarse
como contexto a otra sesión de Claude sin depender del resto de la
conversación en la que se armó.

**Estado: diseñado y escrito, NO aplicado todavía a ninguna instancia de
Supabase.** Ver la sección "Estado actual y qué falta" al final — hay una
decisión explícita de no migrar hasta cerrar los formularios de carga.

---

## 1. Qué es esto y por qué existe

El portal de Coordinación tiene dos repos:

- **`Coordinacion-3f` (v1)** — Next.js + Supabase, abandonado como frontend,
  pero con un núcleo de modelo de datos sólido: catálogos normalizados,
  roles, actualizaciones fechadas (nunca se pisa una carga vieja), serie
  histórica y auditoría por trigger.
- **`Coordinacion3F2.0` (v2)** — el repo activo hoy, Vite + React, corriendo
  como prototipo 100% `localStorage` (sin backend real). Le agregó al diseño
  de v1 varios módulos que v1 nunca tuvo: seguimientos, compromisos con
  origen polimórfico, monitoreos, mesas de trabajo, eventos con
  requerimientos, planificación anual, y posicionamiento internacional.

Este DER es la **fusión de los dos**: toma el núcleo relacional de v1 (el
que hoy no tiene ningún repo activo usándolo) y le suma los módulos de v2,
para que cuando el portal deje de vivir en `localStorage` tenga un esquema
real de Postgres detrás, sin perder ninguna de las dos partes.

Vive en `supabase/migrations/0001_esquema.sql` (41 tablas, 14 tipos enum),
escrito el 19/08/2026 y con el módulo de Posicionamiento rediseñado el
21/08/2026 (ver sección 2, punto 9).

---

## 2. Decisiones de diseño que no son obvias mirando el SQL

Estas son las que vale la pena que alguien que solo lea el diagrama se
pierda si no se las explican:

1. **`objetivo` es nullable en `act_cuantitativas`.** No es una corrección
   cosmética: sale de auditar las 8 planillas (`_db`) reales el 16/08/2026.
   Buena parte de las observaciones cuantitativas son indicadores/contadores
   sin meta formal, no proyectos con objetivo comprometido — Trabajo y
   Producción tenía 107/107 filas sin objetivo, Obras 36/36, Seguridad
   162/163. Sin objetivo no hay % de avance ni banda de cumplimiento, y el
   dato se carga igual (`porcentaje_avance` queda `null`, no `0`).

2. **`id_legible` es cosmético, no la clave primaria.** El formato
   `SEC-AAAA-NNN` que ve el usuario (heredado de v2) es una columna `text
   unique`, no el PK. El PK real de todo es `uuid`. Importa para cualquier
   FK que se escriba a mano: siempre apunta al `uuid`, nunca al legible.

3. **`es_estrategico` en `proyectos` absorbe tres conceptos de v1 que
   vivían separados**: la pestaña `Ejes_Estratégicos`, el campo "Interés de
   Roco", y los "puntuales estratégicos". En vez de tres mecanismos
   paralelos (que en v1 podían desincronizarse entre sí), es un solo flag
   booleano con su bloque de campos (`motivo_estrategico_id`,
   `responsable_politico`, `compromiso_publico`, `origen_estrategico`, quién
   y cuándo lo marcó).

4. **`actualizaciones` es de solo alta, nunca de update.** Cargar la
   observación de junio no pisa la de mayo — cada fila es una foto fechada.
   `act_cuantitativas` y `act_comparativas` cuelgan 1:1 de una
   `actualizacion_id` (herencia por tabla, no columnas opcionales mezcladas
   en la misma fila) porque una actualización cualitativa no tiene ninguno
   de los dos, una cuantitativa solo el primero, una comparativa solo el
   segundo.

5. **`compromisos` tiene origen polimórfico con FK dura, no un
   `tipo + id` genérico.** Tres columnas nullable
   (`id_seguimiento_origen`, `id_tema_origen`, `id_reunion_origen`), con un
   `CHECK (num_nonnulls(...) <= 1)` que garantiza que como máximo una esté
   cargada (o ninguna, si el compromiso se creó a mano sin origen). La
   alternativa típica —una columna `origen_tipo` de texto libre más un
   `origen_id` sin FK— no la elimina el motor de base de datos si un
   registro de origen se borra; esta sí.

6. **La auditoría es por trigger genérico sobre la tabla, no por bitácora
   de aplicación.** Reemplaza el `historial` de v2 (que era app-level: solo
   registraba lo que pasaba por la UI). Con un trigger en Postgres, un
   `UPDATE` hecho a mano desde el editor SQL de Supabase queda registrado
   igual que uno hecho desde la pantalla — la tabla `auditoria` guarda
   `datos_antes`/`datos_despues` en `jsonb`.

7. **Datos personales de vecinos, marcados desde el esquema.** El campo
   `pedidos_roco.solicitante` puede contener el nombre de un vecino —
   comentado en el SQL como "fuera del grant de select por defecto en
   `0003_rls.sql`. Ley 25.326". Esto conecta con una regla que ya está en el
   `CLAUDE.md` del workspace: datos de reclamos/casos sociales se agregan a
   nivel barrio en outputs públicos, nunca a nivel persona.

8. **Sin tildes ni ñ en identificadores ni literales SQL.** Convención
   heredada de v1, mantenida por consistencia (no por limitación técnica de
   Postgres).

9. **Posicionamiento internacional, rediseñado el 21/08/2026.** JP revisó el
   DER en Lucidchart y simplificó todo el módulo. Se elimina
   `acciones_internacionales` (con `tipo`, `pais_id`, `alcance`,
   `fecha_inicio`, `fecha_limite`, `fecha_resolucion`, `resultado`,
   `descripcion`, `referente`) y sus dos tablas puente
   (`acciones_internacionales_proyectos`, `acciones_internacionales_ods`),
   incluido el catálogo de **ODS** (Objetivos de Desarrollo Sostenible —
   Agenda 2030 de la ONU) que colgaba de ahí. En su lugar, dos tablas nuevas:
   `proyectos_posicionamiento` (una fila por proyecto: nombre, organismo,
   área, estado, financiamiento, objetivo) y `actualizaciones_posicionamiento`
   (una fila por observación fechada, mismo patrón append-only que
   `actualizaciones` — punto 4). Ya no hay vínculo M:N con la tabla general
   `proyectos`: un proyecto de posicionamiento es una entidad propia.

   **Aviso de procedencia, para que quede escrito:** ni el catálogo de ODS
   (que existía en el diseño anterior) ni los campos `organismo_id`,
   `area_id` y `financiamiento_usd` de la tabla nueva aparecieron en la
   pestaña real "Estado de proyectos" que se relevó de `Coordinacion_db` el
   19/08/2026 (los 8 proyectos reales — CIPPEC, UBA, CIIAR, etc. — solo
   traían Programa/Proyecto/Estado/Comentarios/Fecha). Son campos heredados
   del diseño original del prototipo v2, no verificados contra un dato real.
   Si en algún momento se confirma que sí se cargan en la gestión real de
   posicionamiento, esto queda resuelto; si no, hay que revisar si siguen
   teniendo sentido en el esquema.

---

## 3. Catálogo de entidades, agrupado por dominio

### Catálogos (listas cerradas, reemplazan los desplegables hardcodeados)
`areas` · `ejes` · `estados` · `unidades` · `tipos_proyecto` ·
`categorias_tema` · `items_requerimiento` · `motivos_estrategicos` ·
`organismos` (quién es la contraparte de un proyecto de posicionamiento)

`areas` viene pre-cargada con las **siete secretarías reales** de Tres de
Febrero (Ambiente, Capital Humano, Obras, Salud, Seguridad, Trabajo y
Producción, Coordinación) y `ejes` con los valores reales del campo `Eje` de
los `_db` (POA, Compromisos, Puntual, las tres mesas territoriales,
Posicionamiento) — no son datos de prueba, son el mismo vocabulario
institucional que documenta `contexto/glosario.md`.

### Usuarios
`perfiles` — referencia a `auth.users` de Supabase (RLS entra desde el
arranque, no es una pregunta abierta como era en el boceto de v2).

### Maestro
`programas` · `proyectos` — el corazón del modelo. `proyectos` tiene el
bloque estratégico completo (punto 3 de la sección anterior).

### Monitoreo y actualizaciones (núcleo de v1)
`actualizaciones` · `act_cuantitativas` · `act_comparativas` · `objetivos`
(umbrales por período) · `serie_historica` (comparativo interanual)

### Resto del circuito heredado de v1
`actividades` (con lat/lng, para el mapa de obras) · `pedidos_roco` ·
`eventos` · `requerimientos_evento` · `adjuntos`

### Seguimiento (nuevo de v2)
`seguimientos` · `seguimientos_proyectos` (tabla puente: un seguimiento
puede tocar varios proyectos)

### Monitoreo operativo y compromisos (nuevo de v2)
`monitoreos` · `temas_monitoreo` · `mesas` · `reuniones_mesa` ·
`mesas_proyectos` · `compromisos` (origen polimórfico, punto 5)

### Planificación anual (nuevo de v2)
`planificacion_anual` · `planificacion_trimestres` · `hitos_planificacion`

### Posicionamiento internacional (rediseñado el 21/08/2026)
`proyectos_posicionamiento` (una fila por proyecto: nombre, organismo, área,
estado, financiamiento, objetivo) · `actualizaciones_posicionamiento` (una
fila por observación fechada, mismo patrón que `actualizaciones` de la
cartera general — nunca se pisa una carga vieja). Entidad totalmente propia,
sin vínculo M:N con `proyectos`: un proyecto de posicionamiento no depende de
la tabla general. Reemplaza a la versión anterior (`acciones_internacionales`
y dos tablas puente) — ver punto 9 de la sección 2.

### Sistema
`reportes_guardados` · `auditoria` · `auditoria_consultas` · `alertas` ·
`migracion_cuarentena` (filas de los Sheets que no calzaron en la migración,
para no perderlas en silencio) · `renglon_overrides`

---

## 4. Diagrama entidad-relación

```mermaid
erDiagram
    areas {
        uuid id PK
        text slug UK
        text nombre
        text prefijo
        boolean activa
    }
    ejes {
        uuid id PK
        text slug UK
        text nombre
        boolean activo
    }
    estados {
        uuid id PK
        text slug UK
        text nombre
        text color
        text aplica_a
    }
    unidades {
        uuid id PK
        text slug UK
        text nombre
    }
    tipos_proyecto {
        uuid id PK
        text slug UK
        text nombre
    }
    categorias_tema {
        uuid id PK
        text slug UK
        text nombre
    }
    items_requerimiento {
        uuid id PK
        text slug UK
        text nombre
    }
    motivos_estrategicos {
        uuid id PK
        text slug UK
        text nombre
    }
    organismos {
        uuid id PK
        text nombre
    }
    perfiles {
        uuid id PK
        text nombre
        text email
        text rol
        uuid area_id FK
    }
    programas {
        uuid id PK
        uuid area_id FK
        text nombre
    }
    proyectos {
        uuid id PK
        text id_legible UK
        uuid programa_id FK
        text nombre
        uuid eje_id FK
        uuid tipo_id FK
        text estado_general
        boolean es_obra
        numeric monto_planificado
        numeric monto_ejecutado
        boolean es_estrategico
        uuid motivo_estrategico_id FK
    }
    actualizaciones {
        uuid id PK
        uuid proyecto_id FK
        text tipo
        date fecha_actualizacion
        uuid estado_id FK
        text derivacion
        text origen
    }
    act_cuantitativas {
        uuid actualizacion_id PK
        numeric cantidad
        uuid unidad_id FK
        numeric objetivo "nullable"
        numeric porcentaje_avance "generada"
    }
    act_comparativas {
        uuid actualizacion_id PK
        int ingresados
        int resueltos
        numeric porcentaje_resolucion "generada"
    }
    objetivos {
        uuid id PK
        uuid proyecto_id FK
        date periodo_inicio
        date periodo_fin
        numeric umbral_critico
        numeric umbral_minimo
        numeric umbral_supera
    }
    serie_historica {
        uuid id PK
        uuid proyecto_id FK
        text metrica
        numeric valor
    }
    actividades {
        uuid id PK
        uuid proyecto_id FK
        text nombre
        double lat
        double lng
    }
    pedidos_roco {
        uuid id PK
        uuid area_id FK
        text descripcion
        text solicitante "Ley 25.326"
        text estado
    }
    eventos {
        uuid id PK
        text nombre
        date fecha
        uuid area_organizadora_id FK
        uuid proyecto_id FK
    }
    requerimientos_evento {
        uuid id PK
        uuid evento_id FK
        uuid item_id FK
        uuid area_responsable_id FK
        text estado
    }
    adjuntos {
        uuid id PK
        uuid programa_id FK
        uuid proyecto_id FK
        text storage_path
    }
    seguimientos {
        uuid id PK
        uuid area_id FK
        date fecha
        text tipo
        text texto_crudo
    }
    seguimientos_proyectos {
        uuid seguimiento_id PK
        uuid proyecto_id PK
    }
    monitoreos {
        uuid id PK
        date fecha
        uuid area_id FK
        boolean cerrado
    }
    temas_monitoreo {
        uuid id PK
        uuid monitoreo_id FK
        uuid proyecto_id FK
        uuid categoria_id FK
        text criticidad
        boolean requiere_accion
        boolean resuelto
    }
    mesas {
        uuid id PK
        text nombre
        text tipo
        text estado
    }
    reuniones_mesa {
        uuid id PK
        uuid mesa_id FK
        date fecha
    }
    mesas_proyectos {
        uuid mesa_id PK
        uuid proyecto_id PK
    }
    compromisos {
        uuid id PK
        text origen_tipo
        uuid id_seguimiento_origen FK
        uuid id_tema_origen FK
        uuid id_reunion_origen FK
        uuid proyecto_id FK
        uuid area_id FK
        text estado
        date fecha_limite
    }
    planificacion_anual {
        uuid id PK
        uuid proyecto_id FK
        int anio
        numeric meta_anual
    }
    planificacion_trimestres {
        uuid id PK
        uuid planificacion_id FK
        int trimestre
        numeric meta
    }
    hitos_planificacion {
        uuid id PK
        uuid planificacion_id FK
        text nombre
        boolean cumplido
    }
    proyectos_posicionamiento {
        uuid id PK
        text nombre
        uuid organismo_id FK
        text estado
        uuid area_id FK
        numeric financiamiento_usd
        text objetivo
    }
    actualizaciones_posicionamiento {
        uuid id PK
        uuid proyecto_posicionamiento_id FK
        date fecha_actualizacion
        text estado
        text comentarios
    }
    reportes_guardados {
        uuid id PK
        text nombre
        text filtros
    }
    alertas {
        uuid id PK
        text tipo
        text severidad
        uuid proyecto_id FK
        uuid area_id FK
    }
    renglon_overrides {
        uuid id PK
        text informe
        uuid area_id FK
        uuid programa_id FK
        uuid estado_id FK
        text motivo
    }
    auditoria {
        bigserial id PK
        text tabla
        text registro_id
        text accion
        jsonb datos_antes
        jsonb datos_despues
    }
    auditoria_consultas {
        bigserial id PK
        text tipo
        jsonb parametros
    }
    migracion_cuarentena {
        bigserial id PK
        text origen_sheet
        text origen_pestana
        int origen_fila
        jsonb payload
        text motivo
    }

    areas ||--o{ programas : tiene
    areas |o--o{ perfiles : pertenece
    programas ||--o{ proyectos : agrupa
    ejes ||--o{ proyectos : clasifica
    tipos_proyecto |o--o{ proyectos : tipo
    motivos_estrategicos |o--o{ proyectos : motivo

    proyectos ||--o{ actualizaciones : tiene
    estados ||--o{ actualizaciones : estado
    actualizaciones ||--o| act_cuantitativas : detalle
    actualizaciones ||--o| act_comparativas : detalle
    unidades |o--o{ act_cuantitativas : unidad

    proyectos ||--o{ objetivos : ""
    proyectos ||--o{ serie_historica : ""
    proyectos ||--o{ actividades : ""
    areas |o--o{ pedidos_roco : ""

    areas |o--o{ eventos : organiza
    proyectos |o--o{ eventos : vincula
    eventos ||--o{ requerimientos_evento : requiere
    items_requerimiento ||--o{ requerimientos_evento : cataloga
    areas |o--o{ requerimientos_evento : responsable

    programas |o--o{ adjuntos : ""
    proyectos |o--o{ adjuntos : ""

    areas ||--o{ seguimientos : ""
    seguimientos ||--o{ seguimientos_proyectos : ""
    proyectos ||--o{ seguimientos_proyectos : ""

    areas ||--o{ monitoreos : ""
    monitoreos ||--o{ temas_monitoreo : contiene
    categorias_tema ||--o{ temas_monitoreo : clasifica
    proyectos |o--o{ temas_monitoreo : opcional

    mesas ||--o{ reuniones_mesa : agenda
    mesas ||--o{ mesas_proyectos : ""
    proyectos ||--o{ mesas_proyectos : ""

    seguimientos |o--o{ compromisos : "origen posible"
    temas_monitoreo |o--o{ compromisos : "origen posible"
    reuniones_mesa |o--o{ compromisos : "origen posible"
    proyectos |o--o{ compromisos : ""
    areas ||--o{ compromisos : ""

    proyectos ||--o{ planificacion_anual : planifica
    planificacion_anual ||--o{ planificacion_trimestres : desagrega
    planificacion_anual ||--o{ hitos_planificacion : marca

    organismos |o--o{ proyectos_posicionamiento : organismo
    areas |o--o{ proyectos_posicionamiento : ""
    proyectos_posicionamiento ||--o{ actualizaciones_posicionamiento : tiene

    proyectos |o--o{ alertas : ""
    areas |o--o{ alertas : ""
    areas ||--o{ renglon_overrides : ""
    programas ||--o{ renglon_overrides : ""
    estados ||--o{ renglon_overrides : ""
```

> `auditoria`, `auditoria_consultas` y `migracion_cuarentena` quedan fuera de
> las relaciones del diagrama a propósito: `auditoria.tabla`/`registro_id`
> es una referencia genérica en texto (para poder auditar también tablas
> puente con clave compuesta), no una FK real a una tabla puntual.

Nota: el diagrama omite a propósito columnas de auditoría repetidas en casi
todas las tablas (`activo`, `creado_por`, `created_at`, `updated_at`) para
que se pueda leer. Están en el SQL completo.

---

## 5. Estado actual y qué falta

- **No aplicado a Supabase.** Decisión de la reunión del 18/08/2026 con
  Salva: primero se termina de diseñar la interfaz y los formularios de
  carga de cada módulo usando los datos reales de los Sheets como insumo, y
  recién después se migra — para no tener que migrar dos veces si un
  formulario revela que falta o sobra una columna.
- **Solo existe `0001_esquema.sql`.** El propio archivo referencia (en
  comentarios) dos migraciones que todavía no están escritas:
  - `0002_logica.sql` — lógica de validación adicional (ej. el CHECK de
    origen único de `compromisos` está anticipado en el comentario pero la
    migración en sí falta).
  - `0003_rls.sql` — Row Level Security, incluida la restricción de
    `pedidos_roco.solicitante` por Ley 25.326.
- **Mapeo módulo → tablas** (qué pantalla del front toca qué parte del
  esquema) está en
  [`docs/decisiones/2026-08-18-despliegue-del-modelo.md`](decisiones/2026-08-18-despliegue-del-modelo.md).
- **Próximo paso concreto:** por cada módulo del front (`src/modulos/`),
  listar los campos del formulario, cruzarlos contra las columnas del
  esquema y anotar los tres casos posibles — campo que sobra, campo que
  falta, campo que existe con otro nombre.

## 6. Dónde está cada cosa

| Qué | Dónde |
|---|---|
| El esquema completo (fuente de verdad) | `supabase/migrations/0001_esquema.sql` |
| Decisiones de la reunión que fija el orden de trabajo | `docs/decisiones/2026-08-18-despliegue-del-modelo.md` |
| Bitácora de cambios de interfaz (para no perder trazabilidad) | `docs/registro-de-cambios.md` |
| Vocabulario institucional (áreas, ejes, siglas) | `contexto/glosario.md` y `contexto/programas-municipales.md` (repo `Trabajo`, fuera de este repo) |
| Versiones anteriores/borrador de este DER, para Lucidchart | `archivos_varios/coordinacion-3f-fusion.mermaid` y `coordinacion-3f-fusion-para-lucidchart.sql` (repo `Trabajo`) — este documento es la versión actualizada y autoritativa, generada directamente desde el SQL final |
