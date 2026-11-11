import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from './schema.js'

describe('schema', () => {
  let db

  beforeEach(async () => {
    db = crearDb(`test-schema-${Math.random().toString(36).slice(2)}`)
    await db.open()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('declara las 10 tablas del modelo', async () => {
    const nombres = db.tables.map((t) => t.name).sort()
    expect(nombres).toEqual([
      'avisos', 'bitacora', 'casos', 'centrosSalud', 'escuelas',
      'eventos', 'localidades', 'meta', 'ninos', 'usuarios',
    ])
  })

  it('cada tabla acepta y recupera un registro básico', async () => {
    await db.localidades.put({ claveInegi: '140660002', nombre: 'Agua Caliente' })
    const l = await db.localidades.get('140660002')
    expect(l.nombre).toBe('Agua Caliente')
  })

  it('eventos usa id autoincremental', async () => {
    const id1 = await db.eventos.add({ codigoCaso: 'PON-AC-0001', etapa: 1, fecha: '2026-03-01', tipo: 'resultado' })
    const id2 = await db.eventos.add({ codigoCaso: 'PON-AC-0001', etapa: 2, fecha: '2026-05-25', tipo: 'resultado' })
    expect(id2).toBeGreaterThan(id1)
  })

  it('casos indexa por cct, clues y estado', async () => {
    await db.casos.bulkPut([
      { codigo: 'PON-AC-0001', cct: '14DPR1710G', clues: 'PROV-AC-01', etapaActual: 1, estado: 'en_seguimiento' },
      { codigo: 'PON-AC-0002', cct: '14DPR1710G', clues: 'PROV-AC-01', etapaActual: 4, estado: 'referido' },
      { codigo: 'PON-SPI-0001', cct: '14DPR1616B', clues: 'PROV-SPI-01', etapaActual: 2, estado: 'en_seguimiento' },
    ])
    const porCct = await db.casos.where('cct').equals('14DPR1710G').toArray()
    expect(porCct).toHaveLength(2)
    const referidos = await db.casos.where('estado').equals('referido').toArray()
    expect(referidos).toHaveLength(1)
  })
})
