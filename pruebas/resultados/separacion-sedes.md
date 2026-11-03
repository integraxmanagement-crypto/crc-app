# Separación entre sedes de una misma empresa (etapa 1 del punto 2)

Fecha: 2026-11-03 · empresa D ficticia (RUC 20000000052).

## 1. Activos y ubicaciones: cada sede ve y toca solo lo suyo

- ✅ Admin de la sede 1 crea una ubicación en la sede 1
- ✅ Gestor de la sede 2 crea una ubicación en la sede 2
- ✅ Admin de la sede 1 NO crea una ubicación en la sede 2 — No autorizado
- ✅ Gestor de la sede 2 NO crea una ubicación en la sede 1 — No autorizado
- ✅ Admin de la sede 1 da de alta un activo en la sede 1
- ✅ Gestor de la sede 2 da de alta un activo en la sede 2
- ✅ Admin de la sede 1 NO da de alta un activo en la sede 2 — No autorizado
- ✅ Admin de la sede 1 NO edita un activo de la sede 2 — No autorizado
- ✅ Admin de la sede 1 NO pasa su activo a la sede 2 — No autorizado
- ✅ Admin de la sede 1 NO da de baja un activo de la sede 2 — No autorizado
- ✅ ADMSEDE_C1: de los activos ve solo los de sus sedes — 30 activo(s)
- ✅ ADMSEDE_C1: de las ubicaciones ve solo las de sus sedes — 19 ubicación(es)
- ✅ USUARIO_C1: de los activos ve solo los de sus sedes — 30 activo(s)
- ✅ USUARIO_C1: de las ubicaciones ve solo las de sus sedes — 19 ubicación(es)
- ✅ GESTOR_C2: de los activos ve solo los de sus sedes — 24 activo(s)
- ✅ GESTOR_C2: de las ubicaciones ve solo las de sus sedes — 18 ubicación(es)
- ✅ GESTOR_C12: de los activos ve solo los de sus sedes — 54 activo(s)
- ✅ GESTOR_C12: de las ubicaciones ve solo las de sus sedes — 37 ubicación(es)
- ✅ ADMIN_C: de los activos ve solo los de sus sedes — 54 activo(s)
- ✅ ADMIN_C: de las ubicaciones ve solo las de sus sedes — 37 ubicación(es)

## 2. Inspecciones, planes de acción, fotos y firmas

- ✅ Gestor de la sede 2 registra una inspección de la sede 2 (con un plan de acción) — 200 
- ✅ Admin de la sede 1 registra una inspección de la sede 1 — 200 
- ✅ Admin de la sede 1 NO registra una inspección de la sede 2 — 403 Ya no tienes acceso a esa sede: la inspección no se puede recibir
- ✅ Gestor de la sede 2 NO registra una inspección de la sede 1 — 403 Ya no tienes acceso a esa sede: la inspección no se puede recibir
- ✅ Gestor con las dos sedes registra en la sede 2 — 200 
- ✅ Cada inspección quedó en la sede correcta
- ✅ Ninguna inspección rechazada quedó guardada
- ✅ ADMSEDE_C1: de las inspecciones ve solo las de sus sedes — 52
- ✅ USUARIO_C1: solo ve las inspecciones que firma — 88
- ✅ GESTOR_C2: de las inspecciones ve solo las de sus sedes — 36
- ✅ GESTOR_C12: de las inspecciones ve solo las de sus sedes — 88
- ✅ ADMIN_C: de las inspecciones ve solo las de sus sedes — 88
- ✅ Admin de la sede 1 NO anula una inspección de la sede 2 — Ya no tienes acceso a esa sede: la inspección no se puede recibir
- ✅ El plan de acción nació con la sede de la inspección (sede 2)
- ✅ Admin de la sede 1 NO ve los planes de acción de la sede 2
- ✅ Gestor de la sede 2 sí ve los de su sede
- ✅ Admin de la sede 2 sí los ve
- ✅ Admin de la sede 1 NO gestiona un plan de acción de la sede 2 — No autorizado
- ✅ Admin de la sede 1 NO cierra un plan de acción de la sede 2 — No autorizado
- ✅ Admin de la sede 2 sí gestiona el plan de acción de su sede
- ✅ El responsable (gestor de la sede 2) sí lo pone en proceso
- ✅ Admin de la sede 1 NO abre la foto de una inspección de la sede 2
- ✅ Usuario de la sede 1 sin firmar NO abre la foto de la sede 2… salvo que sea firmante: sí es firmante (custodia) y la abre
- ✅ Gestor de la sede 2 abre la foto de su sede
- ✅ Admin de la sede 2 abre la foto de su sede
- ✅ Admin general abre la foto de cualquier sede
- ✅ Gestor con las dos sedes abre la foto de la sede 2
- ✅ Admin de la sede 1 SÍ abre la foto de su propia sede
- ✅ Gestor de la sede 2 NO abre la foto de la sede 1
- ✅ Admin de la sede 1 NO ve en la lista las fotos de la sede 2
- ✅ Admin de la sede 1 NO ve las firmas de la sede 2
- ✅ Admin de la sede 1 NO sube la foto de cierre de un plan de acción de la sede 2
- ✅ Admin de la sede 2 sí corrige la inspección de su sede — 200 
- ✅ Admin de la sede 1 NO corrige una inspección de la sede 2 — 403 Ya no tienes acceso a esa sede: la inspección no se puede recibir

## 3. Funciones de lectura del servidor que se saltan las reglas de las tablas

- ✅ avance_periodo: admin de la sede 1 NO pide la sede 2 — No autorizado
- ✅ avance_periodo: admin de la sede 1 sí pide su sede
- ✅ avance_periodo: el admin general pide cualquier sede
- ✅ personas_de_mi_empresa: admin de la sede 1 no recibe al gestor de la sede 2
- ✅ personas_de_mi_empresa: el admin general recibe a todos
- ✅ passt_responsables: admin de la sede 1 no ve al gestor de la sede 2 y sí al gestor de las dos sedes
- ✅ passt_trabajadores: la sede 1 cuenta menos personas que la empresa entera — sede 1: 39; empresa: 43
- ✅ numero_trabajadores: igual que passt_trabajadores para el admin de la sede 1 — 39
- ✅ uso_almacenamiento: la sede 1 usa menos que la empresa entera — sede 1: 7280; empresa: 12320
- ✅ uso_almacenamiento: nadie lo pide para otra empresa

## 4. Programa anual de SST: general, de sede y aprobación

- ✅ Admin de la sede 1 crea el programa de la sede 1
- ✅ Admin de la sede 1 NO crea el programa de la sede 2 — No autorizado
- ✅ Admin de la sede 1 NO crea un programa general (para todas las sedes) — No autorizado
- ✅ Un gestor NO crea un programa general — No autorizado
- ✅ El admin general crea el programa general
- ✅ Gestor de la sede 2 crea el programa de su sede
- ✅ Gestor de la sede 2 edita el programa de su sede
- ✅ Gestor de la sede 2 NO edita el programa de la sede 1
- ✅ Admin de la sede 1 NO edita el programa de la sede 2
- ✅ Gestor con dos sedes NO edita el programa general
- ✅ Admin de la sede 1 NO edita el programa general
- ✅ El admin general sí edita el programa general
- ✅ Gestor con dos sedes edita el programa de la sede 1
- ✅ Admin de la sede 1 NO sube un PDF a una actividad del programa de la sede 2
- ✅ Admin de la sede 2 sí sube el PDF de su programa
- ✅ El responsable de la sede 2 sube el PDF de su actividad
- ✅ Admin de la sede 1 NO marca la actividad de la sede 2
- ✅ El responsable marca su actividad con el PDF
- ✅ Admin de la sede 2 abre el PDF
- ✅ Admin general abre el PDF
- ✅ Admin de la sede 1 NO abre el PDF de la sede 2
- ✅ Gestor de la sede 1 y 2 sí lo abre (tiene las dos sedes)
- ✅ Admin de la sede 1 ve su programa y el general, y NO el de la sede 2
- ✅ Gestor de la sede 2 ve el suyo y el general, y NO el de la sede 1
- ✅ El admin general ve los tres
- ✅ Admin de la sede 1 NO ve las actividades del programa de la sede 2
- ✅ Admin de la sede 1 NO aprueba el programa general
- ✅ Admin de la sede 1 NO aprueba el programa de la sede 2
- ✅ Gestor de la sede 2 NO aprueba (ni el suyo)
- ✅ Admin de la sede 1 sí está autorizado a aprobar el programa de su sede — Programa al menos una semana de una actividad antes de aprobar
- ✅ El admin general sí está autorizado a aprobar el programa general — Programa al menos una semana de una actividad antes de aprobar
- ✅ passt_ejecucion: admin de la sede 1 NO lo pide del programa de la sede 2 — No autorizado
- ✅ passt_hallazgos: admin de la sede 1 NO lo pide del programa de la sede 2 — No autorizado
- ✅ passt_ejecucion: del programa general responde sin error, solo con filas de sus sedes
- ✅ passt_ejecucion: sí responde del programa de su sede

## 5. Cuentas, sedes de cada cuenta y el límite del administrador de sede

- ✅ Admin de la sede 1 NO crea un administrador general — 403
- ✅ Admin de la sede 1 NO crea un administrador de sede — 403
- ✅ El admin general NO crea administradores (solo el dueño) — 403
- ✅ Admin de la sede 1 NO crea un gestor para la sede 2 — 403
- ✅ Admin de la sede 1 NO crea un usuario con la sede 1 y la 2 — 403
- ✅ Admin de la sede 1 sí crea un gestor para su sede — 200 
- ✅ Una cuenta nueva no puede quedar sin sedes: el admin general debe elegirlas (empresa con dos sedes) — 400 Elige las sedes de la cuenta
- ✅ El admin de una sola sede crea un usuario sin elegir sede: recibe la suya — 200 
- ✅ Una sede que no es de la empresa se rechaza — 400
- ✅ El gestor nuevo quedó solo con la sede 1
- ✅ El usuario nuevo quedó con la sede del administrador (sede 1)
- ✅ El gestor de dos sedes tiene las dos sedes
- ✅ Admin de la sede 1 ve su cuenta, al usuario de la sede 1 y al gestor de las dos sedes
- ✅ Admin de la sede 1 NO ve al gestor de la sede 2 ni al admin de la sede 2
- ✅ Admin de la sede 1 NO ve al administrador general
- ✅ Admin de la sede 1 NO ve las fichas de personas de la sede 2 ni del admin general
- ✅ El admin general ve todas las cuentas de la empresa
- ✅ Admin de la sede 1 ve las sedes de las cuentas que ve, no las de otras
- ✅ Un usuario solo ve las sedes de su propia cuenta
- ✅ Admin de la sede 1 NO cesa al gestor de la sede 2
- ✅ Admin de la sede 1 NO cesa al admin general
- ✅ Admin de la sede 1 NO cesa al admin de la sede 2
- ✅ El admin general NO cesa a un administrador de sede (solo el dueño)
- ✅ Admin de la sede 1 NO se cesa a sí mismo
- ✅ Admin de la sede 1 NO corrige al gestor de la sede 2
- ✅ Admin de la sede 1 NO se da el rol de administrador general
- ✅ Admin de la sede 1 NO sube de rol a su usuario a administrador
- ✅ Admin de la sede 1 sí corrige a su usuario (nombre)
- ✅ Admin de la sede 1 NO da contraseña al gestor de la sede 2
- ✅ Admin de la sede 1 NO da contraseña al admin general
- ✅ Admin de la sede 1 NO da contraseña a su propia cuenta por esta vía
- ✅ Admin de la sede 1 NO se agrega la sede 2
- ✅ Admin de la sede 1 NO agrega la sede 2 a su usuario
- ✅ Admin de la sede 1 NO toca las sedes del gestor de la sede 2
- ✅ Admin de la sede 1 NO cambia las sedes de un administrador
- ✅ Una cuenta no puede quedar sin sedes (ni el admin general la deja vacía) — La cuenta debe tener al menos una sede
- ✅ Admin de la sede 1 quita SU sede a un gestor de dos sedes: queda con la sede 2
- ✅ …y no puede dejarlo sin sedes
- ✅ El admin general restablece las dos sedes del gestor
- ✅ El dueño sí puede fijar las sedes de un administrador de sede
- ✅ El admin general NO cambia las sedes de un administrador de sede (solo el dueño)
- ✅ Admin de la sede 1 NO se agrega permisos al rol (no hay escritura en roles_permisos)
- ✅ Admin de la sede 1 NO se agrega una sede escribiendo la tabla
- ✅ Admin de la sede 1 NO cambia su rol escribiendo la tabla
- ✅ El rol admin_sede no tiene permisos de toda la empresa
- ✅ Los roles asignables: el admin de sede solo asigna gestor, usuario gestor y usuario; nadie asigna administradores

## 6. Quitar una sede con inspecciones guardadas sin señal: el servidor las rechaza y quedan en el equipo

- ✅ El admin general le quita la sede 2 al gestor
- ✅ Al llegar el envío pendiente de la sede 2, el servidor lo rechaza (403) con un mensaje claro — 403 Ya no tienes acceso a esa sede: la inspección no se puede recibir
- ✅ …y no se grabó nada
- ✅ Lo de la sede 1 sigue entrando — 200 
- ✅ Ya no ve activos de la sede 2
- ✅ Se le devuelve la sede 2 (para repetir la prueba)

## 7. El administrador general y el dueño ven todo

- ✅ ADMIN_C: ve los activos de las dos sedes
- ✅ ADMIN_C: ve las inspecciones de las dos sedes
- ✅ DUENO: ve los activos de las dos sedes
- ✅ DUENO: ve las inspecciones de las dos sedes

## 8. Una persona de la empresa A o B no ve nada de la empresa D (y al revés)

- ✅ ADMIN_A: 0 filas de activos de la empresa D
- ✅ ADMIN_A: 0 filas de ubicaciones de la empresa D
- ✅ ADMIN_A: 0 filas de inspecciones de la empresa D
- ✅ ADMIN_A: 0 filas de hallazgos de la empresa D
- ✅ ADMIN_A: 0 filas de passt_programas de la empresa D
- ✅ ADMIN_A: 0 filas de vinculos de la empresa D
- ✅ ADMIN_A: 0 filas de vinculos_sedes de la empresa D
- ✅ ADMIN_B: 0 filas de activos de la empresa D
- ✅ ADMIN_B: 0 filas de ubicaciones de la empresa D
- ✅ ADMIN_B: 0 filas de inspecciones de la empresa D
- ✅ ADMIN_B: 0 filas de hallazgos de la empresa D
- ✅ ADMIN_B: 0 filas de passt_programas de la empresa D
- ✅ ADMIN_B: 0 filas de vinculos de la empresa D
- ✅ ADMIN_B: 0 filas de vinculos_sedes de la empresa D
- ✅ Admin general de C: 0 activos de otras empresas

## 9. Permisos de las tablas: nadie escribe directo

- ✅ Se encontraron las tablas de public en las migraciones — 44 tablas
- ✅ Ninguna tabla de public deja escribir directo a anon ni a authenticated

**172 de 172 pruebas pasaron.**
