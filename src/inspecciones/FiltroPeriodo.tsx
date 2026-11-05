import { NOMBRE_MES, semanasDelMes } from './periodos'

export type PeriodoElegido = { anio: number; mes: number; semana: number }

/**
 * Filtro por año y mes (y semana, si la inspección es semanal), cada uno en su propia lista (pedido del dueño, 05/11/2026).
 * Por defecto empieza en el mes de hoy; todo se puede cambiar. Con `conAnioCompleto` el mes puede ser «Todo el año».
 */
export function FiltroPeriodo({ valor, onCambio, semanal, conAnioCompleto, hoy }: { valor: PeriodoElegido; onCambio: (p: PeriodoElegido) => void; semanal: boolean; conAnioCompleto?: boolean; hoy: string }) {
  const anioHoy = Number(hoy.slice(0, 4))
  const anios = Array.from({ length: 5 }, (_, k) => anioHoy - k)
  if (!anios.includes(valor.anio)) anios.push(valor.anio)
  anios.sort((a, b) => b - a)
  const semanas = semanal && valor.mes > 0 ? semanasDelMes(valor.anio, valor.mes) : []
  return (
    <div className="fila3">
      <label className="field campo-fecha">
        <span>Año</span>
        <select value={valor.anio} onChange={(e) => onCambio({ anio: Number(e.target.value), mes: valor.mes, semana: 0 })}>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label className="field campo-fecha">
        <span>Mes</span>
        <select value={valor.mes} onChange={(e) => onCambio({ anio: valor.anio, mes: Number(e.target.value), semana: 0 })}>
          {conAnioCompleto && <option value={0}>Todo el año</option>}
          {NOMBRE_MES.map((m, i) => <option key={m} value={i + 1}>{m[0].toUpperCase() + m.slice(1)}</option>)}
        </select>
      </label>
      {semanal && valor.mes > 0 && (
        <label className="field campo-fecha">
          <span>Semana</span>
          <select value={valor.semana} onChange={(e) => onCambio({ ...valor, semana: Number(e.target.value) })}>
            <option value={0}>Todas las semanas del mes</option>
            {semanas.map((s) => <option key={s.semana} value={s.semana}>{s.etiqueta}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}
