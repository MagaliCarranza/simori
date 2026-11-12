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

// % completado solo si completados, no completados y total son >= 5;
// si no, el porcentaje revelaría cuántos casos hay en un grupo pequeño.
function completadoSeguro(casos, eventos) {
  const total = casos.length
  const completados = contarCompletados(casos, eventos)
  const noCompletados = total - completados
  if (
    total < ENMASCARAR_MENOR_QUE ||
    completados < ENMASCARAR_MENOR_QUE ||
    noCompletados < ENMASCARAR_MENOR_QUE
  ) {
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

// Marca de una cifra >= 5 que se oculta solo para proteger a otra (supresión secundaria).
export const OCULTO_SECUNDARIO = 'oculto'

// Enmascara una columna de una tabla por grupos. Si queda exactamente una cifra
// menor de 5, se podría recalcular restando del total visible; por eso se oculta
// también la siguiente más pequeña de la columna.
export function columnaSegura(valores) {
  const salida = valores.map(enmascararMenorQue5)
  const ocultas = valores.filter((n) => n < ENMASCARAR_MENOR_QUE).length
  if (ocultas !== 1) return salida
  let menor = -1
  valores.forEach((n, i) => {
    if (n >= ENMASCARAR_MENOR_QUE && (menor === -1 || n < valores[menor])) menor = i
  })
  if (menor !== -1) salida[menor] = OCULTO_SECUNDARIO
  return salida
}

// Un resumen enmascarado por grupo (escuela, localidad o centro), con supresión
// secundaria por columna en total, embudo y salidas.
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
  const lista = [...grupos.entries()].map(([clave, casosGrupo]) => {
    const eventosGrupo = casosGrupo.flatMap((c) => eventosPorCaso.get(c.codigo) || [])
    return {
      clave,
      casos: casosGrupo,
      eventos: eventosGrupo,
      embudo: embudo(casosGrupo, eventosGrupo),
      salidas: desgloseSalidas(casosGrupo, eventosGrupo, hoyISO),
    }
  })

  const totales = columnaSegura(lista.map((g) => g.casos.length))
  const salidasPorColumna = Object.fromEntries(SALIDAS.map((s) => [s, columnaSegura(lista.map((g) => g.salidas[s]))]))
  const embudoPorColumna = (lista[0]?.embudo ?? []).map((_, j) => columnaSegura(lista.map((g) => g.embudo[j].n)))

  return lista.map((g, i) => ({
    clave: g.clave,
    total: totales[i],
    embudo: g.embudo.map((e, j) => ({ ...e, n: embudoPorColumna[j][i] })),
    salidas: Object.fromEntries(SALIDAS.map((s) => [s, salidasPorColumna[s][i]])),
    completado: completadoSeguro(g.casos, g.eventos),
    medianas: medianasSeguras(g.casos, g.eventos),
  }))
}
