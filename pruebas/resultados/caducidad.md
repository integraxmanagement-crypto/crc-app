# Prueba de la caducidad de contraseña de administradores (nivel 2, punto 3)

Fecha: 2026-11-05 · Solo datos ficticios en crc-dev. Las fechas viejas se prueban en pruebas/caducidad.sql.

## 1. Interruptor por empresa: solo lo cambia el dueño de la plataforma

- ✅ En crc-dev la empresa D parte con la caducidad APAGADA (es ficticia y la usan las pruebas)
- ✅ ADMIN_C no puede encender la caducidad
- ✅ ADMSEDE_C1 no puede encender la caducidad
- ✅ GESTOR_C1 no puede encender la caducidad
- ✅ USUARIO_C1 no puede encender la caducidad
- ✅ ADMIN_A no puede encender la caducidad
- ✅ Los intentos no cambiaron nada
- ✅ No acepta una empresa que no existe
- ✅ El dueño la enciende para la empresa D
- ✅ Con la caducidad encendida y la clave de hoy, nadie queda vencido
- ✅ Los administradores siguen trabajando con normalidad (ven sus permisos)
- ✅ El dueño la vuelve a apagar
- ✅ Otra empresa no se vio afectada

## 2. Nadie lee ni escribe las tablas directo; el dueño de la plataforma queda fuera

- ✅ Nadie inserta directo en contrasenas_vigencia
- ✅ Ni actualiza ni borra en contrasenas_vigencia
- ✅ Nadie inserta directo en contrasenas_politica
- ✅ Ni actualiza ni borra en contrasenas_politica
- ✅ Un administrador no lee las fechas de cambio de clave de nadie
- ✅ Un administrador no lee el interruptor de las empresas
- ✅ El dueño de la plataforma nunca queda vencido (no es administrador de ninguna empresa)
- ✅ Sin sesión no se ejecuta contrasena_vencida
- ✅ Sin sesión no se ejecuta fijar_caducidad_admin
- ✅ Un usuario y un gestor nunca quedan vencidos

**Resultado: 23 de 23**
