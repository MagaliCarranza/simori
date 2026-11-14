import { describe, expect, it } from 'vitest'
import { cambiarFiltro, FILTROS_INICIALES, filtrarCasos, opcionesFiltros } from './filtros.js'

const escuelas = [
  { cct: 'E-AC-1', nombre: 'Zapata', claveInegi: 'AC' },
  { cct: 'E-AC-2', nombre: 'Juárez', claveInegi: 'AC' },
  { cct: 'E-SPI-1', nombre: 'Hidalgo', claveInegi: 'SPI' },
]
// CH no tiene centro propio: la atiende C-SPI, que está en San Pedro.
const centros = [
  { clues: 'C-AC', nombre: 'Centro AC', claveInegi: 'AC' },
  { clues: 'C-SPI', nombre: 'Centro SPI', claveInegi: 'SPI' },
]
const localidades = [
  { claveInegi: 'SPI', nombre: 'San Pedro Itzicán', cluesOperativo: 'C-SPI' },
  { claveInegi: 'AC', nombre: 'Agua Caliente', cluesOperativo: 'C-AC' },
  { claveInegi: 'CH', nombre: 'Chalpicote', cluesOperativo: 'C-SPI' },
]
const escuelasPorCct = new Map(escuelas.map((e) => [e.cct, e]))

const casos = [
  { codigo: '1', cct: 'E-AC-1', clues: 'C-AC' },
  { codigo: '2', cct: 'E-AC-2', clues: 'C-AC' },
  { codigo: '3', cct: 'E-SPI-1', clues: 'C-SPI' },
  { codigo: '4', cct: 'E-AC-1', clues: 'C-SPI' },
]
const codigos = (lista) => lista.map((c) => c.codigo)

describe('filtrarCasos', () => {
  it('sin filtros devuelve todos', () => {
    expect(codigos(filtrarCasos(casos, FILTROS_INICIALES, escuelasPorCct))).toEqual(['1', '2', '3', '4'])
  })

  it('filtra por localidad de la escuela', () => {
    expect(codigos(filtrarCasos(casos, { ...FILTROS_INICIALES, localidad: 'AC' }, escuelasPorCct))).toEqual([
      '1',
      '2',
      '4',
    ])
  })

  it('combina escuela y centro', () => {
    const f = { localidad: '', cct: 'E-AC-1', clues: 'C-SPI' }
    expect(codigos(filtrarCasos(casos, f, escuelasPorCct))).toEqual(['4'])
  })
})

describe('opcionesFiltros', () => {
  it('ordena localidades por nombre y limita escuelas y centros a la localidad', () => {
    const o = opcionesFiltros({ localidades, escuelas, centros }, { ...FILTROS_INICIALES, localidad: 'AC' })
    expect(o.localidades.map((l) => l.nombre)).toEqual(['Agua Caliente', 'Chalpicote', 'San Pedro Itzicán'])
    expect(o.escuelas.map((e) => e.cct)).toEqual(['E-AC-2', 'E-AC-1'])
    expect(o.centros.map((c) => c.clues)).toEqual(['C-AC'])
  })

  it('una localidad sin centro propio ofrece el centro que la atiende', () => {
    const o = opcionesFiltros({ localidades, escuelas, centros }, { ...FILTROS_INICIALES, localidad: 'CH' })
    expect(o.centros.map((c) => c.clues)).toEqual(['C-SPI'])
  })
})

describe('cambiarFiltro', () => {
  it('al cambiar de localidad limpia escuela y centro de otra localidad', () => {
    const antes = { localidad: 'AC', cct: 'E-AC-1', clues: 'C-AC' }
    expect(cambiarFiltro(antes, { localidad: 'SPI' }, { localidades, escuelas, centros })).toEqual({
      localidad: 'SPI',
      cct: '',
      clues: '',
    })
  })

  it('conserva escuela y centro si pertenecen a la nueva localidad', () => {
    const antes = { localidad: '', cct: 'E-AC-1', clues: 'C-AC' }
    expect(cambiarFiltro(antes, { localidad: 'AC' }, { localidades, escuelas, centros })).toEqual({
      localidad: 'AC',
      cct: 'E-AC-1',
      clues: 'C-AC',
    })
  })

  it('conserva el centro que atiende a la nueva localidad aunque esté en otra', () => {
    const antes = { localidad: 'SPI', cct: '', clues: 'C-SPI' }
    expect(cambiarFiltro(antes, { localidad: 'CH' }, { localidades, escuelas, centros })).toEqual({
      localidad: 'CH',
      cct: '',
      clues: 'C-SPI',
    })
  })
})
