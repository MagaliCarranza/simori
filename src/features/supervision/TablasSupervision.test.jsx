import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { cargarEscenario } from '../../db/seed.js'
import { PronosticoPage } from '../pronostico/PronosticoPage.jsx'
import { SupervisionPage } from './SupervisionPage.jsx'

vi.mock('react-chartjs-2', () => ({ Bar: () => null }))

const HOY = '2026-11-14'
const CLUES = 'PROV-AC-01'
const supervisor = { id: 'USR-SUP-JAL', rol: 'supervision', clues: null }

let db
let n = 0

function caso(i) {
  return {
    codigo: `PON-AC-${String(i).padStart(4, '0')}`,
    codigoNino: `NIN-AC-${String(i).padStart(4, '0')}`,
    cct: '14DPR1710G',
    clues: CLUES,
    fechaTamizaje: '2026-09-01',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: '2026-11-23',
    simulado: true,
  }
}

beforeEach(async () => {
  db = crearDb(`test-tablas-supervision-${n++}`)
  await db.localidades.add({ claveInegi: '140660002', nombre: 'Agua Caliente', enAlcance: true, cluesOperativo: CLUES })
  await db.escuelas.add({ cct: '14DPR1710G', nombre: 'Emiliano Zapata', claveInegi: '140660002' })
  await db.centrosSalud.add({ clues: CLUES, nombre: 'Centro de Salud Agua Caliente', claveInegi: '140660002' })
  await cargarEscenario(30, { casos: Array.from({ length: 6 }, (_, i) => caso(i + 1)) }, db)
})

afterEach(async () => {
  await db.delete()
})

describe('tablas de Supervisión a 360 px', () => {
  it('la tabla por localidad se desliza en su propia región, enfocable, con aviso para deslizar', async () => {
    render(<SupervisionPage hoyISO={HOY} usuario={supervisor} db={db} />)
    const region = await screen.findByRole('region', { name: 'Tabla por localidad' })
    expect(region).toHaveClass('supervision__tabla-envoltura')
    expect(region).toHaveAttribute('tabindex', '0')
    expect(within(region).getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Desliza la tabla a los lados para ver todas las columnas.')).toBeInTheDocument()
  })

  it('la nota de cifras protegidas queda fuera de la región que se desliza', async () => {
    render(<SupervisionPage hoyISO={HOY} usuario={supervisor} db={db} />)
    const region = await screen.findByRole('region', { name: 'Tabla por localidad' })
    const nota = screen.getByText('Se protegen las cifras menores de 5 y las que permitirían calcularlas.')
    expect(region.contains(nota)).toBe(false)
  })

  it('en Pronóstico cada tabla tiene su región enfocable y la regla va después de las tablas', async () => {
    render(<PronosticoPage hoyISO={HOY} usuario={supervisor} db={db} />)
    const region = await screen.findByRole('region', { name: `Tabla del centro de salud ${CLUES}` })
    expect(region).toHaveAttribute('tabindex', '0')
    const regla = screen.getByText(/Cómo se calcula:/).closest('p')
    expect(region.compareDocumentPosition(regla) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('en Pronóstico las columnas tienen ayuda al pasar el mouse y en celular se avisa que la tabla se desliza', async () => {
    render(<PronosticoPage hoyISO={HOY} usuario={supervisor} db={db} />)
    await screen.findByRole('region', { name: `Tabla del centro de salud ${CLUES}` })
    const encabezado = (nombre) => screen.getByRole('columnheader', { name: nombre })
    expect(encabezado('Semana')).toHaveAttribute('title')
    expect(encabezado('Citas programadas')).toHaveAttribute('title', expect.stringMatching(/seguimiento o en vigilancia/))
    expect(encabezado('Llegadas esperadas')).toHaveAttribute('title', expect.stringMatching(/× \(1 − 30 %\)/))
    const aviso = screen.getByText('Desliza la tabla a los lados para ver todas las columnas.')
    expect(aviso).toHaveClass('supervision__deslizar')
  })
})
