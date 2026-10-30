// Contenido base de CRC (tarea 3.4-B): las 6 plantillas, los 4 tipos de activo y las listas editables.
// Textos tomados del «Anexo del encargo 3.4 · Textos base de las 6 plantillas» (Cowork, v01, 26/10/2026),
// redactados desde cero para CRC. No hay personas, empresas, áreas ni ubicaciones: cada empresa copia y adapta.
// Los plazos de vencimiento que no da el anexo quedan vacíos (decisión del dueño, 26/10/2026): solo el próximo
// mantenimiento del extintor se calcula (+12 meses). Este archivo genera la migración de semillas
// (herramientas/generar-formatos-base.mjs) y lo usan las pruebas del motor (pruebas/motor.mjs).
import type { Firma, Punto, Receta, Seccion, TipoRespuesta } from './receta.ts'

// ───── Listas base (editables por cada empresa) ─────
export type ListaBase = { codigo: string; nombre: string; valores: string[] }
export const LISTAS_BASE: ListaBase[] = [
  { codigo: 'agentes_extintores', nombre: 'Agentes extintores', valores: ['PQS', 'CO₂', 'Agua', 'Espuma', 'Acetato de potasio', 'Agente limpio'] },
  { codigo: 'unidades_capacidad', nombre: 'Unidades de capacidad', valores: ['kg', 'lb', 'L'] },
  { codigo: 'tipos_soporte', nombre: 'Tipos de soporte', valores: ['Pared', 'Pedestal', 'Rodante', 'Gabinete', 'Vehículo'] },
  { codigo: 'tipos_bloqueo', nombre: 'Tipos de bloqueo (LOTO)', valores: ['Individual', 'Grupal'] },
]

// ───── Tipos de activo base ─────
export type TipoCampo = 'texto' | 'texto_largo' | 'numero' | 'anio' | 'mes' | 'lista'
export type CampoFicha = {
  clave: string
  etiqueta: string
  tipo: TipoCampo
  obligatorio: boolean
  lista?: string | null
  calcula?: { desde: string; meses: number } | null // valor sugerido a partir de otro dato (editable)
  solo_subtipos?: string[] | null
}
export type Subtipo = { codigo: string; nombre: string }
export type TipoActivoBase = { codigo: string; nombre: string; subtipos: Subtipo[]; campos: CampoFicha[]; dotacion: boolean }

/** Datos de la ficha que tienen todos los activos (van en columnas propias, no en «campos»). */
export const CAMPOS_COMUNES = ['código', 'subtipo', 'sede', 'área', 'ubicación', 'responsable'] as const

/** Ficha de un tipo nuevo creado por la empresa (decisión del dueño, 26/10/2026). */
export const CAMPOS_TIPO_NUEVO: CampoFicha[] = [
  { clave: 'datos_tecnicos', etiqueta: 'Datos técnicos', tipo: 'texto_largo', obligatorio: false },
]

export const TIPOS_ACTIVO_BASE: TipoActivoBase[] = [
  {
    codigo: 'extintor',
    nombre: 'Extintor',
    subtipos: [],
    dotacion: false,
    campos: [
      { clave: 'numero_serie', etiqueta: 'Número de serie', tipo: 'texto', obligatorio: true },
      { clave: 'agente', etiqueta: 'Tipo de agente', tipo: 'lista', lista: 'agentes_extintores', obligatorio: true },
      { clave: 'capacidad', etiqueta: 'Capacidad', tipo: 'numero', obligatorio: true },
      { clave: 'capacidad_unidad', etiqueta: 'Unidad de capacidad', tipo: 'lista', lista: 'unidades_capacidad', obligatorio: true },
      { clave: 'anio_fabricacion', etiqueta: 'Año de fabricación', tipo: 'anio', obligatorio: false },
      { clave: 'anio_prueba_hidrostatica', etiqueta: 'Año de la última prueba hidrostática', tipo: 'anio', obligatorio: false },
      { clave: 'ultimo_mantenimiento', etiqueta: 'Último mantenimiento (mes y año)', tipo: 'mes', obligatorio: true },
      {
        clave: 'proximo_mantenimiento',
        etiqueta: 'Próximo mantenimiento (mes y año)',
        tipo: 'mes',
        obligatorio: true,
        calcula: { desde: 'ultimo_mantenimiento', meses: 12 },
      },
      { clave: 'tipo_soporte', etiqueta: 'Tipo de soporte', tipo: 'lista', lista: 'tipos_soporte', obligatorio: false },
    ],
  },
  { codigo: 'caseta', nombre: 'Caseta de ataque rápido (CAR)', subtipos: [], dotacion: true, campos: [] },
  // Una motobomba solo tiene código y ubicación (paquete MOTOBOMBA.md del dueño, 29/10/2026); la electrobomba tendrá su propio tipo.
  { codigo: 'motobomba', nombre: 'Motobomba (bomba diésel)', subtipos: [], dotacion: false, campos: [] },
  // Electrobomba (paquete ELECTROBOMBA.md del dueño): código, ubicación y dos fichas técnicas obligatorias, la principal y la jockey.
  {
    codigo: 'electrobomba',
    nombre: 'Electrobomba (bomba eléctrica)',
    subtipos: [],
    dotacion: false,
    campos: (['principal', 'jockey'] as const).flatMap((q) =>
      ([['marca', 'Marca'], ['potencia', 'Potencia'], ['caudal', 'Caudal'], ['presion_nominal', 'Presión nominal'], ['arranque_parada', 'Arranque / Parada'], ['alimentacion', 'Alimentación / Observación']] as const).map(
        ([c, e]): CampoFicha => ({ clave: `${q}_${c}`, etiqueta: `${q === 'principal' ? 'Principal' : 'Jockey'} · ${e}`, tipo: 'texto', obligatorio: true }),
      ),
    ),
  },
  {
    codigo: 'bomba',
    nombre: 'Bomba contra incendio',
    subtipos: [
      { codigo: 'electrobomba', nombre: 'Electrobomba' },
      { codigo: 'motobomba', nombre: 'Motobomba (diésel)' },
    ],
    dotacion: false,
    campos: [
      { clave: 'marca', etiqueta: 'Marca', tipo: 'texto', obligatorio: false },
      { clave: 'modelo', etiqueta: 'Modelo', tipo: 'texto', obligatorio: false },
      { clave: 'potencia', etiqueta: 'Potencia', tipo: 'texto', obligatorio: false },
      { clave: 'caudal', etiqueta: 'Caudal', tipo: 'texto', obligatorio: false },
      { clave: 'presion_nominal', etiqueta: 'Presión nominal', tipo: 'texto', obligatorio: false },
    ],
  },
  {
    codigo: 'dispositivo_alarma',
    nombre: 'Dispositivo de alarma (DACI)',
    subtipos: [
      { codigo: 'panel', nombre: 'Panel de control' },
      { codigo: 'pulsador', nombre: 'Pulsador (estación manual)' },
      { codigo: 'detector', nombre: 'Detector' },
      { codigo: 'sirena', nombre: 'Sirena o luz estroboscópica' },
    ],
    dotacion: false,
    campos: [
      { clave: 'modelo', etiqueta: 'Modelo', tipo: 'texto', obligatorio: true, solo_subtipos: ['panel'] },
      { clave: 'zona', etiqueta: 'Zona o lazo', tipo: 'texto', obligatorio: false },
    ],
  },
]

// ───── Ayudas para escribir los puntos ─────
type Marcas = Partial<Omit<Punto, 'clave' | 'texto'>>
const p = (clave: string, texto: string, m: Marcas = {}): Punto => ({
  clave,
  texto,
  tipo: 'cumple',
  obligatorio: true,
  critico: false,
  hallazgo: 'nunca',
  obs_si_no_cumple: false,
  foto_si_no_cumple: false,
  pide_accion: false,
  ...m,
})
/** C = crítico, H = genera hallazgo si no cumple (marcas del anexo). */
const pCH = (clave: string, texto: string, c: boolean, h: boolean, m: Marcas = {}) =>
  // Un punto crítico siempre genera hallazgo y pide acción correctiva, responsable y plazo (pedido del dueño, 30/10/2026).
  p(clave, texto, { critico: c, hallazgo: h || c ? 'no_cumple' : 'nunca', pide_accion: c, ...m })
const dato = (clave: string, texto: string, tipo: TipoRespuesta, m: Marcas = {}) => p(clave, texto, { tipo, ...m })
const sec = (clave: string, titulo: string, puntos: Punto[], m: Partial<Seccion> = {}): Seccion => ({ clave, titulo, puntos, ...m })
const INSPECTOR: Firma = { clave: 'inspector', titulo: 'Inspector', obligatoria: true, externo: false, minimo: 1 }
const recetaBase = (r: Partial<Receta> & Pick<Receta, 'secciones'>): Receta => ({
  version: 1,
  firmas: [INSPECTOR],
  reglas: [],
  resultado_defecto: null,
  puntaje: false,
  na_favorable: true,
  hallazgo_vencimiento: false,
  observacion_general: true,
  ...r,
})

export type Frecuencia = 'semanal' | 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual' | 'sin_frecuencia'
export type PlantillaBase = {
  codigo: string
  nombre: string
  descripcion: string
  aplica_a: 'activo' | 'area'
  tipo_activo: string | null
  frecuencia: Frecuencia
  receta: Receta
}

// ───── 1. Extintores ─────
// Según el paquete de replicación del dueño (SO.R.G.085, 29/10/2026): 16 puntos con √ / X / N/A, 6 críticos; es SEMANAL y por equipo;
// «No conforme» si hay un crítico en X, fabricación con más de 20 años, PH con más de 5, mantenimiento vencido u observaciones escritas.
const extintores: PlantillaBase = {
  codigo: 'extintores',
  nombre: 'Inspección de extintores portátiles',
  descripcion: '1 inspección = 1 extintor, cada semana. 16 puntos (√ / X / N/A, 6 críticos); controla fabricación, prueba hidrostática y mantenimiento. El registro de la semana (Excel o PDF) junta todos los extintores.',
  aplica_a: 'activo',
  tipo_activo: 'extintor',
  frecuencia: 'semanal',
  receta: recetaBase({
    firmas: [], // sin firmas en la inspección (pedido del dueño, 29/10/2026); el pie firmado va en el registro del período
    secciones: [
      sec('verificacion', 'Anomalías físicas y de instalación', [
        pCH('EXT-01', 'Ubicación', false, true, { valor_defecto: 'si' }),
        pCH('EXT-02', 'Acceso', false, true, { valor_defecto: 'si' }),
        pCH('EXT-03', 'Extintor numerado', false, false, { valor_defecto: 'si' }),
        pCH('EXT-04', 'Pictograma de clase de fuego', false, false, { valor_defecto: 'si' }),
        pCH('EXT-05', 'Pictograma de forma de uso', false, false, { valor_defecto: 'si' }),
        pCH('EXT-06', 'Etiqueta de recarga', false, true, { valor_defecto: 'si' }),
        pCH('EXT-07', 'Tipo de carga / # parte / concentración del agente', false, true, { valor_defecto: 'si' }),
        pCH('EXT-08', 'Posición colgado / pedestal', false, true, { valor_defecto: 'si' }),
        pCH('EXT-09', 'Pasador / precinto de seguridad', true, true, { pide_accion: true }),
        pCH('EXT-10', 'Manómetro de presión', true, true, { pide_accion: true }),
        pCH('EXT-11', 'Manija de acarreo / palanca de activación', true, true, { pide_accion: true }),
        pCH('EXT-12', 'Manguera', true, true, { pide_accion: true }),
        pCH('EXT-13', 'Tobera, pitón o pistola', true, true, { pide_accion: true }),
        pCH('EXT-14', 'Abrazadera o sujetador de manguera', false, true, { valor_defecto: 'si' }),
        pCH('EXT-15', 'Cilindro, botella, cartucho', true, true, { pide_accion: true }),
        pCH('EXT-16', 'Pintura de la botella', false, true, { valor_defecto: 'si' }),
      ]),
    ],
    reglas: [
      {
        tipo: 'vencido',
        etiqueta: 'No conforme: vencido',
        controles: [
          { campo: 'proximo_mantenimiento', tipo: 'fecha_limite' },
          { campo: 'anio_prueba_hidrostatica', tipo: 'anios', anios: 5 },
          { campo: 'anio_fabricacion', tipo: 'anios', anios: 20 },
        ],
      },
      { tipo: 'x_en', etiqueta: 'No conforme', alcance: 'criticos' },
      { tipo: 'observacion', etiqueta: 'No conforme: con observaciones' },
    ],
    resultado_defecto: 'Conforme',
    hallazgo_vencimiento: true,
  }),
}

// ───── 2. Caseta de ataque rápido (CAR) ─────
const material = (clave: string, texto: string) => pCH(clave, texto, false, true, { cantidad: null })
const car: PlantillaBase = {
  codigo: 'car',
  nombre: 'Inspección de caseta de ataque rápido (CAR)',
  descripcion: '1 inspección = 1 caseta. Revisa su condición y la dotación de materiales; X en un material = por reponer.',
  aplica_a: 'activo',
  tipo_activo: 'caseta',
  frecuencia: 'mensual',
  receta: recetaBase({
    secciones: [
      sec('condicion', 'Condición', [
        pCH('CAR-01', 'La señal informativa de la caseta es visible y legible', false, true),
        pCH('CAR-02', 'El acceso a la caseta está libre', true, true),
        pCH('CAR-03', 'La estructura, la puerta y el cierre están en buen estado', false, true),
        pCH('CAR-04', 'El interior está limpio y ordenado', false, false),
      ]),
      sec('materiales', 'Materiales (X = falta o está dañado: por reponer)', [
        material('CAR-M01', 'Mangueras contra incendio del diámetro que use la empresa (una fila por diámetro)'),
        material('CAR-M02', 'Boquillas o pitones regulables'),
        material('CAR-M03', 'Bifurcación o accesorio de reducción'),
        material('CAR-M04', 'Llaves para acoplamientos de manguera'),
        material('CAR-M05', 'Llave de hidrante o de válvula'),
        material('CAR-M06', 'Agente espumógeno y eductor (solo si la caseta lo requiere)'),
      ]),
    ],
    reglas: [
      { tipo: 'x_en', etiqueta: 'No conforme', alcance: 'criticos' },
      { tipo: 'x_en', etiqueta: 'No conforme', alcance: 'seccion', seccion: 'materiales' },
    ],
    resultado_defecto: 'Conforme',
  }),
}

// ───── 3. Bombas contra incendio ─────
const SN: Marcas = { tipo: 'si_no', obs_si_no_cumple: true }
// En las bombas, los puntos que generan hallazgo son los críticos: con No piden acción correctiva, responsable y plazo.
const sn = (clave: string, texto: string, h: boolean, m: Marcas = {}) => p(clave, texto, { ...SN, hallazgo: h ? 'no_cumple' : 'nunca', critico: h, pide_accion: h, ...m })
const lectura = (clave: string, texto: string, unidad: string, solo?: string[]) =>
  dato(clave, texto, 'numero', { unidad, hallazgo: 'fuera_rango', min: null, max: null, solo_subtipos: solo ?? null })
const bombas: PlantillaBase = {
  codigo: 'bombas',
  nombre: 'Inspección de bombas contra incendio',
  descripcion: '1 inspección = 1 bomba. El subtipo (electrobomba o motobomba) elige los puntos. Prueba de arranque con lecturas.',
  aplica_a: 'activo',
  tipo_activo: 'bomba',
  frecuencia: 'semanal',
  receta: recetaBase({
    secciones: [
      sec('antes', 'A. Antes de la prueba', [
        sn('BCI-A01', 'El acceso al cuarto de bombas está libre y señalizado', false),
        sn('BCI-A02', 'El cuarto está limpio, ordenado y sin materiales ajenos', false),
        sn('BCI-A03', 'No hay filtraciones, inundación ni agua acumulada', false),
        sn('BCI-A04', 'La iluminación del cuarto funciona', false),
        sn('BCI-A05', 'Las tuberías, soportes y uniones no tienen daños, fugas ni corrosión importante', false),
        sn('BCI-A06', 'Las válvulas están en la posición normal de operación', false),
        sn('BCI-A07', 'Los manómetros están en buen estado y se leen con claridad', false),
        sn('BCI-A08', 'La bomba no tiene fugas ni piezas sueltas', false),
        sn('BCI-A09', 'El selector de la bomba está en posición automática', false),
        sn('BCI-A10', 'El tablero o controlador está energizado, sin alarmas ni fallas activas', false),
        sn('BCI-E01', 'El motor, el acoplamiento y la guarda de protección están en buen estado', false, { solo_subtipos: ['electrobomba'] }),
        sn('BCI-M01', 'El nivel de aceite del motor es el correcto', false, { solo_subtipos: ['motobomba'] }),
        sn('BCI-M02', 'El nivel de refrigerante es el correcto y el precalentador funciona', false, { solo_subtipos: ['motobomba'] }),
        sn('BCI-M03', 'Hay combustible suficiente y la válvula del tanque está abierta', false, { solo_subtipos: ['motobomba'] }),
        sn('BCI-M04', 'Las baterías están cargadas y con bornes limpios', false, { solo_subtipos: ['motobomba'] }),
        sn('BCI-M05', 'No hay fugas de combustible, aceite o refrigerante', false, { solo_subtipos: ['motobomba'] }),
      ]),
      sec('durante', 'B. Durante la prueba', [
        sn('BCI-B01', 'La bomba arranca automáticamente al bajar la presión', true),
        sn('BCI-B02', 'El arranque es normal, sin demora ni comportamiento extraño', true),
        sn('BCI-B03', 'Funciona de forma estable durante la prueba', true),
        sn('BCI-B04', 'No hay ruidos anormales', true),
        sn('BCI-B05', 'No hay vibraciones anormales', true),
        sn('BCI-B06', 'No hay fugas en bomba, tuberías, válvulas ni accesorios', true),
        sn('BCI-B07', 'No hay sobrecalentamiento, humo ni olor anormal', true),
        sn('BCI-B08', 'La presión de descarga está dentro de lo esperado', true),
      ]),
      // Lecturas: el rango mínimo/máximo lo define la empresa; fuera de rango = hallazgo. Las unidades son editables.
      sec('lecturas', 'Lecturas de la prueba', [
        lectura('BCI-L01', 'Presión de arranque', 'psi'),
        lectura('BCI-L02', 'Presión de descarga', 'psi'),
        lectura('BCI-L03', 'Tiempo de funcionamiento', 'min'),
        lectura('BCI-L04', 'Temperatura del refrigerante', '°C', ['motobomba']),
        lectura('BCI-L05', 'Presión de aceite', 'psi', ['motobomba']),
        lectura('BCI-L06', 'Voltaje de baterías', 'V', ['motobomba']),
        lectura('BCI-L07', 'Corriente', 'A', ['electrobomba']),
      ]),
      sec('despues', 'C. Después de la prueba', [
        sn('BCI-C01', 'La parada de la bomba funciona', true),
        sn('BCI-C02', 'El sistema quedó restablecido en automático', true),
        sn('BCI-C03', 'El selector quedó en automático', true),
        sn('BCI-C04', 'Las válvulas quedaron en su posición normal', true),
        sn('BCI-C05', 'No quedaron fugas, alarmas ni condiciones anormales', true),
        sn('BCI-C06', 'El cuarto quedó limpio y con acceso libre', true),
      ]),
    ],
    // Por defecto sin resultado (solo Realizado/Pendiente); la empresa puede agregar «No conforme si hay un No».
    reglas: [],
    resultado_defecto: null,
  }),
}

// ───── 3b. Motobomba (bomba diésel) contra incendio ─────
// Según el paquete MOTOBOMBA.md del dueño (SO.R.G.075, 29/10/2026): 22 puntos Sí / No (16 antes y 6 durante la prueba), observación obligatoria
// si es No, 4 datos de la prueba funcional (con observaciones opcionales) y 2 firmas. Es SEMANAL y por bomba.
const zona = (z: string, t: string) => `[${z}] ${t}`
const motobomba: PlantillaBase = {
  codigo: 'motobomba',
  nombre: 'Inspección de motobomba',
  descripcion: '1 inspección = 1 motobomba, cada semana. 22 puntos Sí / No (16 antes y 6 durante la prueba) y 4 datos de la prueba funcional. Parte de «Inspección de bomba contra incendio».',
  aplica_a: 'activo',
  tipo_activo: 'motobomba',
  frecuencia: 'semanal',
  receta: recetaBase({
    firmas: [INSPECTOR, { clave: 'custodia', titulo: 'Responsable de la custodia del registro', obligatoria: true, externo: false, minimo: 1 }],
    secciones: [
      sec('antes', 'ANTES DE LA PRUEBA', [
        sn('MB-A01', zona('Motor', 'Nivel completo de aceite del motor'), false),
        sn('MB-A02', zona('Motor', 'Precalentador del refrigerante en funcionamiento'), false),
        sn('MB-A03', zona('Motor', 'Válvulas de refrigeración en posición abierta'), false),
        sn('MB-A04', zona('Tanque Combustible', 'Válvula de combustible en posición abierta'), false),
        sn('MB-A05', zona('Tanque Combustible', 'Nivel del tanque de combustible (Mayor a los 3/4 de la capacidad)'), false),
        sn('MB-A06', zona('Cisterna', 'Nivel de tanque de agua de la cisterna contra incendio se encuentra lleno'), false),
        sn('MB-A07', zona('Motor', 'Switches del tablero del motor Diesel en posición normal'), false),
        sn('MB-A08', zona('Tablero Principal', 'Selector del tablero de control principal se encuentre en AUTOMATICO'), false),
        sn('MB-A09', zona('Tablero Principal', 'Luces indicadoras de falla apagadas'), false),
        sn('MB-A10', zona('Bomba', 'Goteo normal de la prensaestopa de la bomba: aprox. 60 gotas por minuto'), false),
        sn('MB-A11', zona('Tablero Principal', 'Presion del sistema en el tablero de control (PSI) aprox. 150'), false),
        sn('MB-A12', zona('Motor', 'Voltajes de baterías del tablero del motor Diesel (Bat. 1; Bat. 2) aprox. 14 Voltios'), false),
        sn('MB-A13', zona('Tablero Principal', 'Voltajes de baterías del tablero principal (Bat. 1; Bat. 2) aprox. 14 Voltios'), false),
        sn('MB-A14', zona('Motor', 'Contómetro de horas del motor en funcionamiento'), false),
        sn('MB-A15', zona('Tablero Jockey', 'Selector de la bomba Jockey en automático'), false),
        sn('MB-A16', zona('Tablero Principal', 'Nivel de tanque de combustible (> a los 3/4 de capacidad)'), false),
      ]),
      sec('durante', 'DURANTE LA PRUEBA', [
        sn('MB-B01', zona('N.A.', 'Hay flujo de agua a través del circuito de refrigeración. Si no lo hay "APAGAR"'), true),
        sn('MB-B02', zona('N.A.', 'Funciona la presión en el tablero de control principal (PSI); Indicar PSI'), true),
        sn('MB-B03', zona('N.A.', 'Funciona el tacómetro del motor Diesel (RPM); Indicar RPM'), true),
        sn('MB-B04', zona('N.A.', 'Funciona el manómetro de presión de aceite del motor (PSI/Kpa)'), true),
        sn('MB-B05', zona('N.A.', 'Funciona el manómetro de la presión del circuito de refrigeración (PSI); Indicar PSI'), true),
        sn('MB-B06', zona('N.A.', 'Funciona el manómetro de temperatura del motor (°F/°C)'), true),
      ]),
      // Cada parámetro tiene su dato (obligatorio) y sus observaciones (opcionales), como en el Excel.
      sec('despues', 'DESPUÉS DE LA PRUEBA', [
        dato('MB-P01', 'Registrar la hora de finalización de la prueba', 'hora'),
        dato('MB-P01O', 'Observaciones de la hora de finalización', 'texto', { obligatorio: false }),
        dato('MB-P02', 'Registrar el número de horas de funcionamiento', 'texto'),
        dato('MB-P02O', 'Observaciones de las horas de funcionamiento', 'texto', { obligatorio: false }),
        dato('MB-P03', 'Registrar la presión del sistema en el tablero de control principal', 'texto'),
        dato('MB-P03O', 'Observaciones de la presión del sistema', 'texto', { obligatorio: false }),
        dato('MB-P04', 'Verificar la posición de los selectores de controladores principal y Jockey', 'texto'),
        dato('MB-P04O', 'Observaciones de la posición de los selectores', 'texto', { obligatorio: false }),
      ]),
    ],
    reglas: [{ tipo: 'x_en', etiqueta: 'No conforme', alcance: 'todos' }],
    resultado_defecto: 'Conforme',
  }),
}

// ───── 3c. Electrobomba contra incendio ─────
// Según el paquete ELECTROBOMBA.md del dueño (SO.R.G.054, 30/10/2026): 29 puntos Sí / No (13 antes, 9 durante y 7 después de la prueba), observación
// obligatoria si es No, prueba funcional con «Antes» y «Final» (presión y hora de inicio) y 2 firmas. Semanal y por bomba. Las fichas técnicas
// (principal y jockey) viven en la ficha del equipo.
const electrobomba: PlantillaBase = {
  codigo: 'electrobomba',
  nombre: 'Inspección de electrobomba',
  descripcion: '1 inspección = 1 electrobomba, cada semana. 29 puntos Sí / No (13 antes, 9 durante y 7 después de la prueba) y la prueba funcional (antes y final). Parte de «Inspección de bomba contra incendio».',
  aplica_a: 'activo',
  tipo_activo: 'electrobomba',
  frecuencia: 'semanal',
  receta: recetaBase({
    firmas: [INSPECTOR, { clave: 'custodia', titulo: 'Responsable de la custodia del registro', obligatoria: true, externo: false, minimo: 1 }],
    secciones: [
      sec('antes', 'ANTES DE LA PRUEBA', [
        sn('EB-A01', 'Acceso al cuarto de bombas libre, señalizado y sin obstrucciones.', false),
        sn('EB-A02', 'Cuarto de bombas limpio, ordenado y sin almacenamiento de materiales ajenos al sistema.', false),
        sn('EB-A03', 'No se evidencian filtraciones, inundación o acumulación de agua', false),
        sn('EB-A04', 'Iluminación del cuarto de bombas operativa', false),
        sn('EB-A05', 'Tuberías, accesorios, soportes y uniones sin daños visibles ni corrosión crítica.', false),
        sn('EB-A06', 'Válvulas asociadas a la bomba Jockey en posición normal de operación.', false),
        sn('EB-A07', 'Manómetro de la bomba principal en buen estado y con lectura legible', false),
        sn('EB-A08', 'Manómetro de la bomba Jockey en buen estado y con lectura legible.', false),
        sn('EB-A09', 'Electrobomba principal sin fugas, daños visibles o elementos sueltos.', false),
        sn('EB-A10', 'Motor eléctrico, acoplamiento y guarda de protección en buen estado', false),
        sn('EB-A11', 'Tablero/controlador de la electrobomba principal energizado y sin daños visibles.', false),
        sn('EB-A12', 'Selector de la bomba principal colocado en posición AUTOMÁTICO.', false),
        sn('EB-A13', 'Indicadores Luminosos del controlador operativos y sin alarmas/fallas activas.', false),
      ]),
      sec('durante', 'DURANTE LA PRUEBA', [
        sn('EB-B01', 'La Electrobomba principal arranca automática por caída de presión.', true),
        sn('EB-B02', 'El arranque de la electrobomba principal se produce sin demora o comportamiento anormal.', true),
        sn('EB-B03', 'La bomba principal mantiene funcionamiento estable durante la prueba', true),
        sn('EB-B04', 'No se presentan ruidos anormales durante el funcionamiento.', true),
        sn('EB-B05', 'No se presentan vibraciones anormales durante el funcionamiento.', true),
        sn('EB-B06', 'No se presentan vibraciones anormales durante el funcionamiento.', true), // repetido en el formato del dueño; se conserva
        sn('EB-B07', 'No se evidencia fugas de agua en bomba, tuberías, válvulas o accesorios', true),
        sn('EB-B08', 'Motor eléctrico sin evidencia de sobrecalentamiento, humo u olor anormal.', true),
        sn('EB-B09', 'Presión de descarga durante la prueba dentro de la condición esperada.', true),
      ]),
      sec('despues', 'DESPUÉS DE LA PRUEBA', [
        sn('EB-C01', 'Parada manual de la electrobomba principal operativa.', true),
        sn('EB-C02', 'Sistema queda restablecido en condición automática después de la prueba.', true),
        sn('EB-C03', 'Selector de la bomba principal queda en posición AUTOMÁTICO.', true),
        sn('EB-C04', 'Bomba Jockey queda en posición AUTOMÁTICO.', true),
        sn('EB-C05', 'Válvulas quedan en posición normal de operación', true),
        sn('EB-C06', 'No quedan fugas, alarmas o condiciones anormales después de la prueba.', true),
        sn('EB-C07', 'Cuarto de bombas queda limpio, ordenado y con acceso libre.', true),
      ]),
      // Cada parámetro tiene su «Antes» y su «Final» (obligatorios) y sus observaciones (opcionales), como en el Excel.
      sec('prueba', 'REGISTRO DE PRUEBA FUNCIONAL', [
        dato('EB-P01A', 'Presión · Antes', 'texto'),
        dato('EB-P01F', 'Presión · Final', 'texto'),
        dato('EB-P01O', 'Presión · Observaciones', 'texto', { obligatorio: false }),
        dato('EB-P02A', 'Hora de inicio · Antes', 'hora'),
        dato('EB-P02F', 'Hora de inicio · Final', 'hora'),
        dato('EB-P02O', 'Hora de inicio · Observaciones', 'texto', { obligatorio: false }),
      ]),
    ],
    reglas: [{ tipo: 'x_en', etiqueta: 'No conforme', alcance: 'todos' }],
    resultado_defecto: 'Conforme',
  }),
}

// ───── 4. Sistema DACI ─────
const daci: PlantillaBase = {
  codigo: 'daci',
  nombre: 'Inspección del sistema DACI (detección y alarma contra incendio)',
  descripcion: '1 inspección = 1 dispositivo. El subtipo (panel, pulsador, detector, sirena) elige los puntos.',
  aplica_a: 'activo',
  tipo_activo: 'dispositivo_alarma',
  frecuencia: 'mensual',
  receta: recetaBase({
    secciones: [
      sec('panel', 'Panel de control', [
        pCH('DACI-P01', 'El panel está energizado y sin fallas ni alarmas activas', true, true, { pide_accion: true }),
        pCH('DACI-P02', 'Los indicadores luminosos funcionan', false, true),
        pCH('DACI-P03', 'El panel está accesible y sin objetos que lo cubran', false, true),
        pCH('DACI-P04', 'La batería de respaldo está en buen estado (según indicador)', true, true, { pide_accion: true }),
      ], { solo_subtipos: ['panel'] }),
      sec('pulsador', 'Pulsador (estación manual)', [
        pCH('DACI-S01', 'El pulsador está completo, sin daños y accesible', true, true, { pide_accion: true }),
        pCH('DACI-S02', 'La señal de ubicación es visible', false, true),
        pCH('DACI-S03', 'No está bloqueado ni cubierto', false, true),
      ], { solo_subtipos: ['pulsador'] }),
      sec('detector', 'Detector', [
        pCH('DACI-D01', 'El detector está firme, limpio y sin daños', true, true, { pide_accion: true }),
        pCH('DACI-D02', 'No está cubierto ni obstruido', true, true, { pide_accion: true }),
        pCH('DACI-D03', 'Su indicador luminoso funciona', false, true),
      ], { solo_subtipos: ['detector'] }),
      sec('sirena', 'Sirena o luz estroboscópica', [
        pCH('DACI-A01', 'Está firme y sin daños', false, true),
        pCH('DACI-A02', 'La luz o el sonido funciona en la prueba', true, true, { pide_accion: true }),
      ], { solo_subtipos: ['sirena'] }),
    ],
    reglas: [{ tipo: 'x_en', etiqueta: 'Inoperativo', alcance: 'criticos' }],
    resultado_defecto: 'Operativo',
  }),
}

// ───── 5. Eficacia del programa LOTO ─────
const loto_ = (clave: string, texto: string) => pCH(clave, texto, false, true, { pide_accion: true })
const loto: PlantillaBase = {
  codigo: 'loto',
  nombre: 'Eficacia del programa de bloqueo y etiquetado (LOTO)',
  descripcion: 'Se aplica a un área: se observa una tarea con bloqueo. Cada X pide acción correctiva, plazo y responsable.',
  aplica_a: 'area',
  tipo_activo: null,
  frecuencia: 'trimestral', // valor inicial aprobado por el dueño (27/10/2026)
  receta: recetaBase({
    secciones: [
      // Textos tal como el formato de referencia del dueño (decisión del dueño, 29/10/2026: ajusta D-22 para LOTO).
      sec('datos', 'Datos de la inspección', [
        dato('LOTO-D02', 'Tipo de bloqueo', 'lista', { lista: 'tipos_bloqueo' }),
      ]),
      sec('procedimiento', 'PROCEDIMIENTO DE LOTO', [
        loto_('LOTO-01', '¿El responsable de bloqueo conoce la importancia de LOTO?'),
        loto_('LOTO-02', '¿El responsable de bloqueo identifica el mapa LOTO en el equipo? Según aplique.'),
        loto_('LOTO-03', '¿El Responsable de Bloqueo está capacitado y autorizado para realizar el bloqueo del equipo?'),
        loto_('LOTO-04', '¿El Responsable bloquea correctamente las fuentes de energía peligrosa? (Según el mapa LOTO)'),
        loto_('LOTO-05', '¿Se verificó que el Responsable efectuara el bloqueo principal y que el personal de apoyo colocara correctamente su candado y tarjeta LOTO en la pinza o caja grupal, según aplique?'),
      ]),
      sec('equipo', 'EQUIPO O MÁQUINA', [
        loto_('LOTO-06', '¿El equipo o maquina cuenta con Mapa LOTO visible, en buen estado y la versión vigente?'),
        loto_('LOTO-07', '¿Los puntos de bloqueo se encuentran accesibles?'),
        loto_('LOTO-08', '¿Los puntos de bloqueo permite utilizarse para la tarea ejecutada?'),
      ]),
      sec('dispositivos', 'DISPOSITIVOS DE BLOQUEO Y ETIQUETADO', [
        loto_('LOTO-09', '¿Los dispositivos de bloqueo se encuentran en óptimas condiciones para su uso?'),
        loto_('LOTO-10', '¿Tarjeta LOTO del trabajador se encuentra en buen estado?'),
        loto_('LOTO-11', '¿Estación LOTO se encuentra limpia, ordenada y en buen estado?'),
        loto_('LOTO-12', '¿Cuenta con los dispositivos de bloqueo completos? (según cartilla de estación LOTO)'),
      ]),
    ],
    firmas: [
      { clave: 'observado', titulo: 'Observado', obligatoria: true, externo: true, minimo: 1 },
      { clave: 'responsable_area', titulo: 'Responsable del área inspeccionada', obligatoria: true, externo: false, minimo: 1 },
      { clave: 'responsable_registro', titulo: 'Responsable del registro e inspección', obligatoria: true, externo: false, minimo: 1 },
    ],
    reglas: [{ tipo: 'x_en', etiqueta: 'No conforme', alcance: 'todos' }],
    resultado_defecto: 'Conforme',
    puntaje: true,
  }),
}

// ───── 6. IPF ─────
const ipf: PlantillaBase = {
  codigo: 'ipf',
  nombre: 'Inspección de seguridad ocupacional (IPF)',
  descripcion: 'Se aplica a un área. Se registran las condiciones inseguras encontradas; cada una genera un hallazgo.',
  aplica_a: 'area',
  tipo_activo: null,
  frecuencia: 'mensual', // valor inicial aprobado por el dueño (27/10/2026)
  receta: recetaBase({
    secciones: [
      // Según el modelo de Inspección de Seguridad Ocupacional del dueño (decisión del 29/10/2026, como el LOTO): el área y la
      // hora salen de la inspección y el N.º de trabajadores de la ficha de la empresa; el responsable de la inspección y del
      // registro firman (mínimo 1 inspector).
      sec('datos', 'Datos de la inspección', [
        dato('IPF-A01', 'Responsable del área', 'persona'),
        // Tipo de inspección con tres casillas (pedido del dueño, 29/10/2026): en el Excel van como «X» y, si es «Otros», se detalla.
        dato('IPF-A02', 'Tipo de inspección', 'lista', { opciones: ['Programada', 'No programada', 'Otros'] }),
        dato('IPF-A04', 'Otros (detallar el tipo de inspección)', 'texto', { obligatorio: false, mostrar_si: { clave: 'IPF-A02', valor: 'Otros' } }),
        dato('IPF-A03', 'Objetivo de la inspección', 'texto_largo', { valor_defecto: 'Identificar condiciones y actos inseguros en el área' }),
      ]),
      sec('pregunta', 'Condiciones inseguras', [dato('IPF-01', '¿Se identificaron condiciones inseguras?', 'si_no')]),
      sec(
        'condiciones',
        'Condición insegura',
        [
          dato('IPF-C01', 'Peligro identificado', 'texto'),
          dato('IPF-C02', 'Riesgo asociado', 'texto'),
          dato('IPF-C03', 'Evidencia (foto)', 'foto'),
          dato('IPF-C04', 'Acción de mejora', 'texto_largo'),
          dato('IPF-C05', 'Responsable', 'persona'),
          dato('IPF-C06', 'Plazo', 'fecha'),
        ],
        { repetible: { activa_con: 'IPF-01', minimo: 1, genera_hallazgo: true } },
      ),
      sec('cierre', 'Cierre', [
        dato('IPF-R01', 'Resultado de la inspección', 'texto_largo'),
        dato('IPF-R02', 'Causas de los resultados desfavorables (escribe «No aplica» si no hubo)', 'texto_largo'),
        dato('IPF-R03', 'Conclusiones y recomendaciones', 'texto_largo'),
      ]),
    ],
    firmas: [
      { clave: 'inspectores', titulo: 'Responsable(s) de la inspección', obligatoria: true, externo: true, minimo: 1 },
      { clave: 'responsable_registro', titulo: 'Responsable del registro', obligatoria: true, externo: false, minimo: 1 },
    ],
    reglas: [{ tipo: 'filas', etiqueta: 'Con condiciones inseguras', seccion: 'condiciones' }],
    resultado_defecto: 'Conforme',
  }),
}

export const PLANTILLAS_BASE: PlantillaBase[] = [extintores, car, bombas, motobomba, electrobomba, daci, loto, ipf]
