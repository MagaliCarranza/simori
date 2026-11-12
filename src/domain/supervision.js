// Resumen agregado para supervisión (M8: RF08, RF09, RNF10).
// Supervisión solo ve cifras agregadas, nunca códigos. Toda cifra menor de
// ENMASCARAR_MENOR_QUE se muestra como "menos de 5" (el 0 también).

import { ENMASCARAR_MENOR_QUE } from './config.js'
import { embudo, enmascararMenorQue5 } from './embudo.js'
import { estadoDerivado } from './etapas.js'
import { contarCompletados, diasEntreEtapas, medianaDiasEntreEtapas } from './indicador.js'
import { debeMarcarseSinSeguimiento } from './sinSeguimiento.js'

export const SALIDAS = ['alta', 'vigilancia', 'referido', 'sin_seguimiento', 'en_seguimiento']

function agruparEventos(eventos) {
  const m = new Map()
  for (const e of eventos) {
    if (!m.has(e.codigoCaso)) m.set(e.codigoCaso, [])
    m.get(e.codigoCaso).push(e)
  }
  return m
}

// Estado de cada caso para el desglose. "Sin seguimiento" se calcula aquí
// sin escribir en la base, para no depender de que alguien abra pendientes.
function estadoParaDesglose(caso, eventos, hoyISO) {
  const estado = estadoDerivado(caso, eventos)
  if (estado === 'en_seguimiento' && debeMarcarseSinSeguimiento(caso, eventos, hoyISO)) {
    return 'sin_seguimiento'
  }
  return estado
}

// Cuenta casos por salida (sin enmascarar). Las cinco claves suman el total.
export function desgloseSalidas(casos, eventos, hoyISO) {
  const eventosPorCaso = agruparEventos(eventos)
  const conteo = Object.fromEntries(SALIDAS.map((s) => [s, 0]))
  for (const c of casos) {
    conteo[estadoParaDesglose(c, eventosPorCaso.get(c.codigo) || [], hoyISO)]++
  }
  return conteo
}

// % completado solo si numerador y total son >= 5; si no, revelaría casos.
function completadoSeguro(casos, eventos) {
  const total = casos.length
  const completados = contarCompletados(casos, eventos)
  if (total < ENMASCARAR_MENOR_QUE || completados < ENMASCARAR_MENOR_QUE) {
    return { porcentaje: null, visible: false }
  }
  return { porcentaje: (completados / total) * 100, visible: true }
}

// Mediana por transición solo si se calculó con >= 5 casos.
function medianasSeguras(casos, eventos) {
  const diffs = diasEntreEtapas(casos, eventos)
  const medianas = medianaDiasEntreEtapas(casos, eventos)
  const salida = {}
  for (const clave of Object.keys(medianas)) {
    const suficiente = diffs[clave].length >= ENMASCARAR_MENOR_QUE
    salida[clave] = { dias: suficiente ? medianas[clave] : null, suficiente }
  }
  return salida
}

// Resumen listo para mostrar: todas las cifras ya enmascaradas, sin códigos.
export function resumenSupervision(casos, eventos, hoyISO) {
  const salidas = desgloseSalidas(casos, eventos, hoyISO)
  return {
    total: enmascararMenorQue5(casos.length),
    embudo: embudo(casos, eventos).map((e) => ({ ...e, n: enmascararMenorQue5(e.n) })),
    salidas: Object.fromEntries(SALIDAS.map((s) => [s, enmascararMenorQue5(salidas[s])])),
    completado: completadoSeguro(casos, eventos),
    medianas: medianasSeguras(casos, eventos),
  }
}

// Un resumen enmascarado por grupo (escuela, localidad o centro).
// claveDe(caso) devuelve la clave del grupo; los casos sin clave se omiten.
export function resumenPorGrupo(casos, eventos, hoyISO, claveDe) {
  const grupos = new Map()
  for (const c of casos) {
    const clave = claveDe(c)
    if (clave == null) continue
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave).push(c)
  }
  const eventosPorCaso = agruparEventos(eventos)
  return [...grupos.entries()].map(([clave, casosGrupo]) => {
    const eventosGrupo = casosGrupo.flatMap((c) => eventosPorCaso.get(c.codigo) || [])
    return { clave, ...resumenSupervision(casosGrupo, eventosGrupo, hoyISO) }
  })
}
