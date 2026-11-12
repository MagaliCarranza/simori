// RF14: guarda el paso a "sin seguimiento" y la reactivación en la base local.
// La regla vive en src/domain/ (debeMarcarseSinSeguimiento, puedeReactivarse);
// aquí solo se persiste el cambio y se deja rastro en la bitácora (RF15).

import { db as dbDefault } from '../../db/index.js'
import { registrar } from '../../db/bitacora.js'
import { debeMarcarseSinSeguimiento, puedeReactivarse } from '../../domain/index.js'

const ESTADOS_QUE_PUEDEN_PERDERSE = new Set(['en_seguimiento', 'vigilancia'])

// Revisa los casos indicados y pasa a 'sin_seguimiento' los que cumplan la regla.
// Guarda el estado anterior en `estadoPrevio` para regresar a él al reactivar.
// Idempotente: un caso que ya está en sin_seguimiento no se toca.
// Regresa los códigos que cambiaron.
export async function aplicarSinSeguimiento({ codigos, hoyISO, usuario }, db = dbDefault) {
  const cambiados = []
  await db.transaction('rw', db.casos, db.eventos, db.bitacora, async () => {
    const casos = await db.casos.where('codigo').anyOf(codigos).toArray()
    for (const caso of casos) {
      if (!ESTADOS_QUE_PUEDEN_PERDERSE.has(caso.estado)) continue
      const eventos = await db.eventos.where('codigoCaso').equals(caso.codigo).toArray()
      if (!debeMarcarseSinSeguimiento(caso, eventos, hoyISO)) continue

      await db.casos.update(caso.codigo, { estado: 'sin_seguimiento', estadoPrevio: caso.estado })
      await registrar(
        { usuarioId: usuario.id, rol: usuario.rol, accion: 'modificar', entidad: 'caso', entidadId: caso.codigo },
        { db },
      )
      cambiados.push(caso.codigo)
    }
  })
  return cambiados
}

// Para llamarse al guardar un evento nuevo (resultado o cita) de un caso.
// Si el caso estaba en sin_seguimiento y el evento lo permite, regresa a su
// estado anterior (o a 'en_seguimiento'). Regresa true si lo reactivó.
export async function reactivarSiCorresponde({ codigoCaso, evento, usuario }, db = dbDefault) {
  let reactivado = false
  await db.transaction('rw', db.casos, db.bitacora, async () => {
    const caso = await db.casos.get(codigoCaso)
    if (!caso || !puedeReactivarse(caso, evento)) return

    const estado = ESTADOS_QUE_PUEDEN_PERDERSE.has(caso.estadoPrevio) ? caso.estadoPrevio : 'en_seguimiento'
    await db.casos.update(codigoCaso, { estado, estadoPrevio: undefined })
    await registrar(
      { usuarioId: usuario.id, rol: usuario.rol, accion: 'modificar', entidad: 'caso', entidadId: codigoCaso },
      { db },
    )
    reactivado = true
  })
  return reactivado
}
