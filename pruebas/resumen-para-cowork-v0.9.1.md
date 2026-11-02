# CRC · Resumen para Cowork — de la ronda de diseño a la v0.9.1 (28 al 30/10/2026)

Punto de partida: el último mensaje que se le pasó a Cowork fue la respuesta sobre las plantillas de prueba de crc-dev («se quedan como están… el piloto de la tarea 1.8 se arma desde cero»). Desde ahí se hicieron **tres versiones**: la v0.8.1, la v0.9.0 y la v0.9.1. Las tres están publicadas.

- **Sitio publicado:** https://crc-app-phi.vercel.app (la v0.9.1 salió el 30/10/2026; commit `7340597`, rama `main`).
- **Base de datos:** solo crc-dev (`kezolcttaanfeunafvms`), con datos ficticios. Nada de esta ronda toca el piloto.
- **Lista completa por observación** (86 puntos, con archivo y si toca tablas): `pruebas/revision-diseno-flujos.md`.

## 0. Aviso por la regla permanente del CLAUDE.md

Esta ronda cambió tablas que usan también los módulos de contratistas y medio ambiente. **El dueño decide si hay que actualizar el esquema de esos módulos; no se tocaron esas carpetas.**

| Tabla | Cambio | Migración |
|---|---|---|
| `empresas` | Columnas del N.º de trabajadores (modo automático o manual) | `20261029181907_trabajadores_y_seguimiento` |

Sin cambios en `sedes`, `unidades` (solo se usa), `puestos`, `personas`, `vinculos`, `roles` ni `permisos`. (El aviso de `empresas` ya se dio el 29/10.)

## 1. Qué hay que verificar en Supabase (cambios de esquema y funciones)

| Migración | Qué cambia |
|---|---|
| `20261029132606_loto_textos_formato` | LOTO base v2 con los textos del formato del dueño. |
| `20261029133027_passt_area_actividad` | `passt_nodos.unidad_id`: cada actividad del PASST puede tener su área (LOTO: una actividad por área). |
| `20261029143645_una_copia_por_formato_base` | `copiar_plantilla` y `cambiar_vigencia_plantilla`: un solo formato activo por formato base en cada empresa. |
| `20261029181907_trabajadores_y_seguimiento` | `empresas` (trabajadores automático/manual) y `passt_programas.seguimiento` (por semana o por mes). |
| `20261029182649_formatos_loto_ipf_v` | LOTO base sin «N.º de trabajadores»; IPF base según el modelo de Inspección de Seguridad Ocupacional. |
| `20261029184525_nombre_formato_ipf` | Nombre «Inspección de seguridad ocupacional (IPF)» (base y copias). |
| `20261029190920_ipf_tipo_inspeccion` | IPF: tipo Programada / No programada / Otros + «Otros (detallar)». |
| `20261029203022_ipf_otros_condicional` | «Otros (detallar)» solo aparece si el tipo es «Otros» (regla `mostrar_si`). |
| `20261029205803_firmas_cargo` | `firmas.cargo` (cargo escrito al firmar) y `grabar_inspeccion` lo guarda. |
| `20261029213135_extintores_16_puntos` | Extintores base: 16 puntos, 6 críticos, semanal. |
| `20261029220433_extintores_sin_firmas_con_visto` | Extintores sin firmas en la inspección; puntos no críticos con √ al abrir. |
| `20261030010931_passt_frecuencia_actividad` | `passt_nodos.frecuencia` y semanas programables por actividad; solo el administrador (`passt.reprogramar`). |
| `20261030033709_criticos_piden_accion_ext_daci` | Extintores y DACI: crítico en X pide acción, responsable y plazo. |
| `20261030043508_motobomba_base` | Tipo de activo base «Motobomba» y formato base «Inspección de motobomba». |
| `20261030060422_electrobomba_base` | Tipo de activo base «Electrobomba» (12 fichas técnicas) y formato base «Inspección de electrobomba». |
| `20261030061811_criticos_con_accion_bombas_car` | Versión nueva de CAR, bombas, motobomba y electrobomba: críticos con hallazgo y acción; hora de inicio de la electrobomba de tipo hora. |

- Todas están aplicadas en crc-dev y los archivos locales llevan la versión aplicada.
- **Función del servidor `registrar-inspeccion`:** redesplegada hoy (versión 3). El servidor tenía el motor de reglas del 27/10; ahora recalcula con el mismo motor que la app (puntos condicionales, valores por defecto, texto de vencidos, cargo del firmante). `verify_jwt` sigue en `false`, como antes.
- No hubo cambios de permisos ni roles. Sí cambió quién puede **programar** en el PASST: solo el administrador (ver decisión 5.4).

## 2. v0.8.1 — Ronda de revisión de diseño (28 al 29/10)

Todo sin tablas ni permisos. Detalle en los puntos 1 al 9 del documento.

- Perfil: un botón arriba con «Mi información», «Información de la empresa», «Configuración de usuarios» (según permisos) y cerrar sesión. Se quitaron los íconos «Usuarios» y «Mi empresa».
- Indicador «En línea» / «Modo sin conexión» junto al logo; se quitó «Estado del sistema» del inicio.
- Saludo «Hola, nombre».
- Tarjeta deslizable del avance del PASST por mes (con % por objetivo), «pendientes del mes» y «atrasados».
- Campana con número de no leídas: firmas pendientes.
- Firmantes: elegir de la lista o **escribir a mano** con búsqueda rápida.

**Decisión de proceso del dueño:** desde el cambio 8, todos los cambios restantes se hacen de una vez y se presentan juntos para una aprobación general.

## 3. v0.9.0 — Formato LOTO, firmas en Excel y PDF (29/10)

Decisiones del dueño:
1. Datos de la empresa desde la ficha de CRC, nunca datos reales.
2. **Opción b:** el LOTO base usa los textos del formato del dueño. Cada empresa pone su logo, código, versión y fecha de aprobación. (Ajusta D-22 solo para LOTO; ya registrado como D-45.)
3. CRC sigue guardando respuestas y firmas.
4. Programación semanal desde el PASST: estrategia «Eficacia LOTO» con una actividad por área.
5. Las firmas van **dentro del Excel**.
6. **PDF idéntico al Excel** de cada empresa.
7. Un solo formato activo por formato base en cada empresa (las copias repetidas se desactivaron).

## 4. v0.9.1 — Lo nuevo (29 al 30/10)

### 4.1 Inicio, perfil y avisos
- Menú lateral (tres líneas): Inicio, Programa anual de SST, Inspecciones (las 4 más usadas y «Ver todas») y Formatos.
- Inicio sin botones de acceso; sección «Alerta de sismos — Perú» (USGS + mapa); nota «Para instalar…» al final; sin la versión.
- Las secciones «Mis pendientes», «Atrasados» y «Mis hallazgos abiertos y en proceso» comparten diseño (icono, nombre con cantidad y «Ver detalle»).
- La tarjeta de objetivos dice «9 de 24 ejecutadas».
- Logo de la empresa cliente en la cabecera (negativo, o positivo si no hay); la cuenta del dueño lo ve mientras mira la ficha de una empresa. Los logos piden «Guardar cambio» o «Descartar» y se suben por separado.
- Alerta si un formato no tiene código, versión y fecha de aprobación (y al generar un registro).
- Cierre de inspección sin avisos amarillos; campana con hallazgos asignados.

### 4.2 PASST
- Descarga en Excel y PDF con el formato del modelo; % y meta también por objetivo y por estrategia.
- **N.º de trabajadores** automático (conteo) o manual, usado en todos los formatos (`{{trabajadores}}`).
- Seguimiento por mes o por semana; calendario con el mes actual abierto y resaltado.
- **La frecuencia nace en la actividad del PASST** (periódica o manual) y solo la define el administrador. Vincular un formato a la actividad es opcional. Un formato ya no tiene período propio.
- Mensual, bimestral, trimestral, semestral y anual son del **calendario** (octubre = 01/10 al 31/10).
- Cambios de un programa aprobado: el motivo se pide en una ventana al guardar.

### 4.3 Hallazgos
- Primero tarjetas por fuente (formato) con «abiertos de total»; en cada inspección, botón «Ver hallazgos».
- Se quitó el icono de hallazgos de la cabecera.
- **Todo punto crítico genera hallazgo y pide acción correctiva, responsable y plazo**, en todos los formatos.

### 4.4 Formatos y pantallas por tipo de inspección
- **LOTO:** pestañas Resultados / Hallazgos; filtro por mes con promedio; tabla de áreas desde inicio de año.
- **IPF** (según su modelo): pestañas Resultados (tarjetas de % cerrado, abiertos y levantados, y gráfico), Registros (por mes y área, con Excel y PDF) y Hallazgos; fotos como imagen en el Excel.
- **Extintores** (paquete SO.R.G.085): 16 puntos, semanal; pantalla con cumplimiento, no operativos, por vencer, catastro de doble entrada, realizar inspección, generar registro (Excel o PDF, semana o mes), buscador con ficha, carga masiva de equipos con plantilla Excel.
- **Sistema DACI:** misma pantalla que extintores; el cargo del inspector sale solo; Excel y PDF con una fila por dispositivo, tipo de dispositivo y una columna por criterio (√ / X / N/A).
- **Inspección de bomba contra incendio** (nueva): motobomba (22 puntos Sí/No, prueba funcional, 2 firmas) y electrobomba (29 puntos, prueba antes y final, 12 fichas técnicas). **Una sola pantalla** para las dos con semana, cumplimiento general y hallazgos, catastro separado por tipo, realizar inspección con filtro, generar registro por equipo y hallazgos acumulados. Ambas semanales según el PASST.
- Excel y PDF de cada formato **iguales al formato del dueño**, con filas dinámicas, fotos y firmas; el PDF sale del mismo Excel.

## 5. Decisiones del dueño (para el registro de decisiones)

1. Datos de empresa siempre desde la ficha de CRC (nunca datos reales).
2. LOTO con los textos de su formato; cada empresa pone logo, versión y fecha.
3. Todos los formatos con los datos de la empresa y el N.º de trabajadores automático o manual.
4. **La frecuencia vive en el PASST** (actividad), no en el formato; solo el administrador la define o programa semanas. *Por tanto un gestor ya no puede programar semanas.*
5. Un solo formato activo por formato base en cada empresa.
6. PDF idéntico al Excel; firmas dentro del Excel; el cargo del firmante se escribe a mano (o se completa solo en DACI, motobomba y electrobomba).
7. Extintores: sin firmas en la inspección; críticos en X piden acción, responsable y plazo; «no operativo» también si hay mantenimiento vencido, prueba hidrostática de más de 5 años o fabricación de más de 20.
8. Las inspecciones se ordenan por tipo; sin cuadro «En este equipo» en LOTO, DACI y bombas.
9. Una bomba contra incendio = una inspección por semana por equipo; el registro Excel/PDF es de **un equipo** (así es el formato del dueño).
10. Los formatos del dueño se quedan solo en su equipo (`Registros/`): no se suben a GitHub ni a Drive. Los Excel marcados se subieron a crc-dev (con datos ficticios) para que el botón Excel/PDF funcione.

## 6. Decisiones que tomé yo y el dueño puede cambiar
- En motobomba y electrobomba, «críticos» = los puntos de «durante» y «después de la prueba»; los de «antes» solo piden observación. En la genérica `bombas` y en CAR (acceso libre) también.
- Las observaciones de la prueba funcional de las bombas son opcionales; la hora de inicio de la electrobomba usa el selector de hora.
- Se agregó la fila «Electrobomba Jockey» al Excel (el formato del dueño solo trae la principal).
- Se corrigieron las erratas del Excel de la electrobomba («elementros», «cída», «pruebla», «Alimientación», «RESPONABLE», «Marco»).

## 7. Pendientes y alcance nuevo (no hechos)
- **Campana, 8b–8e:** eventos del PASST, mensajes, tareas delegadas, «sin leer» (esperan a Cowork).
- Del paquete de extintores **no se hizo**: lectura del código con cámara y el rol «contratista».
- **Mapa de sismos:** usa un mapa de pruebas; antes del piloto hay que decidir el servicio de mapas (privacidad 5.3).
- En el almacén de crc-dev quedó un Excel antiguo de extintores con nombres reales (sin usar); **no se borró** (falta permiso del dueño).
- La plantilla genérica `bombas` queda en la biblioteca sin usar.
- Los datos ficticios de bombas (MB-001 a 003, EB-001 a 003) y la actividad de muestra del PASST solo existen en crc-dev; el piloto parte de cero.
- Verificar con Cowork: `firmas.cargo`, `passt_nodos.frecuencia` y `unidad_id`, `empresas` (trabajadores), `passt_programas.seguimiento`, los permisos `passt.reprogramar` / `programar_semana` y la función `registrar-inspeccion` v3.

## 8. Pruebas
Pasan por separado: motor (71), formatos (103), programación (25), períodos (25), Excel (79), hallazgos (44), PASST (69) e inspecciones (60). No se probó, desde la pantalla, guardar una inspección completa de motobomba o electrobomba con firmas.
