import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { HOME_POR_ROL, NavegacionRol, RUTAS_POR_ROL } from './NavegacionRol.jsx'

const usuarios = [
  { id: 'USR-CAP-AC', rol: 'captura', clues: 'PROV-AC-01' },
  { id: 'USR-CAM-AC', rol: 'campo', clues: 'PROV-AC-01' },
  { id: 'USR-SUP-JAL', rol: 'supervision', clues: null },
]

function montar(usuario) {
  render(
    <MemoryRouter>
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

  it('captura ve Registrar caso y Pendientes', () => {
    montar(usuarios[0])
    // Registrar caso (M3) está "En construcción": oculto del menú por ahora.
    expect(screen.queryByRole('link', { name: 'Registrar caso' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pendientes' })).toHaveAttribute('href', '/pendientes')
    expect(screen.queryByRole('link', { name: 'Mis visitas' })).not.toBeInTheDocument()
  })

  it('campo ve Mis visitas y Avisos', () => {
    montar(usuarios[1])
    expect(screen.getByRole('link', { name: 'Mis visitas' })).toHaveAttribute('href', '/visitas')
    expect(screen.getByRole('link', { name: 'Avisos' })).toHaveAttribute('href', '/avisos')
    expect(screen.queryByRole('link', { name: 'Pendientes' })).not.toBeInTheDocument()
  })

  it('supervisión ve Embudo y Mapa (Pronóstico oculto por pendiente; nunca Registrar caso)', () => {
    montar(usuarios[2])
    expect(screen.getByRole('link', { name: 'Embudo' })).toHaveAttribute('href', '/supervision/embudo')
    expect(screen.getByRole('link', { name: 'Mapa' })).toHaveAttribute('href', '/supervision/mapa')
    expect(screen.queryByRole('link', { name: 'Pronóstico' })).not.toBeInTheDocument()
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
    expect(HOME_POR_ROL.captura).toBe('/pendientes')
  })

  it('las pantallas pendientes siguen definidas (solo se ocultan del menú)', () => {
    expect(RUTAS_POR_ROL.captura.map((r) => r.to)).toContain('/registrar')
    expect(RUTAS_POR_ROL.supervision.map((r) => r.to)).toContain('/supervision/pronostico')
  })
})
