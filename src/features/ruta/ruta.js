// M4 · Ruta clínica (HU02, RF03). Registro del resultado de cada etapa y
// avance o cierre del caso. La lógica clínica vive en src/domain/
// (CKiD U25, clasificación KDIGO, salida propuesta); aquí solo se arma qué
// eventos y cambios se guardan, con el mismo formato que scripts/simular_casos.py:
//
//   etapa 2 · confirmación:  resultado { tiraMgL }  (+ alta "No confirmado" si es negativa)
//   etapa 3 · valoración:    resultado { creatininaMgDl, tallaCm, pesoKg, tfge }
//   etapa 4 · clasificación: resultado { ...valoración, cocienteAlbCrea, categoriaG, categoriaA }
//                            + referencia (TFGe < 60) o vigilancia con revisión a 6 meses
//
// La herramienta no diagnostica (RNF08): los cálculos se muestran como
// propuesta y la salida la elige el personal de salud.

import { db as dbDefault } from '../../db/index.js'
import { registrar } from '../../db/bitacora.js'
import {
  agendarProximaRevisionVigilancia,
  categoriaA,
  clasificarTFG,
  diasEntre,
  edadDecimal,
  esPositivo,
  salidaPropuesta,
  tfgeCKiDU25,
} from '../../domain/index.js'

export const NOMBRES_ETAPA = {
  1: 'Tamizaje',
  2: 'Confirmación',
  3: 'Valoración',
  4: 'Clasificación',
}

export const NOMBRES_ESTADO = {
  en_seguimiento: 'En seguimiento',
  sin_seguimiento: 'Sin seguimiento',
  vigilancia: 'En vigilancia periódica',
  referido: 'Referido a nefrología pediátrica',
  alta: 'No confirmado (alta)',
}

export const VALORES_TIRA = [0, 20, 50, 100]
export const SALIDAS = ['referido', 'vigilancia']
export const NOTA_NO_CONFIRMADO = 'No confirmado'

// Rangos de captura (evitan errores de dedo; no son criterios clínicos).
const RANGOS = {
  creatininaMgDl: { min: 0.1, max: 10, texto: 'La creatinina debe estar entre 0.1 y 10 mg/dL.' },
  tallaCm: { min: 50, max: 210, texto: 'La talla debe estar entre 50 y 210 cm.' },
  pesoKg: { min: 5, max: 200, texto: 'El peso debe estar entre 5 y 200 kg.' },
  cocienteAlbCrea: { min: 0, max: 10000, texto: 'El cociente albúmina/creatinina debe estar entre 0 y 10000 mg/g.' },
}

const ESTADOS_CERRADOS = new Set(['alta', 'referido'])
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

function fechaValida(iso) {
  if (typeof iso !== 'string' || !FECHA_ISO.test(iso)) return false
  const [anio, mes, dia] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
}

function numero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  if (typeof v === 'string' && v.trim() !== '') return Number(v.trim().replace(',', '.'))
  return NaN
}

function redondear2(n) {
  return Math.round(n * 100) / 100
}

function validarRango(campo, valor, errores) {
  const r = RANGOS[campo]
  if (!(valor >= r.min && valor <= r.max)) errores.push(r.texto)
}

function ordenarEventos(eventos) {
  return [...eventos].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.id ?? 0) - (b.id ?? 0)))
}

// Último evento 'resultado' (de una etapa, si se indica).
export function ultimoResultado(eventos, etapa) {
  let ultimo = null
  for (const e of ordenarEventos(eventos)) {
    if (e.tipo !== 'resultado') continue
    if (etapa != null && e.etapa !== etapa) continue
    ultimo = e
  }
  return ultimo
}

// Etapa que toca registrar, o null si el caso ya no avanza por la ruta
// (cerrado, o en vigilancia después de la clasificación).
export function etapaPorRegistrar(caso) {
  if (ESTADOS_CERRADOS.has(caso.estado)) return null
  if (caso.estado === 'vigilancia' || caso.estadoPrevio === 'vigilancia') return null
  if (caso.etapaActual >= 4) return null
  return caso.etapaActual + 1
}

// TFGe con CKiD U25 a la fecha de la valoración. Devuelve null en tfge si la
// edad queda fuera del rango validado de la fórmula.
export function calcularValoracion({ nino, fecha, creatininaMgDl, tallaCm }) {
  const edadAnios = edadDecimal(nino, fecha)
  const tfge = tfgeCKiDU25({ sexo: nino.sexo, edadAnios, tallaCm, creatininaMgDl })
  const tfgeRedondeada = tfge == null ? null : redondear2(tfge)
  const { categoria, baja } = clasificarTFG(tfgeRedondeada, edadAnios)
  return { edadAnios, tfge: tfgeRedondeada, categoriaG: categoria, baja }
}

// Clasificación KDIGO y salida propuesta a partir de la valoración guardada.
export function calcularClasificacion({ valoracion, cocienteAlbCrea }) {
  const tfge = valoracion?.tfge ?? null
  const categoriaG = tfge == null ? null : clasificarTFG(tfge, 99).categoria
  return {
    tfge,
    categoriaG,
    categoriaA: categoriaA(cocienteAlbCrea),
    propuesta: salidaPropuesta({ tfge }),
  }
}

// Arma lo que se guardará para el resultado de la siguiente etapa.
// No toca la base. Devuelve { ok, errores, eventos, cambios, calculo }.
export function planificarResultado({ caso, nino, eventos, datos, usuario, hoyISO }) {
  const errores = []
  const etapa = etapaPorRegistrar(caso)
  if (etapa == null) {
    return { ok: false, errores: ['Este caso ya no tiene etapas por registrar.'], eventos: [], cambios: null, calculo: null }
  }

  // Fecha: válida, no futura y no anterior al último resultado.
  const fecha = datos.fecha
  const previo = ultimoResultado(eventos)
  if (!fechaValida(fecha)) {
    errores.push('La fecha del resultado no es válida.')
  } else if (diasEntre(hoyISO, fecha) > 0) {
    errores.push('La fecha del resultado no puede ser futura.')
  } else if (previo && fecha < previo.fecha) {
    errores.push(`La fecha no puede ser anterior al último resultado (${previo.fecha}).`)
  }

  // Próxima cita (opcional, etapas 2 y 3): posterior a la fecha del resultado.
  const proximaCita = datos.proximaCita || null
  if (proximaCita && etapa < 4) {
    if (!fechaValida(proximaCita)) errores.push('La fecha de la próxima cita no es válida.')
    else if (fechaValida(fecha) && proximaCita <= fecha) {
      errores.push('La próxima cita debe ser posterior a la fecha del resultado.')
    }
  }

  const base = { codigoCaso: caso.codigo, usuarioId: usuario.id, etapa, fecha }
  const nuevos = []
  let cambios = null
  let calculo = null

  if (etapa === 2) {
    const tiraMgL = numero(datos.tiraMgL)
    if (!VALORES_TIRA.includes(tiraMgL)) errores.push('El valor de la tira debe ser 0, 20, 50 o 100 mg/L.')
    if (errores.length) return { ok: false, errores, eventos: [], cambios: null, calculo: null }

    nuevos.push({ ...base, tipo: 'resultado', tiraMgL })
    if (esPositivo(tiraMgL)) {
      cambios = { etapaActual: 2, estado: 'en_seguimiento', fechaProximaCita: proximaCita }
    } else {
      nuevos.push({ ...base, tipo: 'alta', nota: NOTA_NO_CONFIRMADO })
      cambios = { etapaActual: 2, estado: 'alta', fechaProximaCita: null }
    }
    calculo = { confirmado: esPositivo(tiraMgL) }
  }

  if (etapa === 3) {
    const creatininaMgDl = numero(datos.creatininaMgDl)
    const tallaCm = numero(datos.tallaCm)
    const pesoKg = numero(datos.pesoKg)
    validarRango('creatininaMgDl', creatininaMgDl, errores)
    validarRango('tallaCm', tallaCm, errores)
    validarRango('pesoKg', pesoKg, errores)
    if (!nino) errores.push('No se encontraron los datos del niño (sexo y nacimiento).')
    if (errores.length) return { ok: false, errores, eventos: [], cambios: null, calculo: null }

    calculo = calcularValoracion({ nino, fecha, creatininaMgDl, tallaCm })
    if (calculo.tfge == null) {
      return {
        ok: false,
        errores: ['La edad queda fuera del rango de la fórmula CKiD U25; no se puede estimar la filtración.'],
        eventos: [],
        cambios: null,
        calculo,
      }
    }
    nuevos.push({ ...base, tipo: 'resultado', creatininaMgDl, tallaCm, pesoKg, tfge: calculo.tfge })
    cambios = { etapaActual: 3, estado: 'en_seguimiento', fechaProximaCita: proximaCita }
  }

  if (etapa === 4) {
    const cocienteAlbCrea = numero(datos.cocienteAlbCrea)
    validarRango('cocienteAlbCrea', cocienteAlbCrea, errores)
    const valoracion = ultimoResultado(eventos, 3)
    if (!valoracion || valoracion.tfge == null) {
      errores.push('Falta la valoración (etapa 3) con la filtración estimada.')
    }
    if (!SALIDAS.includes(datos.salida)) errores.push('Elige la salida: referencia o vigilancia periódica.')
    if (errores.length) return { ok: false, errores, eventos: [], cambios: null, calculo: null }

    calculo = calcularClasificacion({ valoracion, cocienteAlbCrea })
    nuevos.push({
      ...base,
      tipo: 'resultado',
      creatininaMgDl: valoracion.creatininaMgDl,
      tallaCm: valoracion.tallaCm,
      pesoKg: valoracion.pesoKg,
      tfge: valoracion.tfge,
      cocienteAlbCrea,
      categoriaG: calculo.categoriaG,
      categoriaA: calculo.categoriaA,
    })
    if (datos.salida === 'referido') {
      nuevos.push({ ...base, tipo: 'referencia' })
      cambios = { etapaActual: 4, estado: 'referido', fechaProximaCita: null }
    } else {
      const { estado, fechaProximaCita } = agendarProximaRevisionVigilancia(caso, fecha)
      cambios = { etapaActual: 4, estado, fechaProximaCita }
    }
  }

  // Si el caso estaba en "sin seguimiento", el resultado lo reactiva (RF14).
  cambios = { ...cambios, estadoPrevio: undefined }
  return { ok: true, errores: [], eventos: nuevos, cambios, calculo }
}

// Guarda el resultado de la siguiente etapa y deja rastro en la bitácora.
// Regresa { ok, errores, caso, calculo, reactivado }.
export async function registrarResultado({ codigoCaso, datos, usuario, hoyISO }, db = dbDefault) {
  let salida = null
  await db.transaction('rw', db.casos, db.ninos, db.eventos, db.bitacora, async () => {
    const caso = await db.casos.get(codigoCaso)
    if (!caso) {
      salida = { ok: false, errores: ['No se encontró el caso.'], caso: null, calculo: null, reactivado: false }
      return
    }
    const [nino, eventos] = await Promise.all([
      db.ninos.get(caso.codigoNino),
      db.eventos.where('codigoCaso').equals(codigoCaso).toArray(),
    ])
    const plan = planificarResultado({ caso, nino, eventos, datos, usuario, hoyISO })
    if (!plan.ok) {
      salida = { ok: false, errores: plan.errores, caso, calculo: plan.calculo, reactivado: false }
      return
    }
    for (const e of plan.eventos) e.id = await db.eventos.add(e)
    await db.casos.update(codigoCaso, plan.cambios)
    await registrar(
      { usuarioId: usuario.id, rol: usuario.rol, accion: 'modificar', entidad: 'caso', entidadId: codigoCaso },
      { db },
    )
    salida = {
      ok: true,
      errores: [],
      caso: await db.casos.get(codigoCaso),
      calculo: plan.calculo,
      reactivado: caso.estado === 'sin_seguimiento',
    }
  })
  return salida
}

// RF02 · Agenda (o cambia) la cita de la etapa que sigue. Guarda un evento
// 'cita' (reactiva el caso si estaba sin seguimiento, regla del dominio).
export function validarCita({ caso, fechaCita, hoyISO }) {
  const errores = []
  if (etapaPorRegistrar(caso) == null && caso.estado !== 'vigilancia') {
    errores.push('Este caso está cerrado; no se le agendan citas.')
  }
  if (!fechaValida(fechaCita)) errores.push('La fecha de la cita no es válida.')
  else if (diasEntre(hoyISO, fechaCita) < 0) errores.push('La cita no puede ser en una fecha pasada.')
  return { valido: errores.length === 0, errores }
}

export async function agendarCita({ codigoCaso, fechaCita, usuario, hoyISO }, db = dbDefault) {
  let salida = null
  await db.transaction('rw', db.casos, db.eventos, db.bitacora, async () => {
    const caso = await db.casos.get(codigoCaso)
    if (!caso) {
      salida = { ok: false, errores: ['No se encontró el caso.'], caso: null, reactivado: false }
      return
    }
    const { valido, errores } = validarCita({ caso, fechaCita, hoyISO })
    if (!valido) {
      salida = { ok: false, errores, caso, reactivado: false }
      return
    }
    await db.eventos.add({
      codigoCaso,
      usuarioId: usuario.id,
      etapa: caso.etapaActual,
      fecha: hoyISO,
      tipo: 'cita',
      fechaCita,
    })
    const reactivado = caso.estado === 'sin_seguimiento'
    const cambios = { fechaProximaCita: fechaCita }
    if (reactivado) {
      cambios.estado = caso.estadoPrevio === 'vigilancia' ? 'vigilancia' : 'en_seguimiento'
      cambios.estadoPrevio = undefined
    }
    await db.casos.update(codigoCaso, cambios)
    await registrar(
      { usuarioId: usuario.id, rol: usuario.rol, accion: 'modificar', entidad: 'caso', entidadId: codigoCaso },
      { db },
    )
    salida = { ok: true, errores: [], caso: await db.casos.get(codigoCaso), reactivado }
  })
  return salida
}

// Texto legible de cada evento para la línea de tiempo de la ficha.
export function describirEvento(e) {
  const etapa = NOMBRES_ETAPA[e.etapa] ?? `Etapa ${e.etapa}`
  switch (e.tipo) {
    case 'resultado':
      if (e.etapa <= 2 && e.tiraMgL != null) {
        return `${etapa}: tira ${e.tiraMgL} mg/L (${esPositivo(e.tiraMgL) ? 'positiva' : 'negativa'})`
      }
      if (e.etapa === 3) {
        return `${etapa}: creatinina ${e.creatininaMgDl} mg/dL, talla ${e.tallaCm} cm, peso ${e.pesoKg} kg; TFGe ${e.tfge} mL/min/1.73 m²`
      }
      if (e.etapa === 4) {
        return `${etapa}: ${e.categoriaG} ${e.categoriaA} (TFGe ${e.tfge}; albúmina/creatinina ${e.cocienteAlbCrea} mg/g)`
      }
      return `${etapa}: resultado registrado`
    case 'alta':
      return `Alta: ${e.nota ?? NOTA_NO_CONFIRMADO}`
    case 'referencia':
      return 'Referido a nefrología pediátrica'
    case 'visita':
      return `Visita de campo: ${e.visitaResultado === 'localizada' ? 'familia localizada' : 'familia no localizada'}${e.nota ? ` · ${e.nota}` : ''}`
    case 'cita':
      return `Cita agendada para el ${e.fechaCita}`
    default:
      return e.tipo
  }
}

export function lineaDeTiempo(eventos) {
  return ordenarEventos(eventos).map((e) => ({ ...e, descripcion: describirEvento(e) }))
}
