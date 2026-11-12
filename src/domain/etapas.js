// Etapa y estado derivados de los eventos de un caso.
// Guardados desnormalizados en Caso para rendimiento, pero recalculados aquí.

// Devuelve la mayor etapa alcanzada por eventos tipo 'resultado'.
// 0 si aún no hay resultados registrados.
export function etapaDerivada(eventos) {
  let max = 0
  for (const e of eventos) {
    if (e.tipo === 'resultado' && typeof e.etapa === 'number' && e.etapa > max) {
      max = e.etapa
    }
  }
  return max
}

// Devuelve 1..5 o null si ya está en la última etapa.
export function siguienteEtapa(etapaActual) {
  if (etapaActual < 1 || etapaActual >= 5) return null
  return etapaActual + 1
}

// El evento manda sobre la salida: si personal de salud registró 'alta' o
// 'referencia', ese es el estado del caso. En otro caso, conserva el estado
// desnormalizado si ya es 'vigilancia' o 'sin_seguimiento'; si no, 'en_seguimiento'.
export function estadoDerivado(caso, eventos) {
  for (const e of eventos) {
    if (e.tipo === 'alta') return 'alta'
    if (e.tipo === 'referencia') return 'referido'
  }
  if (caso.estado === 'vigilancia' || caso.estado === 'sin_seguimiento') {
    return caso.estado
  }
  return 'en_seguimiento'
}
