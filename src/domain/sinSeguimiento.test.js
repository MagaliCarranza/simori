import { describe, expect, it } from 'vitest'
import { debeMarcarseSinSeguimiento, puedeReactivarse } from './sinSeguimiento.js'

const HOY = '2026-06-15'

describe('debeMarcarseSinSeguimiento', () => {
  it('rojo + 2 visitas no_localizada → true', () => {
    const caso = { estado: 'en_seguimiento', fechaProximaCita: '2026-05-10' } // 36 días rojo? no, 36 → rojo (>28)
    const eventos = [
      { tipo: 'visita', fecha: '2026-05-20', visitaResultado: 'no_localizada' },
      { tipo: 'visita', fecha: '2026-06-01', visitaResultado: 'no_localizada' },
    ]
    expect(debeMarcarseSinSeguimiento(caso, eventos, HOY)).toBe(true)
  })

  it('rojo + 1 visita no_localizada → false (aún no cumple 84 días)', () => {
    const caso = { estado: 'en_seguimiento', fechaProximaCita: '2026-05-10' }
    const eventos = [{ tipo: 'visita', fecha: '2026-05-20', visitaResultado: 'no_localizada' }]
    expect(debeMarcarseSinSeguimiento(caso, eventos, HOY)).toBe(false)
  })

  it('amarillo con varias visitas no_localizada → false (hay que estar en rojo)', () => {
    const caso = { estado: 'en_seguimiento', fechaProximaCita: '2026-06-01' } // 14 días amarillo
    const eventos = [
      { tipo: 'visita', fecha: '2026-06-05', visitaResultado: 'no_localizada' },
      { tipo: 'visita', fecha: '2026-06-10', visitaResultado: 'no_localizada' },
      { tipo: 'visita', fecha: '2026-06-12', visitaResultado: 'no_localizada' },
    ]
    expect(debeMarcarseSinSeguimiento(caso, eventos, HOY)).toBe(false)
  })

  it('retraso > 84 días sin visitas → true', () => {
    // Cita hace 85 días
    const caso = { estado: 'en_seguimiento', fechaProximaCita: '2026-03-22' }
    expect(debeMarcarseSinSeguimiento(caso, [], HOY)).toBe(true)
  })

  it('caso cerrado nunca pasa a sin_seguimiento', () => {
    expect(debeMarcarseSinSeguimiento({ estado: 'alta' }, [], HOY)).toBe(false)
    expect(debeMarcarseSinSeguimiento({ estado: 'referido' }, [], HOY)).toBe(false)
  })

  it('sin cita: rojo por retraso desde último resultado + 2 visitas no_localizada → true', () => {
    // Las visitas no reinician el reloj: el resultado fue hace 50 d (rojo).
    const caso = { estado: 'en_seguimiento' }
    const eventos = [
      { tipo: 'resultado', fecha: '2026-04-26' },
      { tipo: 'visita', fecha: '2026-06-10', visitaResultado: 'no_localizada' },
      { tipo: 'visita', fecha: '2026-06-14', visitaResultado: 'no_localizada' },
    ]
    expect(debeMarcarseSinSeguimiento(caso, eventos, HOY)).toBe(true)
  })
})

describe('puedeReactivarse', () => {
  it('sin_seguimiento + evento resultado → true', () => {
    const caso = { estado: 'sin_seguimiento' }
    expect(puedeReactivarse(caso, { tipo: 'resultado' })).toBe(true)
  })

  it('sin_seguimiento + evento cita → true', () => {
    const caso = { estado: 'sin_seguimiento' }
    expect(puedeReactivarse(caso, { tipo: 'cita' })).toBe(true)
  })

  it('sin_seguimiento + visita → false (visita sola no reactiva)', () => {
    const caso = { estado: 'sin_seguimiento' }
    expect(puedeReactivarse(caso, { tipo: 'visita' })).toBe(false)
  })

  it('caso en seguimiento no se reactiva (no aplica)', () => {
    const caso = { estado: 'en_seguimiento' }
    expect(puedeReactivarse(caso, { tipo: 'resultado' })).toBe(false)
  })
})
