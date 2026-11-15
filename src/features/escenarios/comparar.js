// M10 · Comparar escenarios de pérdida (HU10, RF11). Lógica pura, sin React
// ni Dexie. Cada escenario es su propio archivo de casos simulados
// (public/data/casos_N.json); aquí solo se resumen con las funciones del
// dominio: embudo() por etapa y porcentajeCompletado() para el % final.
// Nada se escribe a mano.

import {
  contarCompletados,
  desgloseSalidas,
  embudo,
  ENMASCARAR_MENOR_QUE,
  enmascararMenorQue5,
  porcentajeCompletado,
  resumenSupervision,
  semaforoEnSeguimiento,
} from '../../domain/index.js'
import { ESCENARIOS } from './escenarios.js'

export const NUMEROS_ESCENARIO = ESCENARIOS.map((e) => e.numero)

export const FRASE_CIERRE = 'Hoy no se sabe dónde se pierden. Con SIMORI, se sabría cada semana.'

// % de pérdida entre los casos a los que ya les tocaba avanzar:
// perdidos ÷ (completados + perdidos). Solo si las dos cifras son de 5 o más;
// si no, revelaría un grupo pequeño.
export function porcentajePerdida(completados, perdidos) {
  if (completados < ENMASCARAR_MENOR_QUE || perdidos < ENMASCARAR_MENOR_QUE) return null
  return Math.round((perdidos / (completados + perdidos)) * 100)
}

// Desglose de los positivos de un escenario a la fecha `hoyISO`, con las
// cifras de resumenSupervision() (ya con "menos de 5"):
//   completados  = alta + vigilancia + referido
//   aTiempo      = en seguimiento con semáforo verde (aún no les toca su cita)
//   conRetraso   = en seguimiento con semáforo amarillo o rojo
//   sinSeguimiento
// Las sumas se hacen con las cifras sin enmascarar y luego se enmascaran.
export function desgloseEscenario({ casos = [], eventos = [] } = {}, hoyISO) {
  const resumen = resumenSupervision(casos, eventos, hoyISO)
  const salidas = desgloseSalidas(casos, eventos, hoyISO)
  const semaforo = semaforoEnSeguimiento(casos, eventos, hoyISO)
  const completados = salidas.alta + salidas.vigilancia + salidas.referido
  const conRetraso = semaforo.amarillo + semaforo.rojo
  const perdidos = conRetraso + salidas.sin_seguimiento
  return {
    total: resumen.total,
    completados: enmascararMenorQue5(completados),
    aTiempo: resumen.semaforo.verde,
    conRetraso: enmascararMenorQue5(conRetraso),
    sinSeguimiento: resumen.salidas.sin_seguimiento,
    porcentajePerdida: porcentajePerdida(completados, perdidos),
  }
}

// Resumen de un escenario a partir de su JSON ({ casos, eventos }).
// Supervisión solo ve cifras agregadas: toda cifra menor de 5 se enmascara y,
// si el total es menor de 5, no se muestran porcentajes.
export function resumenEscenario(numero, { casos = [], eventos = [] } = {}, hoyISO) {
  const total = casos.length
  const visible = total >= 5
  const etapas = embudo(casos, eventos).map((e) => ({
    etapa: e.etapa,
    titulo: e.titulo,
    n: enmascararMenorQue5(e.n),
    porcentaje: visible ? Math.round((e.n / total) * 100) : null,
  }))
  const completados = contarCompletados(casos, eventos)
  return {
    numero,
    total: enmascararMenorQue5(total),
    etapas,
    completados: enmascararMenorQue5(completados),
    porcentajeFinal: visible ? Math.round(porcentajeCompletado(casos, eventos)) : null,
    desglose: hoyISO ? desgloseEscenario({ casos, eventos }, hoyISO) : null,
  }
}
