import { describe, expect, it } from 'vitest'
import { validarRegistro } from './validacion.js'

const HOY = '2026-11-11'

const registroValido = {
  codigo: 'PON-SPI-0231',
  cct: '14DPR0123X',
  clues: 'JCSSA001234',
  fechaTamizaje: '2026-11-01',
  tiraMgL: 20,
  consentimientoTutor: true,
  asentimientoNino: true,
}

describe('validarRegistro — camino feliz', () => {
  it('registro completo y válido pasa sin errores', () => {
    expect(validarRegistro(registroValido, HOY)).toEqual({ valido: true, errores: [] })
  })

  it('acepta las tres localidades del estudio', () => {
    for (const codigo of ['PON-SPI-0001', 'PON-AC-0012', 'PON-CHA-0045']) {
      expect(validarRegistro({ ...registroValido, codigo }, HOY).valido).toBe(true)
    }
  })

  it('acepta todas las tiras del fabricante (0, 20, 50, 100)', () => {
    for (const tiraMgL of [0, 20, 50, 100]) {
      expect(validarRegistro({ ...registroValido, tiraMgL }, HOY).valido).toBe(true)
    }
  })
})

describe('validarRegistro — campos sensibles', () => {
  it('rechaza nombre, curp, domicilio y fechaNacimiento completa', () => {
    const r = validarRegistro(
      { ...registroValido, nombre: 'Juan', curp: 'ABCD', domicilio: 'Calle 1', fechaNacimiento: '2015-05-05' },
      HOY,
    )
    expect(r.valido).toBe(false)
    expect(r.errores).toEqual(
      expect.arrayContaining([
        expect.stringContaining('nombre'),
        expect.stringContaining('curp'),
        expect.stringContaining('domicilio'),
        expect.stringContaining('fechaNacimiento'),
      ]),
    )
  })

  it('un string vacío no cuenta como campo sensible presente', () => {
    expect(validarRegistro({ ...registroValido, nombre: '' }, HOY).valido).toBe(true)
  })
})

describe('validarRegistro — código', () => {
  it('rechaza código mal formado', () => {
    expect(validarRegistro({ ...registroValido, codigo: 'PON-123' }, HOY).valido).toBe(false)
    expect(validarRegistro({ ...registroValido, codigo: 'SPI-0231' }, HOY).valido).toBe(false)
    expect(validarRegistro({ ...registroValido, codigo: 'PON-spi-0231' }, HOY).valido).toBe(false)
  })

  it('rechaza código vacío', () => {
    expect(validarRegistro({ ...registroValido, codigo: '' }, HOY).valido).toBe(false)
  })
})

describe('validarRegistro — CCT', () => {
  it('acepta CCT con formato oficial (14DPR0123X)', () => {
    expect(validarRegistro({ ...registroValido, cct: '14DPR0123X' }, HOY).valido).toBe(true)
  })

  it('normaliza a mayúsculas antes de validar', () => {
    expect(validarRegistro({ ...registroValido, cct: '14dpr0123x' }, HOY).valido).toBe(true)
  })

  it('rechaza formatos que no cumplen el patrón', () => {
    for (const cct of ['14DPR123X', 'ABCDE12345F', '14DP0123X', '14DPR01234X']) {
      const r = validarRegistro({ ...registroValido, cct }, HOY)
      expect(r.valido).toBe(false)
      expect(r.errores.some((e) => e.includes('CCT'))).toBe(true)
    }
  })

  it('marca CCT faltante', () => {
    const r = validarRegistro({ ...registroValido, cct: '' }, HOY)
    expect(r.errores).toEqual(expect.arrayContaining([expect.stringContaining('Falta la CCT')]))
  })
})

describe('validarRegistro — CLUES', () => {
  it('acepta CLUES con formato oficial (JCSSA001234)', () => {
    expect(validarRegistro({ ...registroValido, clues: 'JCSSA001234' }, HOY).valido).toBe(true)
  })

  it('normaliza a mayúsculas antes de validar', () => {
    expect(validarRegistro({ ...registroValido, clues: 'jcssa001234' }, HOY).valido).toBe(true)
  })

  it('rechaza formatos que no cumplen el patrón', () => {
    for (const clues of ['JCSS001234', 'JCSSA12345', 'JCSSA0012345', '12345ABCDEF']) {
      const r = validarRegistro({ ...registroValido, clues }, HOY)
      expect(r.valido).toBe(false)
      expect(r.errores.some((e) => e.includes('CLUES'))).toBe(true)
    }
  })
})

describe('validarRegistro — catálogo opcional', () => {
  const catalogo = { ccts: ['14DPR0123X', '14DPR0456Y'], clues: ['JCSSA001234', 'JCSSA005678'] }

  it('con catálogo: CCT que no existe en el dataset 28 → error', () => {
    const r = validarRegistro({ ...registroValido, cct: '14DPR9999Z' }, HOY, catalogo)
    expect(r.valido).toBe(false)
    expect(r.errores).toEqual(expect.arrayContaining([expect.stringContaining('catálogo de escuelas')]))
  })

  it('con catálogo: CCT que sí existe → pasa', () => {
    expect(validarRegistro({ ...registroValido, cct: '14DPR0456Y' }, HOY, catalogo).valido).toBe(true)
  })

  it('con catálogo: CLUES que no existe en el dataset 13 → error', () => {
    const r = validarRegistro({ ...registroValido, clues: 'JCSSA999999' }, HOY, catalogo)
    expect(r.valido).toBe(false)
    expect(r.errores).toEqual(expect.arrayContaining([expect.stringContaining('catálogo de centros de salud')]))
  })

  it('sin catálogo: solo valida formato, no existencia', () => {
    expect(validarRegistro({ ...registroValido, cct: '14DPR9999Z' }, HOY).valido).toBe(true)
  })

  it('la normalización a mayúsculas también aplica contra el catálogo', () => {
    expect(validarRegistro({ ...registroValido, cct: '14dpr0456y' }, HOY, catalogo).valido).toBe(true)
  })
})

describe('validarRegistro — fecha', () => {
  it('rechaza fecha inválida', () => {
    expect(validarRegistro({ ...registroValido, fechaTamizaje: '2026-13-01' }, HOY).valido).toBe(false)
    expect(validarRegistro({ ...registroValido, fechaTamizaje: '2026-02-30' }, HOY).valido).toBe(false)
    expect(validarRegistro({ ...registroValido, fechaTamizaje: '01/11/2026' }, HOY).valido).toBe(false)
  })

  it('rechaza fecha futura', () => {
    const r = validarRegistro({ ...registroValido, fechaTamizaje: '2027-01-01' }, HOY)
    expect(r.valido).toBe(false)
    expect(r.errores).toEqual(expect.arrayContaining([expect.stringContaining('futura')]))
  })

  it('acepta fecha igual a hoy', () => {
    expect(validarRegistro({ ...registroValido, fechaTamizaje: HOY }, HOY).valido).toBe(true)
  })
})

describe('validarRegistro — tira', () => {
  it('rechaza valores fuera del set del fabricante', () => {
    for (const tiraMgL of [10, 25, 99, undefined, null, '20']) {
      expect(validarRegistro({ ...registroValido, tiraMgL }, HOY).valido).toBe(false)
    }
  })
})

describe('validarRegistro — consentimiento y asentimiento', () => {
  it('requiere ambos en true (no acepta "truthy")', () => {
    expect(validarRegistro({ ...registroValido, consentimientoTutor: false }, HOY).valido).toBe(false)
    expect(validarRegistro({ ...registroValido, asentimientoNino: false }, HOY).valido).toBe(false)
    expect(validarRegistro({ ...registroValido, consentimientoTutor: 1 }, HOY).valido).toBe(false)
  })
})

describe('validarRegistro — robustez', () => {
  it('con datos vacíos devuelve errores sin lanzar', () => {
    const r = validarRegistro({}, HOY)
    expect(r.valido).toBe(false)
    expect(r.errores.length).toBeGreaterThan(0)
  })

  it('tolera datos null/undefined', () => {
    expect(validarRegistro(null, HOY).valido).toBe(false)
    expect(validarRegistro(undefined, HOY).valido).toBe(false)
  })
})
