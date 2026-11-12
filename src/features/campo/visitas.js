// M6 · Registro de visitas de campo (HU05, RF06).
// Una visita es un Evento tipo 'visita' con visitaResultado 'localizada' o
// 'no_localizada'. Las visitas nunca reinician el semáforo (regla del dominio).

import { db as dbDefault } from '../../db/index.js'
import { registrar } from '../../db/bitacora.js'
import { diasEntre } from '../../domain/index.js'
import { aplicarSinSeguimiento } from '../pendientes/seguimiento.js'

export const RESULTADOS_VISITA = ['localizada', 'no_localizada']
export const NOTA_MAX = 280

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

function fechaValida(iso) {
  if (typeof iso !== 'string' || !FECHA_ISO.test(iso)) return false
  const [anio, mes, dia] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
}

// Valida lo capturado en el formulario. Nunca lanza.
export function validarVisita({ visitaResultado, fecha, nota = '' }, hoyISO) {
  const errores = []
  if (!RESULTADOS_VISITA.includes(visitaResultado)) {
    errores.push('Elige si la familia fue localizada o no.')
  }
  if (!fechaValida(fecha)) {
    errores.push('La fecha de la visita no es válida.')
  } else if (diasEntre(hoyISO, fecha) > 0) {
    errores.push('La fecha de la visita no puede ser futura.')
  }
  if (typeof nota !== 'string' || nota.length > NOTA_MAX) {
    errores.push(`La nota debe tener ${NOTA_MAX} caracteres o menos.`)
  }
  return { valido: errores.length === 0, errores }
}

// Guarda la visita, deja rastro en la bitácora y aplica la regla de
// "sin seguimiento" (rojo + 2 visitas sin localizar).
// Regresa { ok, errores, evento, pasoASinSeguimiento }.
export async function registrarVisita({ codigoCaso, visitaResultado, fecha, nota = '', usuario, hoyISO }, db = dbDefault) {
  const notaLimpia = typeof nota === 'string' ? nota.trim() : nota
  const { valido, errores } = validarVisita({ visitaResultado, fecha, nota: notaLimpia }, hoyISO)
  if (!valido) return { ok: false, errores, evento: null, pasoASinSeguimiento: false }

  const caso = await db.casos.get(codigoCaso)
  if (!caso) return { ok: false, errores: ['No se encontró el caso.'], evento: null, pasoASinSeguimiento: false }

  const evento = {
    codigoCaso,
    usuarioId: usuario.id,
    etapa: caso.etapaActual,
    fecha,
    tipo: 'visita',
    visitaResultado,
    ...(notaLimpia ? { nota: notaLimpia } : {}),
  }

  await db.transaction('rw', db.eventos, db.bitacora, async () => {
    evento.id = await db.eventos.add(evento)
    await registrar(
      { usuarioId: usuario.id, rol: usuario.rol, accion: 'crear', entidad: 'visita', entidadId: codigoCaso },
      { db },
    )
  })

  const cambiados = await aplicarSinSeguimiento({ codigos: [codigoCaso], hoyISO, usuario }, db)
  return { ok: true, errores: [], evento, pasoASinSeguimiento: cambiados.includes(codigoCaso) }
}

// Para la ficha del caso (M4): visitas en orden cronológico.
export async function visitasDelCaso(codigoCaso, db = dbDefault) {
  const eventos = await db.eventos.where('codigoCaso').equals(codigoCaso).toArray()
  return eventos
    .filter((e) => e.tipo === 'visita')
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.id ?? 0) - (b.id ?? 0)))
}
