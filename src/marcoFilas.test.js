import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// jsdom no calcula el layout de CSS grid, así que no se puede medir la altura
// del encabezado. Esta prueba solo protege la regla que lo evita: el marco
// define sus filas (encabezado automático, contenido con el resto).
const css = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8')

function bloque(selector, texto) {
  const inicio = texto.indexOf(`${selector} {`)
  if (inicio === -1) return ''
  return texto.slice(inicio, texto.indexOf('}', inicio))
}

describe('marco de las pantallas', () => {
  it('el encabezado es automático y el contenido toma el resto en cualquier ancho', () => {
    const marco = bloque('.marco', css)
    expect(marco).toMatch(/grid-template-rows:\s*auto 1fr;/)
    // La regla base no está dentro de un @media: aplica también en celular.
    const antesDelBloque = css.slice(0, css.indexOf('.marco {'))
    expect(antesDelBloque).not.toMatch(/@media[^{]*\{\s*$/)
  })
})
