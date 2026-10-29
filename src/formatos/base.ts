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
  p(clave, texto, { critico: c, hallazgo: h ? 'no_cumple' : 'nunca', ...m })
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
const extintores: PlantillaBase = {
  codigo: 'extintores',
  nombre: 'Inspección de extintores portátiles',
  descripcion: '1 inspección = 1 extintor. Revisa ubicación, acceso, señalización y componentes críticos, y controla vencimientos.',
  aplica_a: 'activo',
  tipo_activo: 'extintor',
  frecuencia: 'mensual',
  receta: recetaBase({
    secciones: [
      sec('verificacion', 'Verificación del extintor', [
        pCH('EXT-01', 'Está en su lugar asignado y es fácilmente visible', false, true),
        pCH('EXT-02', 'El acceso está libre de obstáculos', false, true),
        pCH('EXT-03', 'Tiene señal de ubicación visible', false, true),
        pCH('EXT-04', 'Está identificado con su código', false, false),
        pCH('EXT-05', 'Las instrucciones de uso y la clase de fuego son legibles', false, false),
        pCH('EXT-06', 'La etiqueta de mantenimiento está presente, legible y vigente', false, true),
        pCH('EXT-07', 'El pasador y el precinto de seguridad están completos', true, true),
        pCH('EXT-08', 'El indicador de presión (o el peso, en CO₂) está en la zona operativa', true, true),
        pCH('EXT-09', 'La válvula y la palanca no tienen daños ni deformaciones', true, true),
        pCH('EXT-10', 'La manguera no tiene grietas, obstrucciones ni deterioro (N/A si no tiene)', true, true),
        pCH('EXT-11', 'La boquilla o tobera está limpia y sin obstrucción', true, true),
        pCH('EXT-12', 'El cilindro no tiene golpes, corrosión ni fugas', true, true),
        pCH('EXT-13', 'El soporte, gabinete o pedestal está firme y a la altura prevista por la empresa', false, true),
      ]),
    ],
    reglas: [
      {
        tipo: 'vencido',
        etiqueta: 'No conforme: vencido',
        controles: [
          { campo: 'proximo_mantenimiento', tipo: 'fecha_limite' },
          { campo: 'anio_prueba_hidrostatica', tipo: 'anios', anios: null },
          { campo: 'anio_fabricacion', tipo: 'anios', anios: null },
        ],
      },
      { tipo: 'x_en', etiqueta: 'No conforme', alcance: 'criticos' },
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
const sn = (clave: string, texto: string, h: boolean, m: Marcas = {}) => p(clave, texto, { ...SN, hallazgo: h ? 'no_cumple' : 'nunca', ...m })
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
        pCH('DACI-P01', 'El panel está energizado y sin fallas ni alarmas activas', true, true),
        pCH('DACI-P02', 'Los indicadores luminosos funcionan', false, true),
        pCH('DACI-P03', 'El panel está accesible y sin objetos que lo cubran', false, true),
        pCH('DACI-P04', 'La batería de respaldo está en buen estado (según indicador)', true, true),
      ], { solo_subtipos: ['panel'] }),
      sec('pulsador', 'Pulsador (estación manual)', [
        pCH('DACI-S01', 'El pulsador está completo, sin daños y accesible', true, true),
        pCH('DACI-S02', 'La señal de ubicación es visible', false, true),
        pCH('DACI-S03', 'No está bloqueado ni cubierto', false, true),
      ], { solo_subtipos: ['pulsador'] }),
      sec('detector', 'Detector', [
        pCH('DACI-D01', 'El detector está firme, limpio y sin daños', true, true),
        pCH('DACI-D02', 'No está cubierto ni obstruido', true, true),
        pCH('DACI-D03', 'Su indicador luminoso funciona', false, true),
      ], { solo_subtipos: ['detector'] }),
      sec('sirena', 'Sirena o luz estroboscópica', [
        pCH('DACI-A01', 'Está firme y sin daños', false, true),
        pCH('DACI-A02', 'La luz o el sonido funciona en la prueba', true, true),
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
        dato('LOTO-D03', 'N° de trabajadores del centro laboral', 'numero'),
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
  nombre: 'IPF · Inspección programada focalizada',
  descripcion: 'Se aplica a un área. Se registran las condiciones inseguras encontradas; cada una genera un hallazgo.',
  aplica_a: 'area',
  tipo_activo: null,
  frecuencia: 'mensual', // valor inicial aprobado por el dueño (27/10/2026)
  receta: recetaBase({
    secciones: [
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
      { clave: 'inspectores', titulo: 'Inspectores', obligatoria: true, externo: true, minimo: 2 },
      { clave: 'responsable_area', titulo: 'Responsable del área', obligatoria: true, externo: true, minimo: 1 },
    ],
    reglas: [{ tipo: 'filas', etiqueta: 'Con condiciones inseguras', seccion: 'condiciones' }],
    resultado_defecto: 'Conforme',
  }),
}

export const PLANTILLAS_BASE: PlantillaBase[] = [extintores, car, bombas, daci, loto, ipf]
