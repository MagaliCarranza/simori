// Semáforo del caso (RF04). Siempre devuelve etiqueta con texto (no solo color).

import { SEMAFORO_CON_CITA, SEMAFORO_SIN_CITA } from './config.js'
import { diasEntre } from './fechas.js'

// Solo los eventos de tipo 'resultado' reinician el reloj "sin cita".
// Las visitas nunca cuentan: si contaran, una familia no localizada podría
// mantener el semáforo en verde y nunca pasar a sin_seguimiento.
function ultimoResultado(eventos) {
  let ultimo = null
  for (const e of eventos) {
    if (e.tipo !== 'resultado') continue
    if (!ultimo || e.fecha > ultimo.fecha) ultimo = e
  }
  return ultimo
}

export function calcularSemaforo(caso, eventos, hoyISO) {
  if (caso.estado === 'alta' || caso.estado === 'referido') {
    return { color: null, etiqueta: 'Cerrado', diasRetraso: 0, referencia: 'cerrado' }
  }

  if (caso.fechaProximaCita) {
    const dias = diasEntre(caso.fechaProximaCita, hoyISO)
    if (dias <= 0) {
      return { color: 'verde', etiqueta: 'A tiempo', diasRetraso: 0, referencia: 'cita' }
    }
    if (dias < SEMAFORO_CON_CITA.rojoDesde) {
      return { color: 'amarillo', etiqueta: `Con retraso (${dias} días)`, diasRetraso: dias, referencia: 'cita' }
    }
    return { color: 'rojo', etiqueta: `Retraso alto (${dias} días)`, diasRetraso: dias, referencia: 'cita' }
  }

  const ultimo = ultimoResultado(eventos)
  const fechaBase = ultimo ? ultimo.fecha : caso.fechaTamizaje
  if (!fechaBase) {
    return { color: 'verde', etiqueta: 'Pendiente de agendar', diasRetraso: 0, referencia: 'ultimo_evento' }
  }
  const dias = diasEntre(fechaBase, hoyISO)
  if (dias < SEMAFORO_SIN_CITA.amarilloDesde) {
    return { color: 'verde', etiqueta: 'Pendiente de agendar', diasRetraso: Math.max(dias, 0), referencia: 'ultimo_evento' }
  }
  if (dias < SEMAFORO_SIN_CITA.rojoDesde) {
    return { color: 'amarillo', etiqueta: `Sin cita (${dias} días)`, diasRetraso: dias, referencia: 'ultimo_evento' }
  }
  return { color: 'rojo', etiqueta: `Sin cita, retraso alto (${dias} días)`, diasRetraso: dias, referencia: 'ultimo_evento' }
}
