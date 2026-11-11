import { describe, expect, it } from 'vitest'
import { calcularSemaforo } from './semaforo.js'

const HOY = '2026-06-15'

describe('calcularSemaforo — caso cerrado', () => {
  it('alta no tiene color y etiqueta "Cerrado"', () => {
    const r = calcularSemaforo({ estado: 'alta' }, [], HOY)
    expect(r.color).toBe(null)
    expect(r.etiqueta).toBe('Cerrado')
    expect(r.referencia).toBe('cerrado')
  })

  it('referido tampoco tiene color', () => {
    const r = calcularSemaforo({ estado: 'referido' }, [], HOY)
    expect(r.color).toBe(null)
    expect(r.referencia).toBe('cerrado')
  })
})

describe('calcularSemaforo — con cita programada', () => {
  it('cita hoy: verde "A tiempo"', () => {
    const r = calcularSemaforo({ estado: 'en_seguimiento', fechaProximaCita: HOY }, [], HOY)
    expect(r).toEqual({ color: 'verde', etiqueta: 'A tiempo', diasRetraso: 0, referencia: 'cita' })
  })

  it('cita en el futuro: verde', () => {
    const r = calcularSemaforo({ estado: 'en_seguimiento', fechaProximaCita: '2026-07-01' }, [], HOY)
    expect(r.color).toBe('verde')
  })

  it('1 día de retraso: amarillo', () => {
    const r = calcularSemaforo({ estado: 'en_seguimiento', fechaProximaCita: '2026-06-14' }, [], HOY)
    expect(r).toEqual({ color: 'amarillo', etiqueta: 'Con retraso (1 días)', diasRetraso: 1, referencia: 'cita' })
  })

  it('28 días de retraso: amarillo (borde superior)', () => {
    const r = calcularSemaforo({ estado: 'en_seguimiento', fechaProximaCita: '2026-05-18' }, [], HOY)
    expect(r.color).toBe('amarillo')
    expect(r.diasRetraso).toBe(28)
  })

  it('29 días de retraso: rojo', () => {
    const r = calcularSemaforo({ estado: 'en_seguimiento', fechaProximaCita: '2026-05-17' }, [], HOY)
    expect(r.color).toBe('rojo')
    expect(r.etiqueta).toBe('Retraso alto (29 días)')
    expect(r.diasRetraso).toBe(29)
  })

  it('vigilancia usa la cita como el resto', () => {
    const r = calcularSemaforo({ estado: 'vigilancia', fechaProximaCita: '2026-05-10' }, [], HOY)
    expect(r.color).toBe('rojo')
    expect(r.referencia).toBe('cita')
  })
})

describe('calcularSemaforo — sin cita, desde el último evento', () => {
  const caso = { estado: 'en_seguimiento' }

  it('sin eventos: verde "Pendiente de agendar"', () => {
    const r = calcularSemaforo(caso, [], HOY)
    expect(r).toEqual({ color: 'verde', etiqueta: 'Pendiente de agendar', diasRetraso: 0, referencia: 'ultimo_evento' })
  })

  it('último evento hace 14 días: verde', () => {
    const r = calcularSemaforo(caso, [{ tipo: 'resultado', fecha: '2026-06-01' }], HOY)
    expect(r.color).toBe('verde')
    expect(r.diasRetraso).toBe(14)
  })

  it('último evento hace 15 días: amarillo', () => {
    const r = calcularSemaforo(caso, [{ tipo: 'resultado', fecha: '2026-05-31' }], HOY)
    expect(r.color).toBe('amarillo')
    expect(r.etiqueta).toBe('Sin cita (15 días)')
  })

  it('último evento hace 42 días: amarillo (borde superior)', () => {
    const r = calcularSemaforo(caso, [{ tipo: 'resultado', fecha: '2026-05-04' }], HOY)
    expect(r.color).toBe('amarillo')
    expect(r.diasRetraso).toBe(42)
  })

  it('último evento hace 43 días: rojo', () => {
    const r = calcularSemaforo(caso, [{ tipo: 'resultado', fecha: '2026-05-03' }], HOY)
    expect(r.color).toBe('rojo')
    expect(r.etiqueta).toBe('Sin cita, retraso alto (43 días)')
  })

  it('usa el resultado más reciente cuando hay varios', () => {
    const eventos = [
      { tipo: 'resultado', fecha: '2026-01-01' },
      { tipo: 'resultado', fecha: '2026-06-10' },
    ]
    const r = calcularSemaforo(caso, eventos, HOY)
    expect(r.diasRetraso).toBe(5)
    expect(r.color).toBe('verde')
  })

  it('cuando no hay resultados cae a caso.fechaTamizaje', () => {
    const r = calcularSemaforo({ estado: 'en_seguimiento', fechaTamizaje: '2026-05-04' }, [], HOY)
    expect(r.color).toBe('amarillo')
    expect(r.diasRetraso).toBe(42)
  })

  it('las visitas nunca reinician el reloj (resultado hace 50 d, visita ayer → sigue en rojo)', () => {
    const eventos = [
      { tipo: 'resultado', fecha: '2026-04-26' }, // hace 50 días
      { tipo: 'visita', fecha: '2026-06-14', visitaResultado: 'no_localizada' },
      { tipo: 'visita', fecha: '2026-06-10', visitaResultado: 'no_localizada' },
    ]
    const r = calcularSemaforo(caso, eventos, HOY)
    expect(r.color).toBe('rojo')
    expect(r.diasRetraso).toBe(50)
  })
})

describe('calcularSemaforo — etiqueta siempre presente', () => {
  it.each([
    [{ estado: 'alta' }, []],
    [{ estado: 'en_seguimiento', fechaProximaCita: HOY }, []],
    [{ estado: 'en_seguimiento', fechaProximaCita: '2026-05-01' }, []],
    [{ estado: 'en_seguimiento' }, []],
    [{ estado: 'en_seguimiento' }, [{ tipo: 'resultado', fecha: '2026-04-01' }]],
  ])('tiene etiqueta no vacía', (caso, eventos) => {
    const r = calcularSemaforo(caso, eventos, HOY)
    expect(typeof r.etiqueta).toBe('string')
    expect(r.etiqueta.length).toBeGreaterThan(0)
  })
})
