// Hook compartido por "Casos con retraso y pendientes" (captura) y
// "Mis visitas" (campo). Lee de la base local, así que funciona sin internet.

import { liveQuery } from 'dexie'
import { useEffect, useRef, useState } from 'react'
import { db as dbDefault } from '../../db/index.js'
import { registrar } from '../../db/bitacora.js'
import { evaluarCentro } from './pendientes.js'
import { aplicarSinSeguimiento } from './seguimiento.js'

const INICIAL = { cargando: true, error: null, filas: [], escuelas: new Map(), centro: null }

export function usePendientesDelCentro({ usuario, hoyISO, db = dbDefault }) {
  const [datos, setDatos] = useState(INICIAL)
  const clues = usuario?.clues
  const usuarioRef = useRef(usuario)

  useEffect(() => {
    usuarioRef.current = usuario
  }, [usuario])

  // Si cambia el usuario o el centro, la pantalla se monta de nuevo (key en App),
  // así que no hace falta reiniciar el estado aquí.
  useEffect(() => {
    if (!clues) return undefined

    const consulta = liveQuery(async () => {
      const casos = await db.casos.where('clues').equals(clues).toArray()
      const codigos = casos.map((c) => c.codigo)
      const eventos = codigos.length ? await db.eventos.where('codigoCaso').anyOf(codigos).toArray() : []
      const escuelas = await db.escuelas.toArray()
      const centro = await db.centrosSalud.get(clues)
      return { casos, eventos, escuelas, centro }
    })

    const sub = consulta.subscribe({
      next: ({ casos, eventos, escuelas, centro }) => {
        const filas = evaluarCentro({ casos, eventos, clues, hoyISO })
        setDatos({
          cargando: false,
          error: null,
          filas,
          escuelas: new Map(escuelas.map((e) => [e.cct, e])),
          centro: centro ?? null,
        })

        // Guarda el paso a "sin seguimiento" de los que ya cumplen la regla.
        // liveQuery vuelve a emitir tras el cambio; la segunda vez ya no hay pendientes.
        const porMarcar = filas
          .filter((f) => f.sinSeguimiento && f.estado !== 'sin_seguimiento')
          .map((f) => f.codigo)
        if (porMarcar.length) {
          aplicarSinSeguimiento({ codigos: porMarcar, hoyISO, usuario: usuarioRef.current }, db).catch(() => {})
        }
      },
      error: (error) => setDatos({ ...INICIAL, cargando: false, error }),
    })

    return () => sub.unsubscribe()
  }, [clues, hoyISO, db])

  // Bitácora (RF15): una consulta por apertura de la lista.
  useEffect(() => {
    if (!clues) return
    const u = usuarioRef.current
    registrar({ usuarioId: u.id, rol: u.rol, accion: 'consultar', entidad: 'pendientes', entidadId: clues }, { db }).catch(
      () => {},
    )
  }, [clues, db])

  return datos
}
