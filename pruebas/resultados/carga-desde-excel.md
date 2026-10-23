# Carga de personal desde Excel — prueba final (tarea 3.6)

Fecha: 23/10/2026, 9:16:07 a. m. (hora de Lima). Solo datos ficticios; esta prueba no graba nada.

Archivo: `pruebas/excel/CRC_prueba_carga_25_filas_FICTICIO.xlsx` (se crea con `pruebas/excel/crear_excel_prueba.py`).

**Resultado: 48 de 48 pruebas pasaron.**

## 1. El lector de la app con el Excel de 25 filas

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | Lee las 25 personas | 25 |
| ✅ Pasa | Fecha guardada por Excel → 03/04/2023 | 2023-04-03 |
| ✅ Pasa | Fecha escrita a mano «15/03/2021» → 15/03/2021 | 2021-03-15 |
| ✅ Pasa | Fecha imposible «31/02/2022» se marca como no válida |  |
| ✅ Pasa | Avisa cuando Excel guardó el documento como número |  |
| ✅ Pasa | El documento escrito como texto no se marca |  |
| ✅ Pasa | El Excel modelo del dueño se sigue leyendo (27 personas) | 27 |

## 2. La revisión del servidor, fila por fila (administrador de A)

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | La revisión responde | 200 |
| ✅ Pasa | Fila 2: nueva | nueva ·  |
| ✅ Pasa | Fila 3: nueva | nueva ·  |
| ✅ Pasa | Fila 4: error («quitarle un 0») | error · DNI no válido: debe tener 8 dígitos, solo números. Excel pudo quitarle un 0 inicial: escribe el número como texto. |
| ✅ Pasa | Fila 5: nueva | nueva ·  |
| ✅ Pasa | Fila 6: nueva | nueva ·  |
| ✅ Pasa | Fila 7: nueva | nueva ·  |
| ✅ Pasa | Fila 8: nueva | nueva ·  |
| ✅ Pasa | Fila 9: error («Fecha de ingreso no válida») | error · Fecha de ingreso no válida («31/02/2022»): usa día/mes/año. |
| ✅ Pasa | Fila 10: error («fuera de rango») | error · Fecha de ingreso fuera de rango (01/01/2030). |
| ✅ Pasa | Fila 11: error («Repetido») | error · Repetido: el mismo documento ya está en la fila 2. |
| ✅ Pasa | Fila 12: error («Faltan los apellidos») | error · Faltan los apellidos y nombres. |
| ✅ Pasa | Fila 13: error («administradores los crea Integrax») | error · Rol no permitido: los administradores los crea Integrax, no el Excel. |
| ✅ Pasa | Fila 14: error («Rol no válido») | error · Rol no válido: usa «gestor» o «usuario». |
| ✅ Pasa | Fila 15: falta_lista («Puesto «Piloto de submarino»») | falta_lista · Puesto «Piloto de submarino» |
| ✅ Pasa | Fila 16: falta_lista («Área fantasma») | falta_lista · Área «General (ficticia) › Área fantasma» |
| ✅ Pasa | Fila 17: nueva | nueva ·  |
| ✅ Pasa | Fila 18: falta_lista («Línea Z») | falta_lista · Subárea «General (ficticia) › Planta › Línea Z» |
| ✅ Pasa | Fila 19: error («Falta la gerencia») | error · Falta la gerencia. |
| ✅ Pasa | Fila 20: error («Tipo de documento no válido») | error · Tipo de documento no válido: usa DNI, CE o PAS. |
| ✅ Pasa | Fila 21: administrador | administrador ·  |
| ✅ Pasa | Fila 22: actualizar o sin_cambios | actualizar ·  |
| ✅ Pasa | Fila 23: error («otra empresa») | error · Esta persona tiene una cuenta activa en otra empresa: debe cesarse allí primero. |
| ✅ Pasa | Fila 24: error («como CE») | error · Ya existe una persona con este número como CE: revisa el tipo de documento. |
| ✅ Pasa | Fila 25: nueva | nueva ·  |
| ✅ Pasa | Fila 26: nueva | nueva ·  |
| ✅ Pasa | Fila 7: el número con puntos queda limpio (72000006) | 72000006 |
| ✅ Pasa | Propone crear solo lo que falta (puesto, área y subárea) | Piloto de submarino / General (ficticia) › Área fantasma / General (ficticia) › Planta › Línea Z |
| ✅ Pasa | Con filas con error no se puede grabar (409) y nada se graba | 409 |
| ✅ Pasa | Ninguna persona de este Excel quedó creada | 0 |

## 3. Archivos malos: se rechazan con un mensaje claro, sin colgarse

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | Excel dañado (cortado a la mitad): rechazado | El archivo no es un Excel .xlsx válido. |
| ✅ Pasa | Archivo que no es Excel (bytes al azar): rechazado | El archivo no es un Excel .xlsx. Usa la plantilla de CRC. |
| ✅ Pasa | Excel antiguo (.xls): rechazado | Es un Excel antiguo (.xls). Ábrelo y guárdalo como «Libro de Excel (.xlsx)». |
| ✅ Pasa | Lista en CSV renombrada: rechazado | El archivo no es un Excel .xlsx. Usa la plantilla de CRC. |
| ✅ Pasa | Archivo de más de 1 MB: rechazado | El archivo pesa más de 1 MB. Divide la lista en varios archivos. |
| ✅ Pasa | Plantilla sin personas: rechazado | El Excel no tiene personas debajo de los títulos. |
| ✅ Pasa | Excel de 301 personas: rechazado (máximo 300) | El Excel tiene 301 personas; el máximo por archivo es 300. Divídelo en varios archivos. |

## 4. Límites del servidor (por si alguien se salta la pantalla)

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | 301 filas enviadas directo: rechazadas | 400 · Máximo 300 personas por archivo |
| ✅ Pasa | Envío demasiado grande: rechazado | 400 · Datos no válidos o demasiado grandes |
| ✅ Pasa | Sin filas: rechazado | 400 · El Excel no tiene personas |
| ✅ Pasa | Nadie puede llamar al grabado de la base de datos sin pasar por la revisión | permission denied for function grabar_carga |

