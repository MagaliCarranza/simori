import { describe, expect, it } from 'vitest'
import { PROTEGIDO, resumenPorGrupo } from '../../domain/index.js'
import gruposReales from '../../../public/data/grupos_localidades.json'
import { centrosEnMapa, panelesPorLocalidad, textoAgrupacion } from './panelLocalidad.js'

const HOY = '2026-11-14'

const catalogos = {
  localidades: [
    { claveInegi: 'L2', nombre: 'San Pedro', gradoMarginacion: 'Medio', poblacion5a14: 1954, lat: 20.31, lng: -102.95, cluesOperativo: 'C-SP', distanciaKm: 0 },
    { claveInegi: 'L1', nombre: 'Agua Caliente', gradoMarginacion: 'Medio', poblacion5a14: 445, lat: 20.31, lng: -102.92, cluesOperativo: 'C-SP', distanciaKm: 2.723 },
    { claveInegi: 'L3', nombre: 'Chalpicote', gradoMarginacion: 'Alto', poblacion5a14: 276, cluesOperativo: null, distanciaKm: null },
  ],
  escuelas: [
    { cct: 'E1', nombre: 'Zapata', turno: 'matutino', claveInegi: 'L1', matricula: 157, ubicacionAproximada: true },
    { cct: 'E2', nombre: 'Hidalgo', turno: 'vespertino', claveInegi: 'L2', matricula: 90, ubicacionAproximada: true },
    { cct: 'E3', nombre: 'Juárez', claveInegi: 'L3', matricula: 60 },
  ],
  // C-SP está en L2 y atiende también a L1. C-AP no atiende a nadie.
  centros: [
    { clues: 'C-SP', nombre: 'CENTRO DE SALUD SAN PEDRO', institucion: 'SSA', claveInegi: 'L2', lat: 20.32, lng: -102.96, ubicacionAproximada: false },
    { clues: 'C-AP', nombre: 'CENTRO APARTE', institucion: 'IMSS', claveInegi: 'L9', lat: 20.4, lng: -102.9, ubicacionAproximada: true },
  ],
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

  it('une escuelas y el centro que atiende a la localidad aunque esté en otra', () => {
    const ac = paneles[0]
    expect(ac.gradoMarginacion).toBe('Medio')
    expect(ac.poblacion5a14).toBe(445)
    expect(ac.coordenadas).toEqual([20.31, -102.92])
    expect(ac.escuelas).toEqual([
      { cct: 'E1', nombre: 'Zapata', turno: 'matutino', matricula: 157, ubicacionAproximada: true },
    ])
    expect(ac.centro).toEqual({
      clues: 'C-SP',
      nombre: 'CENTRO DE SALUD SAN PEDRO',
      institucion: 'SSA',
      distanciaKm: 2.723,
      ubicacionAproximada: false,
    })
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

  it('el nombre del centro se deja tal como viene en CLUES y la distancia 0 se conserva', () => {
    expect(paneles[2].centro.nombre).toBe('CENTRO DE SALUD SAN PEDRO')
    expect(paneles[2].centro.distanciaKm).toBe(0)
  })

  it('una localidad sin casos muestra todo como "menos de 5"', () => {
    const chalpicote = paneles[1]
    expect(chalpicote.coordenadas).toBeNull()
    expect(chalpicote.centro).toBeNull()
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

describe('agrupación k-means en el panel', () => {
  const grupos = {
    kElegida: 3,
    grupos: [
      { grupo: 1, tamano: 13, descripcion: 'marginación más alta del municipio, más lejos de la unidad de salud' },
      { grupo: 2, tamano: 6, descripcion: 'más cerca de la unidad de salud, matrícula más alta' },
      { grupo: 3, tamano: 21, descripcion: 'marginación más baja del municipio' },
    ],
    localidades: [
      { claveInegi: 'L1', grupo: 1 },
      { claveInegi: 'L2', grupo: 2 },
      { claveInegi: 'OTRA', grupo: 3 },
    ],
  }
  const porNombre = (paneles) => Object.fromEntries(paneles.map((p) => [p.nombre, p]))

  it('cada localidad con grupo trae número, total, descripción y cuántas se parecen', () => {
    const p = porNombre(panelesPorLocalidad(catalogos, [], undefined, grupos))
    expect(p['Agua Caliente'].agrupacion).toEqual({
      grupo: 1,
      totalGrupos: 3,
      descripcion: 'marginación más alta del municipio, más lejos de la unidad de salud',
      parecidas: 12,
    })
    expect(p['San Pedro'].agrupacion.grupo).toBe(2)
  })

  it('arma la línea con el formato del panel', () => {
    const p = porNombre(panelesPorLocalidad(catalogos, [], undefined, grupos))
    expect(textoAgrupacion(p['Agua Caliente'].agrupacion)).toBe(
      'Grupo 1 de 3: marginación más alta del municipio, más lejos de la unidad de salud ' +
        '(otras 12 localidades con perfil parecido)',
    )
  })

  it('singular y cero en el conteo de localidades parecidas', () => {
    const base = { grupo: 1, totalGrupos: 2, descripcion: 'x' }
    expect(textoAgrupacion({ ...base, parecidas: 1 })).toBe('Grupo 1 de 2: x (otra localidad con perfil parecido)')
    expect(textoAgrupacion({ ...base, parecidas: 0 })).toBe('Grupo 1 de 2: x (sin otras localidades con perfil parecido)')
  })

  it('una localidad sin grupo trae agrupacion null', () => {
    const p = porNombre(panelesPorLocalidad(catalogos, [], undefined, grupos))
    expect(p.Chalpicote.agrupacion).toBeNull()
  })

  it.each([
    ['sin JSON', undefined],
    ['null', null],
    ['un arreglo', []],
    ['sin grupos', { kElegida: 3, localidades: [{ claveInegi: 'L1', grupo: 1 }] }],
    ['grupo inexistente', { ...grupos, localidades: [{ claveInegi: 'L1', grupo: 9 }] }],
    ['grupo sin descripción', { kElegida: 1, grupos: [{ grupo: 1, tamano: 4 }], localidades: [{ claveInegi: 'L1', grupo: 1 }] }],
  ])('no falla y no trae agrupación con datos inválidos (%s)', (_, datos) => {
    const paneles = panelesPorLocalidad(catalogos, [], undefined, datos)
    expect(paneles.every((p) => p.agrupacion === null)).toBe(true)
  })

  it('con grupos_localidades.json real, las 3 localidades del piloto tienen grupo', () => {
    const piloto = {
      localidades: [
        { claveInegi: '140660002', nombre: 'Agua Caliente' },
        { claveInegi: '140660031', nombre: 'San Pedro Itzicán' },
        { claveInegi: '140660043', nombre: 'Chalpicote' },
      ],
      escuelas: [],
      centros: [],
    }
    const p = porNombre(panelesPorLocalidad(piloto, [], undefined, gruposReales))
    for (const nombre of ['Agua Caliente', 'San Pedro Itzicán', 'Chalpicote']) {
      const a = p[nombre].agrupacion
      const g = gruposReales.grupos.find((x) => x.grupo === a.grupo)
      expect(a.totalGrupos).toBe(gruposReales.kElegida)
      expect(a.descripcion).toBe(g.descripcion)
      expect(a.parecidas).toBe(g.tamano - 1)
    }
  })
})

describe('centrosEnMapa', () => {
  it('solo centros con coordenadas que atienden a alguna localidad', () => {
    expect(centrosEnMapa(catalogos.localidades, catalogos.centros)).toEqual([
      { clues: 'C-SP', nombre: 'CENTRO DE SALUD SAN PEDRO', coordenadas: [20.32, -102.96], ubicacionAproximada: false },
    ])
  })

  it('omite un centro sin coordenadas', () => {
    const sinCoordenadas = [{ ...catalogos.centros[0], lat: null, lng: null }]
    expect(centrosEnMapa(catalogos.localidades, sinCoordenadas)).toEqual([])
  })
})
