# Prueba sin señal en el navegador (tarea 3.4-C)

Fecha: 27/10/2026 · App: versión 0.6.0 compilada (`npm run preview`, http://localhost:4173) · Cuenta: GESTOR_A (ficticia) · Empresa A (ficticia) · Base: crc-dev

La señal se cortó dentro del navegador: toda llamada a internet fallaba y el equipo se marcaba «sin conexión».

| Paso | Resultado |
|---|---|
| Al ingresar con señal, la app baja sola los datos para trabajar sin señal | ✅ 5 formatos y 10 activos en el equipo |
| Sin señal: «Recibidas» muestra «Se ven con señal» | ✅ |
| Sin señal: nueva inspección de extintor (EXT-INS-ac8f25), todo √ y una X en un punto crítico | ✅ resultado en vivo «No conforme», 1 hallazgo |
| Sin señal: firma del inspector en el recuadro | ✅ «Firmaste» |
| Sin señal: cerrar la inspección | ✅ pasa a la cola «Por enviar», con su firma, guardada en la memoria del equipo; aviso «Sin señal: 1 inspección espera para enviarse» |
| Cerrar y volver a abrir la app (vuelve la señal) | ✅ se envía sola: «N.º 7 · Enviada» |
| En la base de datos | ✅ una sola fila, N.º 7, «No conforme» recalculado en el servidor, firma «firmada» (17 KB en el almacén), sin avisos |
| Reenvío forzado (como si se perdiera la respuesta) y volver a abrir | ✅ sigue siendo una sola inspección (el servidor responde «ya recibida») |
| Detalle de la inspección | ✅ respuestas, hallazgo, firma y datos; sin errores en la consola |

No se probó con foto en el navegador: el formato de extintores no pide foto en ese punto. La subida de fotos se prueba en `pruebas/inspecciones.mjs` y usa el mismo camino que la firma.
