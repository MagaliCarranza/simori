import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InicioPage } from './InicioPage.jsx'

const nombres = () => [...document.querySelectorAll('.inicio__rol-nombre')].map((n) => n.textContent)

describe('InicioPage', () => {
  it('explica qué es SIMORI sin sonar a diagnóstico y con lenguaje incluyente', () => {
    render(<InicioPage rolActual={null} onElegir={() => {}} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Que ninguna niña ni niño se quede a medio camino',
    )
    expect(screen.getByText(/no\s+diagnostica/)).toBeInTheDocument()
    expect(screen.getByText('Funciona sin conexión')).toBeInTheDocument()
    expect(screen.getByText('SIMORI')).toBeInTheDocument()
  })

  it('no menciona instituciones ni sincronización', () => {
    render(<InicioPage rolActual={null} onElegir={() => {}} />)
    expect(document.body.textContent).not.toMatch(/SSA|Secretaría de Salud|Región Sanitaria|Sincronizado|Ruta Riñón/)
  })

  it('tres tarjetas: título en lenguaje sencillo y etiqueta pequeña aparte', () => {
    render(<InicioPage rolActual={null} onElegir={() => {}} />)
    expect(nombres()).toEqual(['Enfermería del centro de salud', 'Visitas de campo', 'Supervisión'])
    const etiquetas = [...document.querySelectorAll('.inicio__rol-etiqueta')].map((n) => n.textContent)
    expect(etiquetas).toEqual(['Clínica', 'Brigada', 'Gestión'])
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(3)
  })

  it('cada botón "Entrar" dice a qué rol entra y avisa el rol elegido', () => {
    const onElegir = vi.fn()
    render(<InicioPage rolActual={null} onElegir={onElegir} />)
    const boton = screen.getByRole('button', { name: 'Entrar como Visitas de campo' })
    expect(boton).toHaveTextContent('Entrar')
    fireEvent.click(boton)
    expect(onElegir).toHaveBeenCalledWith('campo')
  })

  it('marca el rol actual', () => {
    render(<InicioPage rolActual="supervision" onElegir={() => {}} />)
    const tarjeta = screen.getByRole('button', { name: 'Entrar como Supervisión' }).closest('article')
    expect(tarjeta).toHaveTextContent('Rol actual')
    expect(screen.getAllByText('Rol actual')).toHaveLength(1)
  })

  it('el logo y la portada son decorativos (alt vacío) y locales', () => {
    render(<InicioPage rolActual={null} onElegir={() => {}} />)
    const imagenes = [...document.querySelectorAll('img')]
    expect(imagenes).toHaveLength(2)
    for (const img of imagenes) {
      expect(img).toHaveAttribute('alt', '')
      expect(img.getAttribute('src')).not.toMatch(/^https?:/)
    }
  })
})
