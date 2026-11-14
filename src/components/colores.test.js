// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { COLORES } from './colores.js'

// colores.js es una copia en JS de variables de ui.css (Chart.js y Leaflet no
// leen variables CSS). Esta prueba falla si alguien cambia una sin la otra.
const VARIABLE_DE = {
  principal: '--color-primary',
  principalHover: '--color-primary-hover',
}

const css = readFileSync(fileURLToPath(new URL('./ui.css', import.meta.url)), 'utf8')

function valorEnCss(variable) {
  const m = css.match(new RegExp(String.raw`${variable}\s*:\s*(#[0-9a-fA-F]{3,8})\s*;`))
  return m ? m[1].toLowerCase() : null
}

describe('colores.js coincide con ui.css', () => {
  it('cada color de colores.js tiene su variable asignada', () => {
    expect(Object.keys(COLORES).sort()).toEqual(Object.keys(VARIABLE_DE).sort())
  })

  for (const [clave, variable] of Object.entries(VARIABLE_DE)) {
    it(`${clave} = ${variable}`, () => {
      const enCss = valorEnCss(variable)
      expect(enCss, `${variable} no está definida con un hex en ui.css`).not.toBeNull()
      expect(COLORES[clave].toLowerCase()).toBe(enCss)
    })
  }
})
