import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { edadDecimal, tfgeCKiDU25 } from '../../domain/index.js'
import {
  agendarCita,
  calcularClasificacion,
  describirEvento,
  etapaPorRegistrar,
  planificarResultado,
  registrarResultado,
} from './ruta.js'

const HOY = '2026-11-14'
const usuario = { id: 'USR-CAP-01', rol: 'captura', clues: 'JCSSA004213' }
const nino = { codigo: 'NIN-AC-0001', sexo: 'F', mesNacimiento: 4, anioNacimiento: 2016 }
const tamizaje = { id: 1, codigoCaso: 'PON-AC-0001', etapa: 1, fecha: '2026-08-01', tipo: 'resultado', tiraMgL: 50 }

function caso(cambios = {}) {
  return {
    codigo: 'PON-AC-0001',
    codigoNino: 'NIN-AC-0001',
    cct: '14DPR1710G',
    clues: 'JCSSA004213',
    fechaTamizaje: '2026-08-01',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: '2026-10-24',
    simulado: true,
    ...cambios,
  }
}

const valoracion = {
  id: 3,
  codigoCaso: 'PON-AC-0001',
  etapa: 3,
  fecha: '2026-11-05',
  tipo: 'resultado',
  creatininaMgDl: 1,
  tallaCm: 140,
  pesoKg: 35,
  tfge: 49.97,
}

describe('etapaPorRegistrar', () => {
  it('toca la etapa siguiente mientras el caso está en la ruta', () => {
    expect(etapaPorRegistrar(caso())).toBe(2)
    expect(etapaPorRegistrar(caso({ etapaActual: 3 }))).toBe(4)
    expect(etapaPorRegistrar(caso({ estado: 'sin_seguimiento', estadoPrevio: 'en_seguimiento' }))).toBe(2)
  })

  it('no hay etapa por registrar si está cerrado o en vigilancia', () => {
    expect(etapaPorRegistrar(caso({ estado: 'alta', etapaActual: 2 }))).toBeNull()
    expect(etapaPorRegistrar(caso({ estado: 'referido', etapaActual: 4 }))).toBeNull()
    expect(etapaPorRegistrar(caso({ estado: 'vigilancia', etapaActual: 4 }))).toBeNull()
    expect(etapaPorRegistrar(caso({ estado: 'sin_seguimiento', estadoPrevio: 'vigilancia', etapaActual: 4 }))).toBeNull()
  })
})

describe('planificarResultado · confirmación (etapa 2)', () => {
  const planificar = (datos, c = caso()) =>
    planificarResultado({ caso: c, nino, eventos: [tamizaje], datos, usuario, hoyISO: HOY })

  it('segunda tira positiva: avanza a etapa 2 con la próxima cita', () => {
    const plan = planificar({ fecha: '2026-11-01', tiraMgL: 20, proximaCita: '2026-11-20' })
    expect(plan.ok).toBe(true)
    expect(plan.eventos).toEqual([
      { codigoCaso: 'PON-AC-0001', usuarioId: 'USR-CAP-01', etapa: 2, fecha: '2026-11-01', tipo: 'resultado', tiraMgL: 20 },
    ])
    expect(plan.cambios).toMatchObject({ etapaActual: 2, estado: 'en_seguimiento', fechaProximaCita: '2026-11-20' })
  })

  it('segunda tira negativa: cierra como "No confirmado (alta)"', () => {
    const plan = planificar({ fecha: '2026-11-01', tiraMgL: 0 })
    expect(plan.eventos.map((e) => e.tipo)).toEqual(['resultado', 'alta'])
    expect(plan.eventos[1].nota).toBe('No confirmado')
    expect(plan.cambios).toMatchObject({ etapaActual: 2, estado: 'alta', fechaProximaCita: null })
  })

  it('rechaza fecha futura, anterior al último resultado y cita antes del resultado', () => {
    expect(planificar({ fecha: '2026-11-20', tiraMgL: 20 }).errores).toContain('La fecha del resultado no puede ser futura.')
    expect(planificar({ fecha: '2026-07-01', tiraMgL: 20 }).errores).toContain(
      'La fecha no puede ser anterior al último resultado (2026-08-01).',
    )
    expect(planificar({ fecha: '2026-11-01', tiraMgL: 20, proximaCita: '2026-10-01' }).errores).toContain(
      'La próxima cita debe ser posterior a la fecha del resultado.',
    )
  })

  it('pide un valor de tira válido', () => {
    expect(planificar({ fecha: '2026-11-01', tiraMgL: null }).errores).toEqual([
      'El valor de la tira debe ser 0, 20, 50 o 100 mg/L.',
    ])
  })

  it('al registrar un resultado reactiva un caso sin seguimiento', () => {
    const plan = planificar({ fecha: '2026-11-01', tiraMgL: 50 }, caso({ estado: 'sin_seguimiento', estadoPrevio: 'en_seguimiento' }))
    expect(plan.cambios.estado).toBe('en_seguimiento')
    expect('estadoPrevio' in plan.cambios && plan.cambios.estadoPrevio).toBeUndefined()
  })
})

describe('planificarResultado · valoración (etapa 3)', () => {
  it('calcula la TFGe con CKiD U25 a la fecha de la valoración', () => {
    const plan = planificarResultado({
      caso: caso({ etapaActual: 2 }),
      nino,
      eventos: [tamizaje],
      datos: { fecha: '2026-11-05', creatininaMgDl: '0.6', tallaCm: '140', pesoKg: '35' },
      usuario,
      hoyISO: HOY,
    })
    const esperado = tfgeCKiDU25({ sexo: 'F', edadAnios: edadDecimal(nino, '2026-11-05'), tallaCm: 140, creatininaMgDl: 0.6 })
    expect(plan.ok).toBe(true)
    expect(plan.eventos[0]).toMatchObject({ etapa: 3, tipo: 'resultado', creatininaMgDl: 0.6, tallaCm: 140, pesoKg: 35 })
    expect(plan.eventos[0].tfge).toBeCloseTo(esperado, 2)
    expect(plan.calculo.categoriaG).toBe('G2')
    expect(plan.cambios).toMatchObject({ etapaActual: 3, estado: 'en_seguimiento', fechaProximaCita: null })
  })

  it('valida rangos de captura', () => {
    const plan = planificarResultado({
      caso: caso({ etapaActual: 2 }),
      nino,
      eventos: [tamizaje],
      datos: { fecha: '2026-11-05', creatininaMgDl: '0', tallaCm: '1400', pesoKg: '' },
      usuario,
      hoyISO: HOY,
    })
    expect(plan.errores).toEqual([
      'La creatinina debe estar entre 0.1 y 10 mg/dL.',
      'La talla debe estar entre 50 y 210 cm.',
      'El peso debe estar entre 5 y 200 kg.',
    ])
  })
})

describe('planificarResultado · clasificación (etapa 4)', () => {
  const planificar = (datos) =>
    planificarResultado({
      caso: caso({ etapaActual: 3 }),
      nino,
      eventos: [tamizaje, valoracion],
      datos: { fecha: '2026-11-10', ...datos },
      usuario,
      hoyISO: HOY,
    })

  it('propone referencia si la TFGe es menor de 60', () => {
    expect(calcularClasificacion({ valoracion, cocienteAlbCrea: 120 })).toEqual({
      tfge: 49.97,
      categoriaG: 'G3a',
      categoriaA: 'A2',
      propuesta: 'referido',
    })
  })

  it('referencia: guarda clasificación + evento referencia y cierra el caso', () => {
    const plan = planificar({ cocienteAlbCrea: '120', salida: 'referido' })
    expect(plan.eventos.map((e) => e.tipo)).toEqual(['resultado', 'referencia'])
    expect(plan.eventos[0]).toMatchObject({ etapa: 4, tfge: 49.97, categoriaG: 'G3a', categoriaA: 'A2', cocienteAlbCrea: 120 })
    expect(plan.cambios).toMatchObject({ etapaActual: 4, estado: 'referido', fechaProximaCita: null })
  })

  it('vigilancia: agenda la revisión a 6 meses (decisión del personal)', () => {
    const plan = planificar({ cocienteAlbCrea: '45', salida: 'vigilancia' })
    expect(plan.eventos.map((e) => e.tipo)).toEqual(['resultado'])
    expect(plan.cambios).toMatchObject({ etapaActual: 4, estado: 'vigilancia', fechaProximaCita: '2027-05-10' })
  })

  it('pide la salida y una valoración previa', () => {
    expect(planificar({ cocienteAlbCrea: '45' }).errores).toContain('Elige la salida: referencia o vigilancia periódica.')
    const sinValoracion = planificarResultado({
      caso: caso({ etapaActual: 3 }),
      nino,
      eventos: [tamizaje],
      datos: { fecha: '2026-11-10', cocienteAlbCrea: '45', salida: 'vigilancia' },
      usuario,
      hoyISO: HOY,
    })
    expect(sinValoracion.errores).toContain('Falta la valoración (etapa 3) con la filtración estimada.')
  })
})

describe('describirEvento', () => {
  it('describe cada tipo de evento en lenguaje sencillo', () => {
    expect(describirEvento(tamizaje)).toBe('Tamizaje: tira 50 mg/L (positiva)')
    expect(describirEvento({ tipo: 'alta', etapa: 2 })).toBe('Alta: No confirmado')
    expect(describirEvento({ tipo: 'referencia', etapa: 4 })).toBe('Referido a nefrología pediátrica')
    expect(describirEvento({ tipo: 'cita', etapa: 2, fechaCita: '2026-12-01' })).toBe('Cita agendada para el 2026-12-01')
  })
})

describe('persistencia', () => {
  let db
  let n = 0

  beforeEach(async () => {
    db = crearDb(`test-ruta-${n++}`)
    await db.ninos.add(nino)
    await db.casos.add(caso({ estado: 'sin_seguimiento', estadoPrevio: 'en_seguimiento' }))
    await db.eventos.add({ ...tamizaje, id: undefined })
  })

  afterEach(async () => {
    await db.delete()
  })

  it('registrarResultado guarda eventos, actualiza el caso y la bitácora', async () => {
    const res = await registrarResultado(
      { codigoCaso: 'PON-AC-0001', datos: { fecha: '2026-11-01', tiraMgL: 50 }, usuario, hoyISO: HOY },
      db,
    )
    expect(res.ok).toBe(true)
    expect(res.reactivado).toBe(true)
    expect(res.caso).toMatchObject({ etapaActual: 2, estado: 'en_seguimiento' })
    expect(res.caso).not.toHaveProperty('estadoPrevio')
    expect(await db.eventos.where('codigoCaso').equals('PON-AC-0001').count()).toBe(2)
    expect(await db.bitacora.toArray()).toEqual([expect.objectContaining({ accion: 'modificar', entidadId: 'PON-AC-0001' })])
  })

  it('registrarResultado no guarda nada si hay errores', async () => {
    const res = await registrarResultado(
      { codigoCaso: 'PON-AC-0001', datos: { fecha: '2026-11-30', tiraMgL: 50 }, usuario, hoyISO: HOY },
      db,
    )
    expect(res.ok).toBe(false)
    expect(await db.eventos.count()).toBe(1)
    expect(await db.bitacora.count()).toBe(0)
  })

  it('agendarCita actualiza la próxima cita y reactiva el caso', async () => {
    const res = await agendarCita({ codigoCaso: 'PON-AC-0001', fechaCita: '2026-11-28', usuario, hoyISO: HOY }, db)
    expect(res.ok).toBe(true)
    expect(res.reactivado).toBe(true)
    expect(res.caso).toMatchObject({ fechaProximaCita: '2026-11-28', estado: 'en_seguimiento' })
    const cita = (await db.eventos.toArray()).find((e) => e.tipo === 'cita')
    expect(cita).toMatchObject({ fecha: HOY, fechaCita: '2026-11-28' })
  })

  it('agendarCita rechaza fechas pasadas', async () => {
    const res = await agendarCita({ codigoCaso: 'PON-AC-0001', fechaCita: '2026-11-01', usuario, hoyISO: HOY }, db)
    expect(res.errores).toEqual(['La cita no puede ser en una fecha pasada.'])
  })
})
