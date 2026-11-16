// Carga inicial de la base desde public/data/.
//
// - cargarCatalogos: localidades, escuelas, centros de salud y usuarios demo.
//   Idempotente (bulkPut).
// - cargarEscenario: reemplaza los casos del escenario anterior por los del
//   nuevo, pero conserva los que registró un usuario desde M3 (códigos que
//   no vienen en el escenario), junto con sus niños, eventos y avisos.
// - inicializar: si la DB todavía no tiene escenario activo, carga catálogos
//   y el escenario default (11 %). Pensada para llamar al arrancar la app.
//   Si ya estaba inicializada, programa actualizarCatalogos en segundo plano
//   (no la espera).
// - actualizarCatalogos: vuelve a descargar los catálogos y, si su contenido
//   cambió (hash en meta.versionCatalogos), los reemplaza. Nunca toca casos,
//   niños, eventos, avisos ni bitácora. Sin red o con error, no escribe nada.

import { db as dbDefault } from './index.js'

const RUTA_LOCALIDADES = '/data/localidades.json'
const RUTA_ESCUELAS = '/data/escuelas.json'
const RUTA_CENTROS = '/data/centros_salud.json'
const RUTA_USUARIOS = '/data/usuarios_demo.json'
const ruta_casos = (n) => `/data/casos_${n}.json`

const ESCENARIO_DEFAULT = 11

// Tiempo máximo por descarga al actualizar catálogos.
const LIMITE_DESCARGA_MS = 5000
const CLAVE_VERSION = 'versionCatalogos'

// Hash FNV-1a de 32 bits: solo sirve para notar que el contenido cambió.
function hashTexto(texto) {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const versionDe = ({ localidades, escuelas, centrosSalud, usuarios }) =>
  hashTexto(JSON.stringify([localidades, escuelas, centrosSalud, usuarios]))

// Descarga un JSON con límite de tiempo. Si se pasa, cancela la petición y
// rechaza aunque el fetch nunca responda.
function descargarJson(ruta, fetchImpl, limiteMs) {
  const control = new AbortController()
  return new Promise((resolve, reject) => {
    const reloj = setTimeout(() => {
      control.abort()
      reject(new Error(`Tiempo agotado: ${ruta}`))
    }, limiteMs)
    Promise.resolve()
      .then(() => fetchImpl(ruta, { signal: control.signal }))
      .then((r) => {
        if (!r || r.ok === false) throw new Error(`No se pudo descargar ${ruta}`)
        return r.json()
      })
      .then(resolve, reject)
      .finally(() => clearTimeout(reloj))
  })
}

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

// Reemplaza los catálogos si su contenido cambió. Devuelve 'actualizado',
// 'igual' o 'sin-cambios-por-error' y nunca lanza: sin red, con una descarga
// que tarda más de limiteMs o con un JSON inválido, no escribe nada.
// Borra centros y escuelas que ya no vienen en el JSON (p. ej. los PROV-*
// viejos) solo si ningún caso guardado en el equipo los usa.
export async function actualizarCatalogos({
  fetchImpl = fetch,
  db = dbDefault,
  limiteMs = LIMITE_DESCARGA_MS,
} = {}) {
  try {
    const [localidades, escuelas, centrosSalud, usuarios] = await Promise.all(
      [RUTA_LOCALIDADES, RUTA_ESCUELAS, RUTA_CENTROS, RUTA_USUARIOS].map((ruta) =>
        descargarJson(ruta, fetchImpl, limiteMs),
      ),
    )
    if (![localidades, escuelas, centrosSalud, usuarios].every(Array.isArray)) {
      return 'sin-cambios-por-error'
    }
    const version = versionDe({ localidades, escuelas, centrosSalud, usuarios })
    const guardada = await db.meta.get(CLAVE_VERSION)
    if (guardada?.valor === version) return 'igual'

    // Lectura previa (fuera de la transacción, que solo abre catálogos y meta).
    const casos = await db.casos.toArray()
    const cctUsados = new Set(casos.map((c) => c.cct))
    const cluesUsados = new Set(casos.map((c) => c.clues))
    const cctNuevos = new Set(escuelas.map((e) => e.cct))
    const cluesNuevos = new Set(centrosSalud.map((c) => c.clues))

    await db.transaction('rw', db.localidades, db.escuelas, db.centrosSalud, db.usuarios, db.meta, async () => {
      await db.localidades.bulkPut(localidades)
      await db.escuelas.bulkPut(escuelas)
      await db.centrosSalud.bulkPut(centrosSalud)
      await db.usuarios.bulkPut(usuarios)
      const escuelasHuerfanas = (await db.escuelas.toCollection().primaryKeys()).filter(
        (cct) => !cctNuevos.has(cct) && !cctUsados.has(cct),
      )
      const centrosHuerfanos = (await db.centrosSalud.toCollection().primaryKeys()).filter(
        (clues) => !cluesNuevos.has(clues) && !cluesUsados.has(clues),
      )
      await db.escuelas.bulkDelete(escuelasHuerfanas)
      await db.centrosSalud.bulkDelete(centrosHuerfanos)
      await db.meta.put({ clave: CLAVE_VERSION, valor: version })
    })
    return 'actualizado'
  } catch {
    return 'sin-cambios-por-error'
  }
}

// Pensada para arrancar la PWA. fetchImpl se puede inyectar en pruebas.
// Si la base ya estaba inicializada, resuelve de inmediato y deja la
// actualización de catálogos para después (setTimeout 0), sin esperarla.
// `actualizacion` es su promesa (nunca rechaza); la app no la usa.
export async function inicializar({
  fetchImpl = fetch,
  escenario = ESCENARIO_DEFAULT,
  db = dbDefault,
  limiteDescargaMs = LIMITE_DESCARGA_MS,
} = {}) {
  if (await escenarioActivo(db)) {
    const actualizacion = new Promise((resolve) => {
      setTimeout(() => {
        actualizarCatalogos({ fetchImpl, db, limiteMs: limiteDescargaMs }).then(resolve)
      }, 0)
    })
    return { yaInicializada: true, actualizacion }
  }

  const [localidades, escuelas, centrosSalud, usuarios] = await Promise.all([
    fetchImpl(RUTA_LOCALIDADES).then((r) => r.json()),
    fetchImpl(RUTA_ESCUELAS).then((r) => r.json()),
    fetchImpl(RUTA_CENTROS).then((r) => r.json()),
    fetchImpl(RUTA_USUARIOS).then((r) => r.json()),
  ])
  await cargarCatalogos({ localidades, escuelas, centrosSalud, usuarios }, db)
  await db.meta.put({ clave: CLAVE_VERSION, valor: versionDe({ localidades, escuelas, centrosSalud, usuarios }) })

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
