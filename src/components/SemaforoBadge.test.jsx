import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { calcularSemaforo } from '../domain/index.js'
import { SemaforoBadge } from './SemaforoBadge.jsx'

describe('SemaforoBadge', () => {
  it('siempre muestra el texto del semáforo, no solo el color', () => {
    const sem = calcularSemaforo({ estado: 'en_seguimiento', fechaProximaCita: '2026-05-17' }, [], '2026-06-15')
    render(<SemaforoBadge semaforo={sem} />)
    const badge = screen.getByText('Retraso alto (29 días)')
    expect(badge).toHaveClass('semaforo--rojo')
  })

  it('un caso cerrado se muestra como "Cerrado"', () => {
    const sem = calcularSemaforo({ estado: 'alta' }, [{ tipo: 'alta', fecha: '2026-06-01' }], '2026-06-15')
    render(<SemaforoBadge semaforo={sem} />)
    expect(screen.getByText('Cerrado')).toHaveClass('semaforo--cerrado')
  })
})
