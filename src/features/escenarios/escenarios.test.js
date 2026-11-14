import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { cambiarEscenario, etiquetaEscenario, ESCENARIOS } from './escenarios.js'

const datos11 = {
  escenario: 11,
  semilla: 2026,
  ninos: [{ codigo: 'NIN-AC-0001', sexo: 'M', mesNacimiento: 3, anioNacimiento: 2016 }],
  casos: [
    { codigo: 'PON-AC-0001', codigoNino: 'NIN-AC-0001', cct: '14DPR1710G', clues: 'JCSSA001234', fechaTamizaje: '2026-03-01', etapaActual: 1, estado: 'en_seguimiento' },
  ],
  eventos: [],
}

const datos30 = {
  escenario: 30,
  semilla: 2026,
  ninos: [{ codigo: 'NIN-AC-0001', sexo: 'F', mesNacimiento: 5, anioNacimiento: 2016 }],
  casos: [
    { codigo: 'PON-AC-0001', codigoNino: 'NIN-AC-0001', cct: '14DPR1710G', clues: 'JCSSA001234', fechaTamizaje: '2026-04-01', etapaActual: 1, estado: 'en_seguimiento' },
  ],
  eventos: [],
}

function fetchDe(mapa) {
  return vi.fn((url) => {
    const cuerpo = mapa[url]
    if (!cuerpo) return Promise.resolve({ ok: false })
    return Promise.resolve({ ok: true, json: () => Promise.resolve(cuerpo) })
  })
}

describe('escenarios', () => {
  describe('ESCENARIOS', () => {
    it('declara 11, 30 y 50 %', () => {
      expect(ESCENARIOS.map((e) => e.numero)).toEqual([11, 30, 50])
    })
  })

  describe('etiquetaEscenario', () => {
    it('devuelve la etiqueta canónica del escenario', () => {
      expect(etiquetaEscenario(30)).toBe('30 %')
    })

    it('tolera números fuera de la lista', () => {
      expect(etiquetaEscenario(99)).toBe('99 %')
    })
  })

  describe('cambiarEscenario', () => {
    let db

    beforeEach(async () => {
      db = crearDb(`test-escenarios-${Math.random().toString(36).slice(2)}`)
      await db.open()
    })

    afterEach(async () => {
      await db.delete()
    })

    it('fetch del escenario, cargarEscenario y entrada en bitácora', async () => {
      const fetchImpl = fetchDe({ '/data/casos_11.json': datos11, '/data/casos_30.json': datos30 })
      await cambiarEscenario({ numero: 11, usuario: null, fetchImpl, db })
      expect(await db.casos.count()).toBe(1)
      expect((await db.meta.get('escenarioActivo')).valor).toBe('11')

      await cambiarEscenario({ numero: 30, usuario: { id: 'USR-X', rol: 'supervision' }, fetchImpl, db })
      expect((await db.meta.get('escenarioActivo')).valor).toBe('30')
      const bitacora = await db.bitacora.toArray()
      expect(bitacora).toHaveLength(2)
      expect(bitacora[1]).toMatchObject({
        accion: 'modificar',
        entidad: 'escenario',
        entidadId: '11->30',
        usuarioId: 'USR-X',
        rol: 'supervision',
      })
    })

    it('rechaza números no soportados', async () => {
      const fetchImpl = fetchDe({})
      await expect(cambiarEscenario({ numero: 7, fetchImpl, db })).rejects.toThrow()
    })

    it('propaga el error si el fetch falla y no cambia el escenario activo', async () => {
      const fetchImpl = fetchDe({ '/data/casos_11.json': datos11 })
      await cambiarEscenario({ numero: 11, fetchImpl, db })
      // 30 no está en el mapa → ok: false.
      await expect(cambiarEscenario({ numero: 30, fetchImpl, db })).rejects.toThrow()
      expect((await db.meta.get('escenarioActivo')).valor).toBe('11')
    })
  })
})
