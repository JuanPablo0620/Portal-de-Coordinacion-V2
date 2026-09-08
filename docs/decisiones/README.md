# Decisiones

Una decisión por archivo, con fecha en el nombre: `AAAA-MM-DD-tema.md`.

## Qué va acá

Lo que no queremos volver a discutir dentro de tres meses: por qué se eligió
Supabase, por qué el login falla cerrado, por qué los estratégicos son un campo y
no una tabla. Si alguien va a proponer lo contrario, que sea con evidencia nueva y
no porque no sabía que ya se había decidido.

## Qué no va acá

- **El estado del trabajo en curso** → `docs/traspaso-actual.md`.
- **Cómo funciona el sistema** → `README.md` y `docs/der-esquema-datos.md`.
- **Qué cambió en cada versión** → `docs/registro-de-cambios.md`.

## Forma

No hay plantilla rígida. Los archivos existentes muestran el patrón: contexto
breve, la decisión en una línea, y después **por qué esa y no la alternativa**.
Esa última parte es la que hace que el documento sirva — una decisión sin su
razonamiento no se puede revisar, solo obedecer o ignorar.

Cuando una decisión queda superada por otra posterior, no se borra: se anota
arriba qué la reemplazó. El registro de por qué las cosas fueron cambiando vale
tanto como el estado final.
