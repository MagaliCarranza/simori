import { describe, expect, it } from 'vitest'
import { embudo, enmascararMenorQue5 } from './embudo.js'

describe('embudo', () => {
  it('cuenta acumulado por etapa (casos que llegaron a esa etapa o más)', () => {
    // 10 casos tamizados; 7 confirmados (etapa 2); 5 valorados (etapa 3); 3 clasificados (etapa 4)
    const casos = Array.from({ length: 10 }, (_, i) => ({ codigo: `C${i + 1}` }))
    const eventos = [
      // 10 con etapa 1
      ...casos.map((c) => ({ codigoCaso: c.codigo, tipo: 'resultado', etapa: 1, fecha: '2026-01-10' })),
      // 7 con etapa 2
      ...casos.slice(0, 7).map((c) => ({ codigoCaso: c.codigo, tipo: 'resultado', etapa: 2, fecha: '2026-03-26' })),
      // 5 con etapa 3
      ...casos.slice(0, 5).map((c) => ({ codigoCaso: c.codigo, tipo: 'resultado', etapa: 3, fecha: '2026-04-15' })),
      // 3 con etapa 4
      ...casos.slice(0, 3).map((c) => ({ codigoCaso: c.codigo, tipo: 'resultado', etapa: 4, fecha: '2026-05-01' })),
    ]
    expect(embudo(casos, eventos)).toEqual([
      { etapa: 1, titulo: 'Tamizaje', n: 10 },
      { etapa: 2, titulo: 'Confirmación', n: 7 },
      { etapa: 3, titulo: 'Valoración', n: 5 },
      { etapa: 4, titulo: 'Clasificación', n: 3 },
      { etapa: 5, titulo: 'Salida', n: 0 },
    ])
  })

  it('sin casos devuelve 0 en todas las etapas', () => {
    expect(embudo([], [])).toEqual([
      { etapa: 1, titulo: 'Tamizaje', n: 0 },
      { etapa: 2, titulo: 'Confirmación', n: 0 },
      { etapa: 3, titulo: 'Valoración', n: 0 },
      { etapa: 4, titulo: 'Clasificación', n: 0 },
      { etapa: 5, titulo: 'Salida', n: 0 },
    ])
  })
})

describe('embudo: etapa 5 "Salida"', () => {
  const clasificado = (codigo) => [
    { codigoCaso: codigo, tipo: 'resultado', etapa: 1, fecha: '2026-01-10' },
    { codigoCaso: codigo, tipo: 'resultado', etapa: 4, fecha: '2026-05-01' },
  ]
  const nEtapa5 = (casos, eventos) => embudo(casos, eventos)[4].n

  it('cuenta un referido por evento "referencia"', () => {
    const eventos = [...clasificado('C1'), { codigoCaso: 'C1', tipo: 'referencia', etapa: 4, fecha: '2026-05-01' }]
    expect(nEtapa5([{ codigo: 'C1', estado: 'en_seguimiento' }], eventos)).toBe(1)
  })

  it('el evento manda: estado "referido" sin evento "referencia" no cuenta (igual que estadoDerivado)', () => {
    expect(nEtapa5([{ codigo: 'C1', estado: 'referido' }], clasificado('C1'))).toBe(0)
  })

  it('cuenta un caso en vigilancia sin eventos de etapa 5', () => {
    expect(nEtapa5([{ codigo: 'C1', estado: 'vigilancia' }], clasificado('C1'))).toBe(1)
  })

  it('no cuenta "alta" como etapa 5', () => {
    const eventos = [
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 2, fecha: '2026-03-26' },
      { codigoCaso: 'C1', tipo: 'alta', etapa: 2, fecha: '2026-03-26' },
    ]
    expect(nEtapa5([{ codigo: 'C1', estado: 'alta' }], eventos)).toBe(0)
  })

  it('un caso en salida cuenta también en las etapas 1 a 4 (embudo acumulado)', () => {
    expect(embudo([{ codigo: 'C1', estado: 'vigilancia' }], []).map((e) => e.n)).toEqual([1, 1, 1, 1, 1])
  })
})

describe('enmascararMenorQue5', () => {
  it('enmascara 0..4', () => {
    expect(enmascararMenorQue5(0)).toBe('menos de 5')
    expect(enmascararMenorQue5(4)).toBe('menos de 5')
  })

  it('deja pasar 5 o más', () => {
    expect(enmascararMenorQue5(5)).toBe(5)
    expect(enmascararMenorQue5(100)).toBe(100)
  })
})
