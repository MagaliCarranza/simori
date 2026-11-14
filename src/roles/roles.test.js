import { describe, expect, it } from 'vitest'
import { guardarRol, leerRolGuardado, NOMBRE_ROL, ROLES } from './roles.js'

function memoria() {
  const datos = new Map()
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, String(v)) }
}

describe('roles', () => {
  it('tres roles con nombre sencillo', () => {
    expect(ROLES.map((r) => r.rol)).toEqual(['captura', 'campo', 'supervision'])
    expect(NOMBRE_ROL.campo).toBe('Visitas de campo')
  })

  it('guarda y lee el rol elegido', () => {
    const s = memoria()
    expect(leerRolGuardado(s)).toBeNull()
    guardarRol('supervision', s)
    expect(leerRolGuardado(s)).toBe('supervision')
  })

  it('ignora un valor guardado que no es un rol', () => {
    const s = memoria()
    s.setItem('simori.rol', 'admin')
    expect(leerRolGuardado(s)).toBeNull()
  })

  it('si el almacenamiento falla, no rompe', () => {
    const roto = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    }
    expect(leerRolGuardado(roto)).toBeNull()
    expect(() => guardarRol('campo', roto)).not.toThrow()
  })
})
