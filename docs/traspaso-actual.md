# Traspaso actual

**Este archivo es el estado vivo del proyecto.** Lo actualiza quien cierra una
sesión de trabajo y lo lee quien abre la siguiente, sea JP o Tomás. Reemplaza al
mecanismo de pedirle a la IA un resumen para pegárselo a la IA del otro: acá el
canal es git.

**Cómo se usa:**

1. Al abrir la sesión: `git pull` y leer este archivo.
2. Al cerrarla: reescribir las secciones 1 a 4 con el estado nuevo, commitear y
   pushear.
3. Cuando un traspaso queda históricamente interesante, se archiva como
   `docs/traspaso-DD-MM-tema.md` y acá queda solo lo vigente.

**Qué NO va acá:** el detalle de qué archivo se tocó (eso está en el diff), la
conversación con la IA, ni nada que ya diga el `README.md` o el `CLAUDE.md`. Va lo
que el otro no puede deducir leyendo el repo.

---

**Última actualización:** 08/09/2026 · JP
**Traspasos que continúa:** `traspaso-07-09-autenticacion.md` (Tomás),
`traspaso-04-09-supabase-en-vivo.md` (JP)

---

## 1. Dónde está parado el portal

| Qué | Estado |
|---|---|
| `main` local | `eeea072`, sincronizado con `fork/main` |
| Producción | `portal-de-coordinacion-v2.vercel.app`, con login |
| `0001_esquema.sql` | Aplicado |
| `0002_auth.sql` | Aplicado — 9 cuentas, 9 perfiles, registro público desactivado |
| `0003_rls.sql` | **Escrito, NO aplicado** ← el paso que desbloquea todo |
| Datos en Supabase | 87 proyectos · 130 compromisos · 61 programas · 3 mesas |
| Datos del portal | Siguen en `localStorage`, salvo la pantalla Vigentes |
| `npm run verificar` | Pasaba completa al 07/09 |

El portal tiene **identidad real pero todavía no seguridad de datos**: se sabe
quién carga cada cosa, pero lo que se ve en pantalla vive en el navegador de cada
uno. La seguridad es la de la base, y es `0003_rls.sql`.

## 2. Lo próximo, en orden de lo que más desbloquea

1. **Aplicar `supabase/migrations/0003_rls.sql`.** La condición previa ya se
   cumplió (el login está en producción). El procedimiento paso a paso, con las
   verificaciones de antes y después, está en `traspaso-07-09-autenticacion.md`
   §10. Es lo primero que hay que hacer.
2. **Escritura desde el portal.** Con `0003` aplicado la base ya acepta que un
   `admin` escriba, pero el front sigue guardando en `localStorage`. Es el trabajo
   grande: migrar `repositorio.js` de síncrono a async y revisar sus ~40
   consumidores. Conviene que lo arranquen coordinados, no en paralelo.
3. **Actualizar el `README.md`.** Está desactualizado: dice "sin backend, sin base
   de datos real" y "hoy no hay login ni roles". Las dos cosas dejaron de ser
   ciertas entre el 04/09 y el 07/09.
4. **Implementar los ajustes de Eventos y Mapa pedidos por JP el 08/09.** Quedaron
   especificados con criterios de terminado en [`pendientes-interfaz.md`](pendientes-interfaz.md):
   eventos con varias fechas, ficha desde el calendario, Secretaría General,
   eliminación de porcentajes y baja de eventos; mapa claro, límite del partido,
   encuadre territorial y zoom con la rueda.

## 3. Decisiones pendientes (necesitan que alguien defina, no que alguien programe)

1. **El `tipo_id` de 8 proyectos de Obras** que quedaron con `tipo_id = 'Obra'` y
   `es_obra = false`: Cartelería, Cuadrilla Municipal, Intervenciones Contratadas,
   Obras Particulares, Restauración casona Bosch, OC, Licencias de conducir, Obras
   de mantenimiento. ¿Servicio? ¿Gestión interna? Es una decisión por proyecto.
2. **De qué programa cuelgan los 15 proyectos sin cargar** (`02b` y `02c` en
   `supabase/datos/carga-inicial/`). Los tres de Salud —Presentismo, Turnos
   efectivos, Uso de Agenda— parecen colgar de un programa real, no de "Agenda".
3. **Dónde entran los contenedores sin lugar en el modelo**: `Reportes MI3F`,
   `Agenda Roco`, `Informe de Estadísticas Generales`.
4. **Si el repositorio debería seguir siendo público.** Es un sistema de gestión
   municipal: no hay nada que ganar con que sea abierto, y sí bastante que perder.

## 4. Deudas anotadas, ninguna urgente

1. **124 de los 130 compromisos no tienen fecha límite.** Como la alerta por
   vencimiento se deduce de esa fecha, hoy el motor de alertas no opera sobre el
   95% de los datos. Solo los 6 del PDF de Obras la tienen.
2. **Los 130 compromisos están sin responsable.** El `_db` de origen no lo registra.
3. **`marcarEstrategico()` escribe dos campos que no existen** en el esquema:
   `id_origen_estrategico` y `fecha_marcado_estrategico` (en la base se llama
   `estrategico_marcado_en`). Va a fallar cuando ese módulo se migre.
4. **El front manda `origen_estrategico: 'base'`** y el enum `origen_carga` solo
   acepta `monitoreo` o `seguimiento`. Mismo caso que el anterior.
5. **Un proyecto tiene comillas dobles espurias en el nombre**, arrastradas del CSV:
   `"Plan Estratégico de los Espacios de Primera Infancia (EPIs)"`.
6. **La rama `feat/autenticacion` en GitHub** ya está fusionada en `main`. Se puede
   borrar.
7. **El remoto `origin` (`Sr4312/Coordinacion3F2.0`) quedó abandonado** en el commit
   del 19/08. O se lo actualiza, o se lo saca de la copia local para que nadie
   pushee ahí por reflejo. Ver `CLAUDE.md`.

---

## Plantilla, para la próxima vez

```markdown
**Última actualización:** DD/MM/AAAA · quién
**Traspasos que continúa:** archivo(s)

## 1. Dónde está parado el portal
Tabla de estado verificado — no "debería andar", comprobado.

## 2. Lo próximo, en orden de lo que más desbloquea
Numerado. Cada punto dice qué desbloquea, no solo qué es.

## 3. Decisiones pendientes
Lo que necesita criterio humano, no programación. Con las opciones sobre la mesa.

## 4. Deudas anotadas
Lo encontrado de paso que no se arregló, para no perderlo.
```

Dos reglas que hacen que esto funcione:

- **Estado verificado, no supuesto.** Si decís que una migración está aplicada,
  comprobalo contra la base antes de escribirlo. Media hora de la sesión del 07/09
  se fue en descubrir que tres cosas del traspaso anterior no coincidían con la
  realidad.
- **No dupliques el diff.** Si se entiende leyendo el código, no va acá.
