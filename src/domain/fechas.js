// Utilidades de fecha para ISO YYYY-MM-DD. Siempre en UTC para evitar DST.
// "hoy" se inyecta como parámetro; estas funciones no leen el reloj.

import { DIA_SUPUESTO_NACIMIENTO } from './config.js'

const MS_POR_DIA = 86_400_000

function partesISO(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return { anio, mes, dia }
}

function aTimestampUTC(iso) {
  const { anio, mes, dia } = partesISO(iso)
  return Date.UTC(anio, mes - 1, dia)
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function aISO(timestampUTC) {
  const d = new Date(timestampUTC)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

export function diasEntre(desdeISO, hastaISO) {
  const d = aTimestampUTC(desdeISO)
  const h = aTimestampUTC(hastaISO)
  return Math.round((h - d) / MS_POR_DIA)
}

export function sumarDias(fechaISO, n) {
  return aISO(aTimestampUTC(fechaISO) + n * MS_POR_DIA)
}

export function sumarMeses(fechaISO, n) {
  const { anio, mes, dia } = partesISO(fechaISO)
  const nuevoTotalMeses = (anio * 12 + (mes - 1)) + n
  const nuevoAnio = Math.floor(nuevoTotalMeses / 12)
  const nuevoMes = (nuevoTotalMeses % 12) + 1
  return `${nuevoAnio}-${pad2(nuevoMes)}-${pad2(dia)}`
}

export function edadDecimal({ mesNacimiento, anioNacimiento }, hoyISO) {
  const nacimiento = Date.UTC(anioNacimiento, mesNacimiento - 1, DIA_SUPUESTO_NACIMIENTO)
  const hoy = aTimestampUTC(hoyISO)
  return (hoy - nacimiento) / (365.25 * MS_POR_DIA)
}
