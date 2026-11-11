import { describe, expect, it } from 'vitest'
import { salidaPropuesta } from './salida.js'

describe('salidaPropuesta', () => {
  it('TFGe < 60 → referido', () => {
    expect(salidaPropuesta({ tfge: 50 })).toBe('referido')
  })

  it('TFGe ≥ 60 → vigilancia (sin importar la categoría A, persistencia ya decidida en etapa 2)', () => {
    expect(salidaPropuesta({ tfge: 70 })).toBe('vigilancia')
    expect(salidaPropuesta({ tfge: 95 })).toBe('vigilancia')
  })

  it('TFGe exactamente 60 → vigilancia (borde)', () => {
    expect(salidaPropuesta({ tfge: 60 })).toBe('vigilancia')
  })

  it('nunca devuelve null para un caso clasificado', () => {
    expect(salidaPropuesta({ tfge: 59.9 })).toBe('referido')
    expect(salidaPropuesta({ tfge: 60.1 })).toBe('vigilancia')
  })
})
