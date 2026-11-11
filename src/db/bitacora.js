// Bitácora (RF15). Cada operación que registre o consulte un caso
// debe llamar a `registrar` para dejar rastro en db.bitacora.

import { db as dbDefault } from './index.js'

const ACCIONES_VALIDAS = new Set(['consultar', 'crear', 'modificar', 'importar'])

export async function registrar(entrada, { db = dbDefault, fechaHoraISO } = {}) {
  const { usuarioId, rol, accion, entidad, entidadId } = entrada
  if (!ACCIONES_VALIDAS.has(accion)) {
    throw new Error(`Acción de bitácora inválida: ${accion}`)
  }
  await db.bitacora.add({
    usuarioId,
    rol,
    accion,
    entidad,
    entidadId,
    fechaHora: fechaHoraISO ?? new Date().toISOString(),
  })
}

export async function consultar({ entidad, usuarioId, limit = 100 } = {}, db = dbDefault) {
  let col = db.bitacora.orderBy('fechaHora').reverse()
  if (entidad) col = col.filter((b) => b.entidad === entidad)
  if (usuarioId) col = col.filter((b) => b.usuarioId === usuarioId)
  return col.limit(limit).toArray()
}
