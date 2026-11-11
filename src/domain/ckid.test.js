import { describe, expect, it } from 'vitest'
import { categoriaA, clasificarTFG, tfgeCKiDU25 } from './ckid.js'

// Casos verificados contra NIDDK, "eGFR Equations for Children, Adolescents,
// & Young Adults" (Pierce et al., 2021).
describe('tfgeCKiDU25 (CKiD U25 — solo creatinina)', () => {
  it('A — Masculino, 10 años, talla 140 cm, cr 0.5 mg/dL', () => {
    const tfge = tfgeCKiDU25({ sexo: 'M', edadAnios: 10, tallaCm: 140, creatininaMgDl: 0.5 })
    expect(tfge).toBeCloseTo(107.47, 1)
  })

  it('B — Femenino, 8 años, talla 130 cm, cr 0.4 mg/dL', () => {
    const tfge = tfgeCKiDU25({ sexo: 'F', edadAnios: 8, tallaCm: 130, creatininaMgDl: 0.4 })
    expect(tfge).toBeCloseTo(113.64, 1)
  })

  it('C — Masculino, 15 años, talla 165 cm, cr 0.8 mg/dL', () => {
    const tfge = tfgeCKiDU25({ sexo: 'M', edadAnios: 15, tallaCm: 165, creatininaMgDl: 0.8 })
    expect(tfge).toBeCloseTo(91.79, 1)
  })

  it('D — Masculino, 18 años, talla 170 cm, cr 1.0 mg/dL (rama de adulto)', () => {
    const tfge = tfgeCKiDU25({ sexo: 'M', edadAnios: 18, tallaCm: 170, creatininaMgDl: 1.0 })
    expect(tfge).toBeCloseTo(86.36, 1)
  })

  it('edad < 1 año: null (fuera del rango validado)', () => {
    const tfge = tfgeCKiDU25({ sexo: 'M', edadAnios: 0.5, tallaCm: 70, creatininaMgDl: 0.3 })
    expect(tfge).toBe(null)
  })

  it('edad = 25 años o más: null (CKiD U25 cubre menores de 25)', () => {
    expect(tfgeCKiDU25({ sexo: 'M', edadAnios: 25, tallaCm: 175, creatininaMgDl: 1.0 })).toBe(null)
    expect(tfgeCKiDU25({ sexo: 'F', edadAnios: 30, tallaCm: 165, creatininaMgDl: 0.9 })).toBe(null)
  })
})

describe('clasificarTFG', () => {
  it('TFGe 95 en un niño de 10 años → G1 y no baja', () => {
    expect(clasificarTFG(95, 10)).toEqual({ categoria: 'G1', baja: false })
  })

  it('TFGe 85 en niño mayor de 2 años → G2 y baja', () => {
    expect(clasificarTFG(85, 5)).toEqual({ categoria: 'G2', baja: true })
  })

  it('TFGe 85 en menor de 2 años no se marca como baja', () => {
    expect(clasificarTFG(85, 1)).toEqual({ categoria: 'G2', baja: false })
  })

  it('bordes exactos de las categorías G', () => {
    expect(clasificarTFG(90, 10).categoria).toBe('G1')
    expect(clasificarTFG(60, 10).categoria).toBe('G2')
    expect(clasificarTFG(45, 10).categoria).toBe('G3a')
    expect(clasificarTFG(30, 10).categoria).toBe('G3b')
    expect(clasificarTFG(15, 10).categoria).toBe('G4')
    expect(clasificarTFG(14, 10).categoria).toBe('G5')
  })

  it('tfge null (CKiD U25 fuera de rango) → categoria null y no marca baja', () => {
    expect(clasificarTFG(null, 10)).toEqual({ categoria: null, baja: false })
    expect(clasificarTFG(undefined, 10)).toEqual({ categoria: null, baja: false })
  })
})

describe('categoriaA', () => {
  it('bordes exactos', () => {
    expect(categoriaA(29)).toBe('A1')
    expect(categoriaA(30)).toBe('A2')
    expect(categoriaA(300)).toBe('A2')
    expect(categoriaA(301)).toBe('A3')
  })
})
