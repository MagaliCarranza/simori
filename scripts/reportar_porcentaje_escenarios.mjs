// Reporte "titular" por escenario (RF11): % que completa su evaluación y
// los tres grupos que el equipo usa en la demo, calculados sobre los JSON
// generados por scripts/simular_casos.py. Se corre con Node directo:
//   node scripts/reportar_porcentaje_escenarios.mjs

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOY = '2026-11-14'

// Replica de `porcentajeCompletado` (src/domain/indicador.js): un caso
// completa su evaluación si llega a la etapa 4 por eventos tipo `resultado`
// o si tiene un evento `alta`.
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

// Replica mínima de `calcularSemaforo` para los umbrales que usan los
// grupos: con cita (verde ≤ 0 d, rojo ≥ 29) o sin cita contra el último
// resultado (verde 0-14, rojo ≥ 43). Devuelve 'verde'|'amarillo'|'rojo'|null.
function semaforo(caso, eventosDelCaso, hoyISO) {
  if (caso.estado === 'alta' || caso.estado === 'referido') return null
  const hoy = new Date(hoyISO)
  if (caso.fechaProximaCita) {
    const dias = Math.round((hoy - new Date(caso.fechaProximaCita)) / 86400000)
    if (dias <= 0) return 'verde'
    if (dias < 29) return 'amarillo'
    return 'rojo'
  }
  const resultados = eventosDelCaso.filter((e) => e.tipo === 'resultado' && e.fecha)
  const base = resultados.length
    ? resultados.map((e) => e.fecha).sort().at(-1)
    : caso.fechaTamizaje
  if (!base) return 'verde'
  const dias = Math.round((hoy - new Date(base)) / 86400000)
  if (dias < 15) return 'verde'
  if (dias < 43) return 'amarillo'
  return 'rojo'
}

for (const n of [11, 30, 50]) {
  const datos = JSON.parse(await readFile(join(raiz, 'public', 'data', `casos_${n}.json`), 'utf8'))
  const total = datos.casos.length
  const porCaso = new Map()
  for (const e of datos.eventos) {
    if (!porCaso.has(e.codigoCaso)) porCaso.set(e.codigoCaso, [])
    porCaso.get(e.codigoCaso).push(e)
  }

  let completados = 0
  let completoEval = 0
  let enProcesoATiempo = 0
  let perdidoORojo = 0

  for (const c of datos.casos) {
    const evs = porCaso.get(c.codigo) ?? []
    if (completa(evs)) completados++

    const color = semaforo(c, evs, HOY)
    const citaFutura = c.fechaProximaCita && new Date(c.fechaProximaCita) > new Date(HOY)

    if (c.estado === 'alta' || c.estado === 'vigilancia' || c.estado === 'referido') {
      completoEval++
    } else if (c.estado === 'sin_seguimiento' || color === 'rojo') {
      perdidoORojo++
    } else if (c.estado === 'en_seguimiento' && (citaFutura || color === 'verde')) {
      enProcesoATiempo++
    }
  }

  const fmt = (x) => ((x / total) * 100).toFixed(1).padStart(4, ' ')
  const pctCompl = ((completados / total) * 100).toFixed(1)
  console.log(`\nEscenario ${String(n).padStart(2)} %  (hoy=${HOY}, total=${total})`)
  console.log(`  % completa evaluación      : ${pctCompl.padStart(4, ' ')} %  (${completados})`)
  console.log(`  Completó su evaluación     : ${String(completoEval).padStart(4, ' ')}  (${fmt(completoEval)} %)`)
  console.log(`  En proceso a tiempo        : ${String(enProcesoATiempo).padStart(4, ' ')}  (${fmt(enProcesoATiempo)} %)`)
  console.log(`  Perdido o con retraso alto : ${String(perdidoORojo).padStart(4, ' ')}  (${fmt(perdidoORojo)} %)`)
}
