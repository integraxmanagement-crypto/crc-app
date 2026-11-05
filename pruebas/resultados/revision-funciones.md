# Resultado: arreglos de la revisión de funciones del servidor

Fecha: 2026-11-05 15:40 UTC · 25 de 25 pasaron · con --restablecer.

- ✅ Con la dirección inventada bloqueada (30 fallos, ver ip-ingreso.sql) el intento NO sale bloqueado: se usa la dirección real (HTTP 400)
- ✅ El intento quedó anotado una vez, como fallo
- ✅ La dirección anotada NO es la inventada
- ✅ Hay un formato publicado y una inspección de la empresa A para probar
- ✅ Formato de otra empresa: «El formato no existe» (422) (HTTP 422)
- ✅ La respuesta es idéntica a la de un formato que no existe (sin textos del formato)
- ✅ La respuesta no trae lista de puntos faltantes
- ✅ Corregir una inspección de otra empresa: «No autorizado» (403) (HTTP 403)
- ✅ Igual que corregir una inspección que no existe (sin textos)
- ✅ Con un formato de su propia empresa la función sí lo lee (responde con el problema de la firma) (Hay un firmante para una firma que el formato no tiene.)
- ✅ Administrador de la sede 1 + documento de un gestor de la sede 2: fila en error (error)
- ✅ El motivo es «ya existe en otra sede»
- ✅ La respuesta no trae el nombre actual ni el identificador de la persona
- ✅ Con alguien de SU sede la vista previa sigue igual (reconoce a la persona y muestra qué cambiaría) (actualizar)
- ✅ El administrador general sí ve a la persona de la sede 2 (ve toda la empresa) (actualizar)
- ✅ Un gestor no puede restablecer en bloque (403) (HTTP 403)
- ✅ Un usuario gestor no puede restablecer en bloque (403) (HTTP 403)
- ✅ Un administrador de sede no puede restablecer en otra empresa (403) (HTTP 403)
- ✅ Un administrador general no puede restablecer en otra empresa (403) (HTTP 403)
- ✅ Administrador de la sede 2: los usuarios de la sede 1 no se tocan (0 resultados) (HTTP 200, 0 resultados)
- ✅ Administrador de sede: a los administradores no los toca (0 resultados) (HTTP 200, 0 resultados)
- ✅ El rescate sigue exigiendo la clave secreta: con otra cosa, 401 y nada cambia (HTTP 401)
- ✅ Administrador de la sede 2 restablece en bloque a los usuarios gestores: solo el de su sede (USUGES_C2) (1 resultado(s))
- ✅ No toca al usuario gestor de la sede 1 (USUGES_C1)
- ✅ USUGES_C2 quedó con una contraseña nueva guardada en el archivo local (no se imprime) (HTTP 200)
