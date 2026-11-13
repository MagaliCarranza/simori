import { describe, expect, it } from 'vitest'
import { atiende, catalogosEnAlcance } from './catalogos.js'

// Imita el catálogo real (PR #19): fila de total, localidades fuera de alcance
// (con y sin coordenadas) y un centro que atiende desde otra localidad.
const localidades = [
  { claveInegi: '140660000', nombre: 'Total del Municipio', lat: null, lng: null, enAlcance: false, cluesOperativo: null },
  { claveInegi: '140660001', nombre: 'Poncitlán', lat: 20.379, lng: -102.927, enAlcance: false, cluesOperativo: 'C-PON' },
  { claveInegi: '140660002', nombre: 'Agua Caliente', lat: 20.31, lng: -102.92, enAlcance: true, cluesOperativo: 'C-SPI' },
  { claveInegi: '140660031', nombre: 'San Pedro Itzicán', lat: 20.31, lng: -102.95, enAlcance: true, cluesOperativo: 'C-SPI' },
  { claveInegi: '140660043', nombre: 'Chalpicote', lat: 20.31, lng: -102.91, enAlcance: true, cluesOperativo: 'C-SPI' },
  { claveInegi: '140660099', nombre: 'Sin bandera', lat: 20.3, lng: -102.9, cluesOperativo: 'C-SPI' },
]
const escuelas = [
  { cct: 'E-AC', claveInegi: '140660002' },
  { cct: 'E-SPI', claveInegi: '140660031' },
  { cct: 'E-PON', claveInegi: '140660001' },
]
const centros = [
  { clues: 'C-SPI', claveInegi: '140660031' },
  { clues: 'C-PON', claveInegi: '140660001' },
  { clues: 'C-AC', claveInegi: '140660002' },
]

describe('catalogosEnAlcance', () => {
  const c = catalogosEnAlcance({ localidades, escuelas, centros })

  it('solo localidades con enAlcance === true (nunca "Total del Municipio")', () => {
    expect(c.localidades.map((l) => l.nombre)).toEqual(['Agua Caliente', 'San Pedro Itzicán', 'Chalpicote'])
  })

  it('solo escuelas de esas localidades', () => {
    expect(c.escuelas.map((e) => e.cct)).toEqual(['E-AC', 'E-SPI'])
  })

  it('solo los centros que las atienden (cluesOperativo), aunque estén en otra localidad', () => {
    expect(c.centros.map((x) => x.clues)).toEqual(['C-SPI'])
  })

  it('tolera catálogos vacíos', () => {
    expect(catalogosEnAlcance({})).toEqual({ localidades: [], escuelas: [], centros: [] })
  })
})

describe('atiende', () => {
  it('compara el cluesOperativo de la localidad con el CLUES del centro', () => {
    expect(atiende(localidades[2], centros[0])).toBe(true)
    expect(atiende(localidades[2], centros[2])).toBe(false)
  })
})
