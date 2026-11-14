// Carga inicial de la base desde public/data/.
//
// - cargarCatalogos: localidades, escuelas, centros de salud y usuarios demo.
//   Idempotente (bulkPut).
// - cargarEscenario: reemplaza los casos del escenario anterior por los del
//   nuevo, pero conserva los que registró un usuario desde M3 (códigos que
//   no vienen en el escenario), junto con sus niños, eventos y avisos.
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
      // Códigos que aporta el escenario entrante: sirven para distinguir
      // los casos simulados (se reemplazan) de los registrados por el
      // usuario desde M3 (se conservan).
      const codigosEscenario = new Set((datos.casos ?? []).map((c) => c.codigo))

      const casosConservados = (await db.casos.toArray()).filter(
        (c) => !codigosEscenario.has(c.codigo),
      )
      const codigosCasoUsuario = new Set(casosConservados.map((c) => c.codigo))
      const codigosNinoUsuario = new Set(casosConservados.map((c) => c.codigoNino))

      const ninosConservados = (await db.ninos.toArray()).filter((n) =>
        codigosNinoUsuario.has(n.codigo),
      )
      const eventosConservados = (await db.eventos.toArray()).filter((e) =>
        codigosCasoUsuario.has(e.codigoCaso),
      )
      const avisosConservados = (await db.avisos.toArray()).filter((a) =>
        codigosCasoUsuario.has(a.codigoCaso),
      )

      await db.ninos.clear()
      await db.casos.clear()
      await db.eventos.clear()
      await db.avisos.clear()

      if (datos.ninos) await db.ninos.bulkAdd(datos.ninos)
      if (datos.casos) await db.casos.bulkAdd(datos.casos)
      if (datos.eventos) await db.eventos.bulkAdd(datos.eventos)

      // Reinserta lo del usuario al final. Los ids autoincrementales de
      // eventos y avisos se quitan para no colisionar; Dexie asigna uno
      // nuevo en la base recién vaciada.
      if (ninosConservados.length) await db.ninos.bulkPut(ninosConservados)
      if (casosConservados.length) await db.casos.bulkPut(casosConservados)
      if (eventosConservados.length) {
        await db.eventos.bulkAdd(eventosConservados.map(({ id: _id, ...resto }) => resto))
      }
      if (avisosConservados.length) {
        await db.avisos.bulkAdd(avisosConservados.map(({ id: _id, ...resto }) => resto))
      }

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
