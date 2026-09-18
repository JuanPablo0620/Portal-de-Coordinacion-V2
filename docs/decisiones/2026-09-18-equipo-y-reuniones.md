# Responsabilidad individual y reuniones del equipo

## Reglas acordadas

1. Un compromiso tiene un responsable actual de Coordinación identificado por
   su cuenta. Derivarlo transfiere la responsabilidad de impulsarlo y actualizarlo.
   No modifica el área, el estado, la fecha límite ni las novedades anteriores.
2. No se agrega un historial de derivaciones ni se pide motivo. La auditoría
   general preexistente de la base no se desactiva.
3. Tener cuenta y participar de una reunión no implica recibir compromisos.
   El padrón se configura en la base mediante `recibe_compromisos`; las
   identidades reales no se incluyen en el repositorio público.
4. Mi seguimiento une los compromisos asignados a la cuenta y los de las áreas
   seleccionadas, sin duplicados. La asignación personal funciona sin áreas elegidas.
5. Secretaría usa un temario seleccionado y ordenado por su organizador. Admite
   compromisos existentes y temas libres. `organiza_secretaria` identifica la
   cuenta que prepara ese temario; ser administrador no basta para modificarlo.
6. Dirección revisa todos los compromisos activos, incluidos cumplidos y sin
   asignar. Revisado es una marca del encuentro, independiente del estado del compromiso.
7. El origen de un compromiso se conserva aunque se trate en varias reuniones.
   Los nuevos acuerdos se pueden crear y asignar después de la reunión, por
   cada integrante habilitado, sin un encargado único de transcripción.
8. Cerrar el temario conserva su lista de temas. Los compromisos permanecen vivos:
   el historial del encuentro no pretende congelar sus estados o responsables.

## Datos y autorización

Migración nueva `0037_equipo_y_reuniones.sql`, posterior a `0036`. Agrega
capacidades en perfiles, `compromisos.id_responsable`, origen de reunión de
equipo, y las tablas `reuniones_equipo` / `temas_reunion_equipo`.

No cambia los permisos generales existentes. Una cuenta de lectura puede
actualizar o derivar un compromiso propio; una vez transferido, pierde ese
permiso individual. El servidor valida que el destinatario esté activo y
habilitado. El equipo conserva las reglas previas para crear compromisos.

Los históricos sin responsable se conservan. Una vez habilitado al menos un
responsable, los nuevos compromisos requieren asignación. Antes de activar el
circuito, configurar el padrón acordado y distribuir el histórico; no inferir
responsabilidad individual a partir del área.

## Validación y activación

1. `npm.cmd test`: 408 pruebas aprobadas el 18/09/2026.
2. `npm.cmd run build`: compiló una versión intermedia. Repetir sobre la versión
   final junto con `npm.cmd run verificar` antes de publicar.
3. `node scripts/verificar-equipo-sql.mjs`: aprobado contra PostgreSQL temporal
   en memoria, con contratos mínimos de las tablas previas, identidades ficticias
   y las políticas relevantes. Comprueba reejecución, destinatarios, permisos
   individuales, agenda de Secretaría, acuerdos y cierre de Dirección. No
   sustituye una prueba sobre una copia completa del esquema de Supabase.
   Dependencia opcional fuera del proyecto:
   `npm.cmd install --prefix ../.tmp/portal-sql --no-audit --no-fund @electric-sql/pglite`.
4. `node scripts/verificar-equipo.mjs`: prueba interactiva preparada, **pendiente
   de ejecución**. Reemplaza sesión y cliente Supabase por dobles ficticios y
   usa el repositorio real en modo local. No utiliza datos de producción.
5. Aplicar primero las migraciones pendientes en un entorno de prueba, habilitar
   las cuentas acordadas desde Configuración → Equipo y verificar con dos sesiones.
6. Revisar Secretaría, Dirección y Mi seguimiento en escritorio y móvil. Recién
   después aplicar la migración y publicar el frontend en el portal en uso.

La prueba interactiva fue bloqueada por revisión automática debido al límite de
uso del servicio. La migración no se aplicó en producción y no se desplegó el frontend.

## Hallazgos durante la integración

- Se corrigió el uso de `vencido` en Mi seguimiento: el selector devuelve
  `alerta`. La fecha y el cálculo siguen en la capa de datos.
- La sincronización vieja por nombre podía borrar las áreas de una cuenta
  remota. Ahora sólo migra preferencias antiguas sin `perfil_id`.
- Una actualización sin `estado` podía borrar el estado anterior en la base
  local. Se corrigió y se agregó una prueba de regresión.
- El alta estratégica ya utilizaba `origen_tipo = estrategico`, pero el
  adaptador remoto no acepta ese origen. Es un problema previo que requiere
  resolver el contrato de ese circuito antes de habilitar altas estratégicas.
