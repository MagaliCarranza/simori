// Regla para pasar un caso a "sin seguimiento" (RF14) y para reactivarlo.

import { UMBRAL_SIN_SEGUIMIENTO_DIAS, VISITAS_NO_LOCALIZADAS } from './config.js'
import { calcularSemaforo } from './semaforo.js'

export function debeMarcarseSinSeguimiento(caso, eventos, hoyISO) {
  const sem = calcularSemaforo(caso, eventos, hoyISO)
  if (sem.referencia === 'cerrado') return false

  const visitasNoLocalizadas = eventos.filter(
    (e) => e.tipo === 'visita' && e.visitaResultado === 'no_localizada',
  ).length

  if (sem.color === 'rojo' && visitasNoLocalizadas >= VISITAS_NO_LOCALIZADAS) return true
  if (sem.diasRetraso > UMBRAL_SIN_SEGUIMIENTO_DIAS) return true
  return false
}

// Se reactiva si el caso está en sin_seguimiento y llega un resultado o una cita.
export function puedeReactivarse(caso, evento) {
  if (caso.estado !== 'sin_seguimiento') return false
  return evento.tipo === 'resultado' || evento.tipo === 'cita'
}
