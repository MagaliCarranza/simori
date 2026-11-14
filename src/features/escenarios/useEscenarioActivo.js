// Suscripción al escenario activo (clave 'escenarioActivo' en db.meta).
// Al cambiar, cualquier pantalla que use este hook se vuelve a renderizar.

import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db as dbDefault } from '../../db/index.js'

export function useEscenarioActivo(db = dbDefault) {
  const [numero, setNumero] = useState(null)

  useEffect(() => {
    const sub = liveQuery(() => db.meta.get('escenarioActivo')).subscribe({
      next: (entrada) => setNumero(entrada ? Number(entrada.valor) : null),
      error: () => setNumero(null),
    })
    return () => sub.unsubscribe()
  }, [db])

  return numero
}
