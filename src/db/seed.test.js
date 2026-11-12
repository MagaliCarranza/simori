import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearDb } from './schema.js'
import {
  cargarCatalogos,
  cargarEscenario,
  escenarioActivo,
  inicializar,
} from './seed.js'

const catalogoMuestra = {
  localidades: [
    { claveInegi: '140660002', nombre: 'Agua Caliente', poblacion5a14: 445, gradoMarginacion: 'Medio', lat: 20.31, lng: -102.93 },
    { claveInegi: '140660031', nombre: 'San Pedro Itzicán', poblacion5a14: 1954, gradoMarginacion: 'Medio', lat: 20.32, lng: -102.95 },
  ],
  escuelas: [
    { cct: '14DPR1710G', nombre: 'Emiliano Zapata', claveInegi: '140660002', matricula: 157 },
  ],
  centrosSalud: [
    { clues: 'PROV-AC-01', nombre: 'Centro AC', claveInegi: '140660002', provisional: true },
  ],
  usuarios: [
    { id: 'USR-CAP-AC', rol: 'captura', clues: 'PROV-AC-01' },
  ],
}

const escenarioMuestra = {
  ninos: [
    { codigo: 'NIN-AC-0001', sexo: 'M', mesNacimiento: 3, anioNacimiento: 2016 },
    { codigo: 'NIN-AC-0002', sexo: 'F', mesNacimiento: 7, anioNacimiento: 2015 },
  ],
  casos: [
    { codigo: 'PON-AC-0001', codigoNino: 'NIN-AC-0001', cct: '14DPR1710G', clues: 'PROV-AC-01', fechaTamizaje: '2026-03-01', etapaActual: 1, estado: 'en_seguimiento' },
    { codigo: 'PON-AC-0002', codigoNino: 'NIN-AC-0002', cct: '14DPR1710G', clues: 'PROV-AC-01', fechaTamizaje: '2026-04-15', etapaActual: 2, estado: 'en_seguimiento' },
  ],
  eventos: [
    { codigoCaso: 'PON-AC-0001', etapa: 1, fecha: '2026-03-01', tipo: 'resultado', tiraMgL: 20 },
    { codigoCaso: 'PON-AC-0002', etapa: 1, fecha: '2026-04-15', tipo: 'resultado', tiraMgL: 50 },
    { codigoCaso: 'PON-AC-0002', etapa: 2, fecha: '2026-07-08', tipo: 'resultado', tiraMgL: 20 },
  ],
  semilla: 2026,
}

describe('seed', () => {
  let db

  beforeEach(async () => {
    db = crearDb(`test-seed-${Math.random().toString(36).slice(2)}`)
    await db.open()
  })

  afterEach(async () => {
    await db.delete()
  })

  describe('cargarCatalogos', () => {
    it('inserta localidades, escuelas, centros y usuarios', async () => {
      await cargarCatalogos(catalogoMuestra, db)
      expect(await db.localidades.count()).toBe(2)
      expect(await db.escuelas.count()).toBe(1)
      expect(await db.centrosSalud.count()).toBe(1)
      expect(await db.usuarios.count()).toBe(1)
    })

    it('es idempotente (bulkPut sobreescribe por PK)', async () => {
      await cargarCatalogos(catalogoMuestra, db)
      await cargarCatalogos(catalogoMuestra, db)
      expect(await db.localidades.count()).toBe(2)
      expect(await db.escuelas.count()).toBe(1)
    })
  })

  describe('cargarEscenario', () => {
    it('vacía tablas de casos y las repuebla', async () => {
      await cargarEscenario(11, escenarioMuestra, db)
      expect(await db.ninos.count()).toBe(2)
      expect(await db.casos.count()).toBe(2)
      expect(await db.eventos.count()).toBe(3)
      expect(await escenarioActivo(db)).toBe('11')
    })

    it('al cambiar de escenario, limpia antes de cargar (RF: no acumula entre escenarios)', async () => {
      await cargarEscenario(11, escenarioMuestra, db)
      const otro = {
        ninos: [{ codigo: 'NIN-SPI-0001', sexo: 'M', mesNacimiento: 1, anioNacimiento: 2017 }],
        casos: [{ codigo: 'PON-SPI-0001', codigoNino: 'NIN-SPI-0001', cct: '14DPR1616B', clues: 'PROV-SPI-01', fechaTamizaje: '2026-05-01', etapaActual: 1, estado: 'en_seguimiento' }],
        eventos: [{ codigoCaso: 'PON-SPI-0001', etapa: 1, fecha: '2026-05-01', tipo: 'resultado', tiraMgL: 20 }],
        semilla: 2026,
      }
      await cargarEscenario(30, otro, db)
      expect(await db.ninos.count()).toBe(1)
      expect(await db.casos.count()).toBe(1)
      expect(await db.eventos.count()).toBe(1)
      expect(await escenarioActivo(db)).toBe('30')
    })

    it('guarda la semilla en meta', async () => {
      await cargarEscenario(11, escenarioMuestra, db)
      const semilla = await db.meta.get('semillaCarga')
      expect(semilla.valor).toBe('2026')
    })
  })

  describe('inicializar', () => {
    it('corre catálogos + escenario default cuando la DB está vacía', async () => {
      const fetchImpl = vi.fn((url) => {
        const cuerpos = {
          '/data/localidades.json': catalogoMuestra.localidades,
          '/data/escuelas.json': catalogoMuestra.escuelas,
          '/data/centros_salud.json': catalogoMuestra.centrosSalud,
          '/data/usuarios_demo.json': catalogoMuestra.usuarios,
          '/data/casos_11.json': { ...escenarioMuestra, escenario: 11 },
        }
        return Promise.resolve({ json: () => Promise.resolve(cuerpos[url]) })
      })

      const r = await inicializar({ fetchImpl, db })
      expect(r.yaInicializada).toBe(false)
      expect(r.escenario).toBe(11)
      expect(await db.casos.count()).toBe(2)
      expect(await escenarioActivo(db)).toBe('11')
    })

    it('no vuelve a correr si ya hay un escenario activo', async () => {
      await cargarEscenario(11, escenarioMuestra, db)
      const fetchImpl = vi.fn()
      const r = await inicializar({ fetchImpl, db })
      expect(r.yaInicializada).toBe(true)
      expect(fetchImpl).not.toHaveBeenCalled()
    })
  })
})
