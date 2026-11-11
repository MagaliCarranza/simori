// Indicador principal (RF09): % que completa su evaluación y mediana de días
// entre etapas. "Completar" = llegar a clasificación (etapa 4) o alta.

import { diasEntre } from './fechas.js'
import { etapaDerivada } from './etapas.js'

function agruparEventos(eventos) {
  const m = new Map()
  for (const e of eventos) {
    if (!m.has(e.codigoCaso)) m.set(e.codigoCaso, [])
    m.get(e.codigoCaso).push(e)
  }
  return m
}

export function porcentajeCompletado(casos, eventos) {
  if (casos.length === 0) return 0
  const eventosPorCaso = agruparEventos(eventos)
  let completados = 0
  for (const c of casos) {
    const ev = eventosPorCaso.get(c.codigo) || []
    const etapa = etapaDerivada(ev)
    const tieneAlta = ev.some((e) => e.tipo === 'alta')
    if (etapa >= 4 || tieneAlta) completados++
  }
  return (completados / casos.length) * 100
}

function mediana(numeros) {
  if (numeros.length === 0) return null
  const ord = [...numeros].sort((a, b) => a - b)
  const m = Math.floor(ord.length / 2)
  return ord.length % 2 ? ord[m] : (ord[m - 1] + ord[m]) / 2
}

// Devuelve { 't1->t2', 't2->t3', 't3->t4', 't4->t5' } con la mediana en días.
// Si un caso no tiene ambas fechas, no aporta a esa transición.
export function medianaDiasEntreEtapas(casos, eventos) {
  const eventosPorCaso = agruparEventos(eventos)
  const diffs = { 't1->t2': [], 't2->t3': [], 't3->t4': [], 't4->t5': [] }
  for (const c of casos) {
    const ev = eventosPorCaso.get(c.codigo) || []
    const primera = {}
    for (const e of ev) {
      if (e.tipo !== 'resultado' || typeof e.etapa !== 'number') continue
      if (!primera[e.etapa] || e.fecha < primera[e.etapa]) primera[e.etapa] = e.fecha
    }
    if (primera[1] && primera[2]) diffs['t1->t2'].push(diasEntre(primera[1], primera[2]))
    if (primera[2] && primera[3]) diffs['t2->t3'].push(diasEntre(primera[2], primera[3]))
    if (primera[3] && primera[4]) diffs['t3->t4'].push(diasEntre(primera[3], primera[4]))
    if (primera[4] && primera[5]) diffs['t4->t5'].push(diasEntre(primera[4], primera[5]))
  }
  return {
    't1->t2': mediana(diffs['t1->t2']),
    't2->t3': mediana(diffs['t2->t3']),
    't3->t4': mediana(diffs['t3->t4']),
    't4->t5': mediana(diffs['t4->t5']),
  }
}
