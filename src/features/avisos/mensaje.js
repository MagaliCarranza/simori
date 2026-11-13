// M7 · Texto del aviso para la familia (HU06, RF07). Función pura.
// Lenguaje sencillo, sin diagnósticos, sin culpar a la familia ni a instituciones.

import { diasEntre } from '../../domain/index.js'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
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

// '2026-11-20' → 'viernes 20 de noviembre de 2026'
export function fechaLarga(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()
  return `${DIAS[diaSemana]} ${dia} de ${MESES[mes - 1]} de ${anio}`
}

// Qué se hará en la cita, según el siguiente paso del caso.
const MOTIVOS = {
  Confirmación: 'repetir la prueba de orina',
  Valoración: 'hacer un análisis de sangre y medir peso, talla y presión',
  Clasificación: 'revisar los resultados con el personal de salud',
  Salida: 'revisar los resultados con el personal de salud',
  'Revisión periódica': 'su revisión de seguimiento',
}

export function motivoCita(siguientePaso) {
  return MOTIVOS[siguientePaso] ?? 'continuar su seguimiento'
}

const POR_QUE_IR =
  'Aunque su niña o niño se vea sano, es importante ir. Muchas veces estos cambios no se notan ' +
  'ni causan molestias, y la única forma de saber cómo sigue es completar sus revisiones.'

// Arma el aviso. `fila` es la que regresa evaluarCaso() (pendientes.js).
// Si la cita ya pasó o no hay cita, pide acudir a acordar una fecha nueva
// y `fechaCita` queda en null.
export function construirAviso({ fila, centro, hoyISO }) {
  const lugarCita = centro?.nombre ?? 'su centro de salud'
  const motivo = motivoCita(fila.siguientePaso)
  const citaVigente = fila.fechaProximaCita && diasEntre(hoyISO, fila.fechaProximaCita) >= 0
  const fechaCita = citaVigente ? fila.fechaProximaCita : null

  const saludo = `Hola. Le escribimos de ${lugarCita}.`
  const pendiente = `Su niña o niño (código ${fila.codigo}) tiene pendiente ${motivo}.`
  const cita = fechaCita
    ? `Su cita es el ${fechaLarga(fechaCita)} en ${lugarCita}.`
    : `Por favor acérquese a ${lugarCita} para acordar la fecha de su cita.`
  const cambio = fechaCita
    ? 'Si no puede ir ese día, acérquese al centro de salud para cambiar la fecha.'
    : 'Le atenderemos con gusto.'

  const parrafos = [saludo, pendiente, cita, POR_QUE_IR, cambio]
  // En el audio no se lee el código (no le dice nada a la familia).
  const textoAudio = [saludo, `Su niña o niño tiene pendiente ${motivo}.`, cita, POR_QUE_IR, cambio].join(' ')

  return {
    codigoCaso: fila.codigo,
    fechaCita,
    lugarCita,
    motivo,
    parrafos,
    texto: parrafos.join('\n\n'),
    textoAudio,
  }
}
