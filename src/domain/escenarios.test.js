import { describe, expect, it } from 'vitest'
import { porcentajeFinalCompletado } from './escenarios.js'

describe('porcentajeFinalCompletado (referencia teórica, no se usa en la UI)', () => {
  it('11 % de pérdida por paso → 70.50 aprox', () => {
    expect(porcentajeFinalCompletado(0.11)).toBeCloseTo(70.50, 2)
  })

  it('30 % → 34.30', () => {
    expect(porcentajeFinalCompletado(0.30)).toBeCloseTo(34.30, 2)
  })

  it('50 % → 12.50', () => {
    expect(porcentajeFinalCompletado(0.50)).toBeCloseTo(12.50, 2)
  })

  it('0 % → 100', () => {
    expect(porcentajeFinalCompletado(0)).toBe(100)
  })
})
