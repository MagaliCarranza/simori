import { describe, expect, it } from 'vitest'
import {
  evaluarCaso,
  evaluarCentro,
  filtrarPendientes,
  ordenarPorRetraso,
  resumenPendientes,
  siguientePaso,
} from './pendientes.js'

const HOY = '2026-11-14'
const CENTRO = 'PROV-AC-01'

function caso(codigo, extra = {}) {
  return {
    codigo,
    cct: '14DPR1710G',
    clues: CENTRO,
    fechaTamizaje: '2026-01-10',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: null,
    ...extra,
  }
}

const casos = [
  // Cita hace 10 días → amarillo, 10 días.
  caso('PON-AC-0001', { fechaProximaCita: '2026-11-04' }),
  // Cita hace 40 días → rojo, 40 días.
  caso('PON-AC-0002', { fechaProximaCita: '2026-10-05' }),
  // Cita futura → verde.
  caso('PON-AC-0003', { fechaProximaCita: '2026-12-01' }),
  // Sin cita; último resultado hace 20 días → amarillo sin cita.
  caso('PON-AC-0004', { cct: '14DTV0442U', etapaActual: 2 }),
  // Sin cita; último resultado hace 5 días → verde, pero cuenta como sin cita.
  caso('PON-AC-0005', { etapaActual: 2 }),
  // Cerrados: no aparecen.
  caso('PON-AC-0006', { estado: 'alta' }),
  caso('PON-AC-0007', { estado: 'referido' }),
  // Otro centro: no aparece.
  caso('PON-SPI-0001', { clues: 'PROV-SPI-01', fechaProximaCita: '2026-09-01' }),
]

const eventos = [
  { codigoCaso: 'PON-AC-0004', tipo: 'resultado', etapa: 2, fecha: '2026-10-25' },
  { codigoCaso: 'PON-AC-0005', tipo: 'resultado', etapa: 2, fecha: '2026-11-09' },
]

describe('evaluarCentro', () => {
  const filas = evaluarCentro({ casos, eventos, clues: CENTRO, hoyISO: HOY })
  const codigos = filas.map((f) => f.codigo)

  it('solo incluye casos activos del centro', () => {
    expect(codigos).toEqual(['PON-AC-0001', 'PON-AC-0002', 'PON-AC-0003', 'PON-AC-0004', 'PON-AC-0005'])
  })

  it('usa el semáforo del dominio', () => {
    const f1 = filas.find((f) => f.codigo === 'PON-AC-0001')
    expect(f1.semaforo).toEqual({ color: 'amarillo', etiqueta: 'Con retraso (10 días)', diasRetraso: 10, referencia: 'cita' })
    const f4 = filas.find((f) => f.codigo === 'PON-AC-0004')
    expect(f4.semaforo.color).toBe('amarillo')
    expect(f4.sinCita).toBe(true)
  })
})

describe('filtrarPendientes', () => {
  const filas = evaluarCentro({ casos, eventos, clues: CENTRO, hoyISO: HOY })

  it('deja solo amarillo y rojo, ordenados por días de retraso', () => {
    const res = filtrarPendientes(filas).map((f) => [f.codigo, f.semaforo.diasRetraso])
    expect(res).toEqual([
      ['PON-AC-0002', 40],
      ['PON-AC-0004', 20],
      ['PON-AC-0001', 10],
    ])
  })

  it('filtra por color', () => {
    expect(filtrarPendientes(filas, { color: 'rojo' }).map((f) => f.codigo)).toEqual(['PON-AC-0002'])
  })

  it('filtra por escuela', () => {
    expect(filtrarPendientes(filas, { cct: '14DTV0442U' }).map((f) => f.codigo)).toEqual(['PON-AC-0004'])
  })

  it('filtra solo sin cita', () => {
    expect(filtrarPendientes(filas, { soloSinCita: true }).map((f) => f.codigo)).toEqual(['PON-AC-0004'])
  })

  it('sin pendientes regresa lista vacía', () => {
    const alDia = evaluarCentro({ casos: [casos[2]], eventos: [], clues: CENTRO, hoyISO: HOY })
    expect(filtrarPendientes(alDia)).toEqual([])
  })
})

describe('resumenPendientes', () => {
  it('cuenta rojos, amarillos y casos sin cita (incluye verdes por agendar)', () => {
    const filas = evaluarCentro({ casos, eventos, clues: CENTRO, hoyISO: HOY })
    expect(resumenPendientes(filas)).toEqual({ rojo: 1, amarillo: 2, sinCita: 2 })
  })
})

describe('ordenarPorRetraso', () => {
  it('en empate de días, rojo va primero y luego por código', () => {
    const f = (codigo, color, dias) => ({ codigo, semaforo: { color, diasRetraso: dias } })
    const res = ordenarPorRetraso([f('B', 'amarillo', 5), f('C', 'rojo', 5), f('A', 'amarillo', 5)])
    expect(res.map((x) => x.codigo)).toEqual(['C', 'A', 'B'])
  })
})

describe('sin seguimiento y visitas', () => {
  const rojo = caso('PON-AC-0010', { fechaProximaCita: '2026-10-01' }) // 44 días
  const visita = (fecha, visitaResultado) => ({ codigoCaso: rojo.codigo, tipo: 'visita', fecha, visitaResultado })

  it('rojo con 2 visitas sin localizar se marca como sin seguimiento', () => {
    const f = evaluarCaso(rojo, [visita('2026-10-20', 'no_localizada'), visita('2026-11-01', 'no_localizada')], HOY)
    expect(f.visitasNoLocalizadas).toBe(2)
    expect(f.sinSeguimiento).toBe(true)
    expect(f.ultimaVisita.fecha).toBe('2026-11-01')
  })

  it('con 1 visita sin localizar todavía no', () => {
    const f = evaluarCaso(rojo, [visita('2026-10-20', 'no_localizada')], HOY)
    expect(f.sinSeguimiento).toBe(false)
  })

  it('las visitas no reinician el semáforo', () => {
    const sinCita = caso('PON-AC-0011')
    const ev = [
      { codigoCaso: sinCita.codigo, tipo: 'resultado', etapa: 1, fecha: '2026-09-01' },
      { codigoCaso: sinCita.codigo, tipo: 'visita', fecha: '2026-11-13', visitaResultado: 'localizada' },
    ]
    const f = evaluarCaso(sinCita, ev, HOY)
    expect(f.semaforo.color).toBe('rojo')
    expect(f.semaforo.diasRetraso).toBe(74)
  })

  it('un caso ya guardado como sin seguimiento sigue marcado', () => {
    const f = evaluarCaso(caso('PON-AC-0012', { estado: 'sin_seguimiento', fechaProximaCita: '2026-11-01' }), [], HOY)
    expect(f.sinSeguimiento).toBe(true)
  })
})

describe('siguientePaso', () => {
  it('muestra la etapa que sigue o la revisión de vigilancia', () => {
    expect(siguientePaso({ etapaActual: 1, estado: 'en_seguimiento' })).toBe('Confirmación')
    expect(siguientePaso({ etapaActual: 3, estado: 'en_seguimiento' })).toBe('Clasificación')
    expect(siguientePaso({ etapaActual: 4, estado: 'vigilancia' })).toBe('Revisión periódica')
    expect(siguientePaso({ etapaActual: 5, estado: 'en_seguimiento' })).toBe('Salida')
  })
})
