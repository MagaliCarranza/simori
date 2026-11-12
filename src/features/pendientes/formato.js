// Formato de fechas ISO para pantalla, en español de México.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// '2026-10-05' → '5 oct 2026'. Sin zona horaria: solo reacomoda el texto.
export function formatearFecha(iso) {
  if (!iso) return ''
  const [anio, mes, dia] = iso.split('-').map(Number)
  return `${dia} ${MESES[mes - 1]} ${anio}`
}
