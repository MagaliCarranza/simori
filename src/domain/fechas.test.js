import { describe, expect, it } from 'vitest'
import { diasEntre, edadDecimal, sumarDias, sumarMeses } from './fechas.js'

describe('diasEntre', () => {
  it('cuenta días hacia adelante como positivos', () => {
    expect(diasEntre('2026-01-01', '2026-01-11')).toBe(10)
  })

  it('cuenta días hacia atrás como negativos', () => {
    expect(diasEntre('2026-01-11', '2026-01-01')).toBe(-10)
  })

  it('devuelve 0 para la misma fecha', () => {
    expect(diasEntre('2026-05-15', '2026-05-15')).toBe(0)
  })

  it('cruza el fin de año sin fallar', () => {
    expect(diasEntre('2026-12-20', '2027-01-05')).toBe(16)
  })
})

describe('sumarDias', () => {
  it('suma 84 días (la distancia del tamizaje a la confirmación)', () => {
    expect(sumarDias('2026-01-01', 84)).toBe('2026-03-26')
  })

  it('cruza el fin de mes', () => {
    expect(sumarDias('2026-01-30', 5)).toBe('2026-02-04')
  })

  it('cruza el fin de año', () => {
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('sumarMeses', () => {
  it('suma 6 meses para la vigilancia periódica', () => {
    expect(sumarMeses('2026-01-15', 6)).toBe('2026-07-15')
  })

  it('cruza de año', () => {
    expect(sumarMeses('2026-10-15', 5)).toBe('2027-03-15')
  })
})

describe('edadDecimal', () => {
  it('nacimiento en febrero 2016 a mitad de febrero 2026 → ~10 años', () => {
    const edad = edadDecimal({ mesNacimiento: 2, anioNacimiento: 2016 }, '2026-02-15')
    expect(edad).toBeCloseTo(10, 1)
  })

  it('niño con 8 años y medio aproximados', () => {
    const edad = edadDecimal({ mesNacimiento: 5, anioNacimiento: 2017 }, '2025-11-15')
    expect(edad).toBeCloseTo(8.5, 1)
  })

  it('bebé de pocos meses regresa una fracción < 1', () => {
    const edad = edadDecimal({ mesNacimiento: 9, anioNacimiento: 2026 }, '2026-11-15')
    expect(edad).toBeGreaterThan(0)
    expect(edad).toBeLessThan(1)
  })
})
