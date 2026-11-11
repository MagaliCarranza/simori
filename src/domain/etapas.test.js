import { describe, expect, it } from 'vitest'
import { estadoDerivado, etapaDerivada, siguienteEtapa } from './etapas.js'

describe('etapaDerivada', () => {
  it('sin eventos devuelve 0', () => {
    expect(etapaDerivada([])).toBe(0)
  })

  it('un resultado de tamizaje positivo marca etapa 1', () => {
    expect(etapaDerivada([{ tipo: 'resultado', etapa: 1, fecha: '2026-01-01' }])).toBe(1)
  })

  it('toma el máximo entre varios resultados', () => {
    const eventos = [
      { tipo: 'resultado', etapa: 1, fecha: '2026-01-01' },
      { tipo: 'resultado', etapa: 2, fecha: '2026-03-26' },
      { tipo: 'resultado', etapa: 4, fecha: '2026-06-01' },
    ]
    expect(etapaDerivada(eventos)).toBe(4)
  })

  it('ignora eventos que no son resultado', () => {
    const eventos = [
      { tipo: 'cita', etapa: 2, fecha: '2026-02-01' },
      { tipo: 'visita', etapa: 3, fecha: '2026-03-01' },
      { tipo: 'resultado', etapa: 1, fecha: '2026-01-01' },
    ]
    expect(etapaDerivada(eventos)).toBe(1)
  })
})

describe('siguienteEtapa', () => {
  it('avanza linealmente', () => {
    expect(siguienteEtapa(1)).toBe(2)
    expect(siguienteEtapa(2)).toBe(3)
    expect(siguienteEtapa(4)).toBe(5)
  })

  it('devuelve null en la última etapa', () => {
    expect(siguienteEtapa(5)).toBe(null)
  })
})

describe('estadoDerivado', () => {
  const baseCaso = { codigo: 'PON-SPI-0001', estado: 'en_seguimiento' }

  it('evento alta manda, aunque el caso diga en_seguimiento', () => {
    const eventos = [{ tipo: 'alta', fecha: '2026-04-01' }]
    expect(estadoDerivado(baseCaso, eventos)).toBe('alta')
  })

  it('evento referencia manda', () => {
    const eventos = [{ tipo: 'referencia', fecha: '2026-06-01' }]
    expect(estadoDerivado(baseCaso, eventos)).toBe('referido')
  })

  it('conserva vigilancia si no hay evento terminal', () => {
    expect(estadoDerivado({ ...baseCaso, estado: 'vigilancia' }, [])).toBe('vigilancia')
  })

  it('conserva sin_seguimiento si no hay evento terminal', () => {
    expect(estadoDerivado({ ...baseCaso, estado: 'sin_seguimiento' }, [])).toBe('sin_seguimiento')
  })

  it('en_seguimiento por defecto', () => {
    expect(estadoDerivado(baseCaso, [{ tipo: 'resultado', etapa: 2, fecha: '2026-03-26' }])).toBe('en_seguimiento')
  })
})
