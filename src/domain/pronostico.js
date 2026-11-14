// Pronóstico de demanda por centro de salud (Anexo E del reporte).
//
// Es una cuenta con reglas fijas, no un modelo estadístico:
//   llegadas esperadas = citas programadas × (1 − pérdida del escenario)
// redondeado al entero más cercano.
//
// Por qué no se cuenta dos veces la pérdida: en los casos simulados, los niños
// que se pierden conservan su próxima cita agendada (la pérdida solo se nota
// cuando la cita pasa sin resultado). Las citas futuras del escenario son, por
// tanto, citas "programadas" y sobre ellas se aplica la pérdida del escenario.
//
// Solo cuentan los casos activos (en seguimiento y vigilancia) con próxima
// cita dentro de la ventana. Las citas vencidas no cuentan.

import { diasEntre, sumarDias } from './fechas.js'

export const SEMANAS_PRONOSTICO = 8
export const DIAS_POR_SEMANA = 7
export const ESTADOS_CON_CITA_PROGRAMADA = ['en_seguimiento', 'vigilancia']

// porcentajePerdida en puntos (11, 30, 50). Se opera en enteros para que los
// .5 no se desvíen por flotantes (p. ej. 5 × 0.7 = 3.4999…).
export function llegadasEsperadas(citas, porcentajePerdida) {
  const p = Number(porcentajePerdida)
  if (!Number.isFinite(p) || p < 0 || p > 100) {
    throw new Error(`Porcentaje de pérdida inválido: ${porcentajePerdida}`)
  }
  return Math.round((citas * (100 - p)) / 100)
}

// Bloques de 7 días desde hoy: semana 1 = hoy … hoy + 6.
export function semanasPronostico(hoyISO, semanas = SEMANAS_PRONOSTICO) {
  return Array.from({ length: semanas }, (_, i) => ({
    numero: i + 1,
    inicio: sumarDias(hoyISO, i * DIAS_POR_SEMANA),
    fin: sumarDias(hoyISO, i * DIAS_POR_SEMANA + DIAS_POR_SEMANA - 1),
  }))
}

// Índice de semana (0-based) de una fecha, o -1 si cae fuera de la ventana.
function indiceSemana(fechaISO, hoyISO, semanas) {
  const dias = diasEntre(hoyISO, fechaISO)
  if (dias < 0) return -1
  const i = Math.floor(dias / DIAS_POR_SEMANA)
  return i < semanas ? i : -1
}

// Devuelve solo cifras agregadas por CLUES; ningún código de caso sale de aquí.
// `cluesCentros` (opcional) agrega centros sin citas para que aparezcan en cero.
export function pronosticoDemanda({
  casos,
  hoyISO,
  porcentajePerdida,
  cluesCentros = [],
  semanas = SEMANAS_PRONOSTICO,
}) {
  const ventana = semanasPronostico(hoyISO, semanas)
  const citasPorCentro = new Map(cluesCentros.map((c) => [c, Array(semanas).fill(0)]))

  for (const caso of casos) {
    if (!caso.clues || !caso.fechaProximaCita) continue
    if (!ESTADOS_CON_CITA_PROGRAMADA.includes(caso.estado)) continue
    const i = indiceSemana(caso.fechaProximaCita, hoyISO, semanas)
    if (i < 0) continue
    if (!citasPorCentro.has(caso.clues)) citasPorCentro.set(caso.clues, Array(semanas).fill(0))
    citasPorCentro.get(caso.clues)[i] += 1
  }

  const centros = [...citasPorCentro.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clues, citas]) => {
      const porSemana = citas.map((n, i) => ({
        ...ventana[i],
        citas: n,
        llegadas: llegadasEsperadas(n, porcentajePerdida),
      }))
      return {
        clues,
        semanas: porSemana,
        totalCitas: porSemana.reduce((s, x) => s + x.citas, 0),
        // Suma de las semanas ya redondeadas, para que el total cuadre con la tabla.
        totalLlegadas: porSemana.reduce((s, x) => s + x.llegadas, 0),
      }
    })

  return { semanas: ventana, centros }
}
