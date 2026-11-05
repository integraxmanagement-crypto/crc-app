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
- ✅ Ve al usuario gestor de su sede, no al de la otra, y no ve a los usuarios (solo el equipo SST)
- ✅ Ve al administrador general y al de su sede, no al de la otra sede
- ✅ Cada fila trae su rol
- ✅ El WhatsApp solo sale en los gestores
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

## 4. El dueño de la plataforma habilita o no «Conoce al equipo de SST» por empresa

- ✅ De partida está habilitado para la empresa D
- ✅ Y el equipo trae personas
- ✅ ADMIN_C no puede deshabilitarlo (solo el dueño)
- ✅ ADMSEDE_C1 no puede deshabilitarlo (solo el dueño)
- ✅ GESTOR_C1 no puede deshabilitarlo (solo el dueño)
- ✅ USUARIO_C1 no puede deshabilitarlo (solo el dueño)
- ✅ USUGES_C1 no puede deshabilitarlo (solo el dueño)
- ✅ Los intentos no cambiaron nada
- ✅ El dueño lo deshabilita para la empresa D
- ✅ La consulta de habilitado dice que no, para todos de esa empresa
- ✅ Nadie de esa empresa recibe a ninguna persona del equipo
- ✅ Otra empresa no se ve afectada
- ✅ No acepta una empresa que no existe
- ✅ Nadie escribe directo en la tabla de interruptores
- ✅ Otra empresa no lee el interruptor de la empresa D
- ✅ El dueño lo vuelve a habilitar
- ✅ Y el equipo vuelve a verse
- ✅ El dueño lee los interruptores de todas las empresas

## 5. El organigrama del equipo de SST: puestos y nombres que editan administradores y gestores

- ✅ El administrador general crea el primer puesto (para toda la empresa)
- ✅ El gestor de la sede 1 agrega una rama de su sede
- ✅ …pero no una de la sede 2
- ✅ …ni una «para toda la empresa» (eso es del administrador general)
- ✅ El gestor de la sede 2 agrega la suya
- ✅ El administrador de la sede 1 agrega una rama (con el nombre vacío: puesto por cubrir)
- ✅ USUARIO_C1 no puede agregar puestos
- ✅ USUGES_C1 no puede agregar puestos
- ✅ Nadie cuelga una rama de un puesto que no ve (el gestor 2 no ve la sede 1)
- ✅ Rechaza textos fuera de medida («…», nombre de 1)
- ✅ Rechaza textos fuera de medida («A…», nombre de 1)
- ✅ Rechaza textos fuera de medida («PPPPPPPP…», nombre de 1)
- ✅ Rechaza textos fuera de medida («Puesto b…», nombre de 81)
- ✅ Un usuario de la sede 1 ve el puesto general y los de su sede
- ✅ …y no ve los de la sede 2
- ✅ El administrador general ve todo
- ✅ Otra empresa no ve nada de la empresa D
- ✅ La fila trae puesto y nombre, sin datos de la cuenta (documento, correo, rol)
- ✅ El gestor cambia el nombre y el puesto de un puesto de su sede
- ✅ El cambio se ve
- ✅ El administrador de la sede también
- ✅ El administrador de la sede 1 no edita un puesto de la sede 2
- ✅ El gestor no edita el puesto general de la empresa
- ✅ El administrador general sí
- ✅ Otra empresa no edita nada
- ✅ El dueño de la plataforma tampoco edita el organigrama de una empresa
- ✅ USUARIO_C1 no edita
- ✅ USUGES_C1 no edita
- ✅ Nadie inserta directo en la tabla
- ✅ Ni actualiza directo
- ✅ Ni borra directo
- ✅ Quien atiende las dos sedes agrega una rama de la sede 2 bajo un puesto de la sede 1
- ✅ No se quita un puesto que tiene ramas de otra sede que no manejas
- ✅ Quien maneja las dos sedes sí quita el puesto con todas sus ramas
- ✅ Se fueron el puesto y sus ramas, y quedó lo demás
- ✅ Un usuario no quita nada
- ✅ El gestor no quita el puesto general
- ✅ Si el dueño deshabilita la sección, nadie de la empresa ve el organigrama
- ✅ El gestor no arma el organigrama inicial (solo el administrador general)
- ✅ El administrador general arma el organigrama con el equipo actual
- ✅ Salen personas con puesto y nombre
- ✅ Hay una sola raíz y las demás cuelgan de algo
- ✅ No se arma dos veces (no pisa lo que ya hay)
- ✅ (limpieza) no quedan puestos de la prueba

## 6. El WhatsApp aparece en el puesto solo si el gestor lo publicó

- ✅ El gestor publica su número
- ✅ Sin vincular a ningún puesto, el número no aparece en ninguna parte
- ✅ El gestor vincula su puesto de la sede con su cuenta
- ✅ Un usuario de la sede ve el WhatsApp en ese puesto
- ✅ …y no recibe el identificador de la cuenta
- ✅ Solo salen los puestos con número publicado
- ✅ Quien edita ve a qué cuenta está vinculado el puesto
- ✅ Un usuario de la otra sede no ve el número de un puesto que no ve
- ✅ Otra empresa no ve nada
- ✅ Si el gestor borra su número, deja de aparecer
- ✅ El administrador sigue viendo el vínculo, sin número
- ✅ No se vincula a un gestor de otra sede
- ✅ Solo se vincula a gestores (no a un usuario)
- ✅ No se vincula un puesto de otra sede
- ✅ USUARIO_C1 no vincula
- ✅ USUGES_C1 no vincula
- ✅ Otra empresa no vincula
- ✅ El administrador general vincula un puesto de toda la empresa con un gestor de cualquier sede
- ✅ Y lo desvincula
- ✅ La tabla de vínculos no se lee ni se escribe directo
- ✅ (escritura directa rechazada)
- ✅ El gestor de la sede 1 ve a los gestores de su sede para vincular (con su nombre)
- ✅ …no los de otra sede
- ✅ Un usuario no recibe la lista
- ✅ Cambiar el nombre del puesto no suelta el vínculo ni el número
- ✅ Se quita el puesto
- ✅ Con el puesto se va el vínculo
- ✅ Se arma con el equipo actual
- ✅ Los gestores quedan vinculados a su puesto
- ✅ Y su número aparece apenas lo publican
- ✅ (limpieza) sin puestos ni números de la prueba

**Resultado: 159 de 159**
