// M10 · Comparar escenarios de pérdida (HU10, RF11). Lógica pura, sin React
// ni Dexie. Cada escenario es su propio archivo de casos simulados
// (public/data/casos_N.json); aquí solo se resumen con las funciones del
// dominio: embudo() por etapa y porcentajeCompletado() para el % final.
// Nada se escribe a mano.

import { contarCompletados, embudo, enmascararMenorQue5, porcentajeCompletado } from '../../domain/index.js'
import { ESCENARIOS } from './escenarios.js'

export const NUMEROS_ESCENARIO = ESCENARIOS.map((e) => e.numero)

export const FRASE_CIERRE = 'Hoy no se sabe dónde se pierden. Con SIMORI, se sabría cada semana.'

// Resumen de un escenario a partir de su JSON ({ casos, eventos }).
// Supervisión solo ve cifras agregadas: toda cifra menor de 5 se enmascara y,
// si el total es menor de 5, no se muestran porcentajes.
export function resumenEscenario(numero, { casos = [], eventos = [] } = {}) {
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
  }
}
