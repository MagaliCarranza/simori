import { describe, expect, it } from 'vitest'
import { contarCompletados, diasEntreEtapas, medianaDiasEntreEtapas, porcentajeCompletado } from './indicador.js'

describe('porcentajeCompletado', () => {
  it('60 de 100 llegan a clasificación → 60', () => {
    const casos = Array.from({ length: 100 }, (_, i) => ({ codigo: `C${i + 1}`, estado: 'en_seguimiento' }))
    const eventos = casos
      .slice(0, 60)
      .map((c) => ({ codigoCaso: c.codigo, tipo: 'resultado', etapa: 4, fecha: '2026-05-01' }))
    expect(porcentajeCompletado(casos, eventos)).toBe(60)
  })

  it('un evento alta cuenta como completado aunque no haya llegado a etapa 4', () => {
    const casos = [
      { codigo: 'C1', estado: 'alta' },
      { codigo: 'C2', estado: 'en_seguimiento' },
    ]
    const eventos = [
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 2, fecha: '2026-03-26' },
      { codigoCaso: 'C1', tipo: 'alta', fecha: '2026-04-01' },
    ]
    expect(porcentajeCompletado(casos, eventos)).toBe(50)
  })

  it('sin casos devuelve 0', () => {
    expect(porcentajeCompletado([], [])).toBe(0)
  })
})

describe('medianaDiasEntreEtapas', () => {
  it('calcula la mediana por transición', () => {
    const casos = [{ codigo: 'C1' }, { codigo: 'C2' }, { codigo: 'C3' }]
    const eventos = [
      // C1: 1→2 = 84, 2→3 = 20
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 1, fecha: '2026-01-01' },
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 2, fecha: '2026-03-26' },
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 3, fecha: '2026-04-15' },
      // C2: 1→2 = 90, 2→3 = 10
      { codigoCaso: 'C2', tipo: 'resultado', etapa: 1, fecha: '2026-01-01' },
      { codigoCaso: 'C2', tipo: 'resultado', etapa: 2, fecha: '2026-04-01' },
      { codigoCaso: 'C2', tipo: 'resultado', etapa: 3, fecha: '2026-04-11' },
      // C3: solo 1→2 = 100
      { codigoCaso: 'C3', tipo: 'resultado', etapa: 1, fecha: '2026-01-01' },
      { codigoCaso: 'C3', tipo: 'resultado', etapa: 2, fecha: '2026-04-11' },
    ]
    const r = medianaDiasEntreEtapas(casos, eventos)
    // t1->t2: [84, 90, 100] → mediana 90
    expect(r['t1->t2']).toBe(90)
    // t2->t3: [20, 10] → mediana 15
    expect(r['t2->t3']).toBe(15)
    // t3->t4, t4->t5 vacíos
    expect(r['t3->t4']).toBe(null)
    expect(r['t4->t5']).toBe(null)
  })
})

describe('contarCompletados y diasEntreEtapas', () => {
  it('cuenta etapa 4 o alta como completado', () => {
    const casos = [{ codigo: 'C1' }, { codigo: 'C2' }, { codigo: 'C3' }]
    const eventos = [
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 4, fecha: '2026-05-01' },
      { codigoCaso: 'C2', tipo: 'alta', fecha: '2026-05-01' },
    ]
    expect(contarCompletados(casos, eventos)).toBe(2)
  })

  it('devuelve los días de cada caso por transición', () => {
    const casos = [{ codigo: 'C1' }, { codigo: 'C2' }]
    const eventos = [
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 1, fecha: '2026-01-01' },
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 2, fecha: '2026-01-11' },
      { codigoCaso: 'C2', tipo: 'resultado', etapa: 1, fecha: '2026-01-01' },
    ]
    expect(diasEntreEtapas(casos, eventos)).toEqual({ 't1->t2': [10], 't2->t3': [], 't3->t4': [], 't4->t5': [] })
  })
})
