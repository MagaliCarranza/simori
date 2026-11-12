import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { PendientesPage } from '../pendientes/PendientesPage.jsx'
import { MisVisitasPage } from './MisVisitasPage.jsx'

const HOY = '2026-11-14'
const campo = { id: 'USR-CAM-AC', rol: 'campo', clues: 'PROV-AC-01' }
const captura = { id: 'USR-CAP-AC', rol: 'captura', clues: 'PROV-AC-01' }

let db
let n = 0

beforeEach(async () => {
  db = crearDb(`test-registrar-visita-${n++}`)
  await db.escuelas.add({ cct: '14DPR1710G', nombre: 'Emiliano Zapata', claveInegi: '140660002' })
  await db.centrosSalud.add({ clues: 'PROV-AC-01', nombre: 'Centro de Salud Agua Caliente', claveInegi: '140660002' })
  await db.casos.add({
    codigo: 'PON-AC-0001',
    codigoNino: 'NIN-AC-0001',
    cct: '14DPR1710G',
    clues: 'PROV-AC-01',
    fechaTamizaje: '2026-01-10',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: '2026-10-01', // rojo, 44 días
    simulado: true,
  })
})

afterEach(async () => {
  await db.delete()
})

async function tarjeta() {
  const codigo = await screen.findByText('PON-AC-0001')
  return within(codigo.closest('li'))
}

async function registrar(t, { boton, nota }) {
  fireEvent.click(t.getByRole('button', { name: 'Registrar visita' }))
  fireEvent.click(t.getByRole('button', { name: boton }))
  if (nota) fireEvent.change(t.getByLabelText(/Nota/), { target: { value: nota } })
  fireEvent.click(t.getByRole('button', { name: 'Guardar visita' }))
  await t.findByRole('status')
}

describe('Registrar visita (HU05)', () => {
  it('pide elegir si se localizó a la familia', async () => {
    render(<MisVisitasPage usuario={campo} hoyISO={HOY} db={db} />)
    const t = await tarjeta()
    fireEvent.click(t.getByRole('button', { name: 'Registrar visita' }))
    fireEvent.click(t.getByRole('button', { name: 'Guardar visita' }))
    expect(await t.findByRole('alert')).toHaveTextContent('Elige si la familia fue localizada o no.')
    expect(await db.eventos.count()).toBe(0)
  })

  it('solo ofrece "Localizada" y "No localizada"', async () => {
    render(<MisVisitasPage usuario={campo} hoyISO={HOY} db={db} />)
    const t = await tarjeta()
    fireEvent.click(t.getByRole('button', { name: 'Registrar visita' }))
    expect(t.getByRole('button', { name: 'Localizada' })).toBeInTheDocument()
    expect(t.getByRole('button', { name: 'No localizada' })).toBeInTheDocument()
    expect(t.queryByRole('button', { name: 'Visitada' })).not.toBeInTheDocument()
    expect(t.getByLabelText('Fecha de la visita')).toHaveValue(HOY)
  })

  it('guarda la visita con nota y actualiza la tarjeta', async () => {
    render(<MisVisitasPage usuario={campo} hoyISO={HOY} db={db} />)
    const t = await tarjeta()
    await registrar(t, { boton: 'No localizada', nota: 'No había nadie en casa' })

    expect(t.getByRole('status')).toHaveTextContent('Visita guardada.')
    await waitFor(() => expect(t.getByText('1 de 2')).toBeInTheDocument())
    const [ev] = await db.eventos.toArray()
    expect(ev).toMatchObject({ tipo: 'visita', visitaResultado: 'no_localizada', nota: 'No había nadie en casa', fecha: HOY })
  })

  it('con la segunda visita sin localizar en rojo, avisa y marca sin seguimiento', async () => {
    render(<MisVisitasPage usuario={campo} hoyISO={HOY} db={db} />)
    let t = await tarjeta()
    await registrar(t, { boton: 'No localizada' })
    t = await tarjeta()
    await registrar(t, { boton: 'No localizada' })

    expect(t.getByRole('status')).toHaveTextContent('sin seguimiento')
    await waitFor(() => expect(t.getByText('Sin seguimiento')).toBeInTheDocument())
    expect((await db.casos.get('PON-AC-0001')).estado).toBe('sin_seguimiento')
  })

  it('el semáforo no cambia al registrar una visita localizada', async () => {
    render(<MisVisitasPage usuario={campo} hoyISO={HOY} db={db} />)
    const t = await tarjeta()
    await registrar(t, { boton: 'Localizada' })
    expect(t.getByText('Retraso alto (44 días)')).toBeInTheDocument()
  })

  it('el rol captura no registra visitas desde su lista', async () => {
    render(<PendientesPage usuario={captura} hoyISO={HOY} db={db} />)
    await screen.findByText('PON-AC-0001')
    expect(screen.queryByRole('button', { name: 'Registrar visita' })).not.toBeInTheDocument()
  })
})
