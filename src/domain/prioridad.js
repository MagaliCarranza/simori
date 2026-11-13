// Índice de prioridad por localidad (docs/01 reporte-simori, anexo D).
// Cuatro variables: marginación (CONAPO), distancia a la unidad más cercana
// (CLUES), matrícula por localidad (SEJ/SEP) y % de lengua indígena (Censo).
//
// Cuidado con CONAPO 2020: a mayor IM_2020, MENOR marginación. Chalpicote
// (im2020 = 18.57) tiene grado "Alto" y San Pedro Itzicán (im2020 = 19.76)
// grado "Medio". Por eso aquí se invierte la marginación antes de combinar
// variables, para que "más marginación" sume más al puntaje final.

import { PRIORIDAD_HLI_MIN_PARA_RAZON, PRIORIDAD_PESOS, PRIORIDAD_UMBRALES } from './config.js'

const EXTRACTORES = {
  marginacion: (l) => l.im2020,
  distancia: (l) => l.distanciaKm,
  matricula: (l) => l.matricula,
  hli: (l) => l.pctHLI,
}

// La marginación se invierte: menos IM_2020 significa más marginación.
const INVERTIR = new Set(['marginacion'])

const ETIQUETAS_FALTA = {
  marginacion: 'marginación',
  distancia: 'distancia a la unidad de salud',
  matricula: 'matrícula',
  hli: 'población con lengua indígena',
}

// CONAPO usa "grado" masculino ("Alto"); en la razón concuerda con el
// sustantivo femenino "marginación", así que mapeamos a la forma femenina.
const GRADO_FEMENINO = {
  'Muy bajo': 'muy baja',
  Bajo: 'baja',
  Medio: 'media',
  Alto: 'alta',
  'Muy alto': 'muy alta',
}

const numero = (x) => (Number.isFinite(x) ? x : null)
const redondear = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d
const FORMATO_MATRICULA = new Intl.NumberFormat('es-MX')

function minMaxPorVariable(localidades) {
  const r = {}
  for (const v of Object.keys(EXTRACTORES)) {
    const vals = localidades.map((l) => numero(EXTRACTORES[v](l))).filter((x) => x !== null)
    r[v] = vals.length === 0 ? { min: null, max: null } : { min: Math.min(...vals), max: Math.max(...vals) }
  }
  return r
}

function normalizar(valor, { min, max }, invertir) {
  if (valor === null || min === null || max === null) return null
  if (max === min) return 0
  const n = (valor - min) / (max - min)
  return invertir ? 1 - n : n
}

function nivelDesde(puntaje, umbrales) {
  if (puntaje >= umbrales.alta) return 'alta'
  if (puntaje >= umbrales.media) return 'media'
  return 'baja'
}

// Frase concreta a partir del dato crudo. Si la distancia es 0 la localidad
// tiene centro propio, es más informativo que "0 km".
function fraseDesdeCrudo(variable, crudo, grado) {
  if (variable === 'marginacion') {
    if (!grado) return null
    return `Marginación ${GRADO_FEMENINO[grado] ?? grado.toLowerCase()}`
  }
  if (variable === 'distancia') {
    if (crudo === 0) return 'tiene centro de salud propio'
    return `${crudo.toFixed(1)} km a la unidad de salud`
  }
  if (variable === 'matricula') {
    return `${FORMATO_MATRICULA.format(crudo)} alumnos`
  }
  if (variable === 'hli') {
    const pct = crudo * 100
    const texto = Math.abs(pct - Math.round(pct)) < 1e-9 ? Math.round(pct).toString() : pct.toFixed(1)
    return `${texto} % con lengua indígena`
  }
  return null
}

// Razón: las 2 variables que más aportan al puntaje, con su dato crudo.
// La lengua indígena se omite si es despreciable (< hliMin).
function componerRazon({ aportes, crudas, grado, faltantes, hliMin }) {
  const frases = aportes
    .filter((a) => {
      if (a.variable === 'hli') return crudas.hli !== null && crudas.hli >= hliMin
      return true
    })
    .sort((a, b) => b.aporte - a.aporte)
    .slice(0, 2)
    .map((a) => fraseDesdeCrudo(a.variable, crudas[a.variable], grado))
    .filter(Boolean)

  let texto = frases.join(', ')
  if (texto.length > 0) {
    texto = texto.charAt(0).toUpperCase() + texto.slice(1)
    if (!/[.!?]$/.test(texto)) texto += '.'
  }
  if (faltantes.length > 0) {
    const nombres = faltantes.map((v) => ETIQUETAS_FALTA[v]).join(', ')
    if (texto.length > 0) texto += ' '
    texto += `Sin dato de ${nombres}: su peso se repartió entre las demás.`
  }
  return texto || 'Sin datos suficientes para explicar el puntaje.'
}

// localidades: arreglo con al menos { claveInegi, nombre, im2020, distanciaKm,
// matricula, pctHLI, gradoMarginacion, enAlcance }.
export function calcularPrioridad(
  localidades,
  pesos = PRIORIDAD_PESOS,
  umbrales = PRIORIDAD_UMBRALES,
  hliMin = PRIORIDAD_HLI_MIN_PARA_RAZON,
) {
  const rangos = minMaxPorVariable(localidades)

  const resultados = localidades.map((l) => {
    const crudas = {}
    const normalizadas = {}
    for (const v of Object.keys(EXTRACTORES)) {
      const valor = numero(EXTRACTORES[v](l))
      crudas[v] = valor
      normalizadas[v] = normalizar(valor, rangos[v], INVERTIR.has(v))
    }

    // Reparte proporcionalmente el peso de las variables sin dato entre las
    // presentes (docs/01: "si una variable es null, reparte su peso
    // proporcionalmente entre las demás").
    const presentes = Object.keys(pesos).filter((v) => normalizadas[v] !== null)
    const faltantes = Object.keys(pesos).filter((v) => normalizadas[v] === null)
    const suma = presentes.reduce((s, v) => s + pesos[v], 0)

    let puntaje = 0
    const aportes = []
    if (suma > 0) {
      for (const v of presentes) {
        const w = pesos[v] / suma
        const aporte = w * normalizadas[v]
        puntaje += aporte
        aportes.push({ variable: v, aporte })
      }
    }

    const grado = l.gradoMarginacion ?? null
    const puntajeRedondeado = redondear(puntaje)

    return {
      claveInegi: l.claveInegi,
      nombre: l.nombre,
      puntaje: puntajeRedondeado,
      nivel: nivelDesde(puntajeRedondeado, umbrales),
      variables: { crudas, normalizadas },
      razon: componerRazon({ aportes, crudas, grado, faltantes, hliMin }),
      lugarAlcance: null,
      totalAlcance: 0,
    }
  })

  // Ranking dentro de la zona de alcance: puntaje descendente, desempate por nombre.
  const enAlcance = localidades
    .map((l, i) => ({ l, r: resultados[i] }))
    .filter(({ l }) => l.enAlcance === true)
  // Puntaje descendente; desempate por claveInegi para que el orden sea
  // estable y no dependa de acentos/mayúsculas del nombre.
  const ordenados = [...enAlcance].sort((a, b) => {
    if (b.r.puntaje !== a.r.puntaje) return b.r.puntaje - a.r.puntaje
    return a.l.claveInegi.localeCompare(b.l.claveInegi)
  })
  ordenados.forEach(({ r }, i) => {
    r.lugarAlcance = i + 1
    r.totalAlcance = ordenados.length
  })
  // El total también se expone a las localidades fuera del alcance.
  for (const r of resultados) r.totalAlcance = ordenados.length

  return resultados
}

// Texto compacto para la UI: "Prioridad media · 1.º de 3 en el alcance · puntaje 0.52".
// Si la localidad no está en el alcance se omite el lugar.
export function etiquetaPrioridad(prioridad) {
  const partes = [`Prioridad ${prioridad.nivel}`]
  if (prioridad.lugarAlcance) {
    partes.push(`${prioridad.lugarAlcance}.º de ${prioridad.totalAlcance} en el alcance`)
  }
  partes.push(`puntaje ${prioridad.puntaje.toFixed(2)}`)
  return partes.join(' · ')
}
