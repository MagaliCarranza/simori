import { describe, expect, it } from 'vitest'
import { aplicarEscenarioPerdida, porcentajeFinalCompletado } from './escenarios.js'

describe('porcentajeFinalCompletado (fórmula de referencia)', () => {
  it('11 % de pérdida por paso → 70.50 aprox', () => {
    expect(porcentajeFinalCompletado(0.11)).toBeCloseTo(70.50, 2)
  })

  it('30 % → 34.30', () => {
    expect(porcentajeFinalCompletado(0.30)).toBeCloseTo(34.30, 2)
  })

  it('50 % → 12.50', () => {
    expect(porcentajeFinalCompletado(0.50)).toBeCloseTo(12.50, 2)
  })
})

describe('aplicarEscenarioPerdida', () => {
  const embudoBase = [
    { etapa: 1, titulo: 'Tamizaje', n: 1000 },
    { etapa: 2, titulo: 'Confirmación', n: 1000 },
    { etapa: 3, titulo: 'Valoración', n: 1000 },
    { etapa: 4, titulo: 'Clasificación', n: 1000 },
    { etapa: 5, titulo: 'Salida', n: 1000 },
  ]

  it('etapa 1 queda igual y cada etapa siguiente reduce por (1 - p)', () => {
    const r = aplicarEscenarioPerdida(embudoBase, 0.30)
    expect(r[0].n).toBe(1000)
    expect(r[1].n).toBe(700)
    expect(r[2].n).toBe(490)
    expect(r[3].n).toBe(343)
    expect(r[4].n).toBe(240)
  })

  it('no muta la entrada', () => {
    const copia = JSON.parse(JSON.stringify(embudoBase))
    aplicarEscenarioPerdida(embudoBase, 0.50)
    expect(embudoBase).toEqual(copia)
  })

  it('con embudo vacío devuelve lista vacía', () => {
    expect(aplicarEscenarioPerdida([], 0.5)).toEqual([])
  })
})
