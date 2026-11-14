import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cargarEscenario } from '../../db/seed.js'
import { crearDb } from '../../db/schema.js'
import { SelectorEscenario } from './SelectorEscenario.jsx'

// jsdom no implementa HTMLDialogElement.showModal/close: lo polyfill-eamos
// con open/removeAttribute para que onCancel + eventos funcionen igual.
beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '')
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open')
    }
  }
})

const datos50 = {
  escenario: 50,
  semilla: 2026,
  ninos: [{ codigo: 'NIN-AC-0001', sexo: 'F', mesNacimiento: 2, anioNacimiento: 2016 }],
  casos: [
    { codigo: 'PON-AC-0001', codigoNino: 'NIN-AC-0001', cct: '14DPR1710G', clues: 'JCSSA001234', fechaTamizaje: '2026-05-01', etapaActual: 1, estado: 'en_seguimiento' },
  ],
  eventos: [],
}

const datosIniciales = {
  escenario: 11,
  semilla: 2026,
  ninos: [{ codigo: 'NIN-AC-0002', sexo: 'M', mesNacimiento: 3, anioNacimiento: 2016 }],
  casos: [
    { codigo: 'PON-AC-0002', codigoNino: 'NIN-AC-0002', cct: '14DPR1710G', clues: 'JCSSA001234', fechaTamizaje: '2026-03-01', etapaActual: 1, estado: 'en_seguimiento' },
  ],
  eventos: [],
}

describe('SelectorEscenario', () => {
  let db

  beforeEach(async () => {
    db = crearDb(`test-sel-${Math.random().toString(36).slice(2)}`)
    await db.open()
    await cargarEscenario(11, datosIniciales, db)
  })

  afterEach(async () => {
    await db.delete()
  })

  it('muestra "Datos simulados" y el escenario activo', async () => {
    render(<SelectorEscenario db={db} fetchImpl={vi.fn()} />)
    expect(screen.getByText('Datos simulados')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByLabelText('Escenario simulado')).toHaveValue('11')
    })
  })

  it('al cambiar abre el modal de confirmación con el escenario destino', async () => {
    render(<SelectorEscenario db={db} fetchImpl={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('Escenario simulado')).toHaveValue('11'))

    fireEvent.change(screen.getByLabelText('Escenario simulado'), { target: { value: '50' } })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('¿Cambiar al escenario 50 %?')).toBeInTheDocument()
    expect(screen.getByText(/Los casos que registraste se mantienen/)).toBeInTheDocument()
  })

  it('cancelar cierra el modal y no cambia nada', async () => {
    const fetchImpl = vi.fn()
    render(<SelectorEscenario db={db} fetchImpl={fetchImpl} />)
    await waitFor(() => expect(screen.getByLabelText('Escenario simulado')).toHaveValue('11'))

    fireEvent.change(screen.getByLabelText('Escenario simulado'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetchImpl).not.toHaveBeenCalled()
    expect((await db.meta.get('escenarioActivo')).valor).toBe('11')
  })

  it('confirmar carga el escenario destino y deja rastro en la bitácora', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(datos50) }),
    )
    const usuario = { id: 'USR-SUP-JAL', rol: 'supervision' }
    render(<SelectorEscenario db={db} fetchImpl={fetchImpl} usuario={usuario} />)
    await waitFor(() => expect(screen.getByLabelText('Escenario simulado')).toHaveValue('11'))

    fireEvent.change(screen.getByLabelText('Escenario simulado'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar escenario' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetchImpl).toHaveBeenCalledWith('/data/casos_50.json')
    expect((await db.meta.get('escenarioActivo')).valor).toBe('50')
    const entrada = (await db.bitacora.toArray())[0]
    expect(entrada).toMatchObject({
      accion: 'modificar',
      entidad: 'escenario',
      entidadId: '11->50',
      usuarioId: 'USR-SUP-JAL',
    })
  })

  it('si el fetch falla muestra el mensaje offline y no cambia el escenario', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: false }))
    render(<SelectorEscenario db={db} fetchImpl={fetchImpl} />)
    await waitFor(() => expect(screen.getByLabelText('Escenario simulado')).toHaveValue('11'))

    fireEvent.change(screen.getByLabelText('Escenario simulado'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar escenario' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/sin conexión/i))
    expect((await db.meta.get('escenarioActivo')).valor).toBe('11')
  })
})
