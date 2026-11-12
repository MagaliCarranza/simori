// M7 · Guardado de avisos (entidad Aviso de docs/02) en la base local.
// El envío es SIMULADO: no sale ningún mensaje real del equipo.

import { db as dbDefault } from '../../db/index.js'
import { registrar } from '../../db/bitacora.js'

export const CANALES = ['mensaje', 'recado', 'visita']

// Crea un aviso en estado 'pendiente'. Regresa el aviso con su id.
export async function crearAviso({ aviso, canal, usuario, hoyISO }, db = dbDefault) {
  if (!CANALES.includes(canal)) throw new Error(`Canal de aviso inválido: ${canal}`)
  const nuevo = {
    codigoCaso: aviso.codigoCaso,
    usuarioId: usuario.id,
    fecha: hoyISO,
    canal,
    fechaCita: aviso.fechaCita,
    lugarCita: aviso.lugarCita,
    estado: 'pendiente',
    simulado: true,
  }
  await db.transaction('rw', db.avisos, db.bitacora, async () => {
    nuevo.id = await db.avisos.add(nuevo)
    await registrar(
      { usuarioId: usuario.id, rol: usuario.rol, accion: 'crear', entidad: 'aviso', entidadId: aviso.codigoCaso },
      { db },
    )
  })
  return nuevo
}

export async function marcarEntregado({ id, usuario }, db = dbDefault) {
  await db.transaction('rw', db.avisos, db.bitacora, async () => {
    const aviso = await db.avisos.get(id)
    if (!aviso || aviso.estado === 'entregado') return
    await db.avisos.update(id, { estado: 'entregado' })
    await registrar(
      { usuarioId: usuario.id, rol: usuario.rol, accion: 'modificar', entidad: 'aviso', entidadId: aviso.codigoCaso },
      { db },
    )
  })
}

// Más reciente primero.
export async function avisosDelCaso(codigoCaso, db = dbDefault) {
  const avisos = await db.avisos.where('codigoCaso').equals(codigoCaso).toArray()
  return avisos.sort((a, b) => (b.fecha === a.fecha ? b.id - a.id : b.fecha < a.fecha ? -1 : 1))
}
