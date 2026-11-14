// Imprime el % que completa su evaluación en cada escenario (RF11).
// Replica la regla de `porcentajeCompletado` (src/domain/indicador.js):
// un caso completa su evaluación si llega a la etapa 4 por eventos tipo
// `resultado`, o si tiene un evento `alta`. Se corre con Node directo:
//   node scripts/reportar_porcentaje_escenarios.mjs

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

function completa(eventosDelCaso) {
  let etapaMax = 0
  let tieneAlta = false
  for (const e of eventosDelCaso) {
    if (e.tipo === 'resultado' && typeof e.etapa === 'number' && e.etapa > etapaMax) {
      etapaMax = e.etapa
    }
    if (e.tipo === 'alta') tieneAlta = true
  }
  return etapaMax >= 4 || tieneAlta
}

for (const n of [11, 30, 50]) {
  const datos = JSON.parse(await readFile(join(raiz, 'public', 'data', `casos_${n}.json`), 'utf8'))
  const porCaso = new Map()
  for (const e of datos.eventos) {
    if (!porCaso.has(e.codigoCaso)) porCaso.set(e.codigoCaso, [])
    porCaso.get(e.codigoCaso).push(e)
  }
  let completados = 0
  for (const c of datos.casos) if (completa(porCaso.get(c.codigo) ?? [])) completados++
  const pct = (completados / datos.casos.length) * 100
  console.log(`Escenario ${String(n).padStart(2)} %: ${pct.toFixed(1)} % completa su evaluación (${completados} de ${datos.casos.length})`)
}
