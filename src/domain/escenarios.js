// Escenarios de pérdida simulada (RF11).
//
// La app NO aplica pérdida en línea sobre un embudo: cada escenario (11 %, 30 %,
// 50 %) es un archivo propio de casos simulados generado por scripts/simular_casos.py
// con semilla fija. Sobre esos casos se usan `embudo()` e `indicador()` normales.
//
// `porcentajeFinalCompletado` se conserva únicamente como referencia teórica
// ((1 − p)^PASOS × 100) para contrastar el número observado contra el esperado
// en la memoria del hackatón. No se usa en el cálculo que ve la UI.

import { PASOS_ENTRE_ETAPAS } from './config.js'

export function porcentajeFinalCompletado(perdidaPorPaso) {
  return Math.pow(1 - perdidaPorPaso, PASOS_ENTRE_ETAPAS) * 100
}
