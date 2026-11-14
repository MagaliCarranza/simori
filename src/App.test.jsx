import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
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
    fireEvent.click(await screen.findByRole('button', { name: /Visitas de campo/ }))
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
    expect(await screen.findByRole('heading', { name: 'Te damos la bienvenida a SIMORI' })).toBeInTheDocument()
  })
})
