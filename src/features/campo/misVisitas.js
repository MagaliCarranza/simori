// M6 · Mis visitas (HU04, HU05): lógica pura de la pantalla. Resumen de la
// semana, pestañas (Urgentes, Por localidad, Localizadas) y "Le toca: …".
// Sin React ni Dexie. No cambia cómo se registra una visita ni la regla de
// "sin seguimiento" (eso vive en visitas.js, seguimiento.js y src/domain/).

import { motivoCita } from '../avisos/mensaje.js'

const DIA_MS = 24 * 60 * 60 * 1000
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function aUTC(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return Date.UTC(anio, mes - 1, dia)
}

function aISO(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

// Semana de lunes a domingo que contiene `hoyISO`.
export function semanaDe(hoyISO) {
  const hoy = aUTC(hoyISO)
  const dia = new Date(hoy).getUTCDay() // 0 = domingo
  const desdeLunes = (dia + 6) % 7
  const inicio = hoy - desdeLunes * DIA_MS
  return { inicio: aISO(inicio), fin: aISO(inicio + 6 * DIA_MS) }
}

// "9 al 15 de noviembre" o "30 de noviembre al 6 de diciembre".
export function textoSemana({ inicio, fin }) {
  const [, mi, di] = inicio.split('-').map(Number)
  const [, mf, df] = fin.split('-').map(Number)
  return mi === mf ? `${di} al ${df} de ${MESES[mf - 1]}` : `${di} de ${MESES[mi - 1]} al ${df} de ${MESES[mf - 1]}`
}

export function enSemana(fechaISO, semana) {
  return Boolean(fechaISO) && fechaISO >= semana.inicio && fechaISO <= semana.fin
}

// Resumen de avance de la semana a partir de los eventos de visita del centro
// y de los casos por visitar (los de la pestaña "Todas").
export function resumenSemana({ visitas, porVisitar, hoyISO }) {
  const semana = semanaDe(hoyISO)
  const deLaSemana = visitas.filter((v) => v.tipo === 'visita' && enSemana(v.fecha, semana))
  const visitadas = new Set(deLaSemana.map((v) => v.codigoCaso))
  return {
    semana,
    visitasRegistradas: deLaSemana.length,
    familiasVisitadas: visitadas.size,
    faltan: porVisitar.filter((f) => !visitadas.has(f.codigo)).length,
  }
}

// Casos activos del centro con al menos una visita "localizada" esta semana.
export function localizadasDeLaSemana({ filas, visitas, hoyISO }) {
  const semana = semanaDe(hoyISO)
  const localizadas = new Set(
    visitas
      .filter((v) => v.tipo === 'visita' && v.visitaResultado === 'localizada' && enSemana(v.fecha, semana))
      .map((v) => v.codigoCaso),
  )
  return filas.filter((f) => localizadas.has(f.codigo))
}

export function urgentes(filas) {
  return filas.filter((f) => f.semaforo.color === 'rojo')
}

export const SIN_LOCALIDAD = 'Localidad sin registrar'

// Nombre de la localidad de un caso a partir de su escuela (solo localidad y
// escuela: nunca domicilios ni barrios).
export function localidadDe(fila, escuelas, localidades) {
  const clave = escuelas.get(fila.cct)?.claveInegi
  return (clave && localidades.get(clave)?.nombre) || null
}

// Agrupa por localidad, en orden alfabético; dentro conserva el orden de llegada
// (del más urgente al menos urgente). La localidad sin registrar va al final.
export function porLocalidad(filas, escuelas, localidades) {
  const grupos = new Map()
  for (const f of filas) {
    const nombre = localidadDe(f, escuelas, localidades) ?? SIN_LOCALIDAD
    if (!grupos.has(nombre)) grupos.set(nombre, [])
    grupos.get(nombre).push(f)
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => {
      if (a === SIN_LOCALIDAD) return 1
      if (b === SIN_LOCALIDAD) return -1
      return a.localeCompare(b, 'es')
    })
    .map(([localidad, casos]) => ({ localidad, casos }))
}

// Lo que le toca a la familia, en lenguaje sencillo (el mismo texto del aviso).
export function leToca(fila) {
  return `Le toca: ${motivoCita(fila.siguientePaso)}.`
}
