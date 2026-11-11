// Carga inicial de la base desde public/data/.
//
// - cargarCatalogos: localidades, escuelas, centros de salud y usuarios demo.
//   Idempotente (bulkPut).
// - cargarEscenario: vacía ninos/casos/eventos/avisos y carga un escenario.
// - inicializar: si la DB todavía no tiene escenario activo, carga catálogos
//   y el escenario default (11 %). Pensada para llamar al arrancar la app.

import { db as dbDefault } from './index.js'

const RUTA_LOCALIDADES = '/data/localidades.json'
const RUTA_ESCUELAS = '/data/escuelas.json'
const RUTA_CENTROS = '/data/centros_salud.json'
const RUTA_USUARIOS = '/data/usuarios_demo.json'
const ruta_casos = (n) => `/data/casos_${n}.json`

const ESCENARIO_DEFAULT = 11

export async function cargarCatalogos(datos, db = dbDefault) {
  await db.transaction(
    'rw',
    db.localidades,
    db.escuelas,
    db.centrosSalud,
    db.usuarios,
    async () => {
      if (datos.localidades) await db.localidades.bulkPut(datos.localidades)
      if (datos.escuelas) await db.escuelas.bulkPut(datos.escuelas)
      if (datos.centrosSalud) await db.centrosSalud.bulkPut(datos.centrosSalud)
      if (datos.usuarios) await db.usuarios.bulkPut(datos.usuarios)
    },
  )
}

export async function cargarEscenario(numero, datos, db = dbDefault) {
  await db.transaction(
    'rw',
    db.ninos,
    db.casos,
    db.eventos,
    db.avisos,
    db.meta,
    async () => {
      await db.ninos.clear()
      await db.casos.clear()
      await db.eventos.clear()
      await db.avisos.clear()
      if (datos.ninos) await db.ninos.bulkAdd(datos.ninos)
      if (datos.casos) await db.casos.bulkAdd(datos.casos)
      if (datos.eventos) await db.eventos.bulkAdd(datos.eventos)
      await db.meta.put({ clave: 'escenarioActivo', valor: String(numero) })
      if (datos.semilla != null) {
        await db.meta.put({ clave: 'semillaCarga', valor: String(datos.semilla) })
      }
    },
  )
}

export async function escenarioActivo(db = dbDefault) {
  const entrada = await db.meta.get('escenarioActivo')
  return entrada ? entrada.valor : null
}

// Pensada para arrancar la PWA. fetchImpl se puede inyectar en pruebas.
export async function inicializar({ fetchImpl = fetch, escenario = ESCENARIO_DEFAULT, db = dbDefault } = {}) {
  if (await escenarioActivo(db)) return { yaInicializada: true }

  const [localidades, escuelas, centrosSalud, usuarios] = await Promise.all([
    fetchImpl(RUTA_LOCALIDADES).then((r) => r.json()),
    fetchImpl(RUTA_ESCUELAS).then((r) => r.json()),
    fetchImpl(RUTA_CENTROS).then((r) => r.json()),
    fetchImpl(RUTA_USUARIOS).then((r) => r.json()),
  ])
  await cargarCatalogos({ localidades, escuelas, centrosSalud, usuarios }, db)

  const casosEscenario = await fetchImpl(ruta_casos(escenario)).then((r) => r.json())
  await cargarEscenario(
    escenario,
    {
      ninos: casosEscenario.ninos,
      casos: casosEscenario.casos,
      eventos: casosEscenario.eventos,
      semilla: casosEscenario.semilla,
    },
    db,
  )
  return { yaInicializada: false, escenario }
}
