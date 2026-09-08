# Pendientes de interfaz

Pedidos funcionales definidos por el equipo y estado de implementación. El
detalle operativo que queda sigue en `traspaso-actual.md`.

**Última actualización:** 08/09/2026 · JP

---

## Eventos

### 1. Cargar un evento en más de una fecha

- [x] El formulario de alta permite cargar un rango consecutivo con fecha
  **Desde** y **Hasta** —por ejemplo, sábado y domingo— en un único evento.
- [x] Se permite repetir el mismo nombre de evento: el nombre no es una
  clave única y una nueva edición del evento puede hacerse en otra fecha.
- [x] Cada día del rango aparece en el calendario y lleva a la
  información del evento correspondiente.

**Impacto en datos:** `0011_eventos_rango_y_secretaria_general.sql` agrega
`fecha_hasta`. Mientras esa migración no pueda aplicarse, el traductor de
Supabase conserva el dato en una marca interna dentro de `descripcion`; la
interfaz la oculta y la migración la normaliza cuando se ejecute.

### 2. Abrir la información desde el calendario

- [x] Al hacer clic sobre un evento del calendario se abre la ficha con la
  información de **ese evento exacto** en la vista de detalle contigua.
- [x] La selección queda reflejada en la URL para que funcione también al
  recargar o compartir el enlace.

**Implementación:** el calendario navega a
`/eventos?tab=checklist&evento=<id>`, de modo que la URL identifica tanto la
vista como el evento abierto.

### 3. Área organizadora

- [x] Agregar **Secretaría General** a las opciones de “Área organizadora”.

### 4. Quitar el avance porcentual

- [x] Eliminar todas las barras de porcentaje del módulo Eventos: próximos
  eventos, lista, checklist, detalle y formulario.
- [x] Mantener la información concreta de los requerimientos por estado
  —solicitados, confirmados y entregados—, sin presentarla como porcentaje de
  avance del evento.

El avance de la planificación de un evento no se mide con porcentajes.

### 5. Eliminar un evento

- [x] Agregar una acción visible para eliminar el evento desde su ficha.
- [x] Pedir confirmación antes de ejecutar la acción.
- [x] La baja es lógica (`activo = false`), siguiendo el criterio general
  del portal, y el evento no debe seguir apareciendo en calendario, lista ni
  checklist.

---

## Mapa de cortes de calle

### 1. Vista inicial y aspecto del mapa

- [x] Usar por defecto una base clara, con fondo blanco y lectura similar a
  Google Maps.
- [x] Mostrar permanentemente la delimitación del partido de Tres de Febrero.
- [x] Al abrir el módulo, centrar y encuadrar el mapa según esa delimitación, con
  todo el territorio visible y un margen cómodo alrededor.
- [x] Mantener el encuadre territorial cuando todavía no hay cortes visibles; un
  corte seleccionado sí puede acercar la vista a su ubicación.

### 2. Zoom con la rueda

- [x] Habilitar el zoom con la rueda del mouse sobre el mapa.
- [x] Mantenerlo habilitado tanto en la vista general como durante la selección
  de cuadras.

**Implementación:** `MapaLeaflet.jsx` habilita `scrollWheelZoom` y la vista carga
`geonode:limites3f` del Geoportal para dibujar y encuadrar el territorio.
