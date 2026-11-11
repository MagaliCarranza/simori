// Propone la salida de un caso que llegó a clasificación (etapa 4).
// Por construcción, todo caso clasificado ya pasó por confirmación persistente
// en etapa 2, así que la categoría A no condiciona la propuesta aquí.
// El personal de salud decide con un evento tipo 'alta' o 'referencia'.
export function salidaPropuesta({ tfge }) {
  return tfge < 60 ? 'referido' : 'vigilancia'
}
