import { DIAS_CONFIRMACION, UMBRAL_POSITIVO_MGL } from './config.js'
import { sumarDias } from './fechas.js'

// Micral-Test: valores posibles 0, 20, 50, 100 mg/L. Positivo = 20 o más.
export function esPositivo(tiraMgL) {
  return tiraMgL >= UMBRAL_POSITIVO_MGL
}

export function fechaConfirmacionEsperada(fechaTamizajeISO) {
  return sumarDias(fechaTamizajeISO, DIAS_CONFIRMACION)
}
