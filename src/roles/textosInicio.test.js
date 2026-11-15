import { describe, expect, it } from 'vitest'
import { ROLES } from './roles.js'

describe('textos de la tarjeta de Enfermería en Inicio', () => {
  const enfermeria = ROLES.find((r) => r.rol === 'captura')

  it('el pie dice Tamizaje y seguimiento', () => {
    expect(enfermeria.pie).toBe('Tamizaje y seguimiento')
  })

  it('la descripción habla de registrar casos y revisar citas, muestras y lo guardado', () => {
    expect(enfermeria.descripcion).toBe(
      'Registra casos positivos y revisa citas, muestras y lo guardado en el equipo.',
    )
  })

  it('las otras tarjetas no cambian', () => {
    expect(ROLES.find((r) => r.rol === 'campo').pie).toBe('Visitas comunitarias')
    expect(ROLES.find((r) => r.rol === 'supervision').pie).toBe('Cifras agregadas')
  })
})
