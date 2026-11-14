import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarCaso } from '../features/registro/registro.js'
import { crearDb } from './schema.js'
import {
  cargarCatalogos,
  cargarEscenario,
  escenarioActivo,
  inicializar,
} from './seed.js'

const CLUES_AC = 'JCSSA001234'

const catalogoMuestra = {
  localidades: [
    { claveInegi: '140660002', nombre: 'Agua Caliente', poblacion5a14: 445, gradoMarginacion: 'Medio', lat: 20.31, lng: -102.93 },
    { claveInegi: '140660031', nombre: 'San Pedro Itzicán', poblacion5a14: 1954, gradoMarginacion: 'Medio', lat: 20.32, lng: -102.95 },
  ],
  escuelas: [
    { cct: '14DPR1710G', nombre: 'Emiliano Zapata', claveInegi: '140660002', matricula: 157 },
  ],
  centrosSalud: [
    { clues: CLUES_AC, nombre: 'Centro AC', claveInegi: '140660002' },
  ],
  usuarios: [
    { id: 'USR-CAP-AC', rol: 'captura', clues: CLUES_AC },
  ],
}

const escenarioMuestra = {
  ninos: [
    { codigo: 'NIN-AC-0001', sexo: 'M', mesNacimiento: 3, anioNacimiento: 2016 },
    { codigo: 'NIN-AC-0002', sexo: 'F', mesNacimiento: 7, anioNacimiento: 2015 },
  ],
  casos: [
    { codigo: 'PON-AC-0001', codigoNino: 'NIN-AC-0001', cct: '14DPR1710G', clues: CLUES_AC, fechaTamizaje: '2026-03-01', etapaActual: 1, estado: 'en_seguimiento' },
    { codigo: 'PON-AC-0002', codigoNino: 'NIN-AC-0002', cct: '14DPR1710G', clues: CLUES_AC, fechaTamizaje: '2026-04-15', etapaActual: 2, estado: 'en_seguimiento' },
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

    it('al cambiar de escenario, reemplaza los casos simulados (mismos códigos entre escenarios)', async () => {
      await cargarEscenario(11, escenarioMuestra, db)
      // Los tres escenarios reales comparten los mismos códigos: el escenario
      // entrante trae los mismos PON-AC-0001/0002 con otros datos.
      const otro = {
        ninos: [
          { codigo: 'NIN-AC-0001', sexo: 'F', mesNacimiento: 1, anioNacimiento: 2017 },
          { codigo: 'NIN-AC-0002', sexo: 'M', mesNacimiento: 2, anioNacimiento: 2017 },
        ],
        casos: [
          { codigo: 'PON-AC-0001', codigoNino: 'NIN-AC-0001', cct: '14DPR1710G', clues: CLUES_AC, fechaTamizaje: '2026-05-01', etapaActual: 1, estado: 'en_seguimiento' },
          { codigo: 'PON-AC-0002', codigoNino: 'NIN-AC-0002', cct: '14DPR1710G', clues: CLUES_AC, fechaTamizaje: '2026-05-10', etapaActual: 1, estado: 'en_seguimiento' },
        ],
        eventos: [
          { codigoCaso: 'PON-AC-0001', etapa: 1, fecha: '2026-05-01', tipo: 'resultado', tiraMgL: 20 },
        ],
        semilla: 2026,
      }
      await cargarEscenario(30, otro, db)
      expect(await db.ninos.count()).toBe(2)
      expect(await db.casos.count()).toBe(2)
      expect(await db.eventos.count()).toBe(1)
      // Los datos ahora son los del nuevo escenario, no los anteriores.
      const caso = await db.casos.get('PON-AC-0001')
      expect(caso.fechaTamizaje).toBe('2026-05-01')
      expect(await escenarioActivo(db)).toBe('30')
    })

    it('guarda la semilla en meta', async () => {
      await cargarEscenario(11, escenarioMuestra, db)
      const semilla = await db.meta.get('semillaCarga')
      expect(semilla.valor).toBe('2026')
    })

    it('conserva los casos que registró el usuario al cambiar de escenario', async () => {
      // 1) Catálogos + escenario inicial (idéntico a la muestra, max AC = 0002).
      await cargarCatalogos(catalogoMuestra, db)
      await cargarEscenario(11, escenarioMuestra, db)

      // 2) M3: registrar un caso nuevo. El código queda por encima del
      // escenario (PON-AC-0003) y no colisiona con otros escenarios.
      const usuarioCaptura = { id: 'USR-CAP-AC', rol: 'captura', clues: CLUES_AC }
      const form = {
        cct: '14DPR1710G',
        fechaTamizaje: '2026-11-01',
        tiraMgL: 20,
        sexo: 'M',
        mesNacimiento: '3',
        anioNacimiento: '2016',
        consentimientoTutor: true,
        asentimientoNino: true,
      }
      const resultado = await registrarCaso({ form, usuario: usuarioCaptura, hoyISO: '2026-11-11' }, db)
      expect(resultado.ok).toBe(true)
      const codigoUsuario = resultado.caso.codigo
      expect(codigoUsuario).toBe('PON-AC-0003')

      // 3) Cambiar a otro escenario. Mantiene los mismos códigos simulados
      // que la muestra: el caso del usuario NO está en ese conjunto.
      await cargarEscenario(30, escenarioMuestra, db)

      // 4) El caso del usuario y su evento siguen ahí; el niño también.
      const casoConservado = await db.casos.get(codigoUsuario)
      expect(casoConservado).toBeDefined()
      expect(casoConservado.clues).toBe(CLUES_AC)
      const ninoConservado = await db.ninos.get(casoConservado.codigoNino)
      expect(ninoConservado).toBeDefined()
      const eventosConservados = await db.eventos
        .where('codigoCaso')
        .equals(codigoUsuario)
        .toArray()
      expect(eventosConservados).toHaveLength(1)
      expect(eventosConservados[0].tipo).toBe('resultado')
      expect(eventosConservados[0].tiraMgL).toBe(20)

      // 5) Los simulados sí se recargaron: 2 del escenario + 1 del usuario.
      expect(await db.casos.count()).toBe(3)
      expect(await escenarioActivo(db)).toBe('30')
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
