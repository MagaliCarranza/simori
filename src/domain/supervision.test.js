import { describe, expect, it } from 'vitest'
import { desgloseSalidas, resumenPorGrupo, resumenSupervision, SALIDAS } from './supervision.js'

const HOY = '2026-11-14'

// n casos en seguimiento, con cita futura (verde) para no caer en sin seguimiento.
function crearCasos(n, prefijo = 'C', extra = {}) {
  return Array.from({ length: n }, (_, i) => ({
    codigo: `${prefijo}${i + 1}`,
    estado: 'en_seguimiento',
    fechaTamizaje: '2026-09-01',
    fechaProximaCita: '2026-12-01',
    ...extra,
  }))
}

const resultado = (codigoCaso, etapa, fecha) => ({ codigoCaso, tipo: 'resultado', etapa, fecha })

describe('desgloseSalidas', () => {
  it('cuenta cada salida y las cinco suman el total', () => {
    const casos = [
      ...crearCasos(2, 'A'),
      { codigo: 'V1', estado: 'vigilancia', fechaProximaCita: '2027-01-01' },
      { codigo: 'S1', estado: 'en_seguimiento', fechaTamizaje: '2026-01-10' }, // sin cita, > 84 días
      { codigo: 'H1', estado: 'en_seguimiento', fechaProximaCita: '2026-12-01' },
      { codigo: 'R1', estado: 'en_seguimiento', fechaProximaCita: '2026-12-01' },
    ]
    const eventos = [
      { codigoCaso: 'H1', tipo: 'alta', fecha: '2026-10-01' },
      { codigoCaso: 'R1', tipo: 'referencia', fecha: '2026-10-01' },
    ]
    const d = desgloseSalidas(casos, eventos, HOY)
    expect(d).toEqual({ alta: 1, vigilancia: 1, referido: 1, sin_seguimiento: 1, en_seguimiento: 2 })
    expect(Object.values(d).reduce((a, b) => a + b, 0)).toBe(casos.length)
  })

  it('calcula sin seguimiento sin modificar el caso', () => {
    const caso = { codigo: 'S1', estado: 'en_seguimiento', fechaTamizaje: '2026-01-10' }
    desgloseSalidas([caso], [], HOY)
    expect(caso.estado).toBe('en_seguimiento')
  })
})

describe('resumenSupervision: enmascarado', () => {
  it('total 0, 4 → "menos de 5"; 5 y 6 → número', () => {
    expect(resumenSupervision([], [], HOY).total).toBe('menos de 5')
    expect(resumenSupervision(crearCasos(4), [], HOY).total).toBe('menos de 5')
    expect(resumenSupervision(crearCasos(5), [], HOY).total).toBe(5)
    expect(resumenSupervision(crearCasos(6), [], HOY).total).toBe(6)
  })

  it('enmascara cada etapa del embudo y cada salida menor de 5 (incluido 0)', () => {
    const casos = crearCasos(6)
    const eventos = [
      ...casos.map((c) => resultado(c.codigo, 1, '2026-09-01')),
      ...casos.slice(0, 3).map((c) => resultado(c.codigo, 2, '2026-10-01')),
    ]
    const r = resumenSupervision(casos, eventos, HOY)
    expect(r.embudo.map((e) => e.n)).toEqual([6, 'menos de 5', 'menos de 5', 'menos de 5', 'menos de 5'])
    expect(r.salidas).toEqual({
      alta: 'menos de 5',
      vigilancia: 'menos de 5',
      referido: 'menos de 5',
      sin_seguimiento: 'menos de 5',
      en_seguimiento: 6,
    })
    expect(Object.keys(r.salidas)).toEqual(SALIDAS)
  })

  it('no contiene códigos de caso', () => {
    const casos = crearCasos(8, 'PON-SPI-')
    const eventos = casos.map((c) => resultado(c.codigo, 1, '2026-09-01'))
    const texto = JSON.stringify(resumenSupervision(casos, eventos, HOY))
    expect(texto).not.toMatch(/PON-/)
    expect(texto).not.toMatch(/codigo/)
  })
})

describe('resumenSupervision: % completado', () => {
  const completar = (casos) => casos.map((c) => resultado(c.codigo, 4, '2026-10-01'))

  it('se muestra con numerador y total >= 5', () => {
    const casos = crearCasos(10)
    const r = resumenSupervision(casos, completar(casos.slice(0, 5)), HOY)
    expect(r.completado).toEqual({ porcentaje: 50, visible: true })
  })

  it('se oculta si el numerador es menor de 5 (3 de 10 revelaría 3 casos)', () => {
    const casos = crearCasos(10)
    const r = resumenSupervision(casos, completar(casos.slice(0, 3)), HOY)
    expect(r.completado).toEqual({ porcentaje: null, visible: false })
  })

  it('se oculta si el total es menor de 5 aunque todos completen', () => {
    const casos = crearCasos(4)
    expect(resumenSupervision(casos, completar(casos), HOY).completado.visible).toBe(false)
  })

  it('se oculta con 0 completados', () => {
    expect(resumenSupervision(crearCasos(10), [], HOY).completado.visible).toBe(false)
  })
})

describe('resumenSupervision: mediana de días entre etapas', () => {
  function conTransicion(n) {
    const casos = crearCasos(n)
    const eventos = casos.flatMap((c) => [resultado(c.codigo, 1, '2026-08-01'), resultado(c.codigo, 2, '2026-08-31')])
    return resumenSupervision(casos, eventos, HOY).medianas
  }

  it('con 5 casos en la transición muestra la mediana', () => {
    expect(conTransicion(5)['t1->t2']).toEqual({ dias: 30, suficiente: true })
  })

  it('con menos de 5 casos marca datos insuficientes', () => {
    expect(conTransicion(4)['t1->t2']).toEqual({ dias: null, suficiente: false })
  })

  it('transición sin casos marca datos insuficientes', () => {
    expect(conTransicion(6)['t2->t3']).toEqual({ dias: null, suficiente: false })
  })
})

describe('resumenPorGrupo', () => {
  it('agrupa por clave, enmascara por grupo y omite casos sin clave', () => {
    const casos = [
      ...crearCasos(6, 'A', { cct: 'E1' }),
      ...crearCasos(2, 'B', { cct: 'E2' }),
      ...crearCasos(1, 'X', { cct: null }),
    ]
    const grupos = resumenPorGrupo(casos, [], HOY, (c) => c.cct)
    expect(grupos.map((g) => [g.clave, g.total])).toEqual([
      ['E1', 6],
      ['E2', 'menos de 5'],
    ])
    expect(JSON.stringify(grupos)).not.toMatch(/"codigo"/)
  })
})
