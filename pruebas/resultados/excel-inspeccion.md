# Pruebas del Excel de la organización (tarea 3.4-C)

Fecha: 2026-10-28T14:31:32.365Z · Datos: FICTICIOS, sin base de datos · **undefined de undefined correctas**

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

## Excel por período: una fila por equipo

- ❌ 3 equipos caben en las filas dibujadas: no se agregan filas — {"filas":3,"usadasDelFormato":3,"agregadas":0,"hoja":"sheet1.xml"}
- ❌ Fila 1: ítem, código, resultado y fecha — ["1","EXT-001","No conforme","20/10/2026",null]
- ❌ Fila 2: la observación del punto — ["2","EXT-002","No conforme","20/10/2026","Sin manómetro (ficticio)"]
- ❌ Equipo sin inspección: «No inspeccionado» — ["3","EXT-003","No inspeccionado",null,null]
- ❌ Encabezado: período y avance — [["Empresa Ficticia A S.A.C. · Inspección de extintores",null,null,"Período: Octubre 2026"],["Sede: Sede ficticia",null,null,"Avance: 2 de 3 (67 %)"]]
- ❌ El pie de firmas no se mueve
- ❌ No queda ninguna marca
- ❌ La fila 3 recibe la celda combinada de la fila modelo
- ❌ Las filas mantienen su estilo (bordes)
- ❌ 6 equipos: usa las 4 filas del formato y agrega 2 — {"filas":6,"usadasDelFormato":4,"agregadas":2,"hoja":"sheet1.xml"}
- ❌ Las 6 filas en orden, la 6.ª en la fila 10 — [["5","EXT-005","No conforme","20/10/2026",null],["6","EXT-006","No inspeccionado",null,null]]
- ❌ El pie de firmas baja 2 filas (de la 10 a la 12) — [["Firma del inspector: ________"],["Nota al pie"]]
- ❌ La celda combinada del pie baja con él
- ❌ Las filas nuevas reciben la celda combinada de la fila modelo
- ❌ La imagen del pie baja con él; la del encabezado no — <?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"><xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:row>0</xdr:row></xdr:from><xdr:to><xdr:col>1</xdr:col><xdr:row>1</xdr:row></xdr:to></xdr:twoCellAnchor><xdr:twoCellAnchor><xdr:from><xdr:col>3</xdr:col><xdr:row>11</xdr:row></xdr:from><xdr:to><xdr:col>4</xdr:col><xdr:row>12</xdr:row></xdr:to></xdr:twoCellAnchor></xdr:wsDr>
- ❌ El área de impresión se agranda
- ❌ El tamaño de la hoja se actualiza
- ❌ Las filas nuevas copian la altura de la fila modelo — <row r="10" ht="18" customHeight="1">
- ❌ Sin equipos: la fila modelo queda en blanco y sin marcas — [null,null,null,null,null]
- ❌ Un Excel sin fila modelo solo llena las marcas generales
