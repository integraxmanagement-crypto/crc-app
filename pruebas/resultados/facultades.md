# Pruebas de la etapa 2: usuario gestor, facultades y solicitudes

Fecha: 2026-11-05T15:23:23.776Z · Base: crc-dev · Datos FICTICIOS (empresa D) · **164 de 164 correctas**

## 1. El rol nuevo y sus permisos

- ✅ Existe el rol «usuario_gestor», entre el gestor y el usuario
- ✅ El usuario gestor empieza solo con lo del usuario
- ✅ El gestor suma crear y cesar cuentas y corregir personas…
- ✅ …pero no cambiar contraseñas, ni anular, ni corregir inspecciones, ni reprogramar, ni dar facultades
- ✅ El administrador de sede puede dar facultades y resolver solicitudes
- ✅ Los administradores asignan gestor, usuario gestor y usuario
- ✅ El gestor asigna solo usuario gestor y usuario
- ✅ mis_permisos: el gestor 1 recibe los de su rol
- ✅ mis_permisos: el usuario gestor sin facultades no recibe permisos de inspecciones

## 2. Usuario gestor: sin facultades no ve nada; con cada una, solo lo suyo

- ✅ Sin facultades no ve inspecciones, salvo las que ella firmó
- ✅ Sin facultades no ve planes de acción de otros
- ✅ El administrador de la sede 1 marca «ver inspecciones» a su usuario gestor
- ✅ El usuario gestor de la sede 1 ve solo las inspecciones de su sede
- ✅ …y no ve nada de la sede 2
- ✅ El usuario gestor de la sede 2 (sin marcas) sigue sin ver nada
- ✅ mis_permisos refleja la facultad marcada
- ✅ El administrador quita la facultad
- ✅ Sin la facultad no registra inspecciones
- ✅ Con «registrar inspecciones» registra en su sede
- ✅ …pero no en la sede 2
- ✅ Sin la facultad no ve planes de acción de su sede
- ✅ Con «gestionar planes de acción» ve los de la sede 2 y solo esos
- ✅ …y los gestiona
- ✅ El usuario gestor de la sede 1 no gestiona el de la sede 2
- ✅ Se crea un programa de la sede 1 para la prueba
- ✅ Sin «ver programa anual» no ve programas
- ✅ Con «ver programa anual» ve los de su sede y no los de la sede 2
- ✅ Ver el programa no deja editarlo
- ✅ Sin «ver nombres» no recibe la lista del personal
- ✅ Con «ver nombres» recibe solo al personal de su sede

## 3. Quién puede marcar facultades, y cuáles

- ✅ Una facultad que no está en la lista no se marca (crear cuentas)
- ✅ Tampoco aprobar el programa
- ✅ Tampoco editar formatos
- ✅ A un usuario común no se le marcan facultades
- ✅ A un administrador no se le marcan facultades
- ✅ Al gestor no se le marcan las del usuario gestor
- ✅ Al usuario gestor no se le marcan las del gestor (anular inspecciones)
- ✅ El administrador de la sede 1 no marca a la cuenta de la sede 2
- ✅ Un gestor no marca facultades
- ✅ Un usuario gestor no se marca facultades a sí mismo
- ✅ Un usuario no marca facultades
- ✅ Otra empresa no marca facultades en la empresa D
- ✅ El administrador general marca a cuentas de cualquier sede
- ✅ Marcar dos veces la misma facultad no duplica
- ✅ Cada cambio queda en el historial, con quién lo hizo
- ✅ Al pasar a la cuenta a «usuario», sus facultades se borran solas

## 4. El gestor solicita anular una inspección; el administrador decide

- ✅ El gestor sin marca no anula directo
- ✅ No se solicita sobre una inspección de otra sede
- ✅ Un usuario gestor no solicita cambios (es del gestor)
- ✅ Un usuario no solicita cambios
- ✅ Sin motivo no se solicita
- ✅ Un tipo inventado no se solicita
- ✅ El gestor de la sede 1 solicita anular la inspección de su sede
- ✅ Queda «pendiente» y la inspección sigue cerrada
- ✅ La ve quien la pidió
- ✅ La ve el administrador de la sede 1
- ✅ La ve el administrador general
- ✅ No la ve el administrador de la sede 2
- ✅ No la ve otro gestor de la empresa
- ✅ No la ve un usuario
- ✅ No la ve otra empresa
- ✅ El gestor no resuelve su propia solicitud
- ✅ El administrador de la sede 2 no resuelve la de la sede 1
- ✅ Al denegar hay que escribir el comentario
- ✅ El administrador de la sede 1 deniega
- ✅ Queda «denegada», con quién y el comentario
- ✅ La inspección sigue cerrada: todo quedó como estaba
- ✅ No se resuelve dos veces
- ✅ El gestor ve la respuesta, todavía sin leer
- ✅ Al abrirla queda como vista
- ✅ El administrador general aprueba
- ✅ La inspección queda anulada, con el motivo del gestor y como hecho del administrador que aprobó
- ✅ La solicitud queda «aprobada»

## 5. El gestor solicita corregir una inspección

- ✅ El gestor sin marca no corrige directo
- ✅ El gestor solicita la corrección
- ✅ Sin las respuestas nuevas no se solicita
- ✅ No se aprueba una corrección que todavía no se aplicó
- ✅ El administrador de otra sede no aprueba la corrección
- ✅ …ni aplica la corrección en una sede que no es la suya
- ✅ El administrador de la sede 1 aplica la corrección pedida (valida el servidor)
- ✅ Después aprueba la solicitud
- ✅ La inspección queda corregida (edición +1) con las respuestas pedidas
- ✅ El historial dice que la corrigió el administrador que aprobó, con el motivo del gestor
- ✅ La corrección aplicada por un administrador no se comunica como si fuera del gestor
- ✅ El administrador deniega la corrección
- ✅ Denegar no cambia la inspección
- ✅ Una corrección ya resuelta no se aprueba otra vez
- ✅ La aprobación solo vale con la corrección de esa edición de la inspección

## 6. El gestor solicita cambiar el programa anual aprobado

- ✅ En borrador el gestor edita la estructura directo (todavía no rige nada)
- ✅ El administrador programa una semana (las semanas las programa solo él)
- ✅ El administrador de la sede 1 aprueba el programa
- ✅ Aprobado, el gestor sin marca no cambia el programa directo
- ✅ Una operación fuera de la lista no se solicita
- ✅ Un programa de la sede 2 no se solicita
- ✅ El gestor solicita programar la semana 6
- ✅ Mientras está pendiente no cambia nada
- ✅ El administrador aprueba y la semana queda programada
- ✅ El historial del programa dice quién aprobó y el motivo del gestor
- ✅ El administrador deniega: el programa queda igual
- ✅ También se puede pedir dar de baja una actividad

## 7. Gestor con la marca «sin aprobación»: lo hace directo y el administrador recibe la comunicación

- ✅ El administrador de la sede 1 marca «anular inspecciones» al gestor 1
- ✅ mis_permisos del gestor lo incluye
- ✅ Con la marca, el gestor anula directo
- ✅ El administrador de la sede recibe la comunicación
- ✅ El administrador general también
- ✅ El administrador de la otra sede no
- ✅ Una comunicación no se «resuelve» (no hay nada que aprobar)
- ✅ El administrador la marca como vista
- ✅ El gestor sin esa marca para corregir sigue necesitando aprobación
- ✅ Con la marca, igual no corrige inspecciones de otra sede
- ✅ Con la marca, el gestor corrige directo en su sede
- ✅ …y el administrador recibe la comunicación de la corrección
- ✅ Con la marca, el gestor cambia el programa aprobado directo
- ✅ …y el administrador recibe la comunicación del cambio del programa
- ✅ …pero no en el programa de la sede 2
- ✅ Al quitar las marcas vuelve a necesitar aprobación
- ✅ A un gestor no se le marca «registrar inspecciones» (ya lo tiene) ni nada fuera de las tres
- ✅ Un gestor no puede marcarse las tres a sí mismo

## 8. El gestor maneja el personal de su sede, con límites

- ✅ Se reutiliza la cuenta fija de usuario: el gestor de su sede la reactiva
- ✅ Se reutiliza la cuenta fija de usuario gestor: el gestor de su sede la reactiva
- ✅ No crea un gestor
- ✅ No crea un administrador de sede
- ✅ No crea un administrador general
- ✅ No crea cuentas en la sede 1
- ✅ Un usuario gestor no crea cuentas
- ✅ Un usuario no crea cuentas
- ✅ El gestor ve las cuentas de su sede
- ✅ El gestor cesa a un usuario de su sede
- ✅ …y lo reactiva
- ✅ El gestor no da contraseñas nuevas
- ✅ Las cuentas de personal no se acumulan: tras las pruebas negativas la empresa D no ganó vínculos
- ✅ No cesa a otro gestor
- ✅ No cesa a un administrador
- ✅ No cesa a una cuenta de la sede 1
- ✅ No cambia el rol de un usuario gestor a gestor

## 9. Nadie escribe directo; otras empresas no ven nada; anon no ejecuta

- ✅ Nadie escribe directo en facultades_persona (ni el administrador general)
- ✅ Otra empresa no ve nada de facultades_persona
- ✅ Nadie escribe directo en facultades_historial (ni el administrador general)
- ✅ Otra empresa no ve nada de facultades_historial
- ✅ Nadie escribe directo en solicitudes_cambio (ni el administrador general)
- ✅ Otra empresa no ve nada de solicitudes_cambio
- ✅ Sin sesión no se ejecuta mis_permisos
- ✅ Sin sesión no se ejecuta dar_facultad
- ✅ Sin sesión no se ejecuta quitar_facultad
- ✅ Sin sesión no se ejecuta solicitar_cambio
- ✅ Sin sesión no se ejecuta resolver_solicitud
- ✅ Sin sesión no se ejecuta marcar_solicitud_vista
- ✅ El dueño de la plataforma ve las solicitudes de la empresa D

## 10. Limpieza: la prueba borra lo que ella misma creó en la empresa D (nada de antes, nada de otras empresas)

- ✅ La prueba dejó solicitudes e historial nuevos (hay algo que limpiar)
- ✅ ADMIN_C no puede ejecutar la limpieza (solo el dueño de la plataforma)
- ✅ ADMSEDE_C1 no puede ejecutar la limpieza (solo el dueño de la plataforma)
- ✅ GESTOR_C1 no puede ejecutar la limpieza (solo el dueño de la plataforma)
- ✅ USUGES_C1 no puede ejecutar la limpieza (solo el dueño de la plataforma)
- ✅ USUARIO_C1 no puede ejecutar la limpieza (solo el dueño de la plataforma)
- ✅ ADMIN_A no puede ejecutar la limpieza (solo el dueño de la plataforma)
- ✅ No acepta una fecha de inicio vieja (no borra de más)
- ✅ No limpia la empresa de la demo
- ✅ No limpia otra empresa de prueba ni una que no existe
- ✅ El dueño ejecuta la limpieza de la empresa D
- ✅ Ya no quedan solicitudes ni historial de esta corrida
- ✅ Lo de antes de la prueba sigue intacto (solo se fue lo nuevo)
- ✅ Las demás empresas (la demo, A, B) no perdieron nada
- ✅ No quedan facultades marcadas por la prueba
- ✅ Las cuentas de prueba siguen ahí
