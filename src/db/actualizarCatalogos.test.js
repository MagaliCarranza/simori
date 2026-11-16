import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearDb } from './schema.js'
import { actualizarCatalogos, cargarCatalogos, cargarEscenario, inicializar } from './seed.js'

let db
let n = 0

const LOC = { claveInegi: '140660002', nombre: 'Agua Caliente', enAlcance: true, cluesOperativo: 'JCSSA004213' }
const escuelaVieja = { cct: '14DPR1710G', nombre: 'Emiliano Zapata', claveInegi: '140660002', lat: 20.312568, lng: -102.928629, ubicacionAproximada: true }
const escuelaNueva = { ...escuelaVieja, lat: 20.312389, lng: -102.929, ubicacionAproximada: false }
const CENTRO = { clues: 'JCSSA004213', nombre: 'CENTRO DE SALUD SAN PEDRO ITZICAN', claveInegi: '140660031' }
const USUARIOS = [{ id: 'USR-CAP-01', rol: 'captura', clues: 'JCSSA004213' }]

const CATALOGO_NUEVO = {
  '/data/localidades.json': [LOC],
  '/data/escuelas.json': [escuelaNueva],
  '/data/centros_salud.json': [CENTRO],
  '/data/usuarios_demo.json': USUARIOS,
}

const respuesta = (cuerpo) => Promise.resolve({ ok: true, json: () => Promise.resolve(cuerpo) })
const fetchCon = (cuerpos) => vi.fn((url) => respuesta(cuerpos[url]))
const fetchSinRed = () => vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
const fetchQueNoResponde = () => vi.fn(() => new Promise(() => {}))

// Base ya inicializada con la versión anterior: escuela aproximada, un centro
// PROV-* viejo sin casos y otro PROV-* usado por un caso capturado en el equipo.
async function baseAnterior() {
  await cargarCatalogos(
    {
      localidades: [LOC],
      escuelas: [escuelaVieja],
      centrosSalud: [
        CENTRO,
        { clues: 'PROV-AC-01', nombre: 'Centro provisional AC', claveInegi: '140660002' },
        { clues: 'PROV-SPI-01', nombre: 'Centro provisional SPI', claveInegi: '140660031' },
      ],
      usuarios: USUARIOS,
    },
    db,
  )
  await cargarEscenario(
    11,
    {
      casos: [{ codigo: 'PON-AC-0001', codigoNino: 'NIN-AC-0001', cct: '14DPR1710G', clues: 'JCSSA004213', etapaActual: 1, estado: 'en_seguimiento' }],
      eventos: [{ codigoCaso: 'PON-AC-0001', tipo: 'resultado', etapa: 1, fecha: '2026-09-01' }],
    },
    db,
  )
  // Capturado en el equipo con la versión anterior (centro PROV-SPI-01).
  await db.casos.add({ codigo: 'PON-SPI-0900', codigoNino: 'NIN-SPI-0900', cct: '14DPR1616B', clues: 'PROV-SPI-01', etapaActual: 1, estado: 'en_seguimiento' })
  await db.ninos.add({ codigo: 'NIN-SPI-0900', sexo: 'F' })
  await db.eventos.add({ codigoCaso: 'PON-SPI-0900', tipo: 'visita', etapa: 1, fecha: '2026-11-10', resultado: 'localizada' })
  await db.avisos.add({ codigoCaso: 'PON-SPI-0900', estado: 'preparado', fecha: '2026-11-11' })
  await db.bitacora.add({ fechaHora: '2026-11-11T10:00', entidad: 'caso', usuarioId: 'USR-CAP-01', accion: 'registrar' })
}

async function capturado() {
  return {
    casos: await db.casos.toArray(),
    ninos: await db.ninos.toArray(),
    eventos: await db.eventos.toArray(),
    avisos: await db.avisos.toArray(),
    bitacora: await db.bitacora.toArray(),
  }
}

async function catalogos() {
  return {
    escuelas: await db.escuelas.toArray(),
    centros: (await db.centrosSalud.toCollection().primaryKeys()).sort(),
    version: (await db.meta.get('versionCatalogos'))?.valor ?? null,
  }
}

beforeEach(async () => {
  db = crearDb(`test-actualizar-catalogos-${n++}`)
  await baseAnterior()
})

afterEach(async () => {
  await db.delete()
})

describe('actualizarCatalogos', () => {
  it('con contenido nuevo reemplaza los catálogos y guarda la versión', async () => {
    expect(await actualizarCatalogos({ fetchImpl: fetchCon(CATALOGO_NUEVO), db })).toBe('actualizado')
    const c = await catalogos()
    expect(c.escuelas).toEqual([escuelaNueva])
    expect(c.version).toMatch(/^[0-9a-f]{8}$/)
  })

  it('no toca casos, niños, eventos, visitas, avisos ni bitácora', async () => {
    const antes = await capturado()
    await actualizarCatalogos({ fetchImpl: fetchCon(CATALOGO_NUEVO), db })
    expect(await capturado()).toEqual(antes)
  })

  it('sin red no cambia nada y no lanza error', async () => {
    const antes = await catalogos()
    expect(await actualizarCatalogos({ fetchImpl: fetchSinRed(), db })).toBe('sin-cambios-por-error')
    expect(await catalogos()).toEqual(antes)
  })

  it('con la misma versión no vuelve a escribir', async () => {
    await actualizarCatalogos({ fetchImpl: fetchCon(CATALOGO_NUEVO), db })
    // Un cambio local que solo se perdería si se reescribiera el catálogo.
    await db.escuelas.update('14DPR1710G', { marca: 'local' })
    expect(await actualizarCatalogos({ fetchImpl: fetchCon(CATALOGO_NUEVO), db })).toBe('igual')
    expect((await db.escuelas.get('14DPR1710G')).marca).toBe('local')
  })

  it('borra el centro PROV-* sin casos y conserva el que usa un caso del equipo', async () => {
    await actualizarCatalogos({ fetchImpl: fetchCon(CATALOGO_NUEVO), db })
    expect((await catalogos()).centros).toEqual(['JCSSA004213', 'PROV-SPI-01'])
  })

  it('una descarga que nunca responde se cancela por tiempo y no cambia nada', async () => {
    // Límite corto (50 ms) para no esperar los 5 s reales.
    const antes = await catalogos()
    const fetchImpl = vi.fn((url) =>
      url === '/data/escuelas.json' ? new Promise(() => {}) : respuesta(CATALOGO_NUEVO[url]),
    )
    expect(await actualizarCatalogos({ fetchImpl, db, limiteMs: 50 })).toBe('sin-cambios-por-error')
    const senal = fetchImpl.mock.calls.find(([url]) => url === '/data/escuelas.json')[1].signal
    expect(senal.aborted).toBe(true)
    expect(await catalogos()).toEqual(antes)
  })
})

describe('inicializar con la base ya inicializada', () => {
  it('resuelve sin esperar la actualización de catálogos', async () => {
    const fetchImpl = fetchQueNoResponde()
    const r = await inicializar({ fetchImpl, db, limiteDescargaMs: 50 })
    expect(r.yaInicializada).toBe(true)
    // Al resolver todavía no se descargó nada: la actualización va después.
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(await r.actualizacion).toBe('sin-cambios-por-error')
    expect(fetchImpl).toHaveBeenCalled()
  })

  it('después actualiza los catálogos en segundo plano', async () => {
    const r = await inicializar({ fetchImpl: fetchCon(CATALOGO_NUEVO), db })
    expect(await r.actualizacion).toBe('actualizado')
    expect((await db.escuelas.get('14DPR1710G')).ubicacionAproximada).toBe(false)
  })
})

describe('inicializar con la base vacía', () => {
  it('carga como antes y además guarda la versión de catálogos', async () => {
    const vacia = crearDb(`test-actualizar-vacia-${n++}`)
    const fetchImpl = fetchCon({ ...CATALOGO_NUEVO, '/data/casos_11.json': { casos: [], eventos: [], ninos: [] } })
    const r = await inicializar({ fetchImpl, db: vacia })
    expect(r.yaInicializada).toBe(false)
    expect(await vacia.escuelas.count()).toBe(1)
    expect((await vacia.meta.get('versionCatalogos')).valor).toMatch(/^[0-9a-f]{8}$/)
    // Con el mismo contenido, la siguiente actualización no escribe.
    expect(await actualizarCatalogos({ fetchImpl, db: vacia })).toBe('igual')
    await vacia.delete()
  })
})
