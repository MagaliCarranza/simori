// Lógica pura de M5: arma la lista de pendientes de un centro de salud.
// Las reglas (semáforo, sin seguimiento) vienen de src/domain/; aquí solo se
// combinan, filtran y ordenan para las pantallas. Sin React ni Dexie.

import {
  calcularSemaforo,
  debeMarcarseSinSeguimiento,
  siguienteEtapa,
  VISITAS_NO_LOCALIZADAS,
} from '../../domain/index.js'

const ESTADOS_CERRADOS = new Set(['alta', 'referido'])

// Nombres de etapa para mostrar en pantalla (no son reglas).
const NOMBRES_ETAPA = {
  1: 'Tamizaje',
  2: 'Confirmación',
  3: 'Valoración',
  4: 'Clasificación',
  5: 'Salida',
}

const PRIORIDAD_COLOR = { rojo: 0, amarillo: 1, verde: 2 }

export const COLORES_PENDIENTES = ['rojo', 'amarillo']

export function agruparEventosPorCaso(eventos) {
  const mapa = new Map()
  for (const e of eventos) {
    if (!mapa.has(e.codigoCaso)) mapa.set(e.codigoCaso, [])
    mapa.get(e.codigoCaso).push(e)
  }
  return mapa
}

// Texto del siguiente paso del caso (lo que la familia tiene pendiente).
export function siguientePaso(caso) {
  if (caso.estado === 'vigilancia') return 'Revisión periódica'
  const siguiente = siguienteEtapa(caso.etapaActual ?? 0)
  if (siguiente == null) return NOMBRES_ETAPA[5]
  return NOMBRES_ETAPA[siguiente]
}

// Resumen de un caso activo para las listas de pendientes.
export function evaluarCaso(caso, eventosCaso, hoyISO) {
  const semaforo = calcularSemaforo(caso, eventosCaso, hoyISO)
  const visitas = eventosCaso
    .filter((e) => e.tipo === 'visita')
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
  const visitasNoLocalizadas = visitas.filter((v) => v.visitaResultado === 'no_localizada').length

  return {
    codigo: caso.codigo,
    cct: caso.cct,
    clues: caso.clues,
    estado: caso.estado,
    etapaActual: caso.etapaActual,
    fechaProximaCita: caso.fechaProximaCita ?? null,
    siguientePaso: siguientePaso(caso),
    semaforo,
    sinCita: semaforo.referencia === 'ultimo_evento',
    visitasNoLocalizadas,
    visitasNecesarias: VISITAS_NO_LOCALIZADAS,
    ultimaVisita: visitas.length ? visitas[visitas.length - 1] : null,
    sinSeguimiento:
      caso.estado === 'sin_seguimiento' || debeMarcarseSinSeguimiento(caso, eventosCaso, hoyISO),
  }
}

// Evalúa todos los casos activos (no cerrados) de un centro.
export function evaluarCentro({ casos, eventos, clues, hoyISO }) {
  const eventosPorCaso = agruparEventosPorCaso(eventos)
  return casos
    .filter((c) => c.clues === clues && !ESTADOS_CERRADOS.has(c.estado))
    .map((c) => evaluarCaso(c, eventosPorCaso.get(c.codigo) || [], hoyISO))
}

// Más días de retraso primero; en empate, rojo antes que amarillo; luego por código.
export function ordenarPorRetraso(filas) {
  return [...filas].sort((a, b) => {
    const dias = b.semaforo.diasRetraso - a.semaforo.diasRetraso
    if (dias !== 0) return dias
    const color = (PRIORIDAD_COLOR[a.semaforo.color] ?? 9) - (PRIORIDAD_COLOR[b.semaforo.color] ?? 9)
    if (color !== 0) return color
    return a.codigo.localeCompare(b.codigo)
  })
}

// Solo amarillo y rojo (HU03, HU04), con filtros opcionales.
// `busqueda`: subcadena que aparece en el código del caso (case-insensitive);
// permite buscar por "0131", "AC-0131" o "PON-AC-0131".
export function filtrarPendientes(
  filas,
  { color = 'todos', cct = '', soloSinCita = false, busqueda = '' } = {},
) {
  const q = busqueda.trim().toUpperCase()
  return ordenarPorRetraso(
    filas.filter((f) => {
      if (!COLORES_PENDIENTES.includes(f.semaforo.color)) return false
      if (color !== 'todos' && f.semaforo.color !== color) return false
      if (cct && f.cct !== cct) return false
      if (soloSinCita && !f.sinCita) return false
      if (q && !f.codigo.toUpperCase().includes(q)) return false
      return true
    }),
  )
}

// Conteos para las tarjetas resumen. "Sin cita" cuenta todos los casos
// activos sin cita agendada (también los verdes que están por agendarse).
export function resumenPendientes(filas) {
  let rojo = 0
  let amarillo = 0
  let sinCita = 0
  for (const f of filas) {
    if (f.semaforo.color === 'rojo') rojo++
    if (f.semaforo.color === 'amarillo') amarillo++
    if (f.sinCita) sinCita++
  }
  return { rojo, amarillo, sinCita }
}
