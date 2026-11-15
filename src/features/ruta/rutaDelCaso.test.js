import { describe, expect, it } from 'vitest'
import { etapasDeLaRuta, TEXTO_ESTADO_ETAPA } from './ruta.js'

const tamizaje = { codigoCaso: 'C1', tipo: 'resultado', etapa: 1, fecha: '2026-08-01', tiraMgL: 50 }
const caso = (c = {}) => ({ codigo: 'C1', etapaActual: 1, estado: 'en_seguimiento', fechaProximaCita: '2026-10-24', ...c })
const resumen = (etapas) => etapas.map((e) => [e.etapa, e.estado])

describe('etapasDeLaRuta', () => {
  it('siempre devuelve las 5 etapas con nombre y estado en texto', () => {
    const etapas = etapasDeLaRuta(caso(), [tamizaje])
    expect(etapas.map((e) => e.nombre)).toEqual(['Tamizaje', 'Confirmación', 'Valoración', 'Clasificación', 'Salida'])
    for (const e of etapas) expect(TEXTO_ESTADO_ETAPA[e.estado]).toBeTruthy()
  })

  it('tamizaje registrado y confirmación en curso con su cita', () => {
    const etapas = etapasDeLaRuta(caso(), [tamizaje])
    expect(resumen(etapas)).toEqual([
      [1, 'hecha'],
      [2, 'en_curso'],
      [3, 'pendiente'],
      [4, 'pendiente'],
      [5, 'pendiente'],
    ])
    expect(etapas[0]).toMatchObject({ fecha: '2026-08-01', detalle: 'Tira 50 mg/L' })
    expect(etapas[1]).toMatchObject({ fecha: '2026-10-24', detalle: 'Cita agendada' })
  })

  it('sin cita, la etapa en curso lo dice', () => {
    const etapas = etapasDeLaRuta(caso({ fechaProximaCita: null }), [tamizaje])
    expect(etapas[1]).toMatchObject({ estado: 'en_curso', fecha: null, detalle: 'Sin cita agendada' })
  })

  it('confirmación negativa: alta y las siguientes etapas no aplican', () => {
    const eventos = [
      tamizaje,
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 2, fecha: '2026-10-24', tiraMgL: 0 },
      { codigoCaso: 'C1', tipo: 'alta', etapa: 2, fecha: '2026-10-24', nota: 'No confirmado' },
    ]
    const etapas = etapasDeLaRuta(caso({ etapaActual: 2, estado: 'alta', fechaProximaCita: null }), eventos)
    expect(resumen(etapas)).toEqual([
      [1, 'hecha'],
      [2, 'hecha'],
      [3, 'no_aplica'],
      [4, 'no_aplica'],
      [5, 'no_aplica'],
    ])
    expect(etapas[1].detalle).toBe('Tira 0 mg/L: no se confirmó; el caso se cerró con alta')
  })

  it('clasificado y referido: las 5 etapas registradas', () => {
    const eventos = [
      tamizaje,
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 2, fecha: '2026-10-24', tiraMgL: 50 },
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 3, fecha: '2026-11-01', tfge: 52.3 },
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 4, fecha: '2026-11-10', tfge: 52.3, categoriaG: 'G3a', categoriaA: 'A2' },
      { codigoCaso: 'C1', tipo: 'referencia', etapa: 4, fecha: '2026-11-10' },
    ]
    const etapas = etapasDeLaRuta(caso({ etapaActual: 4, estado: 'referido', fechaProximaCita: null }), eventos)
    expect(etapas.every((e) => e.estado === 'hecha')).toBe(true)
    expect(etapas[2].detalle).toBe('Filtración estimada (TFGe) 52.3')
    expect(etapas[3].detalle).toBe('Categorías G3a A2')
    expect(etapas[4]).toMatchObject({ fecha: '2026-11-10', detalle: 'Referencia registrada' })
  })

  it('en vigilancia, la salida queda registrada', () => {
    const eventos = [
      tamizaje,
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 2, fecha: '2026-10-24', tiraMgL: 20 },
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 3, fecha: '2026-11-01', tfge: 95 },
      { codigoCaso: 'C1', tipo: 'resultado', etapa: 4, fecha: '2026-11-10', categoriaG: 'G1', categoriaA: 'A2' },
    ]
    const etapas = etapasDeLaRuta(caso({ etapaActual: 4, estado: 'vigilancia', fechaProximaCita: '2027-05-10' }), eventos)
    expect(etapas[4]).toMatchObject({ estado: 'hecha', fecha: '2026-11-10', detalle: 'Vigilancia periódica' })
  })

  it('ningún texto suena a diagnóstico', () => {
    const eventos = [tamizaje, { codigoCaso: 'C1', tipo: 'resultado', etapa: 2, fecha: '2026-10-24', tiraMgL: 50 }]
    const textos = etapasDeLaRuta(caso({ etapaActual: 2 }), eventos)
      .map((e) => `${e.detalle ?? ''} ${TEXTO_ESTADO_ETAPA[e.estado]}`)
      .join(' ')
    expect(textos).not.toMatch(/enfermedad|daño|grave|severo|urgente|diagn/i)
  })
})
