# Pruebas de la carga masiva de equipos

Fecha: 2026-10-30T03:47:25.816Z · Sin base de datos · **undefined de undefined correctas**

- ❌ La plantilla de extintores trae las columnas del tipo, con * en las obligatorias — Código * | Área * | Ubicación * | Responsable * | Número de serie * | Tipo de agente * | Capacidad * | Unidad de capacidad * | Año de fabricación * | Año de la última prueba hidrostática * | Último mantenimiento (mes y año) * | Próximo mantenimiento (mes y año) | Tipo de soporte
- ❌ Los dos años son obligatorios en extintores — Código * | Área * | Ubicación * | Responsable * | Número de serie * | Tipo de agente * | Capacidad * | Unidad de capacidad * | Año de fabricación * | Año de la última prueba hidrostática * | Último mantenimiento (mes y año) * | Próximo mantenimiento (mes y año) | Tipo de soporte
- ❌ Con varias sedes, la plantilla pide la sede; el DACI pide el subtipo — Código | Sede | Subtipo | Área | Ubicación | Responsable | Modelo | Zona o lazo
- ❌ En DACI el área, la ubicación y el responsable son opcionales
- ❌ Dos extintores correctos: sin errores y listos — []
- ❌ Resuelve área, ubicación y responsable a sus identificadores — {"tipo_id":"t-ext","codigo":"P1-010","subtipo":null,"sede_id":"s1","unidad_id":"u1","ubicacion_id":"b1","responsable_id":"p1","datos":{"numero_serie":"SN-P1-010","agente":"PQS","capacidad":6,"capacidad_unidad":"kg","anio_fabricacion":2020,"anio_prueba_hidrostatica":2023,"ultimo_mantenimiento":"2026-03","proximo_mantenimiento":"2027-03"},"dotacion":{}}
- ❌ El próximo mantenimiento se calcula solo (+12 meses) y el mes se normaliza — {"numero_serie":"SN-P1-010","agente":"PQS","capacidad":6,"capacidad_unidad":"kg","anio_fabricacion":2020,"anio_prueba_hidrostatica":2023,"ultimo_mantenimiento":"2026-03","proximo_mantenimiento":"2027-03"}
- ❌ El agente se reconoce aunque se escriba «co2» (queda «CO₂») y el mes puede venir como fecha de Excel — {"numero_serie":"SN-P1-011","agente":"CO₂","capacidad":6,"capacidad_unidad":"kg","anio_fabricacion":2020,"anio_prueba_hidrostatica":2023,"ultimo_mantenimiento":"2026-03","proximo_mantenimiento":"2027-03"}
- ❌ Hay errores y no hay filas listas mezcladas con ellos en la revisión de errores — [{"fila":2,"mensaje":"falta el área"},{"fila":3,"mensaje":"«Tipo de agente»: «Polvo mágico» no está en la lista (PQS, CO₂, Agua)"},{"fila":4,"mensaje":"«Año de fabricación» debe ser un año de 4 cifras (por ejemplo 2021)"},{"fila":5,"mensaje":"el responsable «Nadie Existe» no es una persona activa de la empresa"},{"fila":6,"mensaje":"ya existe un equipo con el código «P1-001»"},{"fila":8,"mensaje":"el código «P1-024» está repetido (también en la fila 7)"},{"fila":9,"mensaje":"la ubicación «Techo» no existe en la sede Sede principal"},{"fila":10,"mensaje":"«Capacidad» debe ser un número (por ejemplo 6 o 2.5)"},{"fila":11,"mensaje":"falta «Año de la última prueba hidrostática»"},{"fila":12,"mensaje":"falta el código"}]
- ❌ Área vacía: «falta el área» — falta el área
- ❌ Agente fuera de la lista: dice cuáles hay — «Tipo de agente»: «Polvo mágico» no está en la lista (PQS, CO₂, Agua)
- ❌ Año fuera de rango — «Año de fabricación» debe ser un año de 4 cifras (por ejemplo 2021)
- ❌ Responsable que no existe — el responsable «Nadie Existe» no es una persona activa de la empresa
- ❌ Código que ya existe en la empresa — ya existe un equipo con el código «P1-001»
- ❌ Código repetido en el mismo Excel (avisa la fila de la primera vez) — el código «P1-024» está repetido (también en la fila 7)
- ❌ Ubicación que no existe — la ubicación «Techo» no existe en la sede Sede principal
- ❌ Capacidad que no es número — «Capacidad» debe ser un número (por ejemplo 6 o 2.5)
- ❌ Falta el año de la prueba hidrostática (obligatorio en extintores) — falta «Año de la última prueba hidrostática»
- ❌ Fila sin código: «falta el código» — falta el código
- ❌ DACI: panel con modelo y detector sin modelo están bien — [{"fila":4,"mensaje":"falta «Modelo»"},{"fila":5,"mensaje":"la sede «Sede sur» no existe (sedes: Sede principal, Sede norte)"},{"fila":6,"mensaje":"el subtipo «Cámara» no es válido (Panel de control, Pulsador (estación manual), Detector, Sirena o luz estroboscópica)"}]
- ❌ DACI: el modelo solo es obligatorio en el panel — falta «Modelo»
- ❌ DACI: sede o subtipo que no existen — [[4,"falta «Modelo»"],[5,"la sede «Sede sur» no existe (sedes: Sede principal, Sede norte)"],[6,"el subtipo «Cámara» no es válido (Panel de control, Pulsador (estación manual), Detector, Sirena o luz estroboscópica)"]]
- ❌ Si falta una columna obligatoria en el Excel, lo dice y manda a usar la plantilla — Faltan columnas obligatorias en el Excel: Área. Usa la plantilla de CRC.
- ❌ Un Excel sin equipos se avisa — El Excel no tiene equipos: llena al menos una fila debajo de los títulos.
