# Pendientes de interfaz

Pedidos funcionales que ya están definidos por el equipo y quedan listos para
implementar. Este archivo registra el comportamiento esperado; el orden técnico
de implementación sigue en `traspaso-actual.md`.

**Última actualización:** 08/09/2026 · JP

---

## Eventos

### 1. Cargar un evento en más de una fecha

- [ ] El formulario de alta debe permitir seleccionar **una o varias fechas** en
  una misma carga.
- [ ] Debe admitir fechas consecutivas —por ejemplo, sábado y domingo— y fechas
  separadas por semanas o meses.
- [ ] Los datos generales del evento se cargan una sola vez para todas las fechas
  seleccionadas.
- [ ] Se debe permitir repetir el mismo nombre de evento: el nombre no es una
  clave única y una nueva edición del evento puede hacerse en otra fecha.
- [ ] Cada fecha seleccionada debe aparecer en el calendario y llevar a la
  información del evento correspondiente.

**Impacto en datos:** hoy tanto el portal como la tabla `eventos` de Supabase
guardan una sola columna `fecha`. Antes de conectar la escritura real hay que
representar las ocurrencias múltiples sin obligar a duplicar la carga desde la
interfaz.

### 2. Abrir la información desde el calendario

- [ ] Al hacer clic sobre un evento del calendario debe abrirse la ficha con la
  información de **ese evento exacto** en la vista de detalle contigua.
- [ ] La selección debe quedar reflejada en la URL para que funcione también al
  recargar o compartir el enlace.

**Situación actual:** el calendario navega a `/eventos?evento=<id>`, pero esa URL
mantiene la pestaña Calendario y no muestra la ficha. La navegación debe activar
la vista que contiene el detalle o incorporar el detalle al panel del calendario.

### 3. Área organizadora

- [ ] Agregar **Secretaría General** a las opciones de “Área organizadora”.

### 4. Quitar el avance porcentual

- [ ] Eliminar todas las barras de porcentaje del módulo Eventos: próximos
  eventos, lista, checklist, detalle y formulario.
- [ ] Mantener la información concreta de los requerimientos por estado
  —solicitados, confirmados y entregados—, sin presentarla como porcentaje de
  avance del evento.

El avance de la planificación de un evento no se mide con porcentajes.

### 5. Eliminar un evento

- [ ] Agregar una acción visible para eliminar el evento desde su ficha o edición.
- [ ] Pedir confirmación antes de ejecutar la acción.
- [ ] La baja debe ser lógica (`activo = false`), siguiendo el criterio general
  del portal, y el evento no debe seguir apareciendo en calendario, lista ni
  checklist.

---

## Mapa de cortes de calle

### 1. Vista inicial y aspecto del mapa

- [ ] Usar por defecto una base clara, con fondo blanco y lectura similar a
  Google Maps.
- [ ] Mostrar permanentemente la delimitación del partido de Tres de Febrero.
- [ ] Al abrir el módulo, centrar y encuadrar el mapa según esa delimitación, con
  todo el territorio visible y un margen cómodo alrededor.
- [ ] Mantener el encuadre territorial cuando todavía no hay cortes visibles; un
  corte seleccionado sí puede acercar la vista a su ubicación.

### 2. Zoom con la rueda

- [ ] Habilitar el zoom con la rueda del mouse sobre el mapa.
- [ ] Verificarlo tanto en la vista general como durante la selección de cuadras.

**Situación actual:** `MapaLeaflet.jsx` tiene `scrollWheelZoom: false`, por eso la
rueda no funciona. El mapa ya arranca en una coordenada aproximada del partido,
pero todavía no usa su geometría para dibujar el límite y calcular el encuadre.
