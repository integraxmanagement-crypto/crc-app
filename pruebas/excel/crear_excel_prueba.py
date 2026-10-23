# Crea los Excel de prueba de la carga de personal (tarea 3.6, paso 7). Solo datos FICTICIOS.
# Uso (desde la carpeta del proyecto): python pruebas/excel/crear_excel_prueba.py
# Las filas apuntan a la empresa ficticia A (RUC 20000000010) y a sus listas de prueba.
# Lo que se espera de cada fila está en pruebas/carga-excel.mjs.
from datetime import date

from openpyxl import Workbook

TITULOS = ['tipo_documento', 'numero_documento', 'apellidos_y_nombres', 'fecha_ingreso', 'puesto',
           'gerencia', 'area', 'subarea_o_linea', 'rol']
G = 'General (ficticia)'

# (tipo, número, nombres, fecha, puesto, gerencia, área, subárea, rol) — una tupla por fila, desde la fila 2.
FILAS = [
    ('DNI', '72000001', 'Prueba Excel, Ana Uno', date(2023, 4, 3), 'Operaria', G, 'Planta', '', 'usuario'),        # 2 nueva (fecha de Excel)
    ('DNI', 72000002, 'Prueba Excel, Beto Dos', date(2022, 1, 10), 'Operaria', G, 'Planta', '', 'usuario'),        # 3 nueva (número guardado como número)
    ('DNI', 2000003, 'Prueba Excel, Carla Tres', date(2022, 1, 10), 'Operaria', G, 'Planta', '', 'usuario'),       # 4 error: Excel le quitó el 0
    ('CE', 'CE720004', 'Prueba Excel, Dina Cuatro', date(2021, 6, 1), 'Almacenera', G, 'Logística', '', 'usuario'), # 5 nueva (carnet de extranjería)
    ('PAS', 'PA720005', 'Prueba Excel, Eloy Cinco', date(2021, 6, 1), 'Almacenera', G, 'Logística', '', 'usuario'), # 6 nueva (pasaporte)
    ('dni', '72.000.006', 'Prueba Excel, Fide Seis', date(2020, 2, 2), 'Operaria', G, 'Operaciones', '', 'usuario'),# 7 nueva (minúsculas y puntos)
    ('DNI', '72000007', 'Prueba Excel, Gina Siete', '15/03/2021', 'Operaria', G, 'Planta', '', 'usuario'),          # 8 nueva (fecha escrita a mano)
    ('DNI', '72000008', 'Prueba Excel, Hugo Ocho', '31/02/2022', 'Operaria', G, 'Planta', '', 'usuario'),           # 9 error: fecha que no existe
    ('DNI', '72000009', 'Prueba Excel, Iris Nueve', date(2030, 1, 1), 'Operaria', G, 'Planta', '', 'usuario'),     # 10 error: fecha muy adelante
    ('DNI', '72000001', 'Prueba Excel, Ana Repetida', date(2023, 4, 3), 'Operaria', G, 'Planta', '', 'usuario'),   # 11 error: repite la fila 2
    ('DNI', '72000011', '', date(2023, 4, 3), 'Operaria', G, 'Planta', '', 'usuario'),                             # 12 error: sin nombre
    ('DNI', '72000012', 'Prueba Excel, Kike Doce', date(2023, 4, 3), 'Jefa de SSO', G, 'Seguridad', '', 'administrador'), # 13 error: rol administrador
    ('DNI', '72000013', 'Prueba Excel, Lola Trece', date(2023, 4, 3), 'Operaria', G, 'Planta', '', 'jefe'),        # 14 error: rol desconocido
    ('DNI', '72000014', 'Prueba Excel, Memo Catorce', date(2023, 4, 3), 'Piloto de submarino', G, 'Planta', '', 'usuario'), # 15 falta el puesto
    ('DNI', '72000015', 'Prueba Excel, Nora Quince', date(2023, 4, 3), 'Operaria', G, 'Área fantasma', '', 'usuario'), # 16 falta el área
    ('DNI', '72000016', 'Prueba Excel, Omar Dieciséis', date(2023, 4, 3), 'Operaria', G, 'Planta', 'Planta', 'usuario'), # 17 nueva (subárea = área)
    ('DNI', '72000017', 'Prueba Excel, Pía Diecisiete', date(2023, 4, 3), 'Operaria', G, 'Planta', 'Línea Z', 'usuario'), # 18 falta la subárea
    ('DNI', '72000018', 'Prueba Excel, Quique Dieciocho', date(2023, 4, 3), 'Operaria', '', 'Planta', '', 'usuario'), # 19 error: sin gerencia
    ('RUC', '20000000010', 'Prueba Excel, Rita Diecinueve', date(2023, 4, 3), 'Operaria', G, 'Planta', '', 'usuario'), # 20 error: tipo no válido
    ('DNI', '20000006', 'PRUEBA ADMIN A2 (ficticio)', date(2023, 4, 3), 'Jefa de SSO', G, 'Seguridad', '', 'gestor'), # 21 administrador: no se toca
    ('DNI', '20000007', 'PRUEBA USUARIO A3 (ficticio)', date(2023, 4, 3), 'Operaria', G, 'Planta', '', 'usuario'),   # 22 ya existe en A
    ('DNI', '30000002', 'PRUEBA GESTOR B (ficticio)', date(2023, 4, 3), 'Operaria', G, 'Planta', '', 'usuario'),     # 23 error: activo en otra empresa
    ('PAS', 'CE300003', 'Prueba Excel, Tipo Cruzado', date(2023, 4, 3), 'Operaria', G, 'Planta', '', 'usuario'),     # 24 error: ese número ya existe como CE
    ('DNI', '72000024', '  Prueba   Excel,  Uli Veinticuatro ', date(2023, 4, 3), '  operaria ', G, 'planta', '', 'Usuario'), # 25 nueva (espacios y mayúsculas)
    ('DNI', '72000025', 'Prueba Excel, Vero Veinticinco', date(2019, 9, 9), 'Supervisor SSO', G, 'Seguridad', '', 'gestor'), # 26 nueva (gestor)
]


def libro(filas, archivo):
    wb = Workbook()
    hoja = wb.active
    hoja.title = 'Personal'
    hoja.append(TITULOS)
    for f in filas:
        hoja.append(list(f))
    for celda in hoja['D'][1:]:
        if isinstance(celda.value, date):
            celda.number_format = 'DD/MM/YYYY'
    wb.save(archivo)


libro(FILAS, 'pruebas/excel/CRC_prueba_carga_25_filas_FICTICIO.xlsx')
# 301 personas: una más que el máximo por archivo (decisión 5A).
libro([('DNI', str(73000000 + i), f'Prueba Larga, Persona {i}', date(2023, 1, 1), 'Operaria', G, 'Planta', '', 'usuario')
       for i in range(301)], 'pruebas/excel/CRC_prueba_301_filas_FICTICIO.xlsx')
print('Listo: 2 archivos en pruebas/excel/')
