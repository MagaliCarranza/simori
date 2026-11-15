import { describe, expect, it } from 'vitest'
import { coincideCodigo, filasTamizados, filtrarTamizados, gruposMuestras, movimientosGuardados } from './captura.js'

const HOY = '2026-11-14'

function caso(codigo, extra = {}) {
  return {
    codigo,
    cct: 'E1',
    clues: 'C1',
    fechaTamizaje: '2026-08-01',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: '2026-12-01',
    ...extra,
  }
}

const casos = [
  caso('PON-AC-0001', { fechaTamizaje: '2026-08-01' }),
  caso('PON-AC-0131', { fechaTamizaje: '2026-09-15', etapaActual: 2, fechaProximaCita: '2026-11-20', cct: 'E2' }),
  caso('PON-AC-0002', { etapaActual: 3, fechaProximaCita: '2026-11-18' }),
  caso('PON-AC-0003', { estado: 'alta', etapaActual: 2 }),
  caso('PON-AC-0004', { estado: 'vigilancia', etapaActual: 4 }),
  caso('PON-SPI-0001', { clues: 'OTRO' }),
]
// El evento manda: el alta solo cuenta como cerrado si tiene su evento.
const eventos = [{ codigoCaso: 'PON-AC-0003', tipo: 'alta', fecha: '2026-11-01' }]
const filas = filasTamizados({ casos, eventos, clues: 'C1', hoyISO: HOY })

describe('filasTamizados', () => {
  it('todos los casos del centro, incluidos los cerrados, y ninguno de otro centro', () => {
    expect(filas.map((f) => f.codigo).sort()).toEqual([
      'PON-AC-0001',
      'PON-AC-0002',
      'PON-AC-0003',
      'PON-AC-0004',
      'PON-AC-0131',
    ])
  })

  it('etapa y estado en texto; el cerrado usa el estado del dominio', () => {
    const cerrado = filas.find((f) => f.codigo === 'PON-AC-0003')
    expect(cerrado.estadoTexto).toBe('Cerrado: alta')
    expect(cerrado.semaforo.etiqueta).toBe('Cerrado')
    expect(filas.find((f) => f.codigo === 'PON-AC-0131').etapaTexto).toBe('Confirmación')
  })
})

describe('buscar y filtrar', () => {
  it('busca por código sin importar mayúsculas ni el prefijo', () => {
    for (const t of ['0131', 'ac-0131', 'PON-AC-0131', ' 0131 ']) expect(coincideCodigo('PON-AC-0131', t)).toBe(true)
    expect(coincideCodigo('PON-AC-0131', '0999')).toBe(false)
  })

  it('filtra por escuela y ordena del tamizaje más reciente al más antiguo', () => {
    expect(filtrarTamizados(filas, { cct: 'E2' }).map((f) => f.codigo)).toEqual(['PON-AC-0131'])
    expect(filtrarTamizados(filas)[0].codigo).toBe('PON-AC-0131')
  })
})

describe('gruposMuestras', () => {
  const grupos = gruposMuestras(filas)

  it('agrupa por la etapa que sigue (2, 3 y 4), solo casos activos', () => {
    expect(grupos.map((g) => g.etapa)).toEqual([2, 3, 4])
    expect(grupos[0].casos.map((c) => c.codigo)).toEqual(['PON-AC-0001'])
    expect(grupos[1].casos.map((c) => c.codigo)).toEqual(['PON-AC-0131'])
    expect(grupos[2].casos.map((c) => c.codigo)).toEqual(['PON-AC-0002'])
  })

  it('no incluye cerrados ni casos en vigilancia', () => {
    const todos = grupos.flatMap((g) => g.casos.map((c) => c.codigo))
    expect(todos).not.toContain('PON-AC-0003')
    expect(todos).not.toContain('PON-AC-0004')
  })

  it('la clasificación aclara que la confirma el personal de salud', () => {
    expect(grupos[2].detalle).toMatch(/personal de salud/)
  })
})

describe('movimientosGuardados', () => {
  const bitacora = [
    { id: 1, accion: 'consultar', entidad: 'caso', entidadId: 'PON-AC-0001', fechaHora: '2026-11-14T10:00:00Z' },
    { id: 2, accion: 'crear', entidad: 'caso', entidadId: 'PON-AC-0001', fechaHora: '2026-11-14T10:01:00Z' },
    { id: 3, accion: 'modificar', entidad: 'caso', entidadId: 'PON-AC-0001', fechaHora: '2026-11-14T10:05:00Z' },
    { id: 4, accion: 'crear', entidad: 'visita', entidadId: 'PON-AC-0002', fechaHora: '2026-11-14T10:03:00Z' },
  ]

  it('omite las consultas, pone texto y ordena del más reciente al más antiguo', () => {
    expect(movimientosGuardados(bitacora).map((m) => [m.id, m.texto])).toEqual([
      [3, 'Resultado o cambio del caso'],
      [4, 'Visita registrada'],
      [2, 'Caso registrado'],
    ])
  })

  it('marca como enviado (simulado) hasta el id indicado', () => {
    const m = movimientosGuardados(bitacora, 3)
    expect(m.find((x) => x.id === 2).enviado).toBe(true)
    expect(m.find((x) => x.id === 4).enviado).toBe(false)
  })
})
