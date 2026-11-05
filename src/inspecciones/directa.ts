/** IPF y LOTO (pedido del dueño, 05/11/2026): al pulsar «Nueva inspección» se abre directo el formato para llenar, sin pantalla intermedia. */
export const esInspeccionDirecta = (receta: { secciones: { puntos: { clave: string }[] }[] }) => receta.secciones.some((s) => s.puntos.some((p) => /^(IPF|LOTO)-/.test(p.clave)))
