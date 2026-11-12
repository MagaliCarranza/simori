import { describe, expect, it } from 'vitest'
import { PROTEGIDO, resumenPorGrupo } from '../../domain/index.js'
import { panelesPorLocalidad } from './panelLocalidad.js'

const HOY = '2026-11-14'

const catalogos = {
  localidades: [
    { claveInegi: 'L2', nombre: 'San Pedro', gradoMarginacion: 'Medio', poblacion5a14: 1954, lat: 20.31, lng: -102.95 },
    { claveInegi: 'L1', nombre: 'Agua Caliente', gradoMarginacion: 'Medio', poblacion5a14: 445, lat: 20.31, lng: -102.92 },
    { claveInegi: 'L3', nombre: 'Chalpicote', gradoMarginacion: 'Alto', poblacion5a14: 276 },
  ],
  escuelas: [
    { cct: 'E1', nombre: 'Zapata', turno: 'matutino', claveInegi: 'L1', matricula: 157, ubicacionAproximada: true },
    { cct: 'E2', nombre: 'Hidalgo', turno: 'vespertino', claveInegi: 'L2', matricula: 90, ubicacionAproximada: true },
    { cct: 'E3', nombre: 'Juárez', claveInegi: 'L3', matricula: 60 },
  ],
  centros: [{ clues: 'PROV-1', nombre: 'Centro Agua Caliente', claveInegi: 'L1', provisional: true }],
}

function casos(n, prefijo, cct, extra = {}) {
  return Array.from({ length: n }, (_, i) => ({
    codigo: `${prefijo}${i + 1}`,
    cct,
    estado: 'en_seguimiento',
    fechaTamizaje: '2026-09-01',
    fechaProximaCita: '2026-12-01',
    ...extra,
  }))
}

const localidadDe = (c) => catalogos.escuelas.find((e) => e.cct === c.cct)?.claveInegi ?? null

describe('panelesPorLocalidad', () => {
  // L1: 5 verdes y 3 rojos; L2: 6 verdes; L3 sin casos.
  const todos = [
    ...casos(5, 'PON-AC-', 'E1'),
    ...casos(3, 'PON-AC-R', 'E1', { fechaProximaCita: '2026-10-01' }),
    ...casos(6, 'PON-SPI-', 'E2'),
  ]
  const porLocalidad = resumenPorGrupo(todos, [], HOY, localidadDe)
  const paneles = panelesPorLocalidad(catalogos, porLocalidad)

  it('un panel por localidad del catálogo, ordenado por nombre', () => {
    expect(paneles.map((p) => p.nombre)).toEqual(['Agua Caliente', 'Chalpicote', 'San Pedro'])
  })

  it('une escuelas y centro de su localidad con ubicación aproximada y provisional', () => {
    const ac = paneles[0]
    expect(ac.gradoMarginacion).toBe('Medio')
    expect(ac.poblacion5a14).toBe(445)
    expect(ac.coordenadas).toEqual([20.31, -102.92])
    expect(ac.escuelas).toEqual([
      { cct: 'E1', nombre: 'Zapata', turno: 'matutino', matricula: 157, ubicacionAproximada: true },
    ])
    expect(ac.centros).toEqual([{ clues: 'PROV-1', nombre: 'Centro Agua Caliente', provisional: true }])
  })

  it('los pendientes son la fila de resumenPorGrupo (con "protegido")', () => {
    const fila = porLocalidad.find((g) => g.clave === 'L1')
    expect(paneles[0].pendientes).toEqual({
      total: fila.total,
      enSeguimiento: fila.salidas.en_seguimiento,
      semaforo: fila.semaforo,
      sinSeguimiento: fila.salidas.sin_seguimiento,
    })
    expect(paneles[0].pendientes.semaforo).toEqual({ verde: 5, amarillo: PROTEGIDO, rojo: PROTEGIDO })
  })

  it('una localidad sin casos muestra todo como "menos de 5"', () => {
    const chalpicote = paneles[1]
    expect(chalpicote.coordenadas).toBeNull()
    expect(chalpicote.centros).toEqual([])
    expect(chalpicote.pendientes).toEqual({
      total: 'menos de 5',
      enSeguimiento: 'menos de 5',
      semaforo: { verde: 'menos de 5', amarillo: 'menos de 5', rojo: 'menos de 5' },
      sinSeguimiento: 'menos de 5',
    })
  })

  it('no contiene códigos de caso', () => {
    expect(JSON.stringify(paneles)).not.toMatch(/PON-/)
  })
})
