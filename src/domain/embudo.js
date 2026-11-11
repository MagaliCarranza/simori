// Embudo acumulativo por etapa para el gráfico de supervisión (M8).

import { ENMASCARAR_MENOR_QUE } from './config.js'
import { etapaDerivada } from './etapas.js'

const TITULOS_ETAPA = {
  1: 'Tamizaje',
  2: 'Confirmación',
  3: 'Valoración',
  4: 'Clasificación',
  5: 'Salida',
}

// Agrupa eventos por codigoCaso una sola vez.
function agruparEventos(eventos) {
  const m = new Map()
  for (const e of eventos) {
    if (!m.has(e.codigoCaso)) m.set(e.codigoCaso, [])
    m.get(e.codigoCaso).push(e)
  }
  return m
}

// Devuelve [{ etapa, titulo, n }] con n = casos que alcanzaron esa etapa o más.
export function embudo(casos, eventos) {
  const eventosPorCaso = agruparEventos(eventos)
  const alcanzadas = casos.map((c) => etapaDerivada(eventosPorCaso.get(c.codigo) || []))
  const salida = []
  for (let etapa = 1; etapa <= 5; etapa++) {
    const n = alcanzadas.filter((e) => e >= etapa).length
    salida.push({ etapa, titulo: TITULOS_ETAPA[etapa], n })
  }
  return salida
}

// Supervisión no ve códigos; cifras < 5 por escuela se enmascaran.
export function enmascararMenorQue5(n) {
  return n < ENMASCARAR_MENOR_QUE ? 'menos de 5' : n
}
