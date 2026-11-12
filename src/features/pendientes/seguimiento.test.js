import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { aplicarSinSeguimiento, reactivarSiCorresponde } from './seguimiento.js'

const HOY = '2026-11-14'
const usuario = { id: 'USR-CAP-AC', rol: 'captura' }

let db
let n = 0

function caso(codigo, extra = {}) {
  return {
    codigo,
    codigoNino: codigo.replace('PON', 'NIN'),
    cct: '14DPR1710G',
    clues: 'PROV-AC-01',
    fechaTamizaje: '2026-01-10',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: null,
    simulado: true,
    ...extra,
  }
}

const noLocalizada = (codigoCaso, fecha) => ({ codigoCaso, tipo: 'visita', fecha, visitaResultado: 'no_localizada', etapa: 1 })

beforeEach(async () => {
  db = crearDb(`test-seguimiento-${n++}`)
  await db.casos.bulkAdd([
    // Rojo (44 días) + 2 visitas sin localizar → pasa.
    caso('PON-AC-0001', { fechaProximaCita: '2026-10-01' }),
    // Rojo con 1 visita → no pasa.
    caso('PON-AC-0002', { fechaProximaCita: '2026-10-01' }),
    // Más de 84 días de retraso, en vigilancia → pasa y recuerda vigilancia.
    caso('PON-AC-0003', { estado: 'vigilancia', etapaActual: 4, fechaProximaCita: '2026-08-01' }),
    // Cerrado → nunca.
    caso('PON-AC-0004', { estado: 'alta', fechaProximaCita: '2026-01-01' }),
  ])
  await db.eventos.bulkAdd([
    noLocalizada('PON-AC-0001', '2026-10-20'),
    noLocalizada('PON-AC-0001', '2026-11-01'),
    noLocalizada('PON-AC-0002', '2026-10-20'),
  ])
})

afterEach(async () => {
  await db.delete()
})

const todos = ['PON-AC-0001', 'PON-AC-0002', 'PON-AC-0003', 'PON-AC-0004']

describe('aplicarSinSeguimiento', () => {
  it('marca solo los casos que cumplen la regla y deja bitácora', async () => {
    const cambiados = await aplicarSinSeguimiento({ codigos: todos, hoyISO: HOY, usuario }, db)
    expect(cambiados.sort()).toEqual(['PON-AC-0001', 'PON-AC-0003'])

    expect((await db.casos.get('PON-AC-0001')).estado).toBe('sin_seguimiento')
    expect((await db.casos.get('PON-AC-0002')).estado).toBe('en_seguimiento')
    expect(await db.casos.get('PON-AC-0003')).toMatchObject({ estado: 'sin_seguimiento', estadoPrevio: 'vigilancia' })
    expect((await db.casos.get('PON-AC-0004')).estado).toBe('alta')

    const bitacora = await db.bitacora.toArray()
    expect(bitacora).toHaveLength(2)
    expect(bitacora[0]).toMatchObject({ usuarioId: 'USR-CAP-AC', rol: 'captura', accion: 'modificar', entidad: 'caso' })
  })

  it('es idempotente', async () => {
    await aplicarSinSeguimiento({ codigos: todos, hoyISO: HOY, usuario }, db)
    const segunda = await aplicarSinSeguimiento({ codigos: todos, hoyISO: HOY, usuario }, db)
    expect(segunda).toEqual([])
    expect(await db.bitacora.count()).toBe(2)
  })
})

describe('reactivarSiCorresponde', () => {
  beforeEach(async () => {
    await aplicarSinSeguimiento({ codigos: todos, hoyISO: HOY, usuario }, db)
  })

  it('un resultado nuevo reactiva al estado anterior', async () => {
    const ok = await reactivarSiCorresponde(
      { codigoCaso: 'PON-AC-0003', evento: { tipo: 'resultado' }, usuario },
      db,
    )
    expect(ok).toBe(true)
    const c = await db.casos.get('PON-AC-0003')
    expect(c.estado).toBe('vigilancia')
    expect(c.estadoPrevio).toBeUndefined()
  })

  it('una cita reactiva a en_seguimiento si no hay estado anterior', async () => {
    await db.casos.update('PON-AC-0001', { estadoPrevio: undefined })
    const ok = await reactivarSiCorresponde({ codigoCaso: 'PON-AC-0001', evento: { tipo: 'cita' }, usuario }, db)
    expect(ok).toBe(true)
    expect((await db.casos.get('PON-AC-0001')).estado).toBe('en_seguimiento')
  })

  it('una visita no reactiva', async () => {
    const ok = await reactivarSiCorresponde({ codigoCaso: 'PON-AC-0001', evento: { tipo: 'visita' }, usuario }, db)
    expect(ok).toBe(false)
    expect((await db.casos.get('PON-AC-0001')).estado).toBe('sin_seguimiento')
  })

  it('un caso activo no cambia', async () => {
    const ok = await reactivarSiCorresponde({ codigoCaso: 'PON-AC-0002', evento: { tipo: 'resultado' }, usuario }, db)
    expect(ok).toBe(false)
  })
})
