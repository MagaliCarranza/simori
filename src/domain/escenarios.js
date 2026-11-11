// Escenarios de pérdida simulada (RF11). Siempre etiquetados como "Datos simulados".

import { PASOS_ENTRE_ETAPAS } from './config.js'

// Fórmula de referencia (didáctica): (1 - p)^PASOS * 100.
// El porcentaje que la app muestra se calcula con los casos en indicador.js.
export function porcentajeFinalCompletado(perdidaPorPaso) {
  return Math.pow(1 - perdidaPorPaso, PASOS_ENTRE_ETAPAS) * 100
}

// Reduce el embudo aplicando la pérdida en cada paso. No muta la entrada.
// n_etapa_k = n_etapa_1 * (1 - p)^(k - 1), redondeado al entero más cercano.
export function aplicarEscenarioPerdida(embudoBase, perdidaPorPaso) {
  if (embudoBase.length === 0) return []
  const nBase = embudoBase[0].n
  return embudoBase.map((row, i) => ({
    ...row,
    n: i === 0 ? nBase : Math.round(nBase * Math.pow(1 - perdidaPorPaso, i)),
  }))
}
