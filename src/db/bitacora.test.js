import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { consultar, registrar } from './bitacora.js'
import { crearDb } from './schema.js'

describe('bitacora', () => {
  let db

  beforeEach(async () => {
    db = crearDb(`test-bitacora-${Math.random().toString(36).slice(2)}`)
    await db.open()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('registra una entrada con fechaHora inyectada', async () => {
    await registrar(
      { usuarioId: 'USR-CAP-AC', rol: 'captura', accion: 'crear', entidad: 'caso', entidadId: 'PON-AC-0001' },
      { db, fechaHoraISO: '2026-11-11T12:00:00.000Z' },
    )
    const todas = await db.bitacora.toArray()
    expect(todas).toHaveLength(1)
    expect(todas[0]).toMatchObject({
      usuarioId: 'USR-CAP-AC',
      rol: 'captura',
      accion: 'crear',
      entidad: 'caso',
      entidadId: 'PON-AC-0001',
      fechaHora: '2026-11-11T12:00:00.000Z',
    })
  })

  it('rechaza acciones fuera del conjunto permitido', async () => {
    await expect(
      registrar(
        { usuarioId: 'USR-SUP-JAL', rol: 'supervision', accion: 'borrar', entidad: 'caso', entidadId: 'X' },
        { db },
      ),
    ).rejects.toThrow(/inválida/)
  })

  it('consultar devuelve las entradas más recientes primero', async () => {
    const base = { usuarioId: 'USR-CAP-AC', rol: 'captura', accion: 'crear', entidad: 'caso' }
    await registrar({ ...base, entidadId: 'PON-AC-0001' }, { db, fechaHoraISO: '2026-11-11T10:00:00Z' })
    await registrar({ ...base, entidadId: 'PON-AC-0002' }, { db, fechaHoraISO: '2026-11-11T11:00:00Z' })
    await registrar({ ...base, entidadId: 'PON-AC-0003' }, { db, fechaHoraISO: '2026-11-11T12:00:00Z' })
    const r = await consultar({ limit: 10 }, db)
    expect(r.map((e) => e.entidadId)).toEqual(['PON-AC-0003', 'PON-AC-0002', 'PON-AC-0001'])
  })

  it('consultar filtra por entidad', async () => {
    await registrar(
      { usuarioId: 'u1', rol: 'captura', accion: 'crear', entidad: 'caso', entidadId: 'PON-AC-0001' },
      { db, fechaHoraISO: '2026-11-11T10:00:00Z' },
    )
    await registrar(
      { usuarioId: 'u1', rol: 'captura', accion: 'crear', entidad: 'nino', entidadId: 'NIN-AC-0001' },
      { db, fechaHoraISO: '2026-11-11T10:05:00Z' },
    )
    const r = await consultar({ entidad: 'caso' }, db)
    expect(r).toHaveLength(1)
    expect(r[0].entidadId).toBe('PON-AC-0001')
  })
})
