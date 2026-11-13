import { describe, expect, it } from 'vitest'
import { calcularPrioridad, etiquetaPrioridad } from './prioridad.js'

// Las pruebas usan localidades ficticias para no atar el comportamiento a
// las claves ni al orden de las localidades reales de Poncitlán.

const buscar = (resultados, clave) => resultados.find((x) => x.claveInegi === clave)

describe('calcularPrioridad — inversión de marginación', () => {
  it('a mayor IM_2020, menor valor normalizado de marginación', () => {
    // L1 tiene IM_2020 más bajo (grado "Alto"), L2 más alto (grado "Medio").
    // El grado de marginación es mayor en L1, así que su marginación
    // normalizada debe quedar por encima de la de L2.
    const locs = [
      { claveInegi: 'L1', nombre: 'L1', im2020: 10, distanciaKm: 1, matricula: 100, pctHLI: 0.1, gradoMarginacion: 'Alto' },
      { claveInegi: 'L2', nombre: 'L2', im2020: 20, distanciaKm: 1, matricula: 100, pctHLI: 0.1, gradoMarginacion: 'Medio' },
    ]
    const r = calcularPrioridad(locs)
    expect(buscar(r, 'L1').variables.normalizadas.marginacion).toBeGreaterThan(
      buscar(r, 'L2').variables.normalizadas.marginacion,
    )
  })

  it('la localidad con IM_2020 más alto obtiene marginación normalizada 0; la más baja, 1', () => {
    const locs = [
      { claveInegi: 'L1', nombre: 'L1', im2020: 10, distanciaKm: 0, matricula: 0, pctHLI: 0 },
      { claveInegi: 'L2', nombre: 'L2', im2020: 15, distanciaKm: 0, matricula: 0, pctHLI: 0 },
      { claveInegi: 'L3', nombre: 'L3', im2020: 20, distanciaKm: 0, matricula: 0, pctHLI: 0 },
    ]
    const r = calcularPrioridad(locs)
    expect(buscar(r, 'L1').variables.normalizadas.marginacion).toBe(1)
    expect(buscar(r, 'L3').variables.normalizadas.marginacion).toBe(0)
  })
})

describe('calcularPrioridad — normalización, pesos y niveles', () => {
  it('normaliza min-max contra todas las localidades recibidas', () => {
    const locs = [
      { claveInegi: 'A', nombre: 'A', im2020: 10, distanciaKm: 0, matricula: 100, pctHLI: 0 },
      { claveInegi: 'B', nombre: 'B', im2020: 20, distanciaKm: 4, matricula: 500, pctHLI: 0.2 },
    ]
    const r = calcularPrioridad(locs)
    const a = buscar(r, 'A')
    expect(a.variables.normalizadas.distancia).toBe(0)
    expect(a.variables.normalizadas.matricula).toBe(0)
    expect(buscar(r, 'B').variables.normalizadas.distancia).toBe(1)
  })

  it('aplica pesos 40/30/20/10 a las variables normalizadas', () => {
    // L1 queda en el extremo "más prioridad" en 3 de 4 variables.
    const locs = [
      { claveInegi: 'L1', nombre: 'L1', im2020: 10, distanciaKm: 5, matricula: 0, pctHLI: 0.2, gradoMarginacion: 'Alto' },
      { claveInegi: 'L2', nombre: 'L2', im2020: 30, distanciaKm: 0, matricula: 1000, pctHLI: 0, gradoMarginacion: 'Muy bajo' },
    ]
    const r = calcularPrioridad(locs)
    // L1: marg=1, dist=1, matrícula=0, HLI=1 → 0.4 + 0.3 + 0 + 0.1 = 0.8.
    expect(buscar(r, 'L1').puntaje).toBeCloseTo(0.8, 4)
  })

  it('alta ≥ 0.66, baja < 0.33 (umbrales inclusivos hacia arriba)', () => {
    // Fuerza niveles con pesos a dedo: solo marginación cuenta.
    const pesos = { marginacion: 1, distancia: 0, matricula: 0, hli: 0 }
    const umbrales = { alta: 0.66, media: 0.33 }
    const locs = [
      { claveInegi: 'A', nombre: 'A', im2020: 34, distanciaKm: 0, matricula: 0, pctHLI: 0, gradoMarginacion: 'Alto' },
      { claveInegi: 'B', nombre: 'B', im2020: 0, distanciaKm: 0, matricula: 0, pctHLI: 0 },
      { claveInegi: 'C', nombre: 'C', im2020: 100, distanciaKm: 0, matricula: 0, pctHLI: 0 },
    ]
    // A: 1 − 34/100 = 0.66 → "alta". C: 0 → "baja".
    const r = calcularPrioridad(locs, pesos, umbrales)
    expect(buscar(r, 'A').nivel).toBe('alta')
    expect(buscar(r, 'C').nivel).toBe('baja')
  })
})

describe('calcularPrioridad — razón con datos crudos', () => {
  it('menciona las 2 variables con mayor aporte, con su dato crudo', () => {
    // L1 queda en el extremo "más prioridad" en marg y dist; matrícula
    // y HLI son mínimos. Esperado: marginación + distancia en km.
    const locs = [
      { claveInegi: 'L1', nombre: 'L1', im2020: 10, distanciaKm: 4.2, matricula: 0, pctHLI: 0.01, gradoMarginacion: 'Alto' },
      { claveInegi: 'L2', nombre: 'L2', im2020: 30, distanciaKm: 0, matricula: 1000, pctHLI: 0.1, gradoMarginacion: 'Bajo' },
    ]
    const r = calcularPrioridad(locs)
    expect(buscar(r, 'L1').razon).toBe('Marginación alta, 4.2 km a la unidad de salud.')
  })

  it('formatea matrícula con separador de miles', () => {
    // Solo marg y matrícula se mencionan; pesos redistribuidos no hacen falta.
    const locs = [
      { claveInegi: 'L1', nombre: 'L1', im2020: 10, distanciaKm: 0, matricula: 1452, pctHLI: 0, gradoMarginacion: 'Medio' },
      { claveInegi: 'L2', nombre: 'L2', im2020: 30, distanciaKm: 0, matricula: 0, pctHLI: 0 },
    ]
    const r = calcularPrioridad(locs)
    expect(buscar(r, 'L1').razon).toBe('Marginación media, 1,452 alumnos.')
  })

  it('distancia 0 se escribe como "tiene centro de salud propio"', () => {
    // Fuerzo que la distancia aparezca en el top-2 volviendo nulas matrícula y HLI.
    const locs = [
      { claveInegi: 'L1', nombre: 'L1', im2020: 10, distanciaKm: 0, matricula: null, pctHLI: null, gradoMarginacion: 'Alto' },
      { claveInegi: 'L2', nombre: 'L2', im2020: 50, distanciaKm: 10, matricula: null, pctHLI: null, gradoMarginacion: 'Muy bajo' },
    ]
    const r = calcularPrioridad(locs)
    expect(buscar(r, 'L1').razon).toMatch(/tiene centro de salud propio/)
    expect(buscar(r, 'L1').razon).not.toMatch(/0\.0 km/)
  })

  it('lengua indígena < 5 % no aparece en la razón', () => {
    // L1: matrícula mínima y HLI de 3 % (debajo del umbral). La razón debe
    // caer en marginación + distancia, nunca en HLI.
    const locs = [
      { claveInegi: 'L1', nombre: 'L1', im2020: 10, distanciaKm: 3, matricula: 0, pctHLI: 0.03, gradoMarginacion: 'Alto' },
      { claveInegi: 'L2', nombre: 'L2', im2020: 30, distanciaKm: 0, matricula: 500, pctHLI: 0 },
    ]
    const r = calcularPrioridad(locs)
    expect(buscar(r, 'L1').razon).not.toMatch(/lengua indígena/i)
  })

  it('lengua indígena ≥ 5 % sí aparece en la razón', () => {
    const locs = [
      { claveInegi: 'L1', nombre: 'L1', im2020: 10, distanciaKm: 0, matricula: 0, pctHLI: 0.2, gradoMarginacion: 'Alto' },
      { claveInegi: 'L2', nombre: 'L2', im2020: 10, distanciaKm: 0, matricula: 0, pctHLI: 0, gradoMarginacion: 'Muy bajo' },
    ]
    // Marg norm = 0 (min=max=10) para ambas: el aporte principal es HLI.
    const r = calcularPrioridad(locs)
    expect(buscar(r, 'L1').razon).toMatch(/20 % con lengua indígena/)
  })
})

describe('calcularPrioridad — lugar dentro del alcance', () => {
  it('el lugar 1 es la localidad en alcance con mayor puntaje', () => {
    const locs = [
      { claveInegi: 'ALC-01', nombre: 'A', im2020: 10, distanciaKm: 5, matricula: 0, pctHLI: 0.3, gradoMarginacion: 'Alto', enAlcance: true },
      { claveInegi: 'ALC-02', nombre: 'B', im2020: 20, distanciaKm: 0, matricula: 500, pctHLI: 0, gradoMarginacion: 'Medio', enAlcance: true },
      { claveInegi: 'ALC-03', nombre: 'C', im2020: 30, distanciaKm: 2, matricula: 200, pctHLI: 0.1, gradoMarginacion: 'Bajo', enAlcance: true },
      { claveInegi: 'FUERA', nombre: 'Fuera', im2020: 40, distanciaKm: 0, matricula: 3000, pctHLI: 0.4, enAlcance: false },
    ]
    const r = calcularPrioridad(locs)
    const porLugar = {}
    for (const x of r) if (x.lugarAlcance) porLugar[x.lugarAlcance] = x
    expect(porLugar[1].puntaje).toBeGreaterThanOrEqual(porLugar[2].puntaje)
    expect(porLugar[2].puntaje).toBeGreaterThanOrEqual(porLugar[3].puntaje)
    expect(buscar(r, 'FUERA').lugarAlcance).toBeNull()
  })

  it('totalAlcance cuenta solo las localidades en alcance', () => {
    const locs = [
      { claveInegi: 'ALC-01', nombre: 'A', im2020: 10, distanciaKm: 1, matricula: 1, pctHLI: 0, enAlcance: true },
      { claveInegi: 'ALC-02', nombre: 'B', im2020: 20, distanciaKm: 1, matricula: 1, pctHLI: 0, enAlcance: true },
      { claveInegi: 'FUERA', nombre: 'Fuera', im2020: 30, distanciaKm: 1, matricula: 1, pctHLI: 0, enAlcance: false },
    ]
    const r = calcularPrioridad(locs)
    for (const x of r) expect(x.totalAlcance).toBe(2)
  })

  it('en empate de puntaje gana la clave INEGI menor', () => {
    const locs = [
      { claveInegi: 'ALC-02', nombre: 'B', im2020: 10, distanciaKm: 1, matricula: 1, pctHLI: 0.1, gradoMarginacion: 'Alto', enAlcance: true },
      { claveInegi: 'ALC-01', nombre: 'A', im2020: 10, distanciaKm: 1, matricula: 1, pctHLI: 0.1, gradoMarginacion: 'Alto', enAlcance: true },
    ]
    const r = calcularPrioridad(locs)
    expect(buscar(r, 'ALC-01').puntaje).toBe(buscar(r, 'ALC-02').puntaje)
    expect(buscar(r, 'ALC-01').lugarAlcance).toBe(1)
    expect(buscar(r, 'ALC-02').lugarAlcance).toBe(2)
  })
})

describe('calcularPrioridad — nulos y redistribución', () => {
  it('reparte el peso de variables sin dato entre las presentes y lo menciona en la razón', () => {
    const locs = [
      { claveInegi: 'L1', nombre: 'L1', im2020: 10, distanciaKm: 5, matricula: null, pctHLI: 0.1, gradoMarginacion: 'Alto' },
      { claveInegi: 'L2', nombre: 'L2', im2020: 30, distanciaKm: 0, matricula: null, pctHLI: 0 },
    ]
    const r = calcularPrioridad(locs)
    const a = buscar(r, 'L1')
    expect(a.puntaje).toBe(1)
    expect(a.variables.normalizadas.matricula).toBeNull()
    expect(a.razon).toMatch(/matrícula/i)
    expect(a.razon).toMatch(/peso se repartió/i)
  })

  it('todas las variables nulas → puntaje 0 y nivel "baja"', () => {
    const r = calcularPrioridad([
      { claveInegi: 'A', nombre: 'A', im2020: null, distanciaKm: null, matricula: null, pctHLI: null },
    ])
    expect(r[0].puntaje).toBe(0)
    expect(r[0].nivel).toBe('baja')
  })
})

describe('etiquetaPrioridad', () => {
  it('"Prioridad media · 1.º de 3 en el alcance · puntaje 0.52"', () => {
    expect(
      etiquetaPrioridad({ nivel: 'media', lugarAlcance: 1, totalAlcance: 3, puntaje: 0.5248 }),
    ).toBe('Prioridad media · 1.º de 3 en el alcance · puntaje 0.52')
  })

  it('sin lugar (fuera del alcance) omite ese segmento', () => {
    expect(
      etiquetaPrioridad({ nivel: 'baja', lugarAlcance: null, totalAlcance: 3, puntaje: 0.12 }),
    ).toBe('Prioridad baja · puntaje 0.12')
  })
})
