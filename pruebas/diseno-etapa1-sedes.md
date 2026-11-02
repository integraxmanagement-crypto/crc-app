# CRC · Etapa 1 del punto 2: sedes y administrador de sede — DISEÑO (sin código)

Fecha: 02/11/2026 · Estado: **para aprobación del dueño; no se ha construido nada ni publicado nada.**

## 0. Aviso (regla permanente del CLAUDE.md)
Esta etapa cambiaría tablas que usan también los módulos de contratistas y medio ambiente: **`vinculos`, `roles`, `permisos` y `sedes`** (además de las políticas de lectura de `personas`). Hay que avisar antes de construir y esperar la respuesta del dueño: él decide si hay que actualizar el esquema de esos módulos. No se tocan sus carpetas del control de Drive.

## 1. Qué hay hoy (resumen de lo que se encontró en crc-dev)
- Tres roles: `admin_empresa`, `gestor`, `usuario` (el dueño está aparte). Un administrador ve **toda la empresa**.
- El administrador ya puede crear y cesar `gestor` y `usuario`, y **no** puede crear administradores (tabla `roles_asignables`: solo admin → gestor y usuario). Los administradores solo los crea el dueño.
- Las sedes ya existen. Hoy llevan `sede_id`: `activos`, `ubicaciones`, `inspecciones`, `hallazgos` y `passt_programas` (un programa anual por sede).
- Hoy **no** llevan sede: `vinculos` (la cuenta de una persona en una empresa), `personas`, `unidades` (áreas), `puestos`, `plantillas` (formatos), `tipos_activo` y `listas`: son de toda la empresa.
- La lectura de datos se limita por empresa (`app.mi_empresa()`), nunca por sede. Todas las escrituras pasan por funciones del servidor (RPC), que son las que hay que endurecer.

## 2. Idea del diseño (una frase)
**Cada cuenta que no es administrador general tiene una lista de sedes; todo lo que tiene sede se limita a esa lista; el administrador general ve todo; si la empresa tiene una sola sede, nadie nota nada.**

## 3. Las pantallas (simples)

**A. Barra superior (administrador general o cuenta con más de una sede)**
```
[≡] [logo empresa] ● En línea        Sede: [ Todas las sedes ▾ ]  🔔 📞 Perfil ▾
```
- Administrador general: «Todas las sedes» o una sede. Gestor o usuario con varias sedes: solo sus sedes.
- Con una sola sede (cuenta o empresa) **no sale el selector**.
- Lo elegido filtra Inicio, PASST, Inspecciones, Planes de acción, Activos y Personas.

**B. Registrar una inspección** — la sede ya no se pregunta
```
Inspección de extintores · Sede: Planta Callao (automática)
Área: [ ▾ ]   Ubicación: [ ▾ ] (solo las de esa sede)   Equipo: [ ▾ ] (solo los de esa sede)
```
- Una sola sede: sale sola. Varias sedes: la **sede activa de la barra**; si está en «Todas» (solo administrador general), se pide elegir una antes de registrar.

**C. Usuarios de la empresa (administrador de sede o general)**
```
Usuarios                                  [ + Nueva cuenta ] [ Cargar lista ]
Nombre            Rol        Sedes                 Estado   Acciones
Pérez, Ana        Gestor     Callao, Lima          Activo   Editar · Cesar · Dar contraseña
Díaz, Luis        Usuario    Callao                Activo   Editar · Cesar · Dar contraseña
```
```
Nueva cuenta
 Rol:   (•) Gestor  ( ) Usuario                 ← sin «Administrador» para el administrador de sede
 Sedes: [x] Callao  [ ] Lima  (solo las de quien crea)
```
Administrador de sede: ve y gestiona solo las cuentas cuyas sedes están dentro de las suyas.

**D. Dueño de la plataforma — administradores de una empresa**
```
Administradores de «Empresa X»
 Rol: (•) Administrador general (todas las sedes)   ( ) Administrador de sede → sedes: [x] Callao [ ] Lima
```

**E. PASST**: el administrador general elige la sede en la barra (ya existe un programa por sede). El administrador de sede solo ve y aprueba los de sus sedes.

## 4. Tablas, roles y permisos que cambian

| Qué | Cambio |
|---|---|
| **Tabla nueva `vinculos_sedes`** | `vinculo_id`, `sede_id`, `empresa_id`. Una fila por cada sede de una cuenta. Gestor, usuario y administrador de sede deben tener al menos una. El administrador general no necesita filas (ve todas). |
| **Rol nuevo `admin_sede`** | En `roles` y `roles_permisos`. Permisos: casi los del administrador general (cuentas, personas, activos, inspecciones, planes de acción, PASST y su aprobación), **sin** `empresa.editar_*`, `plantillas.publicar`, `listas.editar` ni nada que sea de toda la empresa. |
| **`roles_asignables`** | Se agrega `admin_sede → gestor` y `admin_sede → usuario`. **No** se agrega nada que permita crear administradores (ni al administrador general: solo el dueño). |
| **Funciones de ayuda nuevas** | `app.mis_sedes()` (las sedes de mi cuenta; vacío = todas si soy administrador general o dueño) y `app.puedo_en_sede(empresa, sede, permiso)`. Reemplazan en las reglas a `puedo_en_empresa` donde el dato tiene sede. |
| **Políticas de lectura** | Se agrega «y su sede está en mis sedes» a: `activos`, `ubicaciones`, `inspecciones` (y por herencia `archivos`, `firmas`), `hallazgos` (y su historial), `passt_programas` (y por herencia `passt_nodos`, `passt_semanas`, `passt_metas`, `passt_historial`). |
| **Funciones de escritura (RPC)** | Se valida la sede en: `guardar_activo`, `guardar_ubicacion`, `dar_baja_activo`, `reactivar_activo`, `grabar_inspeccion` (la sede sale de la cuenta: se ignora la que mande el equipo), `corregir_inspeccion`, `anular_inspeccion`, `gestionar_hallazgo`, `cerrar_hallazgo`, `reabrir_hallazgo`, `hallazgo_en_proceso`, `crear_programa`, `duplicar_programa`, `guardar_programa`, `aprobar_programa`, `guardar_nodo`, `mover_nodo`, `baja_nodo`, `programar_semana`, `marcar_semana`, `guardar_metas`, `avance_periodo`. |
| **Cuentas** | `puedo_crear_cuenta`, `puedo_dar_contrasena`, `cesar_vinculo`, `reactivar_vinculo`, `actualizar_persona`, `grabar_carga` y las funciones del servidor `crear-cuenta`, `carga-personal` y `dar-contrasena`: se limitan a roles asignables **y** sedes dentro de las del que actúa. |

## 5. Qué pasa con cada cosa

| Tema | Regla |
|---|---|
| **Personas y vínculos** | `personas` sigue siendo una persona única. Un administrador de sede ve y gestiona solo las cuentas que comparten al menos una sede con él. No ve a los administradores generales (solo sus nombres cuando se usan de responsables). El nombre de las personas de **mis sedes** sale en las listas de responsables y firmantes. |
| **Activos** | Cada activo pertenece a una sede (ya es así). Solo se ven y se editan los de mis sedes. |
| **Ubicaciones** | Igual: pertenecen a una sede; solo las de mis sedes. |
| **Áreas (unidades) y puestos** | Siguen siendo **de toda la empresa** (no tienen sede). Todos los ven; solo el administrador general las edita. |
| **Formatos (plantillas)** | Siguen siendo **de toda la empresa**, un solo formato por formato base. Solo el administrador general los publica. (Los gestores siguen editándolos directo hasta la etapa 3.) |
| **Inspecciones** | La sede sale de la cuenta o de la sede activa (nunca se vuelve a elegir). Se ven las de mis sedes. Las firmas y fotos siguen a la inspección. Un firmante de otra sede **sigue** pudiendo ver la inspección que firma (ya es una regla). |
| **Planes de acción** | Nacen con la sede de la inspección. Se ven los de mis sedes; el responsable ve siempre los suyos. |
| **PASST** | Un programa por sede (ya existe). El administrador de sede aprueba y programa los de sus sedes. Los gestores siguen editando directamente. **Empresa con una sola sede:** aprueba el administrador general (no hace falta administrador de sede). El administrador general ve cualquier sede con el selector. El programa se **renueva** para el año nuevo duplicando el anterior; no hace falta crear uno desde cero. |
| **Datos que ya existen** | Se hace un relleno: todos los gestores y usuarios actuales reciben **todas** las sedes de su empresa (nadie pierde acceso) y los administradores actuales quedan como **administradores generales**. Después, el administrador puede acotar. |

## 6. Seguridad — el límite (lo pedido)
1. **Solo el dueño crea administradores** (general o de sede). El administrador de sede **nunca** crea, edita ni cesa administradores.
2. El administrador de sede crea y cesa **solo gestores y usuarios**, y solo con sedes que ya son suyas.
3. **No puede darse permisos extra:** no puede editar su propia cuenta (rol ni sedes), no existe pantalla para cambiar permisos de un rol (solo migraciones del dueño) y la función `actualizar_persona` rechaza cambios sobre sí mismo y sobre cualquier administrador.
4. No puede agregar a nadie a una sede que no es suya, ni quitarle sedes a una persona que tiene sedes fuera de las suyas (solo las suyas).
5. No puede dar contraseña a un administrador ni a una persona con sedes fuera de las suyas.
6. Siempre queda al menos un administrador general activo (regla que ya existe: `hay_otro_admin_activo`).
7. Todo cambio de rol o sede queda en el historial de vínculos (ya existe `vinculos_historial`).
8. La sede **no se confía al equipo**: el servidor la vuelve a calcular al recibir una inspección.

## 7. Usuario gestor (propuesta)
**Recomiendo dejarlo para la etapa 2.** Su definición real es «el administrador marca a qué facultades accede cada persona», y eso necesita permisos por persona (tabla nueva), que es exactamente la etapa 2. Hacer ahora un rol fijo obligaría a rehacerlo.
Opción simple si lo quieres ya: rol `usuario_gestor` = usuario + puede registrar inspecciones y ver las de sus sedes (sin editar PASST ni formatos). Cuesta ~0,5 día más y se reemplaza en la etapa 2. **Mi voto: etapa 2.**

## 8. Pruebas
- **Nueva: separación entre dos sedes de la misma empresa** (`pruebas/separacion-sedes.mjs`). Empresa A con sede 1 y sede 2; cuentas: administrador general, administrador de sede 1, gestor de la sede 2, usuario de la sede 1, gestor con las dos sedes. Se comprueba, para activos, ubicaciones, inspecciones (con fotos y firmas), planes de acción, PASST, personas y vínculos, que:
  - el administrador de sede 1 **no ve** ni **cambia** nada de la sede 2 (lectura y cada función de escritura rechazada);
  - no puede crear administradores, ni gestores de la sede 2, ni darse sedes, ni darse permisos, ni cesar o dar contraseña a un administrador o a alguien de la sede 2;
  - el administrador general ve las dos sedes; el gestor con dos sedes ve las dos;
  - una inspección mandada con la sede equivocada se corrige o se rechaza.
- **Se repiten** las pruebas de separación entre empresas (`separacion.mjs`, `empresas.mjs`, `usuarios.mjs`, `formatos.mjs`, `inspecciones.mjs`, `hallazgos.mjs`, `passt*.mjs`) y todo el conjunto de pruebas actual, más ajustes a las que asumen una cuenta sin sedes.

## 9. Estimación honesta (tiempo de trabajo efectivo mío, no calendario)
| Parte | Estimación | Notas |
|---|---|---|
| Programación de la base de datos (tabla, rol, funciones, políticas, ~25 RPC, relleno, 3 funciones del servidor) | 1,5 a 2 días | Es lo más delicado: cada RPC se revisa a mano. |
| Programación de pantallas (selector de sede, usuarios y alta con sedes, sede automática al registrar, filtros) | 1 a 1,5 días | |
| Pruebas de separación por sede (nueva) + ajustar y repetir todo el conjunto actual | 1 a 1,5 días | Si muchas pruebas actuales asumen una cuenta sin sedes, pueden sumar 0,5 día. |
| Correcciones tras tu revisión | 0,5 a 1 día | |
| **Total mío** | **4 a 6 días hábiles** | Apostaría por ~5. No incluye esperas. |
| **Lo que depende de ti** | aprobar este diseño (~1 h); probar una demo con dos sedes (~2 h, probablemente dos rondas); aprobación general; que **Cowork verifique los cambios en Supabase** (~medio día, ya incluido en los pasos de la ronda). | La calendarización real es de **1 a 1,5 semanas** si respondes el mismo día. |

El mayor riesgo de tiempo: pantallas o consultas que hoy suponen «todas las sedes de la empresa» y no las veo hasta probar con dos sedes. Por eso la prueba nueva se escribe **antes** del código.

## 10. Orden de construcción propuesto
1. Prueba nueva de separación por sede (primero falla, para ver todo lo que hay que cerrar).
2. Migración: tabla, rol, funciones de ayuda, relleno.
3. Políticas y funciones de escritura, de a una tabla.
4. Funciones del servidor de cuentas.
5. Pantallas.
6. Todas las pruebas. Demo con dos sedes para ti. Aprobación general. Publicación solo con tu ok.

## 11. Decisiones que necesito de ti (con valor por defecto)
1. ¿Solo el dueño crea también al **administrador de sede**? (por defecto sí, como los administradores de hoy)
2. ¿El administrador general también puede **ver a los administradores de sede** y cesarlos? (por defecto: verlos sí, cesarlos solo el dueño)
3. ¿Aprobar el diseño así, con el «usuario gestor» en la etapa 2?

---

## 12. Diseño APROBADO el 02/11/2026 y cuatro puntos agregados por el dueño

El dueño aprobó el diseño con el usuario gestor en la etapa 2 y con las dos decisiones por defecto: **solo el dueño crea y cesa a los administradores de sede** (el administrador general los ve, no los cesa). Agregó cuatro puntos, que quedan en el diseño y en la prueba nueva:

### 12.1 Funciones de lectura que se saltan las reglas de las tablas
Estas funciones son del servidor (se ejecutan con permisos propios), así que las políticas de las tablas no las alcanzan: cada una pasa a **filtrar por sede**.

| Función | Cómo filtra |
|---|---|
| `avance_periodo` | Rechaza una sede que no es mía (el administrador general puede pedir cualquiera). |
| `passt_ejecucion`, `passt_hallazgos` | Rechazan un programa que no es de mis sedes; un programa general solo lo ve el administrador general. |
| `passt_responsables` | Devuelve administradores generales y gestores o administradores de sede que comparten una sede conmigo. |
| `passt_trabajadores`, `numero_trabajadores` | En modo automático cuenta solo a las personas de mis sedes (el administrador general, todas). En modo manual devuelve el número manual de la empresa (una sola cifra por empresa: pasa a ser por sede cuando haya datos por sede). |
| `personas_de_mi_empresa` | Solo personas de mis sedes (más los administradores generales, solo nombre, para elegirlos de responsables). |
| `uso_almacenamiento` | `usado` suma solo fotos y firmas de las inspecciones de mis sedes; el tope sigue siendo el de la empresa. |
| Revisión de las demás | Se revisaron todas las funciones de lectura del servidor: las que faltaban son `puedo_ver_inspeccion`, `puedo_ver_hallazgo`, `puedo_ver_evidencia` y `puedo_subir_evidencia` (ver 12.2). Las funciones de escritura quedan cubiertas por un **guardia de sede en las tablas** (activos, ubicaciones, inspecciones, planes de acción, programas del PASST) además de la revisión en cada función. |

### 12.2 Fotos y firmas
- `puedo_ver_evidencia` hoy deja ver una foto si se puede ver la inspección, el plan de acción o la actividad del PASST a la que pertenece. **No mira la sede.** Se corrige por el camino correcto: `puedo_ver_inspeccion`, `puedo_ver_hallazgo` y la rama del PASST pasan a exigir la sede. Con eso, las fotos y firmas siguen a su inspección.
- Una persona que **firma** una inspección de otra sede sigue pudiendo verla y ver su foto y su firma (regla que ya existe).
- `puedo_subir_evidencia` también exige la sede para fotos de cierre de planes de acción y de actividades del PASST.
- **Prueba nueva:** un administrador de sede 1 intenta abrir (descargar) una foto de la sede 2 y recibe error; el administrador de la sede 2, el administrador general y el firmante sí la abren.

### 12.3 Programa general del PASST
- Programa **general** = sin sede (para todas las sedes). En una empresa con **más de una sede activa**, solo lo edita y aprueba el **administrador general**; los gestores y los administradores de sede no lo cambian.
- Programa **de una sede**: lo edita el gestor de esa sede; lo aprueba (y lo cambia una vez aprobado) el administrador de esa sede o el general.
- Empresa con **una sola sede activa**: el programa sin sede cuenta como el de esa sede; aprueba y reprograma el administrador general.

### 12.4 Cuentas sin sede y envíos pendientes
- Una cuenta **nueva** no puede quedar sin sedes, salvo el administrador general. Una regla de la base de datos lo exige al grabar (aunque se intente por otro camino). En una empresa con una sola sede, la cuenta recibe esa sede sola.
- Una cuenta no puede perder su **última** sede mientras no sea administrador general.
- Si a una persona le quitan una sede mientras tiene inspecciones guardadas sin señal de esa sede, el servidor las **rechaza** con un mensaje claro («Ya no tienes acceso a esa sede») y **quedan en su equipo** como rechazadas, que se pueden corregir o descartar: es el mismo camino que con una persona cesada.
