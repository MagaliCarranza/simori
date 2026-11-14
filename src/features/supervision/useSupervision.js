// Datos de supervisión (M8). Lee de la base local (funciona sin internet) y
// devuelve SOLO cifras agregadas y enmascaradas: los casos y sus códigos no
// salen de este hook.

import { liveQuery } from 'dexie'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db as dbDefault } from '../../db/index.js'
import { registrar } from '../../db/bitacora.js'
import { resumenPorGrupo, resumenSupervision } from '../../domain/index.js'
import { catalogosEnAlcance } from './catalogos.js'
import { filtrarCasos, localidadDeCaso } from './filtros.js'

const VACIO = { casos: [], eventos: [], localidades: [], escuelas: [], centros: [] }

// vista: 'embudo' | 'mapa'; solo identifica la entrada de bitácora.
export function useSupervision({ hoyISO, filtros, usuario, db = dbDefault, vista = 'embudo' }) {
  const [estado, setEstado] = useState({ cargando: true, error: null, datos: VACIO })

  // liveQuery vuelve a emitir al registrar resultados, así el indicador se recalcula (HU08).
  useEffect(() => {
    const consulta = liveQuery(async () => {
      const [casos, eventos, localidades, escuelas, centros] = await Promise.all([
        db.casos.toArray(),
        db.eventos.toArray(),
        db.localidades.toArray(),
        db.escuelas.toArray(),
        db.centrosSalud.toArray(),
      ])
      return { casos, eventos, localidades, escuelas, centros }
    })
    const sub = consulta.subscribe({
      next: (datos) => setEstado({ cargando: false, error: null, datos }),
      error: (error) => setEstado({ cargando: false, error, datos: VACIO }),
    })
    return () => sub.unsubscribe()
  }, [db])

  // Bitácora (RF15): una sola entrada al abrir la pantalla, sin códigos.
  // La ref evita la doble entrada del doble montaje de StrictMode.
  const registrado = useRef(false)
  const usuarioId = usuario?.id ?? null
  useEffect(() => {
    if (registrado.current) return
    registrado.current = true
    registrar(
      { usuarioId, rol: 'supervision', accion: 'consultar', entidad: 'supervision', entidadId: vista },
      { db },
    ).catch(() => {})
  }, [usuarioId, db, vista])

  const { casos, eventos, localidades, escuelas, centros } = estado.datos

  const agregados = useMemo(() => {
    const escuelasPorCct = new Map(escuelas.map((e) => [e.cct, e]))
    const filtrados = filtrarCasos(casos, filtros, escuelasPorCct)
    const nombreLocalidad = new Map(localidades.map((l) => [l.claveInegi, l.nombre]))
    const porLocalidad = resumenPorGrupo(filtrados, eventos, hoyISO, (c) => localidadDeCaso(c, escuelasPorCct))
      .map((g) => ({ ...g, nombre: nombreLocalidad.get(g.clave) ?? g.clave }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    return { resumen: resumenSupervision(filtrados, eventos, hoyISO), porLocalidad }
  }, [casos, eventos, localidades, escuelas, filtros, hoyISO])

  // Solo localidades en alcance: así ni el mapa ni los filtros ofrecen
  // "Total del Municipio" ni localidades fuera de la zona.
  const catalogos = useMemo(
    () => catalogosEnAlcance({ localidades, escuelas, centros }),
    [localidades, escuelas, centros],
  )

  return { cargando: estado.cargando, error: estado.error, catalogos, ...agregados }
}
