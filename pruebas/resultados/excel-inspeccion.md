# Pruebas del Excel de la organización (tarea 3.4-C)

Fecha: 2026-10-27T19:19:20.750Z · Datos: FICTICIOS, sin base de datos · **undefined de undefined correctas**

Ejemplo ficticio generado: `pruebas/excel/CRC_formato_extintores_FICTICIO_v01.xlsx` (diseño inventado; no copia formatos reales).

## Marcas del Excel

- ❌ Encuentra las marcas de los textos compartidos
- ❌ Encuentra la marca escrita directo en la celda
- ❌ Encuentra la marca partida en dos tramos de formato
- ❌ Cuenta todas las marcas sin repetir — 73
- ❌ Reconoce todas las marcas de este formato
- ❌ Avisa las marcas que no existen

## Valores de una inspección

- ❌ Datos de la empresa y del formato
- ❌ Fecha en día/mes/año y número de inspección
- ❌ Respuesta √ / X / N/A
- ❌ «X» solo en la columna que toca
- ❌ Observación del punto
- ❌ Dato del activo (mes como mes/año)
- ❌ Firmante: nombre y cargo; la fecha queda en blanco (se firma a mano)
- ❌ Segundo firmante que no existe: en blanco
- ❌ Marca desconocida: sin valor
- ❌ Puntaje con %
- ❌ Fila 1 de un bloque repetible
- ❌ Persona de la fila: su nombre, no su código
- ❌ Fila que no existe: en blanco

## Copia llena del Excel

- ❌ No queda ninguna marca {{…}}
- ❌ Los textos especiales quedan bien escritos (& < >)
- ❌ La marca partida en dos tramos también se llena
- ❌ La marca escrita en la celda se llena
- ❌ La «imagen» del archivo no cambia
- ❌ Los estilos (bordes) no cambian
- ❌ Las celdas que no son marcas no cambian
- ❌ Están todas las partes del archivo
- ❌ Se vuelve a abrir como Excel: encabezado — ["Empresa Ficticia A S.A.C.","RUC: 20000000010","Código: FIC-EXT-01 · Versión: 02"]
- ❌ Se vuelve a abrir como Excel: fila del punto con «X» en «No» — ["EXT-03","","X","","Manómetro en zona roja"]
- ❌ Se vuelve a abrir como Excel: firmante — ["Inspector: Prueba Ficticia, Ana","Cargo: Supervisora SSO (ficticio)","Firma: ____________","Fecha: "]

## Archivos no válidos

- ❌ Rechaza un archivo que no es Excel
- ❌ Rechaza un ZIP sin libro de Excel
- ❌ Rechaza un Excel con macros (trae vbaProject.bin)
- ❌ Rechaza un libro que se declara «con macros» (.xlsm renombrado)
- ❌ Acepta un .xlsx normal sin macros
