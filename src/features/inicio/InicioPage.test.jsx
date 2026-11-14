import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InicioPage } from './InicioPage.jsx'

describe('InicioPage', () => {
  it('explica qué es SIMORI sin sonar a diagnóstico y ofrece tres roles', () => {
    render(<InicioPage rolActual={null} onElegir={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Te damos la bienvenida a SIMORI' })).toBeInTheDocument()
    expect(screen.getByText(/no\s+diagnostica/)).toBeInTheDocument()
    const botones = screen.getAllByRole('button')
    expect(botones.map((b) => b.querySelector('.inicio__rol-nombre').textContent)).toEqual([
      'Enfermería del centro de salud',
      'Visitas de campo',
      'Supervisión',
    ])
  })

  it('al elegir una tarjeta avisa el rol', () => {
    const onElegir = vi.fn()
    render(<InicioPage rolActual={null} onElegir={onElegir} />)
    fireEvent.click(screen.getByRole('button', { name: /Visitas de campo/ }))
    expect(onElegir).toHaveBeenCalledWith('campo')
  })

  it('marca el rol actual', () => {
    render(<InicioPage rolActual="supervision" onElegir={() => {}} />)
    expect(screen.getByRole('button', { name: /Supervisión/ })).toHaveTextContent('Rol actual')
    expect(screen.getAllByText('Rol actual')).toHaveLength(1)
  })
})
