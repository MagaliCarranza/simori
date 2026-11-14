// M3 · Registro de un caso con tamizaje positivo (HU01, RF01, RF02).
// Un registro crea tres cosas en una sola transacción:
//   - Niño: código, sexo y mes/año de nacimiento (sin fecha completa).
//   - Caso: etapa 1, en seguimiento, con la cita de confirmación a 12 semanas.
//   - Evento 'resultado' de la etapa 1 con el valor de la tira.
// Las reglas de formato viven en domain/validacion.js (compartidas con la
// importación CSV); aquí solo se agregan las propias del formulario.

import { db as dbDefault } from '../../db/index.js'
import { registrar } from '../../db/bitacora.js'
import { esPositivo, fechaConfirmacionEsperada, UMBRAL_POSITIVO_MGL, validarRegistro } from '../../domain/index.js'

export const VALORES_TIRA = [0, 20, 50, 100]
export const SEXOS = [
  { valor: 'F', texto: 'Niña' },
  { valor: 'M', texto: 'Niño' },
]

// Misma clave corta que usa scripts/simular_casos.py para los códigos.
export const CLAVE_CORTA_LOCALIDAD = {
  140660002: 'AC',
  140660031: 'SPI',
  140660043: 'CHA',
}

// Edades razonables para escolares de primaria y secundaria.
const EDAD_MIN = 3
const EDAD_MAX = 17

function entero(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : NaN
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim())
  return NaN
}

function pad4(n) {
  return String(n).padStart(4, '0')
}

// Siguiente número libre para una localidad, a partir de los códigos
// existentes de casos y niños (PON-AC-0123 / NIN-AC-0123).
export function siguienteNumero(codigosExistentes, clave) {
  let max = 0
  const patron = new RegExp(`^(?:PON|NIN)-${clave}-(\\d{4})$`)
  for (const c of codigosExistentes) {
    const m = patron.exec(c)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

export function codigosPara(clave, numero) {
  return {
    codigoCaso: `PON-${clave}-${pad4(numero)}`,
    codigoNino: `NIN-${clave}-${pad4(numero)}`,
  }
}

// Valida lo propio del formulario (lo que validarRegistro no cubre).
// Nunca lanza.
export function validarFormulario(form, hoyISO) {
  const errores = []
  const anioHoy = Number(hoyISO.slice(0, 4))

  if (!form.cct) errores.push('Elige la escuela.')

  if (typeof form.tiraMgL === 'number' && !esPositivo(form.tiraMgL)) {
    errores.push(
      `Solo se registran tamizajes positivos (${UMBRAL_POSITIVO_MGL} mg/L o más). Con 0 mg/L no se abre seguimiento.`,
    )
  }

  if (!SEXOS.some((s) => s.valor === form.sexo)) errores.push('Elige si es niña o niño.')

  const mes = entero(form.mesNacimiento)
  const anio = entero(form.anioNacimiento)
  if (!(mes >= 1 && mes <= 12)) errores.push('Elige el mes de nacimiento.')
  if (!(anio >= anioHoy - EDAD_MAX && anio <= anioHoy - EDAD_MIN)) {
    errores.push(`El año de nacimiento debe estar entre ${anioHoy - EDAD_MAX} y ${anioHoy - EDAD_MIN}.`)
  }

  return { valido: errores.length === 0, errores }
}

// Arma niño, caso y evento a partir del formulario ya validado.
export function construirRegistro(form, { usuario, codigoCaso, codigoNino }) {
  const fecha = form.fechaTamizaje
  const nino = {
    codigo: codigoNino,
    sexo: form.sexo,
    mesNacimiento: entero(form.mesNacimiento),
    anioNacimiento: entero(form.anioNacimiento),
  }
  const caso = {
    codigo: codigoCaso,
    codigoNino,
    cct: form.cct,
    clues: usuario.clues,
    fechaTamizaje: fecha,
    consentimientoTutor: true,
    asentimientoNino: true,
    fechaConsentimiento: fecha,
    fechaAsentimiento: fecha,
    simulado: true,
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: fechaConfirmacionEsperada(fecha),
  }
  const evento = {
    codigoCaso,
    usuarioId: usuario.id,
    etapa: 1,
    fecha,
    tipo: 'resultado',
    tiraMgL: form.tiraMgL,
  }
  return { nino, caso, evento }
}

// Valida, genera códigos, guarda y deja rastro en la bitácora.
// Regresa { ok, errores, caso }.
export async function registrarCaso({ form, usuario, hoyISO }, db = dbDefault) {
  if (!usuario?.clues) {
    return { ok: false, errores: ['Tu usuario no tiene un centro de salud asignado.'], caso: null }
  }

  const [escuelas, centros] = await Promise.all([db.escuelas.toArray(), db.centrosSalud.toArray()])
  const catalogo = { ccts: escuelas.map((e) => e.cct), clues: centros.map((c) => c.clues) }
  const escuela = escuelas.find((e) => e.cct === form.cct)
  const clave = escuela ? CLAVE_CORTA_LOCALIDAD[escuela.claveInegi] : null

  const propios = validarFormulario(form, hoyISO)
  // validarRegistro exige un código; usamos uno provisional con formato válido
  // porque el real se genera al guardar.
  const comunes = validarRegistro(
    {
      codigo: 'PON-XX-0000',
      cct: form.cct,
      clues: usuario.clues,
      fechaTamizaje: form.fechaTamizaje,
      tiraMgL: form.tiraMgL,
      consentimientoTutor: form.consentimientoTutor,
      asentimientoNino: form.asentimientoNino,
    },
    hoyISO,
    catalogo,
  )
  const errores = [...propios.errores, ...comunes.errores.filter((e) => !e.startsWith('Falta la CCT'))]
  if (escuela && !clave) errores.push('La escuela no pertenece a una localidad del prototipo.')
  if (errores.length) return { ok: false, errores: [...new Set(errores)], caso: null }

  let registro
  await db.transaction('rw', db.ninos, db.casos, db.eventos, db.bitacora, async () => {
    const existentes = [
      ...(await db.casos.toCollection().primaryKeys()),
      ...(await db.ninos.toCollection().primaryKeys()),
    ]
    const codigos = codigosPara(clave, siguienteNumero(existentes, clave))
    registro = construirRegistro(form, { usuario, ...codigos })
    await db.ninos.add(registro.nino)
    await db.casos.add(registro.caso)
    registro.evento.id = await db.eventos.add(registro.evento)
    await registrar(
      { usuarioId: usuario.id, rol: usuario.rol, accion: 'crear', entidad: 'caso', entidadId: registro.caso.codigo },
      { db },
    )
  })

  return { ok: true, errores: [], caso: registro.caso }
}
