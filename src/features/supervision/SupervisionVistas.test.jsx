import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { SupervisionVistas } from './SupervisionVistas.jsx'

vi.mock('react-chartjs-2', () => ({ Bar: () => null }))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  CircleMarker: ({ children }) => <div>{children}</div>,
  Tooltip: ({ children }) => <span>{children}</span>,
}))

const HOY = '2026-11-14'
const supervisor = { id: 'USR-SUP-JAL', rol: 'supervision', clues: null }

let db
let n = 0

beforeEach(async () => {
  db = crearDb(`test-vistas-${n++}`)
  await db.localidades.bulkAdd([{ claveInegi: '140660002', nombre: 'Agua Caliente', lat: 20.31, lng: -102.92 }])
})

afterEach(async () => {
  await db.delete()
})

describe('SupervisionVistas', () => {
  it('abre en Embudo y cambia a Mapa y de regreso', async () => {
    render(<SupervisionVistas hoyISO={HOY} usuario={supervisor} db={db} />)
    expect(await screen.findByRole('heading', { name: 'Embudo de seguimiento' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Embudo' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }))
    expect(await screen.findByRole('heading', { name: 'Mapa de la zona' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Embudo de seguimiento' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Embudo' }))
    expect(await screen.findByRole('heading', { name: 'Embudo de seguimiento' })).toBeInTheDocument()
  })

  it('una entrada de bitácora por vista abierta', async () => {
    render(<SupervisionVistas hoyISO={HOY} usuario={supervisor} db={db} />)
    await screen.findByRole('heading', { name: 'Embudo de seguimiento' })
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }))
    await screen.findByRole('heading', { name: 'Mapa de la zona' })
    await waitFor(async () => expect(await db.bitacora.count()).toBe(2))
    const entradas = await db.bitacora.toArray()
    expect(entradas.map((e) => e.entidadId).sort()).toEqual(['embudo', 'mapa'])
  })
})
