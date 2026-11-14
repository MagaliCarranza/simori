import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { RUTAS_POR_ROL } from './components/NavegacionRol.jsx'
import { db } from './db/index.js'

// Sin red en pruebas: los catálogos no se descargan; solo los usuarios demo.
vi.mock('./db/seed.js', () => ({ inicializar: async () => ({ yaInicializada: true }) }))

const USUARIOS = [
  { id: 'USR-CAP-01', rol: 'captura', clues: 'JCSSA004213' },
  { id: 'USR-CAM-01', rol: 'campo', clues: 'JCSSA004213' },
  { id: 'USR-SUP-01', rol: 'supervision', clues: null },
]

function abrirEn(ruta) {
  window.history.pushState({}, '', ruta)
  render(<App />)
}

beforeEach(async () => {
  window.localStorage.clear()
  await db.usuarios.bulkPut(USUARIOS)
})

afterEach(async () => {
  await db.usuarios.clear()
})

describe('App', () => {
  it('muestra el título SIMORI', () => {
    abrirEn('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SIMORI')
  })

  it('"/" muestra el inicio y al elegir un rol abre su primera pantalla y lo recuerda', async () => {
    abrirEn('/')
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar como Visitas de campo' }))
    await waitFor(() => expect(window.location.pathname).toBe('/visitas'))
    expect(await screen.findByRole('link', { name: 'Mis visitas' })).toBeInTheDocument()
    expect(window.localStorage.getItem('simori.rol')).toBe('campo')
  })

  it('al recargar conserva el rol guardado', async () => {
    window.localStorage.setItem('simori.rol', 'supervision')
    abrirEn('/supervision/embudo')
    expect(await screen.findByRole('link', { name: 'Embudo' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/supervision/embudo')
  })

  it('sin rol elegido, otra ruta vuelve al inicio', async () => {
    abrirEn('/avisos')
    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(await screen.findByRole('heading', { name: 'Que ninguna niña ni niño se quede a medio camino' })).toBeInTheDocument()
  })

  // Las copias en el encabezado de cada pantalla se ocultan con este selector
  // (App.css); la del marco nunca debe coincidir con él.
  const OCULTAS = '.marco__contenido > section > header .etiqueta-simulado'

  it('la etiqueta "Datos simulados" del marco está en todas las rutas y nunca se oculta', async () => {
    const casos = [[null, '/']]
    for (const [rol, rutas] of Object.entries(RUTAS_POR_ROL)) {
      casos.push([rol, '/'])
      for (const r of rutas) casos.push([rol, r.to])
    }
    for (const [rol, ruta] of casos) {
      window.localStorage.clear()
      if (rol) window.localStorage.setItem('simori.rol', rol)
      abrirEn(ruta)
      // El encabezado del marco (las pantallas tienen su propio <header>).
      const etiqueta = await waitFor(() => {
        const e = document.querySelector('header.nav-rol .etiqueta-simulado')
        if (!e) throw new Error('sin etiqueta del marco')
        return e
      })
      expect(etiqueta, `${rol} ${ruta}`).toHaveTextContent('Datos simulados')
      expect(etiqueta.matches(OCULTAS), `${rol} ${ruta}`).toBe(false)
      cleanup()
    }
  })

  it('/pendientes lleva a "Pacientes tamizados"', async () => {
    window.localStorage.setItem('simori.rol', 'captura')
    abrirEn('/pendientes')
    await waitFor(() => expect(window.location.pathname).toBe('/tamizados'))
    expect(await screen.findByRole('button', { name: 'Con retraso' })).toHaveAttribute('aria-pressed', 'true')
  })
})
