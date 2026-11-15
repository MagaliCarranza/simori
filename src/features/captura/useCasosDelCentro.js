// Casos, eventos y escuelas del centro del usuario, desde la base local (sin
// internet). Solo lee: las reglas que guardan cambios (p. ej. "sin
// seguimiento") se quedan en Pendientes (M5). Deja una consulta en la bitácora.

import { liveQuery } from 'dexie'
import { useEffect, useRef, useState } from 'react'
import { registrar } from '../../db/bitacora.js'
import { db as dbDefault } from '../../db/index.js'

const INICIAL = { cargando: true, error: null, casos: [], eventos: [], escuelas: new Map(), centro: null }

export function useCasosDelCentro({ usuario, db = dbDefault, entidad }) {
  const [datos, setDatos] = useState(INICIAL)
  const clues = usuario?.clues
  const usuarioRef = useRef(usuario)

  useEffect(() => {
    usuarioRef.current = usuario
  }, [usuario])

  useEffect(() => {
    if (!clues) return undefined
    const sub = liveQuery(async () => {
      const casos = await db.casos.where('clues').equals(clues).toArray()
      const codigos = casos.map((c) => c.codigo)
      const eventos = codigos.length ? await db.eventos.where('codigoCaso').anyOf(codigos).toArray() : []
      const escuelas = await db.escuelas.toArray()
      const centro = await db.centrosSalud.get(clues)
      return { casos, eventos, escuelas, centro }
    }).subscribe({
      next: ({ casos, eventos, escuelas, centro }) =>
        setDatos({
          cargando: false,
          error: null,
          casos,
          eventos,
          escuelas: new Map(escuelas.map((e) => [e.cct, e])),
          centro: centro ?? null,
        }),
      error: (error) => setDatos({ ...INICIAL, cargando: false, error }),
    })
    return () => sub.unsubscribe()
  }, [clues, db])

  // Bitácora (RF15): una consulta por apertura de la sección.
  useEffect(() => {
    if (!clues || !entidad) return
    const u = usuarioRef.current
    registrar({ usuarioId: u.id, rol: u.rol, accion: 'consultar', entidad, entidadId: clues }, { db }).catch(() => {})
  }, [clues, db, entidad])

  return datos
}
