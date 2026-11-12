import { describe, expect, it } from 'vitest'
import { esPositivo, fechaConfirmacionEsperada } from './tamizaje.js'

describe('esPositivo', () => {
  it('0 mg/L no es positivo', () => {
    expect(esPositivo(0)).toBe(false)
  })

  it('20 mg/L es positivo (límite exacto del fabricante)', () => {
    expect(esPositivo(20)).toBe(true)
  })

  it('50 mg/L es positivo', () => {
    expect(esPositivo(50)).toBe(true)
  })

  it('100 mg/L es positivo', () => {
    expect(esPositivo(100)).toBe(true)
  })
})

describe('fechaConfirmacionEsperada', () => {
  it('suma 84 días (12 semanas) a la fecha del tamizaje', () => {
    expect(fechaConfirmacionEsperada('2026-01-01')).toBe('2026-03-26')
  })
})
