# Demo de dos sedes: pasos para probar (datos ficticios, solo crc-dev)

Empresa **DEMO · Constructora Dos Sedes S.A.C.** (RUC 20000000061) con **Sede Norte** y **Sede Sur**.
Tiene los **8 formatos** ya revisados (extintores, DACI, bombas contra incendio, motobomba, electrobomba, CAR, LOTO e IPF). Cada sede tiene equipos de cada formato, 1 o 2 inspecciones por formato (varias con plan de acción) y un programa anual de SST con los 8 formatos vinculados (con la frecuencia de cada formato). Además hay un programa general.
Se crea con `node pruebas/demo-dos-sedes.mjs` y después `node pruebas/demo-dos-sedes-formatos.mjs` (ambos se pueden repetir sin duplicar).
La empresa A (la de los datos de siempre: 153 inspecciones, 231 activos, 106 formatos) no se tocó y sigue completa.

Las contraseñas están en el archivo local `.env.pruebas.local` (línea `NOMBRE_CLAVE`). No se escriben en ningún otro lugar.

## Cuentas (se entra con tipo DNI y el número)

| Cuenta | DNI | Rol | Sede |
|---|---|---|---|
| DEMO_GENERAL | 42000001 | Administrador general | las dos |
| DEMO_ADMSEDE_NORTE | 42000002 | Administrador de sede | Norte |
| DEMO_ADMSEDE_SUR | 42000003 | Administrador de sede | Sur |
| DEMO_GESTOR_NORTE | 42000004 | Gestor | Norte |
| DEMO_GESTOR_SUR | 42000005 | Gestor | Sur |
| DEMO_USUARIO_NORTE | 42000006 | Usuario | Norte |
| DEMO_USUARIO_SUR | 42000007 | Usuario | Sur |

## Cómo abrir la app
`npm run dev` y abrir la dirección que muestre (suele ser http://localhost:5173). Usa la versión nueva sin publicar, conectada a crc-dev.

## Pasos

1. **Administrador general (DEMO_GENERAL).**
   Debes ver: en la barra, un selector de sede (Norte / Sur / todas). Inspecciones, planes de acción, activos y personas de las dos sedes. Programas: el general y los dos de sede.
   Prueba: elige «Sede Sur» en el selector → solo debe quedar lo de la Sur.

2. **Administrador de la Sede Norte (DEMO_ADMSEDE_NORTE).**
   Debes ver: solo cosas de la Norte (2 activos, 2 inspecciones, 1 plan de acción, 4 personas). No hay selector (tiene una sola sede).
   NO debes ver: nada de la Sede Sur, ni a su gestor o usuario.
   En Programas puedes abrir el general, pero **no editarlo ni aprobarlo** (solo lo hace el administrador general). El de la Norte sí lo editas.
   En Usuarios: crea un gestor de prueba; la sede debe salir sola (Norte). No debe dejarte elegir la Sur.

3. **Administrador de la Sede Sur (DEMO_ADMSEDE_SUR).** Lo mismo que el paso 2 pero al revés: solo la Sur.

4. **Gestor de la Sede Norte (DEMO_GESTOR_NORTE).**
   Debes ver: lo de la Norte y el plan de acción que le toca (está «en proceso»).
   NO debes poder: crear cuentas de administrador. No debes ver nada de la Sur.
   Prueba: registrar una inspección de una motobomba de la Norte (la sede sale sola).

5. **Usuario de la Sede Norte (DEMO_USUARIO_NORTE).**
   Debes ver: las inspecciones donde es firmante (las 2 de la Norte).
   NO debes ver: planes de acción ajenos, personas, ni nada de la Sur.

6. **Lo mismo con los de la Sur** (gestor y usuario) para confirmar que no ven la Norte.

7. **Fotos y firmas.** Con el administrador de la Norte, abre una inspección de la Norte (se ven foto y firma). No debe haber manera de abrir las de la Sur.

8. **Dueño de la plataforma** (tu cuenta de dueño de prueba): en la empresa DEMO, crea un administrador de sede y asígnale solo una sede. Debe ser imposible dejar a un administrador de sede sin sede.

## Qué cuenta como falla
Cualquier dato, botón o número de la otra sede que aparezca en pantalla. Anota la cuenta, la pantalla y qué viste, y me avisas.

## Para repetir o limpiar
`node pruebas/demo-dos-sedes.mjs` no duplica nada si la demo ya existe.
