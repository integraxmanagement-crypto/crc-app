# Motor de reglas de los formatos (tarea 3.4-B)

Fecha: 2026-11-04 · Resultado: **69 de 69** · Sin base de datos, casos ficticios.

| Prueba | Resultado |
|---|---|
| Hay 7 plantillas base (la genérica de bombas se retiró el 02/11/2026) | ✅ |
| Inspección de extintores portátiles: sin problemas para publicar | ✅ |
| Inspección de caseta de ataque rápido (CAR): sin problemas para publicar | ✅ |
| Inspección de motobomba: sin problemas para publicar | ✅ |
| Inspección de electrobomba: sin problemas para publicar | ✅ |
| Inspección del sistema DACI (detección y alarma contra incendio): sin problemas para publicar | ✅ |
| Eficacia del programa de bloqueo y etiquetado (LOTO): sin problemas para publicar | ✅ |
| Inspección de seguridad ocupacional (IPF): sin problemas para publicar | ✅ |
| Ninguna clave de punto se repite entre las 7 (133 puntos) | ✅ |
| Todo punto crítico de todos los formatos genera hallazgo y pide acción, responsable y plazo (35 críticos; sin acción: ) | ✅ |
| Electrobomba: la hora de inicio (antes y final) es de tipo hora | ✅ |
| Ningún punto trae severidad (queda para la v1.1) | ✅ |
| Ningún texto de la base menciona un código de formato tipo «SO.R.G.» | ✅ |
| Motobomba: 22 puntos Sí / No (16 antes y 6 durante la prueba), todos con observación obligatoria si es No (22) | ✅ |
| Motobomba: 4 datos de la prueba funcional obligatorios, con observaciones opcionales | ✅ |
| Motobomba: dos firmas (inspector y custodia del registro) y frecuencia semanal | ✅ |
| Motobomba: todo en Sí → Conforme y nada falta (Conforme ) | ✅ |
| Motobomba: un No en la prueba → No conforme y 1 hallazgo (No conforme 1) | ✅ |
| Motobomba: un No sin observación no deja cerrar (MB-A01: escribe la observación.) | ✅ |
| Electrobomba: 29 puntos Sí / No (13 antes, 9 durante y 7 después), todos con observación obligatoria si es No (29) | ✅ |
| Electrobomba: prueba funcional con «Antes» y «Final» obligatorios y observaciones opcionales (presión y hora de inicio) | ✅ |
| Electrobomba: dos firmas y frecuencia semanal | ✅ |
| Electrobomba: la ficha del equipo pide las 12 fichas técnicas (principal y jockey), todas obligatorias | ✅ |
| Electrobomba: todo en Sí → Conforme y nada falta (Conforme ) | ✅ |
| Electrobomba: un No en la prueba → No conforme y 1 hallazgo (No conforme 1) | ✅ |
| Electrobomba: sin el «Final» de la presión no deja cerrar (EB-P01F: falta la respuesta.) | ✅ |
| Todo √ y al día → Conforme, sin hallazgos (Conforme) | ✅ |
| X en un crítico (EXT-09) → No conforme y 1 hallazgo (No conforme) | ✅ |
| X en un punto no crítico y sin H (EXT-04) → Conforme, sin hallazgo | ✅ |
| X en no crítico con H (EXT-02) → Conforme, pero 1 hallazgo | ✅ |
| Mantenimiento vencido (oct-2026 en nov-2026) → «No conforme: vencido» + hallazgo de vencimiento (No conforme: vencido) | ✅ |
| Vence este mismo mes → todavía no está vencido | ✅ |
| Fabricado en 1990 (más de 20 años) → No conforme: vencido (No conforme: vencido) | ✅ |
| Fabricado hace exactamente 20 años → todavía vigente (Conforme) | ✅ |
| PH de hace 6 años → No conforme: vencido; de hace 5 → vigente | ✅ |
| Cualquier observación escrita → No conforme (No conforme: con observaciones) | ✅ |
| Al abrir, los no críticos vienen con √ y los críticos sin marcar; sin firmas en la inspección | ✅ |
| Extintores: un crítico en X sin responsable ni fecha → no se puede cerrar (EXT-10: completa la acción correctiva, el responsable y el plazo.) | ✅ |
| Extintores: con responsable y fecha, nace el hallazgo con ese acuerdo ([{"origen":"no_cumple","clave":"EXT-10","fila":null,"texto":"Manómetro de presión","accion":{"texto":"Cambiar manómetro","responsable":"p-1","plazo":"2026-11-30"}}]) | ✅ |
| DACI: un crítico en X sin responsable ni fecha → no se puede cerrar (DACI-D01: completa la acción correctiva, el responsable y el plazo.) | ✅ |
| DACI: con responsable y fecha, nace el hallazgo y el resultado es «Inoperativo» (["Inoperativo",[{"origen":"no_cumple","clave":"DACI-D01","fila":null,"texto":"El detector está firme, limpio y sin daños","accion":{"texto":"Limpiar detector","responsable":"p-1","plazo":"2026-11-15"}}]]) | ✅ |
| Los 16 puntos del paquete, 6 críticos, semanal | ✅ |
| Si la empresa pone 20 años de vida útil, uno de 1990 queda vencido | ✅ |
| N/A en la manguera cuenta como favorable → Conforme | ✅ |
| Un punto obligatorio sin responder → no se puede cerrar (EXT-05: falta la respuesta.) | ✅ |
| 13 puntos: 3 de condición y 10 materiales, uno por columna del Excel del dueño | ✅ |
| Cada material trae su cantidad en el nombre («01 Mangueras…») y ninguno lleva cantidad aparte | ✅ |
| Todo √ → Conforme | ✅ |
| X en un material → No conforme y 1 hallazgo (por reponer) | ✅ |
| Acceso bloqueado (crítico) → No conforme, con hallazgo y acción | ✅ |
| Pictograma en X (ni crítico ni material) → Conforme, con 1 hallazgo | ✅ |
| Un material que no corresponde (N/A) no cuenta como falta | ✅ |
| Presión de descarga 140 con rango 90–120 → hallazgo «fuera de rango» | ✅ |
| Dentro del rango → sin hallazgo | ✅ |
| La misma lectura sin rango definido → no genera hallazgo | ✅ |
| La inspección de bomba contra incendio se arma con motobomba y electrobomba | ✅ |
| Pulsador todo √ → Operativo (solo ve sus 3 puntos) | ✅ |
| Sirena que no suena en la prueba (crítico) → Inoperativo | ✅ |
| Panel con un indicador apagado (no crítico) → Operativo, con 1 hallazgo | ✅ |
| Todo √ → Conforme, puntaje 100 % | ✅ |
| 10 √, 1 N/A, 1 X → No conforme, puntaje 92 % (92 %) | ✅ |
| La X sin acción, responsable ni plazo → no se puede cerrar | ✅ |
| Con acción, responsable y plazo → se puede cerrar y el hallazgo los trae | ✅ |
| Si la empresa decide que N/A no cuenta: 10 de 11 = 91 % (91 %) | ✅ |
| IPF: el tipo de inspección tiene tres opciones (Programada, No programada, Otros) y el objetivo viene escrito | ✅ |
| Sin condiciones inseguras → Conforme, sin hallazgos | ✅ |
| Dice que sí hubo pero no registra ninguna → no se puede cerrar | ✅ |
| 2 condiciones → «Con condiciones inseguras» y 2 hallazgos con responsable y plazo | ✅ |
| Una condición sin foto → falta la foto | ✅ |
