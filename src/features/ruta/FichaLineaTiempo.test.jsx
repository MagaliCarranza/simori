import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { FichaCasoPage } from './FichaCasoPage.jsx'

const HOY = '2026-11-14'
const captura = { id: 'USR-CAP-01', rol: 'captura', clues: 'JCSSA004213' }

let db
let n = 0

beforeEach(async () => {
  db = crearDb(`test-ficha-ruta-${n++}`)
  await db.localidades.add({ claveInegi: '140660002', nombre: 'Agua Caliente' })
  await db.escuelas.add({ cct: '14DPR1710G', nombre: 'Emiliano Zapata', claveInegi: '140660002' })
  await db.centrosSalud.add({ clues: 'JCSSA004213', nombre: 'CS San Pedro Itzicán', claveInegi: '140660031' })
  await db.ninos.add({ codigo: 'NIN-AC-0001', sexo: 'F', mesNacimiento: 4, anioNacimiento: 2016 })
  await db.casos.add({
    codigo: 'PON-AC-0001',
    codigoNino: 'NIN-AC-0001',
    cct: '14DPR1710G',
    clues: 'JCSSA004213',
    fechaTamizaje: '2026-08-01',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: '2026-10-24',
    simulado: true,
  })
  await db.eventos.add({ codigoCaso: 'PON-AC-0001', usuarioId: 'USR-CAP-01', etapa: 1, fecha: '2026-08-01', tipo: 'resultado', tiraMgL: 50 })
})

afterEach(async () => {
  await db.delete()
})

function pintar() {
  render(
    <MemoryRouter initialEntries={['/caso/PON-AC-0001']}>
      <Routes>
        <Route path="/caso/:codigo" element={<FichaCasoPage usuario={captura} hoyISO={HOY} db={db} />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Ficha: ruta del caso, próxima cita y recordatorio', () => {
  it('muestra la línea de tiempo de las 5 etapas con estado en texto', async () => {
    pintar()
    const ruta = within(await screen.findByRole('region', { name: 'Ruta del caso' }))
    const etapas = ruta.getAllByRole('listitem')
    expect(etapas).toHaveLength(5)
    expect(etapas[0]).toHaveTextContent('1. Tamizaje')
    expect(etapas[0]).toHaveTextContent('Registrada · 1 ago 2026')
    expect(etapas[0]).toHaveTextContent('Tira 50 mg/L')
    expect(etapas[1]).toHaveTextContent('2. Confirmación')
    expect(etapas[1]).toHaveTextContent('En curso · 24 oct 2026')
    expect(etapas[2]).toHaveTextContent('Pendiente')
    expect(etapas[4]).toHaveTextContent('5. Salida')
  })

  it('bloque "Próxima cita" con su fecha y un botón que baja al formulario', async () => {
    pintar()
    const cita = within(await screen.findByRole('region', { name: 'Próxima cita' }))
    expect(cita.getByText('24 oct 2026')).toBeInTheDocument()
    expect(cita.getByText('Le toca: confirmación.')).toBeInTheDocument()

    const titulo = await screen.findByRole('heading', { name: 'Registrar resultado: Confirmación' })
    const scroll = vi.fn()
    titulo.closest('section').scrollIntoView = scroll
    fireEvent.click(cita.getByRole('button', { name: 'Registrar resultado de confirmación' }))
    expect(scroll).toHaveBeenCalled()
    expect(titulo).toHaveFocus()
  })

  it('el formulario lleva el recordatorio de que las decisiones clínicas son del personal de salud', async () => {
    pintar()
    await screen.findByRole('heading', { name: 'Registrar resultado: Confirmación' })
    const form = screen.getByRole('form', { name: 'Registrar Confirmación' })
    expect(
      within(form).getByText('La herramienta organiza el seguimiento; las decisiones clínicas son del personal de salud.'),
    ).toBeInTheDocument()
  })

  it('la línea de tiempo se actualiza al cerrar el caso con alta', async () => {
    pintar()
    await screen.findByRole('heading', { name: 'Registrar resultado: Confirmación' })
    fireEvent.change(screen.getByLabelText('Fecha del resultado'), { target: { value: '2026-11-01' } })
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }))
    await screen.findByRole('status')
    const ruta = within(screen.getByRole('region', { name: 'Ruta del caso' }))
    expect(await ruta.findByText('Tira 0 mg/L: no se confirmó; el caso se cerró con alta')).toBeInTheDocument()
    expect(ruta.getAllByText('No aplica')).toHaveLength(3)
    // Caso cerrado: ya no hay bloque de próxima cita ni botón para registrar.
    expect(screen.queryByRole('region', { name: 'Próxima cita' })).not.toBeInTheDocument()
  })
})
