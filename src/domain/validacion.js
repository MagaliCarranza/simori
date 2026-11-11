// Reglas de validación compartidas por el formulario de captura y la
// importación CSV/Excel. Devuelve { valido, errores }. Nunca lanza.

const REGEX_CODIGO_CASO = /^PON-[A-Z]{2,4}-\d{4}$/
const REGEX_CCT = /^\d{2}[A-Z]{3}\d{4}[A-Z]$/ // ej. 14DPR0123X
const REGEX_CLUES = /^[A-Z]{5}\d{6}$/ // ej. JCSSA001234
const VALORES_TIRA = [0, 20, 50, 100]
const CAMPOS_SENSIBLES = ['nombre', 'curp', 'domicilio', 'fechaNacimiento']

function esFechaISOValida(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}

function normalizar(v) {
  return typeof v === 'string' ? v.toUpperCase() : v
}

// catalogo es opcional: { ccts?: string[], clues?: string[] } con claves reales
// de los datasets 13 (centros de salud) y 28 (escuelas). Si viene, además de
// validar el formato se verifica que la clave exista.
export function validarRegistro(datos, hoyISO, catalogo) {
  const errores = []
  const d = datos ?? {}

  // Rechazo explícito de campos sensibles.
  for (const campo of CAMPOS_SENSIBLES) {
    if (d[campo] !== undefined && d[campo] !== null && d[campo] !== '') {
      errores.push(`El campo "${campo}" no se puede registrar`)
    }
  }

  if (!d.codigo || !REGEX_CODIGO_CASO.test(d.codigo)) {
    errores.push('El código del caso no tiene formato válido (PON-<LOC>-<NNNN>)')
  }

  const cct = normalizar(d.cct)
  if (!cct) {
    errores.push('Falta la CCT de la escuela')
  } else if (!REGEX_CCT.test(cct)) {
    errores.push('La CCT no tiene formato válido (ej. 14DPR0123X)')
  } else if (catalogo?.ccts && !catalogo.ccts.includes(cct)) {
    errores.push('La CCT no está en el catálogo de escuelas')
  }

  const clues = normalizar(d.clues)
  if (!clues) {
    errores.push('Falta la CLUES del centro de salud')
  } else if (!REGEX_CLUES.test(clues)) {
    errores.push('La CLUES no tiene formato válido (ej. JCSSA001234)')
  } else if (catalogo?.clues && !catalogo.clues.includes(clues)) {
    errores.push('La CLUES no está en el catálogo de centros de salud')
  }

  if (!d.fechaTamizaje) {
    errores.push('Falta la fecha de tamizaje')
  } else if (!esFechaISOValida(d.fechaTamizaje)) {
    errores.push('La fecha de tamizaje no es válida (YYYY-MM-DD)')
  } else if (hoyISO && d.fechaTamizaje > hoyISO) {
    errores.push('La fecha de tamizaje no puede ser futura')
  }

  if (!VALORES_TIRA.includes(d.tiraMgL)) {
    errores.push('El valor de la tira debe ser 0, 20, 50 o 100 mg/L')
  }

  if (d.consentimientoTutor !== true) {
    errores.push('Falta el consentimiento del tutor')
  }
  if (d.asentimientoNino !== true) {
    errores.push('Falta el asentimiento del niño')
  }

  return { valido: errores.length === 0, errores }
}
