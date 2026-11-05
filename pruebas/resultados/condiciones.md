# Prueba de la gestión de condiciones

Fecha: 2026-11-05 · crc-dev · empresa ficticia D.

## 1. El estado se calcula con las fechas

- ✅ Sin cierre y plazo por venir: pendiente
- ✅ El mismo día del plazo todavía es pendiente
- ✅ Sin cierre y plazo vencido: atrasado
- ✅ Cerrada el día del plazo: dentro de plazo
- ✅ Cerrada antes del plazo: dentro de plazo
- ✅ Cerrada después del plazo: fuera de plazo
- ✅ Sin plazo y sin cierre: pendiente
- ✅ Sin plazo y cerrada: dentro de plazo

## 2. Lo obligatorio

- ✅ Falta el área y la descripción
- ✅ La descripción pide peligro Y riesgo (aunque la columna no marque obligatoria)
- ✅ Con todo completo no falta nada
- ✅ Estado y responsable automáticos nunca se piden
- ✅ Una columna oculta no se pide aunque sea obligatoria
- ✅ Vacío: texto en blanco, lista sin elegir, descripción a medias
- ✅ Texto de la descripción para la tabla

## 2b. Las tarjetas cuentan por columna

- ✅ Tarjeta de borradores
- ✅ Tarjeta «sin plazo»
- ✅ Tarjeta «igual a» no distingue mayúsculas ni tildes
- ✅ Tarjeta «distinta de»
- ✅ Tarjeta sobre el estado calculado
- ✅ Tarjeta sobre una persona compara su nombre

## 3. Quién ve y quién carga

- ✅ El administrador de la sede 1 prepara la matriz de su sede
- ✅ Hay 14 columnas base (y repetir no las duplica)
- ✅ El usuario común no puede preparar ni ver la matriz
- ✅ El administrador de otra empresa no la ve ni la prepara
- ✅ El administrador de la sede 2 no toca la sede 1
- ✅ El gestor de la sede 2 no toca la sede 1
- ✅ El administrador general sí ve las dos sedes
- ✅ Nadie escribe directo en la tabla
- ✅ Los obligatorios de fábrica: todo menos cierre, estado y responsable de la inspección

## 4. Cargar una condición

- ✅ La lista de responsables trae gente de la sede
- ✅ El usuario común no pide esa lista
- ✅ El administrador sube la foto de evidencia al almacén
- ✅ El usuario común no puede subir fotos
- ✅ No se acepta una ruta de otra forma
- ✅ Una condición completa se guarda
- ✅ Queda a nombre de quien la cargó y con la fecha elegida
- ✅ El responsable del levantamiento guarda su nombre
- ✅ El gestor de la sede 2 no la ve
- ✅ El administrador general sí la ve
- ✅ Otra empresa no la ve
- ✅ Quien tiene acceso abre la foto
- ✅ Otra empresa no abre la foto
- ✅ Sin área no se guarda
- ✅ La descripción sin riesgo no se guarda
- ✅ La descripción sin peligro no se guarda
- ✅ Sin foto no se guarda (es obligatoria)
- ✅ El plazo no puede ser anterior al hallazgo
- ✅ El hallazgo no puede ser futuro
- ✅ Una fecha que no existe no se guarda
- ✅ La clasificación solo acepta las opciones de la lista
- ✅ No se acepta una foto de otra empresa
- ✅ El responsable debe ser de la sede
- ✅ El usuario común no puede cargar
- ✅ El gestor de otra sede no puede cargar en esta
- ✅ El gestor de esa sede puede editar la condición (el cierre no se manda al cargar)
- ✅ Guardar no cierra aunque se mande una fecha de cierre
- ✅ El cierre no puede ser futuro
- ✅ El cierre no puede ser anterior al hallazgo
- ✅ El gestor de otra sede no valida el cierre
- ✅ El usuario común no valida el cierre
- ✅ Validar el cierre pone la fecha
- ✅ Queda anotado quién la cambió y que sigue a nombre de quien la creó
- ✅ Con cierre antes del plazo queda dentro de plazo
- ✅ El gestor de otra sede no edita esa condición
- ✅ Editar por otra sede (mismo id, sede distinta) no mueve la condición

## 5. El administrador configura las columnas

- ✅ Ocultar una columna
- ✅ Con la columna oculta ya no se pide
- ✅ Mostrarla otra vez
- ✅ Visible otra vez, vuelve a ser obligatoria
- ✅ Agregar una columna de varias opciones obligatoria
- ✅ Queda al final, no es base y guarda sus opciones
- ✅ La columna nueva obligatoria se pide
- ✅ Solo acepta las opciones de la lista
- ✅ Con opciones válidas se guarda
- ✅ Dos columnas no pueden llamarse igual
- ✅ Una lista pide al menos una opción
- ✅ Las opciones no se repiten
- ✅ El área no cambia de tipo (es la lista de áreas de la empresa)
- ✅ Convertir la ubicación en lista desplegable
- ✅ Con la ubicación en lista, solo acepta sus opciones
- ✅ Devolver la ubicación a texto libre
- ✅ La fecha de hallazgo no cambia de tipo
- ✅ Una columna base no se elimina
- ✅ El estado nunca es obligatorio
- ✅ Cambiar el nombre y volver a ponerlo
- ✅ Eliminar la columna agregada borra sus datos
- ✅ Las columnas son de cada sede: la sede 2 no cambió
- ✅ El administrador de la sede 2 no cambia las columnas de la sede 1
- ✅ El gestor no cambia columnas directo
- ✅ El usuario común tampoco

## 6. El gestor propone y el administrador decide

- ✅ El gestor envía su propuesta
- ✅ La matriz no cambia mientras nadie decide
- ✅ La solicitud es de la sede, pendiente y con título legible
- ✅ Una propuesta mal hecha se rechaza al pedirla
- ✅ El gestor de otra sede no propone para esta
- ✅ El usuario común no propone
- ✅ El gestor no se aprueba a sí mismo
- ✅ El administrador de la otra sede no decide esta propuesta
- ✅ El administrador de la sede la aprueba
- ✅ Al aprobar se ejecuta: la columna aparece con sus opciones
- ✅ Una solicitud resuelta no se decide otra vez
- ✅ Otra propuesta: ocultar la ubicación
- ✅ Denegar pide un motivo
- ✅ El administrador general la deniega
- ✅ Al denegar la matriz queda sin el cambio
- ✅ Una propuesta que no se podría cumplir se rechaza al pedirla (base no se elimina)
- ✅ Proponer eliminar la columna agregada
- ✅ Al aprobar se elimina

## 7. Borradores, responsables, áreas y tarjetas

- ✅ Incompleta sin pedir borrador: se rechaza
- ✅ Incompleta pidiendo borrador: se guarda
- ✅ Queda marcada como borrador
- ✅ El responsable de la inspección es quien la cargó
- ✅ El borrador no se puede cerrar
- ✅ Al completarlo deja de ser borrador
- ✅ Cualquier persona de la empresa puede ser responsable del levantamiento
- ✅ Una persona que no es de la empresa no
- ✅ El área elegida de la lista usa el nombre de la estructura de la empresa
- ✅ Si solo se escribe el nombre de un área existente, se acepta y se vincula
- ✅ Un área con identificador que no es de la empresa se rechaza
- ✅ Hay dos tarjetas fijas: borradores y sin plazo
- ✅ El administrador crea una tarjeta sobre una columna
- ✅ Una tarjeta pide un valor si compara
- ✅ Una tarjeta pide una columna que existe
- ✅ El gestor no crea tarjetas
- ✅ El administrador de otra sede no crea tarjetas aquí
- ✅ El gestor sí ve las tarjetas
- ✅ El usuario común no ve las tarjetas
- ✅ Las tarjetas fijas no se cambian ni se quitan
- ✅ El administrador edita y quita su tarjeta
- ✅ El gestor no quita tarjetas

## 7b. Extrapolar al IPF

- ✅ A la fecha en que seguía abierta, la condición se trae al IPF
- ✅ Ya cerrada a esa fecha, no se trae
- ✅ Una condición anterior al hallazgo no existía aún (fecha previa)
- ✅ Los borradores no se traen
- ✅ Filtra por área: un área sin condiciones no trae nada
- ✅ El usuario común no puede pedirlas
- ✅ El gestor de otra sede no puede pedirlas de esta
- ✅ Pide la fecha de la inspección

## 8. Limpieza

- ✅ La prueba dejó condiciones nuevas (hay algo que limpiar)
- ✅ El dueño limpia solo lo de esta corrida
- ✅ Lo anterior no se puede borrar con una fecha vieja
- ✅ Nadie más limpia
- ✅ No se limpia una empresa que no es la ficticia D
- ✅ Las columnas base siguen todas en su lugar

**Resultado: 145 de 145**
