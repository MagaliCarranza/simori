// Propone la salida de un caso que llegó a clasificación (etapa 4).
// Por construcción, todo caso clasificado ya pasó por confirmación persistente
// en etapa 2, así que la categoría A no condiciona la propuesta aquí.
// El personal de salud decide con un evento tipo 'alta' o 'referencia'.

import { VIGILANCIA_MESES } from './config.js'
import { sumarMeses } from './fechas.js'

export function salidaPropuesta({ tfge }) {
  if (tfge == null) return null
  return tfge < 60 ? 'referido' : 'vigilancia'
}

// Cierra el caso en vigilancia (o agenda la siguiente revisión semestral).
// Idempotente: usar al cerrar clasificación en vigilancia y en cada revisión.
export function agendarProximaRevisionVigilancia(caso, fechaResultadoISO) {
  return {
    ...caso,
    estado: 'vigilancia',
    fechaProximaCita: sumarMeses(fechaResultadoISO, VIGILANCIA_MESES),
  }
}
