// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { desgloseSalidas, embudo, porcentajeCompletado, semaforoEnSeguimiento } from '../../domain/index.js'
import { desgloseEscenario, FRASE_CIERRE, NUMEROS_ESCENARIO, porcentajePerdida, resumenEscenario } from './comparar.js'

const HOY = '2026-11-14'

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

describe('porcentajePerdida', () => {
  it('perdidos ÷ (completados + perdidos), redondeado', () => {
    expect(porcentajePerdida(351, 77)).toBe(18)
    expect(porcentajePerdida(5, 5)).toBe(50)
  })

  it('no se muestra si alguna de las dos cifras es menor de 5', () => {
    expect(porcentajePerdida(4, 100)).toBeNull()
    expect(porcentajePerdida(100, 4)).toBeNull()
    expect(porcentajePerdida(0, 0)).toBeNull()
  })
})

describe('desgloseEscenario', () => {
  // 20 casos: 6 con alta en confirmación, 5 en vigilancia, 6 con cita futura
  // (a tiempo), 3 sin seguimiento.
  function cohorte() {
    const casos = []
    const eventos = []
    const tamizaje = (codigo) => eventos.push({ codigoCaso: codigo, tipo: 'resultado', etapa: 1, fecha: '2026-06-01' })
    for (let i = 1; i <= 6; i++) {
      casos.push({ codigo: `A${i}`, estado: 'alta', fechaTamizaje: '2026-06-01' })
      tamizaje(`A${i}`)
      eventos.push({ codigoCaso: `A${i}`, tipo: 'alta', etapa: 2, fecha: '2026-08-24' })
    }
    for (let i = 1; i <= 5; i++) {
      casos.push({ codigo: `V${i}`, estado: 'vigilancia', fechaTamizaje: '2026-06-01', fechaProximaCita: '2027-03-01' })
      tamizaje(`V${i}`)
    }
    for (let i = 1; i <= 6; i++) {
      casos.push({ codigo: `T${i}`, estado: 'en_seguimiento', fechaTamizaje: '2026-10-01', fechaProximaCita: '2026-12-24' })
      eventos.push({ codigoCaso: `T${i}`, tipo: 'resultado', etapa: 1, fecha: '2026-10-01' })
    }
    for (let i = 1; i <= 3; i++) {
      casos.push({ codigo: `S${i}`, estado: 'sin_seguimiento', fechaTamizaje: '2026-03-01' })
      eventos.push({ codigoCaso: `S${i}`, tipo: 'resultado', etapa: 1, fecha: '2026-03-01' })
    }
    return { casos, eventos }
  }

  it('cuenta completados, a tiempo, con retraso y sin seguimiento, con "menos de 5"', () => {
    expect(desgloseEscenario(cohorte(), HOY)).toEqual({
      total: 20,
      completados: 11,
      aTiempo: 6,
      conRetraso: 'menos de 5',
      sinSeguimiento: 'menos de 5',
      porcentajePerdida: null, // perdidos = 3, menor de 5
    })
  })

  it('con los JSON reales suma el total y coincide con el dominio', () => {
    for (const n of NUMEROS_ESCENARIO) {
      const d = leer(n)
      const r = desgloseEscenario(d, HOY)
      const salidas = desgloseSalidas(d.casos, d.eventos, HOY)
      const sem = semaforoEnSeguimiento(d.casos, d.eventos, HOY)
      const completados = salidas.alta + salidas.vigilancia + salidas.referido
      const perdidos = sem.amarillo + sem.rojo + salidas.sin_seguimiento
      expect(r.completados + r.aTiempo + r.conRetraso + r.sinSeguimiento).toBe(d.casos.length)
      expect(r.completados).toBe(completados)
      expect(r.aTiempo).toBe(sem.verde)
      expect(r.sinSeguimiento).toBe(salidas.sin_seguimiento)
      expect(r.porcentajePerdida).toBe(Math.round((perdidos / (completados + perdidos)) * 100))
    }
  })

  it('a más pérdida por paso, mayor % de pérdida', () => {
    const [p11, p30, p50] = NUMEROS_ESCENARIO.map((n) => desgloseEscenario(leer(n), HOY).porcentajePerdida)
    expect(p11).toBeLessThan(p30)
    expect(p30).toBeLessThan(p50)
  })

  it('resumenEscenario solo agrega el desglose si recibe la fecha', () => {
    expect(resumenEscenario(11, cohorte()).desglose).toBeNull()
    expect(resumenEscenario(11, cohorte(), HOY).desglose.completados).toBe(11)
  })
})
