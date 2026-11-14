// Datos del pronóstico de demanda. Lee de la base local (funciona sin internet)
// y devuelve solo cifras agregadas por CLUES. El escenario se lee de donde lo
// guarda M10 (db.meta 'escenarioActivo') con su propio hook; al cambiarlo en el
// selector, los casos y el escenario se recargan y el pronóstico se recalcula.

import { liveQuery } from 'dexie'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db as dbDefault } from '../../db/index.js'
import { registrar } from '../../db/bitacora.js'
import { pronosticoDemanda } from '../../domain/index.js'
import { useEscenarioActivo } from '../escenarios/useEscenarioActivo.js'

const VACIO = { casos: [], centros: [] }

export function usePronostico({ hoyISO, usuario, db = dbDefault }) {
  const escenario = useEscenarioActivo(db)
  const [estado, setEstado] = useState({ cargando: true, error: null, datos: VACIO })

  useEffect(() => {
    const consulta = liveQuery(async () => {
      const [casos, centros] = await Promise.all([db.casos.toArray(), db.centrosSalud.toArray()])
      return { casos, centros }
    })
    const sub = consulta.subscribe({
      next: (datos) => setEstado({ cargando: false, error: null, datos }),
      error: (error) => setEstado({ cargando: false, error, datos: VACIO }),
    })
    return () => sub.unsubscribe()
  }, [db])

  // Bitácora (RF15): una entrada al abrir la pantalla, sin códigos de caso.
  const registrado = useRef(false)
  const usuarioId = usuario?.id ?? null
  useEffect(() => {
    if (registrado.current) return
    registrado.current = true
    registrar(
      { usuarioId, rol: 'supervision', accion: 'consultar', entidad: 'supervision', entidadId: 'pronostico' },
      { db },
    ).catch(() => {})
  }, [usuarioId, db])

  const { casos, centros } = estado.datos
  const pronostico = useMemo(() => {
    if (escenario == null) return null
    return pronosticoDemanda({
      casos,
      hoyISO,
      porcentajePerdida: escenario,
      cluesCentros: centros.map((c) => c.clues),
    })
  }, [casos, centros, hoyISO, escenario])

  return {
    cargando: estado.cargando || escenario == null,
    error: estado.error,
    escenario,
    pronostico,
  }
}
