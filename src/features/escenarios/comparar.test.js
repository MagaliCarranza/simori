// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { embudo, porcentajeCompletado } from '../../domain/index.js'
import { FRASE_CIERRE, NUMEROS_ESCENARIO, resumenEscenario } from './comparar.js'

const leer = (n) => JSON.parse(readFileSync(new URL(`../../../public/data/casos_${n}.json`, import.meta.url), 'utf8'))

// 10 casos: 7 confirmados, 5 valorados, 3 clasificados.
function cohorte() {
  const casos = Array.from({ length: 10 }, (_, i) => ({ codigo: `C${i + 1}`, estado: 'en_seguimiento' }))
  const ev = (desde, hasta, etapa) =>
    casos.slice(desde, hasta).map((c) => ({ codigoCaso: c.codigo, tipo: 'resultado', etapa, fecha: '2026-01-10' }))
  return { casos, eventos: [...ev(0, 10, 1), ...ev(0, 7, 2), ...ev(0, 5, 3), ...ev(0, 3, 4)] }
}

describe('resumenEscenario', () => {
  it('usa embudo() por etapa con % sobre los positivos y enmascara cifras menores de 5', () => {
    const r = resumenEscenario(11, cohorte())
    expect(r.total).toBe(10)
    expect(r.etapas.map((e) => [e.etapa, e.n, e.porcentaje])).toEqual([
      [1, 10, 100],
      [2, 7, 70],
      [3, 5, 50],
      [4, 'menos de 5', 30],
      [5, 'menos de 5', 0],
    ])
    expect(r.completados).toBe('menos de 5')
    expect(r.porcentajeFinal).toBe(30)
  })

  it('con menos de 5 casos no muestra porcentajes', () => {
    const { casos, eventos } = cohorte()
    const r = resumenEscenario(30, { casos: casos.slice(0, 3), eventos: eventos.filter((e) => ['C1', 'C2', 'C3'].includes(e.codigoCaso)) })
    expect(r.total).toBe('menos de 5')
    expect(r.porcentajeFinal).toBeNull()
    expect(r.etapas.every((e) => e.porcentaje === null)).toBe(true)
  })

  it('sin datos no truena', () => {
    expect(resumenEscenario(50).porcentajeFinal).toBeNull()
  })

  it('con los JSON reales coincide con el dominio y la pérdida mayor deja menos casos', () => {
    const resumenes = NUMEROS_ESCENARIO.map((n) => {
      const d = leer(n)
      const r = resumenEscenario(n, d)
      expect(r.porcentajeFinal).toBe(Math.round(porcentajeCompletado(d.casos, d.eventos)))
      const base = embudo(d.casos, d.eventos)
      expect(r.etapas.map((e) => e.porcentaje)).toEqual(base.map((e) => Math.round((e.n / d.casos.length) * 100)))
      return r
    })
    expect(NUMEROS_ESCENARIO).toEqual([11, 30, 50])
    const [r11, r30, r50] = resumenes
    expect(r11.porcentajeFinal).toBeGreaterThan(r30.porcentajeFinal)
    expect(r30.porcentajeFinal).toBeGreaterThan(r50.porcentajeFinal)
  })

  it('frase de cierre', () => {
    expect(FRASE_CIERRE).toBe('Hoy no se sabe dónde se pierden. Con SIMORI, se sabría cada semana.')
  })
})
