import { describe, expect, it } from 'vitest'
import {
  completadasDeLaSemana,
  enSemana,
  leToca,
  porLocalidad,
  resumenSemana,
  semanaDe,
  SIN_LOCALIDAD,
  textoSemana,
  urgentes,
} from './misVisitas.js'

const HOY = '2026-11-14' // sábado

const fila = (codigo, extra = {}) => ({
  codigo,
  cct: 'CCT-AC',
  siguientePaso: 'Confirmación',
  semaforo: { color: 'amarillo' },
  ...extra,
})
const visita = (codigoCaso, fecha, visitaResultado = 'no_localizada') => ({ codigoCaso, fecha, tipo: 'visita', visitaResultado })

describe('semana', () => {
  it('va de lunes a domingo', () => {
    expect(semanaDe(HOY)).toEqual({ inicio: '2026-11-09', fin: '2026-11-15' })
    expect(semanaDe('2026-11-09')).toEqual({ inicio: '2026-11-09', fin: '2026-11-15' })
    expect(semanaDe('2026-11-15')).toEqual({ inicio: '2026-11-09', fin: '2026-11-15' })
  })

  it('texto en lenguaje sencillo, también si cruza de mes', () => {
    expect(textoSemana(semanaDe(HOY))).toBe('9 al 15 de noviembre')
    expect(textoSemana(semanaDe('2026-12-02'))).toBe('30 de noviembre al 6 de diciembre')
  })

  it('enSemana incluye los extremos', () => {
    const s = semanaDe(HOY)
    expect(enSemana('2026-11-09', s)).toBe(true)
    expect(enSemana('2026-11-15', s)).toBe(true)
    expect(enSemana('2026-11-08', s)).toBe(false)
    expect(enSemana(null, s)).toBe(false)
  })
})

describe('resumenSemana', () => {
  it('cuenta visitas y familias de la semana, y las que faltan por visitar', () => {
    const r = resumenSemana({
      visitas: [visita('A', '2026-11-10'), visita('A', '2026-11-13'), visita('B', '2026-11-12', 'localizada'), visita('C', '2026-11-02')],
      porVisitar: [fila('A'), fila('C'), fila('D')],
      hoyISO: HOY,
    })
    expect(r).toMatchObject({ visitasRegistradas: 3, familiasVisitadas: 2, faltan: 2 })
  })
})

describe('pestañas', () => {
  it('Urgentes: solo semáforo rojo', () => {
    expect(urgentes([fila('A'), fila('B', { semaforo: { color: 'rojo' } })]).map((f) => f.codigo)).toEqual(['B'])
  })

  it('Completadas: casos con visita localizada esta semana', () => {
    const filas = [fila('A'), fila('B'), fila('C')]
    const visitas = [visita('A', '2026-11-10', 'localizada'), visita('B', '2026-11-11'), visita('C', '2026-11-01', 'localizada')]
    expect(completadasDeLaSemana({ filas, visitas, hoyISO: HOY }).map((f) => f.codigo)).toEqual(['A'])
  })

  it('Por localidad: agrupa por la localidad de la escuela, en orden alfabético y sin registrar al final', () => {
    const escuelas = new Map([
      ['CCT-AC', { cct: 'CCT-AC', claveInegi: 'L-AC' }],
      ['CCT-CH', { cct: 'CCT-CH', claveInegi: 'L-CH' }],
      ['CCT-X', { cct: 'CCT-X' }],
    ])
    const localidades = new Map([
      ['L-AC', { claveInegi: 'L-AC', nombre: 'Agua Caliente' }],
      ['L-CH', { claveInegi: 'L-CH', nombre: 'Chalpicote' }],
    ])
    const grupos = porLocalidad(
      [fila('A', { cct: 'CCT-CH' }), fila('B', { cct: 'CCT-X' }), fila('C'), fila('D', { cct: 'CCT-CH' })],
      escuelas,
      localidades,
    )
    expect(grupos.map((g) => [g.localidad, g.casos.map((c) => c.codigo)])).toEqual([
      ['Agua Caliente', ['C']],
      ['Chalpicote', ['A', 'D']],
      [SIN_LOCALIDAD, ['B']],
    ])
  })
})

describe('leToca', () => {
  it('dice el siguiente paso en lenguaje sencillo', () => {
    expect(leToca(fila('A'))).toBe('Le toca: repetir la prueba de orina.')
    expect(leToca(fila('A', { siguientePaso: 'Revisión periódica' }))).toBe('Le toca: su revisión de seguimiento.')
  })
})
