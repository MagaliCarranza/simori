import { describe, expect, it } from 'vitest'
import { agendarProximaRevisionVigilancia, salidaPropuesta } from './salida.js'

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

  it('nunca devuelve null para un caso clasificado con TFGe numérica', () => {
    expect(salidaPropuesta({ tfge: 59.9 })).toBe('referido')
    expect(salidaPropuesta({ tfge: 60.1 })).toBe('vigilancia')
  })

  it('TFGe null (fuera del rango validado de CKiD U25) → null (decide el personal)', () => {
    expect(salidaPropuesta({ tfge: null })).toBe(null)
  })

  it('TFGe undefined (no se pudo calcular) → null', () => {
    expect(salidaPropuesta({ tfge: undefined })).toBe(null)
  })
})

describe('agendarProximaRevisionVigilancia', () => {
  it('cierra el caso en vigilancia y agenda +6 meses desde el resultado', () => {
    const caso = { codigo: 'PON-SPI-0001', estado: 'en_seguimiento' }
    const r = agendarProximaRevisionVigilancia(caso, '2026-06-15')
    expect(r.estado).toBe('vigilancia')
    expect(r.fechaProximaCita).toBe('2026-12-15')
  })

  it('en una revisión semestral posterior, re-agenda la siguiente', () => {
    const caso = {
      codigo: 'PON-SPI-0001',
      estado: 'vigilancia',
      fechaProximaCita: '2026-12-15',
    }
    const r = agendarProximaRevisionVigilancia(caso, '2026-12-20')
    expect(r.estado).toBe('vigilancia')
    expect(r.fechaProximaCita).toBe('2027-06-20')
  })

  it('no muta el caso original', () => {
    const caso = { codigo: 'PON-SPI-0001', estado: 'en_seguimiento' }
    const copia = { ...caso }
    agendarProximaRevisionVigilancia(caso, '2026-06-15')
    expect(caso).toEqual(copia)
  })
})
