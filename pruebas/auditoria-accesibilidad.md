# Tarea B · Auditoría básica de accesibilidad (solo diagnóstico)

Fecha: 05/11/2026 · Solo crc-dev, cuenta ficticia (administrador general de la empresa D) · Aplicación publicada como v0.9.6 más los cambios sin publicar de la rama de trabajo (ingreso nuevo, esqueletos, menú fijo). **No se corrigió nada** en esta tarea.

Método: Lighthouse 13.6 (solo categoría Accesibilidad) con Chrome real, en celular (390 px) y escritorio (1280 px); más una revisión manual medida en el navegador (nombres de botones, etiquetas, foco con teclado, tamaño táctil, imágenes, regiones, mensajes de error) y la revisión del código de la firma y de las ventanas.

## 1. Puntuaciones de Lighthouse (0 a 100)
| Pantalla | Celular | Escritorio |
|---|---|---|
| Ingreso | 100 | 100 |
| Panel (inicio) | 89 | 97 |
| Lista de inspecciones | 90 | 96 |
| Llenado de una inspección | 88 | 94 |
| Hallazgos | 90 | 96 |
| Personal (usuarios) | 90 | 96 |
| Configuración (Mi empresa) | 91 | 96 |
| Equipo de SST | 89 | 96 |
| Formatos | 90 | 96 |
| Programa anual (PASST) | 90 | 96 |
| Cambio de contraseña | sin medir con sesión real (solo se muestra a una cuenta con la contraseña vencida o recién creada); usa los mismos componentes `.field` que Usuarios | — |

Ninguna pantalla baja de 88. Todas conservan `lang="es"`, un solo título principal (h1) y las regiones `main`, `header` y `nav`.

## 2. Qué se comprobó a mano y salió bien
- **Teclado:** en las 10 pantallas se recorrió con Tab (45 elementos por pantalla): cada elemento enfocado muestra un contorno o sombra visible. Única excepción: un campo del llenado de inspección sin indicador (ver tabla).
- **Etiquetas de formularios:** ningún campo sin etiqueta en ninguna pantalla (se revisaron 5 a 116 elementos interactivos por pantalla).
- **Imágenes:** ninguna imagen sin texto alternativo.
- **Mensajes de error:** el error del ingreso tiene `role="alert"`, y las pistas de validación nuevas están en una región `aria-live`; los avisos de las demás pantallas usan `role="alert"`.
- **Ventanas emergentes:** tienen `role="dialog"`, `aria-modal`, nombre y se cierran con Escape.
- **Contraste de las combinaciones de la marca:** texto principal 15,0:1; texto secundario 5,9 a 6,4:1; enlaces teal 5,5 a 5,9:1; blanco sobre azul 11,6:1; alerta 8,5:1; contorno de campos del ingreso 3,15:1 (el contorno antiguo de los demás campos, 1,36:1, está por debajo de 3:1).

## 3. Tabla de hallazgos
Gravedad: alta = impide usar con lector de pantalla o teclado; media = dificulta; baja = mejora.

| # | Pantalla | Problema | Gravedad | Esfuerzo |
|---|---|---|---|---|
| 1 | Todas con sesión (barra superior, celular) | El botón de la **campana** de avisos no tiene nombre para el lector de pantalla (solo un ícono y un número). | Alta | Mínimo (15 min) |
| 2 | Todas con sesión (celular) | El botón de **números de emergencia** y la campana miden 14×40 px: por debajo del mínimo de 24 px de WCAG 2.2 AA (el ideal es 44 px). | Media | Bajo (1 h) |
| 3 | Panel | La **magnitud 4 de los sismos** (blanco sobre ámbar) tiene contraste 2,6:1 (mínimo 4,5:1); el número de la campana, 3,9:1. | Media | Bajo (30 min) |
| 4 | Panel | Casilla «Solo epicentros en Perú» de 13×13 px y enlaces «Detalle USGS» de 14 px de alto, menores que 24 px. | Media | Bajo (1 h) |
| 5 | Configuración (celular) | Botones de opción (radio) de 20×20 px, menores que 24 px. | Baja | Bajo (30 min) |
| 6 | Inspecciones, personal, formatos, PASST (celular y escritorio) | Muchos controles entre 24 y 44 px (PASST: unos 230 por pantalla, la grilla de semanas). Cumplen el mínimo AA de 24 px pero no el ideal de 44 px para dedos. | Media | Medio (1 día; en el PASST, la grilla necesita rediseño) |
| 7 | Llenado de inspección | **Firma con el dedo:** el recuadro es solo táctil o de mouse; no hay alternativa con teclado ni aviso. El recuadro tiene nombre («Recuadro para firmar») pero un lector de pantalla no puede firmar. | Alta (para quien no puede usar dedo o mouse) | Medio (1 día): ofrecer «Firmar escribiendo mi nombre» o aviso de que la firma exige el dedo |
| 8 | Llenado de inspección | Un campo enfocado con el teclado no muestra indicador de foco (campo sin nombre visible). Salto de títulos: de h1 a h3 (Lighthouse `heading-order`). | Baja | Bajo (30 min) |
| 9 | Todas con sesión | No hay enlace «Saltar al contenido» al inicio; quien usa teclado debe pasar por la barra y el menú en cada pantalla. | Media | Bajo (30 min) |
| 10 | Ventanas emergentes (carga de equipos, firma, etc.) | La ventana se cierra con Escape pero **no atrapa el foco** (se puede tabular fuera hacia la pantalla de atrás), no lleva el foco a la ventana al abrir ni lo devuelve al cerrar. | Media | Bajo (2 h) |
| 11 | Ingreso y formularios con `.field` | Los textos de ejemplo (placeholders) tienen contraste 2,8:1. El contorno de los campos de los demás formularios es 1,36:1 (debería ser 3:1 o más). Los campos nuevos del ingreso ya cumplen. | Media | Bajo (1 h; ya resuelto en el ingreso) |
| 12 | Cambio de contraseña | Sin medir con sesión real; se espera el mismo comportamiento de los formularios `.field` (hallazgo 11). | Baja | Bajo |
| 13 | Todas | Falta una prueba con lector de pantalla real (NVDA o TalkBack) y con zoom al 200 % y texto grande; Lighthouse y estas pruebas solo detectan una parte de los problemas. | — | Medio (1 día, con el dueño) |

## 4. Recomendación para decidir qué entra en 1.0 y qué en 1.1
- **Antes de lanzar la 1.0 (esfuerzo total menor a 1 día):** 1, 2, 3, 4, 9 y 11.
- **En la 1.1:** 6 (rediseño de la grilla del PASST), 7 (firma alternativa), 10 (ventanas), 5, 8 y 12, y la prueba con lector de pantalla (13).
- Los puntos 1 a 5 y 9 a 11 son cambios pequeños de diseño; dependen del dueño y no tocan datos.
