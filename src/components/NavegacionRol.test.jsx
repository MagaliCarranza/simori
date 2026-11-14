import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { HOME_POR_ROL, NavegacionRol, RUTAS_POR_ROL } from './NavegacionRol.jsx'

const usuarios = [
  { id: 'USR-CAP-AC', rol: 'captura', clues: 'PROV-AC-01' },
  { id: 'USR-CAM-AC', rol: 'campo', clues: 'PROV-AC-01' },
  { id: 'USR-SUP-JAL', rol: 'supervision', clues: null },
]

function montar(usuario, ruta = '/pendientes') {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <NavegacionRol usuario={usuario} />
    </MemoryRouter>,
  )
}

describe('NavegacionRol', () => {
  it('muestra el título SIMORI y la etiqueta Datos simulados', () => {
    montar(usuarios[0])
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SIMORI')
    expect(screen.getByText('Datos simulados')).toBeInTheDocument()
  })

  it('captura ve 4 secciones: Nuevo tamizaje, Pacientes tamizados, Muestras y lab, Guardados en el equipo', () => {
    montar(usuarios[0])
    const menu = screen.getByRole('navigation')
    expect([...menu.querySelectorAll('a')].map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Nuevo tamizaje', '/registrar'],
      ['Pacientes tamizados', '/tamizados'],
      ['Muestras y lab', '/muestras'],
      ['Guardados en el equipo', '/guardados'],
    ])
    expect(screen.queryByRole('link', { name: 'Pendientes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Mis visitas' })).not.toBeInTheDocument()
  })

  it('campo ve Mis visitas y Avisos', () => {
    montar(usuarios[1])
    expect(screen.getByRole('link', { name: 'Mis visitas' })).toHaveAttribute('href', '/visitas')
    expect(screen.getByRole('link', { name: 'Avisos' })).toHaveAttribute('href', '/avisos')
    expect(screen.queryByRole('link', { name: 'Pendientes' })).not.toBeInTheDocument()
  })

  it('supervisión ve Embudo, Mapa y Pronóstico (nunca Registrar caso)', () => {
    montar(usuarios[2])
    expect(screen.getByRole('link', { name: 'Embudo' })).toHaveAttribute('href', '/supervision/embudo')
    expect(screen.getByRole('link', { name: 'Mapa' })).toHaveAttribute('href', '/supervision/mapa')
    expect(screen.getByRole('link', { name: 'Pronóstico' })).toHaveAttribute('href', '/supervision/pronostico')
    expect(screen.queryByRole('link', { name: /Registrar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Ficha/ })).not.toBeInTheDocument()
  })

  it('el chip del rol lleva al inicio para cambiarlo, con texto accesible', () => {
    montar(usuarios[1])
    const chip = screen.getByRole('link', { name: 'Cambiar de rol (actual: Visitas de campo)' })
    expect(chip).toHaveAttribute('href', '/')
    expect(chip).toHaveTextContent('Visitas de campo')
    expect(screen.queryByLabelText('Usuario demo')).not.toBeInTheDocument()
  })

  it('sin rol elegido no hay chip ni menú, pero sí "Datos simulados"', () => {
    montar(undefined)
    expect(screen.queryByRole('link', { name: /Cambiar de rol/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByText('Datos simulados')).toBeInTheDocument()
  })

  it('el menú lleva el nombre del rol y cada sección ícono más texto', () => {
    montar(usuarios[2])
    const menu = screen.getByRole('navigation', { name: 'Menú de Supervisión' })
    for (const link of menu.querySelectorAll('a')) {
      expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
      expect(link.textContent.trim()).not.toBe('')
    }
  })

  it('HOME_POR_ROL es la primera ruta no pendiente de cada rol', () => {
    for (const rol of Object.keys(RUTAS_POR_ROL)) {
      expect(HOME_POR_ROL[rol]).toBe(RUTAS_POR_ROL[rol].find((r) => !r.pendiente).to)
    }
  })

  it('hoy ninguna pantalla está marcada como pendiente (M3, M4 y pronóstico ya existen)', () => {
    for (const rutas of Object.values(RUTAS_POR_ROL)) {
      expect(rutas.filter((r) => r.pendiente)).toEqual([])
    }
    expect(HOME_POR_ROL.captura).toBe('/registrar')
  })

  it('en una pantalla de rol el encabezado es compacto, pero "SIMORI" sigue para el lector de pantalla', () => {
    montar(usuarios[0], '/pendientes')
    expect(document.querySelector('header.nav-rol')).toHaveClass('nav-rol--en-rol')
    expect(screen.getByRole('heading', { level: 1, name: 'SIMORI' })).toBeInTheDocument()
  })

  it('en el inicio el encabezado no se compacta', () => {
    montar(usuarios[0], '/')
    expect(document.querySelector('header.nav-rol')).not.toHaveClass('nav-rol--en-rol')
  })
})
