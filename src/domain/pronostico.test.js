import { describe, expect, it } from 'vitest'
import { llegadasEsperadas, pronosticoDemanda, semanasPronostico } from './pronostico.js'

const HOY = '2026-11-14'

function caso(codigo, { clues = 'JCSSA004213', fecha = '2026-11-20', estado = 'en_seguimiento' } = {}) {
  return { codigo, clues, fechaProximaCita: fecha, estado }
}

describe('llegadasEsperadas', () => {
  it('20 citas con 30 % de pérdida dan 14', () => {
    expect(llegadasEsperadas(20, 30)).toBe(14)
  })

  it('redondea al entero más cercano (los .5 hacia arriba, sin error de flotante)', () => {
    expect(llegadasEsperadas(5, 30)).toBe(4) // 3.5
    expect(llegadasEsperadas(3, 50)).toBe(2) // 1.5
    expect(llegadasEsperadas(7, 11)).toBe(6) // 6.23
    expect(llegadasEsperadas(1, 50)).toBe(1) // 0.5
  })

  it('cero citas dan cero llegadas', () => {
    expect(llegadasEsperadas(0, 50)).toBe(0)
  })

  it('rechaza porcentajes fuera de 0–100', () => {
    expect(() => llegadasEsperadas(10, 120)).toThrow()
    expect(() => llegadasEsperadas(10, null)).not.toThrow() // Number(null) = 0
    expect(() => llegadasEsperadas(10, 'x')).toThrow()
  })
})

describe('semanasPronostico', () => {
  it('8 bloques de 7 días desde hoy', () => {
    const s = semanasPronostico(HOY)
    expect(s).toHaveLength(8)
    expect(s[0]).toEqual({ numero: 1, inicio: '2026-11-14', fin: '2026-11-20' })
    expect(s[1]).toEqual({ numero: 2, inicio: '2026-11-21', fin: '2026-11-27' })
    expect(s[7]).toEqual({ numero: 8, inicio: '2027-01-02', fin: '2027-01-08' })
  })
})

describe('pronosticoDemanda', () => {
  it('cuenta citas por centro y semana y aplica la pérdida', () => {
    const casos = [
      ...Array.from({ length: 20 }, (_, i) => caso(`A${i}`, { fecha: '2026-11-21' })),
      caso('B1', { clues: 'JCSSA000001', fecha: '2026-11-14', estado: 'vigilancia' }),
    ]
    const r = pronosticoDemanda({ casos, hoyISO: HOY, porcentajePerdida: 30 })
    expect(r.semanas).toHaveLength(8)
    expect(r.centros.map((c) => c.clues)).toEqual(['JCSSA000001', 'JCSSA004213'])

    const a = r.centros[1]
    expect(a.semanas[1]).toMatchObject({ numero: 2, citas: 20, llegadas: 14 })
    expect(a.semanas[0]).toMatchObject({ citas: 0, llegadas: 0 })
    expect(a.totalCitas).toBe(20)
    expect(a.totalLlegadas).toBe(14)

    expect(r.centros[0].semanas[0]).toMatchObject({ citas: 1, llegadas: 1 })
  })

  it('respeta los límites de la ventana: hoy entra, el día 56 ya no', () => {
    const casos = [
      caso('dentro-inicio', { fecha: '2026-11-14' }),
      caso('dentro-fin', { fecha: '2027-01-08' }),
      caso('fuera', { fecha: '2027-01-09' }),
      caso('vencida', { fecha: '2026-11-13' }),
    ]
    const [c] = pronosticoDemanda({ casos, hoyISO: HOY, porcentajePerdida: 0 }).centros
    expect(c.semanas[0].citas).toBe(1)
    expect(c.semanas[7].citas).toBe(1)
    expect(c.totalCitas).toBe(2)
  })

  it('solo cuenta casos activos (en seguimiento y vigilancia)', () => {
    const casos = [
      caso('1', { estado: 'en_seguimiento' }),
      caso('2', { estado: 'vigilancia' }),
      caso('3', { estado: 'sin_seguimiento' }),
      caso('4', { estado: 'alta' }),
      caso('5', { estado: 'referido' }),
      caso('6', { fecha: null }),
    ]
    const [c] = pronosticoDemanda({ casos, hoyISO: HOY, porcentajePerdida: 0 }).centros
    expect(c.totalCitas).toBe(2)
  })

  it('incluye en cero los centros del catálogo sin citas', () => {
    const r = pronosticoDemanda({ casos: [], hoyISO: HOY, porcentajePerdida: 11, cluesCentros: ['JCSSA004213'] })
    expect(r.centros).toHaveLength(1)
    expect(r.centros[0].totalCitas).toBe(0)
    expect(r.centros[0].semanas).toHaveLength(8)
  })

  it('no expone códigos de caso', () => {
    const r = pronosticoDemanda({ casos: [caso('PON-AC-0001')], hoyISO: HOY, porcentajePerdida: 11 })
    expect(JSON.stringify(r)).not.toMatch(/PON-/)
  })

  it('el total de llegadas es la suma de las semanas redondeadas', () => {
    // 1 cita en dos semanas con 50 %: 0.5 → 1 cada una, total 2 (no round(1) = 1).
    const casos = [caso('a', { fecha: '2026-11-14' }), caso('b', { fecha: '2026-11-21' })]
    const [c] = pronosticoDemanda({ casos, hoyISO: HOY, porcentajePerdida: 50 }).centros
    expect(c.totalLlegadas).toBe(2)
  })
})
