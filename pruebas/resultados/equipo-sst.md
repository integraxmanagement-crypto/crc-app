# Prueba del equipo de SST y las etiquetas (etapa 4)

Fecha: 2026-11-04 · Solo datos ficticios en crc-dev.

## 1. El gestor escribe su propio WhatsApp (opcional); nadie más lo escribe

- ✅ El gestor guarda su número (con espacios)
- ✅ Queda guardado limpio y con el código del país (+51900000101)
- ✅ Rechaza un número inválido («abc»)
- ✅ Rechaza un número inválido («123»)
- ✅ Rechaza un número inválido («99999999999999999999»)
- ✅ Rechaza un número inválido («+51 9000;DROP»)
- ✅ Los intentos inválidos no cambiaron el número
- ✅ Puede cambiarlo
- ✅ Y el cambio se ve
- ✅ USUARIO_C1 (no es gestor) no puede guardar un WhatsApp
- ✅ USUGES_C1 (no es gestor) no puede guardar un WhatsApp
- ✅ ADMSEDE_C1 (no es gestor) no puede guardar un WhatsApp
- ✅ ADMIN_C (no es gestor) no puede guardar un WhatsApp
- ✅ Nadie escribe directo en la tabla (ni el gestor)
- ✅ Tampoco actualiza directo
- ✅ El gestor, en la tabla, ve solo su propio contacto
- ✅ Un usuario no lee la tabla (solo ve el equipo por la pantalla)
- ✅ (sesión del dueño válida para el resto)
- ✅ Otro gestor guarda el suyo sin pisar el de GESTOR_C1
- ✅ El número de GESTOR_C1 sigue igual

## 2. «Conoce al equipo de SST»: cada persona ve a los gestores de SU sede

- ✅ El usuario de la sede 1 puede consultar el equipo
- ✅ Ve a los gestores de su sede (el de la sede 1 y el de las dos sedes)
- ✅ No ve al gestor de la otra sede
- ✅ No ve usuarios gestores ni usuarios (solo gestores)
- ✅ Cada fila trae nombre, puesto y WhatsApp
- ✅ Quien no puso número aparece sin número
- ✅ La fila trae las sedes donde atiende
- ✅ No se filtra ningún dato interno (documento, correo)
- ✅ El usuario gestor de la sede 2 ve al gestor de la sede 2 y al de las dos, no al de la sede 1
- ✅ El administrador general ve a los gestores de las dos sedes
- ✅ El administrador de la sede 2 ve a los gestores de su sede, no al de la sede 1
- ✅ Un gestor se ve a sí mismo en el equipo de su sede
- ✅ Una empresa distinta no ve a ningún gestor de la empresa D
- ✅ El dueño (sin empresa propia) no recibe error
- ✅ (los tres gestores de la prueba siguen activos)

## 3. Roles adicionales: son etiquetas, no dan permisos

- ✅ El gestor marca «brigadista» a un usuario de su sede
- ✅ Marcarla otra vez no falla ni duplica
- ✅ Puede marcar «miembro del comité»
- ✅ Puede marcar «monitor de seguridad»
- ✅ «Otro» exige escribir cuál
- ✅ «Otro» con su detalle se guarda
- ✅ Una etiqueta que no existe se rechaza
- ✅ Quedan 4 etiquetas (sin duplicados)
- ✅ Las etiquetas no cambian los permisos de la cuenta
- ✅ El usuario ve sus propias etiquetas
- ✅ Otro usuario de la sede no ve las etiquetas ajenas
- ✅ El gestor de la sede 1 NO marca a alguien de la sede 2
- ✅ Nadie se marca a sí mismo
- ✅ Un usuario no puede marcar etiquetas
- ✅ Un usuario gestor no puede marcar etiquetas (salvo que se le dé la facultad de personal)
- ✅ Un gestor de otra empresa no puede
- ✅ El administrador de la sede 2 no marca a alguien de la sede 1
- ✅ El administrador de la sede 1 marca a un usuario gestor de su sede
- ✅ El administrador general marca a quien sea de la empresa
- ✅ Un gestor no marca a otro gestor (eso lo hace el administrador)
- ✅ Nadie escribe directo en la tabla de etiquetas
- ✅ Tampoco borra directo
- ✅ El usuario no se quita sus propias etiquetas
- ✅ El gestor de la sede la quita
- ✅ Quitarla otra vez no falla
- ✅ El gestor de la otra sede no quita etiquetas ajenas
- ✅ Quedan 3 etiquetas
- ✅ (limpieza) no quedan etiquetas de la prueba

**Resultado: 63 de 63**
