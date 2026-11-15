import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { MisVisitasPage } from './MisVisitasPage.jsx'

const HOY = '2026-11-14'
const campo = { id: 'USR-CAM-AC', rol: 'campo', clues: 'PROV-AC-01' }

let db
let n = 0

const caso = (codigo, extra = {}) => ({
  codigo,
  codigoNino: codigo.replace('PON', 'NIN'),
  cct: '14DPR1710G',
  clues: 'PROV-AC-01',
  fechaTamizaje: '2026-01-10',
  etapaActual: 1,
  estado: 'en_seguimiento',
  simulado: true,
  ...extra,
})

beforeEach(async () => {
  db = crearDb(`test-mis-visitas-pestanas-${n++}`)
  await db.localidades.bulkAdd([
    { claveInegi: '140660002', nombre: 'Agua Caliente' },
    { claveInegi: '140660014', nombre: 'Chalpicote' },
  ])
  await db.escuelas.bulkAdd([
    { cct: '14DPR1710G', nombre: 'Emiliano Zapata', claveInegi: '140660002' },
    { cct: '14DPR0001C', nombre: 'Escuela de Chalpicote', claveInegi: '140660014' },
  ])
  await db.centrosSalud.add({ clues: 'PROV-AC-01', nombre: 'Centro de Salud Agua Caliente', claveInegi: '140660002' })
  await db.casos.bulkAdd([
    caso('PON-AC-0001', { fechaProximaCita: '2026-10-01' }), // rojo
    caso('PON-AC-0002', { fechaProximaCita: '2026-11-04', cct: '14DPR0001C' }), // amarillo
    caso('PON-AC-0003', { fechaProximaCita: '2026-12-01' }), // a tiempo: no es pendiente
  ])
  await db.eventos.bulkAdd([
    { codigoCaso: 'PON-AC-0002', tipo: 'visita', visitaResultado: 'no_localizada', fecha: '2026-11-10', usuarioId: 'USR-CAM-AC' },
    { codigoCaso: 'PON-AC-0003', tipo: 'visita', visitaResultado: 'localizada', fecha: '2026-11-12', usuarioId: 'USR-CAM-AC' },
  ])
})

afterEach(async () => {
  await db.delete()
})

const codigos = (raiz) =>
  [...raiz.querySelectorAll('.caso-pendiente__codigo')].map((e) => e.textContent)

describe('Mis visitas: semana, pestañas y tarjeta (HU04)', () => {
  it('muestra el avance de la semana', async () => {
    render(<MisVisitasPage usuario={campo} hoyISO={HOY} db={db} />)
    expect(await screen.findByText('Semana del 9 al 15 de noviembre')).toBeInTheDocument()
    const cifras = await screen.findByText(/visitas registradas/)
    expect(cifras).toHaveTextContent('2 visitas registradas · 2 familias visitadas · faltan 1 por visitar')
  })

  it('abre en "Todas" y las pestañas filtran', async () => {
    const { container } = render(<MisVisitasPage usuario={campo} hoyISO={HOY} db={db} />)
    await screen.findByText('PON-AC-0001')
    const pestanas = within(screen.getByRole('group', { name: 'Qué visitas ver' }))
    expect(pestanas.getByRole('button', { name: /^Todas/ })).toHaveAttribute('aria-pressed', 'true')
    expect(codigos(container)).toEqual(['PON-AC-0001', 'PON-AC-0002'])

    fireEvent.click(pestanas.getByRole('button', { name: 'Urgentes (1)' }))
    expect(codigos(container)).toEqual(['PON-AC-0001'])

    fireEvent.click(pestanas.getByRole('button', { name: 'Localizadas (1)' }))
    expect(codigos(container)).toEqual(['PON-AC-0003'])

    fireEvent.click(pestanas.getByRole('button', { name: 'Por localidad' }))
    expect(screen.getByRole('heading', { name: 'Agua Caliente (1)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Chalpicote (1)' })).toBeInTheDocument()
    expect(codigos(screen.getByRole('region', { name: 'Chalpicote' }))).toEqual(['PON-AC-0002'])
  })

  it('la tarjeta dice qué le toca y la localidad, sin domicilios', async () => {
    render(<MisVisitasPage usuario={campo} hoyISO={HOY} db={db} />)
    const t = within((await screen.findByText('PON-AC-0001')).closest('li'))
    expect(t.getByText(/Le toca: repetir la prueba de orina\./)).toHaveTextContent('Localidad: Agua Caliente.')
    expect(t.getByRole('button', { name: 'Registrar visita' })).toBeInTheDocument()
    expect(t.getByRole('button', { name: 'Aviso a la familia' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/domicilio:|barrio|calle/i)
  })
})
