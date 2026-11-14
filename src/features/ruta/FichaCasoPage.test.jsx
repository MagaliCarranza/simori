import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { FichaCasoPage } from './FichaCasoPage.jsx'

const HOY = '2026-11-14'
const captura = { id: 'USR-CAP-01', rol: 'captura', clues: 'JCSSA004213' }
const otroCentro = { id: 'USR-CAP-02', rol: 'captura', clues: 'JCSSA000001' }

let db
let n = 0

beforeEach(async () => {
  db = crearDb(`test-ficha-${n++}`)
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

function pintar(usuario = captura) {
  render(
    <MemoryRouter initialEntries={['/caso/PON-AC-0001']}>
      <Routes>
        <Route path="/caso/:codigo" element={<FichaCasoPage usuario={usuario} hoyISO={HOY} db={db} />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function guardar(etiquetaForm) {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }))
  await screen.findByRole('status')
  await screen.findByRole('heading', { name: etiquetaForm })
}

describe('Ficha de seguimiento (HU02)', () => {
  it('muestra datos del caso, semáforo con texto e historial', async () => {
    pintar()
    expect(await screen.findByRole('heading', { name: 'Caso PON-AC-0001' })).toBeInTheDocument()
    expect(screen.getByText(/Con retraso \(21 días\)/)).toBeInTheDocument()
    expect(screen.getByText('Emiliano Zapata · Agua Caliente')).toBeInTheDocument()
    expect(screen.getByText('Niña, 10 años')).toBeInTheDocument()
    expect(screen.getByText(/Tamizaje: tira 50 mg\/L \(positiva\)/)).toBeInTheDocument()
  })

  it('registra la consulta en la bitácora (RF15)', async () => {
    pintar()
    await screen.findByRole('heading', { name: 'Caso PON-AC-0001' })
    await waitFor(async () => {
      expect(await db.bitacora.toArray()).toEqual([expect.objectContaining({ accion: 'consultar', entidadId: 'PON-AC-0001' })])
    })
  })

  it('no muestra casos de otro centro de salud', async () => {
    pintar(otroCentro)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se encontró el caso PON-AC-0001 en tu centro de salud.')
  })

  it('recorre la ruta: confirmación, valoración y clasificación con referencia', async () => {
    pintar()

    // Etapa 2 · confirmación positiva
    await screen.findByRole('heading', { name: 'Registrar resultado: Confirmación' })
    fireEvent.change(screen.getByLabelText('Fecha del resultado'), { target: { value: '2026-11-01' } })
    fireEvent.click(screen.getByRole('button', { name: '50' }))
    await guardar('Registrar resultado: Valoración')

    // Etapa 3 · valoración con vista previa de la TFGe
    fireEvent.change(screen.getByLabelText('Fecha del resultado'), { target: { value: '2026-11-05' } })
    fireEvent.change(screen.getByLabelText('Creatinina en sangre (mg/dL)'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Talla (cm)'), { target: { value: '140' } })
    fireEvent.change(screen.getByLabelText('Peso (kg)'), { target: { value: '35' } })
    expect(screen.getByText(/Filtración estimada \(CKiD U25\)/)).toHaveTextContent('G3a')
    expect(screen.getAllByText(/no diagnostica/).length).toBeGreaterThan(0)
    await guardar('Registrar resultado: Clasificación')

    // Etapa 4 · clasificación: propone referencia y queda preseleccionada
    fireEvent.change(screen.getByLabelText('Cociente albúmina/creatinina en orina (mg/g)'), { target: { value: '120' } })
    expect(screen.getByText(/Salida propuesta: Referir a nefrología pediátrica/)).toBeInTheDocument()
    expect(screen.getByLabelText('Referir a nefrología pediátrica')).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Estado: Referido a nefrología pediátrica'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Guardar resultado' })).toBeNull())
    expect(screen.getByText(/Referido a nefrología pediátrica/, { selector: 'li' })).toBeInTheDocument()
    expect(await db.casos.get('PON-AC-0001')).toMatchObject({ etapaActual: 4, estado: 'referido' })
  })

  it('confirmación negativa cierra el caso como alta', async () => {
    pintar()
    await screen.findByRole('heading', { name: 'Registrar resultado: Confirmación' })
    fireEvent.change(screen.getByLabelText('Fecha del resultado'), { target: { value: '2026-11-01' } })
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Estado: No confirmado (alta)')
    expect(await db.casos.get('PON-AC-0001')).toMatchObject({ estado: 'alta' })
  })

  it('muestra los errores sin guardar', async () => {
    pintar()
    await screen.findByRole('heading', { name: 'Registrar resultado: Confirmación' })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El valor de la tira debe ser 0, 20, 50 o 100 mg/L.')
    expect(await db.eventos.count()).toBe(1)
  })

  it('agenda una cita', async () => {
    pintar()
    await screen.findByRole('heading', { name: 'Cambiar cita' })
    fireEvent.change(screen.getByLabelText('Fecha de la cita'), { target: { value: '2026-11-28' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cita' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Cita agendada para el 28 nov 2026.')
    expect(await db.casos.get('PON-AC-0001')).toMatchObject({ fechaProximaCita: '2026-11-28' })
  })
})
