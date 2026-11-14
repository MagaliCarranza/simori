import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { RegistrarCasoPage } from './RegistrarCasoPage.jsx'

const HOY = '2026-11-14'
const captura = { id: 'USR-CAP-01', rol: 'captura', clues: 'JCSSA004213' }

let db
let n = 0

beforeEach(async () => {
  db = crearDb(`test-registrar-caso-${n++}`)
  await db.localidades.add({ claveInegi: '140660002', nombre: 'Agua Caliente' })
  await db.escuelas.add({
    cct: '14DPR1710G',
    nombre: 'Emiliano Zapata',
    nivel: 'Primaria',
    turno: 'matutino',
    claveInegi: '140660002',
  })
  await db.centrosSalud.add({ clues: 'JCSSA004213', nombre: 'CS San Pedro Itzicán', claveInegi: '140660031' })
})

afterEach(async () => {
  await db.delete()
})

function pintar() {
  render(
    <MemoryRouter>
      <RegistrarCasoPage usuario={captura} hoyISO={HOY} db={db} />
    </MemoryRouter>,
  )
}

async function llenar() {
  const escuela = await screen.findByRole('option', { name: /Emiliano Zapata/ })
  fireEvent.change(screen.getByLabelText('Escuela'), { target: { value: escuela.value } })
  fireEvent.change(screen.getByLabelText('Fecha del tamizaje'), { target: { value: '2026-11-10' } })
  fireEvent.click(screen.getByRole('button', { name: '50' }))
  fireEvent.click(screen.getByRole('button', { name: 'Niña' }))
  fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '4' } })
  fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2016' } })
  fireEvent.click(screen.getByLabelText(/tutor dio su consentimiento/))
  fireEvent.click(screen.getByLabelText(/dio su asentimiento/))
}

describe('Registrar caso positivo (HU01)', () => {
  it('no pide nombre, CURP ni domicilio', async () => {
    pintar()
    await screen.findByRole('option', { name: /Emiliano Zapata/ })
    expect(screen.queryByLabelText(/nombre/i)).toBeNull()
    expect(screen.queryByLabelText(/curp/i)).toBeNull()
    expect(screen.queryByLabelText(/domicilio/i)).toBeNull()
  })

  it('muestra los errores y no guarda si el formulario está vacío', async () => {
    pintar()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar caso' }))
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Elige la escuela.')
    expect(alerta).toHaveTextContent('Falta el consentimiento del tutor')
    expect(await db.casos.count()).toBe(0)
  })

  it('registra el caso y muestra su código y la cita de confirmación', async () => {
    pintar()
    await llenar()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar caso' }))
    const estado = await screen.findByRole('status')
    expect(estado).toHaveTextContent('PON-AC-0001')
    expect(estado).toHaveTextContent('2 feb 2027')
    expect(screen.getByRole('link', { name: 'Ver ficha del caso' })).toHaveAttribute('href', '/caso/PON-AC-0001')
    expect(await db.casos.get('PON-AC-0001')).toMatchObject({ etapaActual: 1, estado: 'en_seguimiento' })
  })

  it('permite registrar otro caso después de guardar', async () => {
    pintar()
    await llenar()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar caso' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('button', { name: 'Registrar otro caso' }))
    expect(await screen.findByRole('button', { name: 'Guardar caso' })).toBeInTheDocument()
  })
})
