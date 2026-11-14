import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { ListaAvisosPage } from './ListaAvisosPage.jsx'

const HOY = '2026-11-14'
const campo = { id: 'USR-CAM-AC', rol: 'campo', clues: 'PROV-AC-01' }

let db
let n = 0

async function sembrar() {
  await db.escuelas.add({ cct: '14DPR1710G', nombre: 'Emiliano Zapata', claveInegi: '140660002' })
  await db.centrosSalud.add({ clues: 'PROV-AC-01', nombre: 'Centro de Salud Agua Caliente', claveInegi: '140660002' })
  await db.casos.bulkAdd([
    {
      codigo: 'PON-AC-0001', codigoNino: 'NIN-AC-0001', cct: '14DPR1710G', clues: 'PROV-AC-01',
      fechaTamizaje: '2026-01-10', etapaActual: 1, estado: 'en_seguimiento',
      fechaProximaCita: '2026-11-20', simulado: true,
    },
    {
      codigo: 'PON-SPI-0001', codigoNino: 'NIN-SPI-0001', cct: '14DPR1616B', clues: 'PROV-SPI-01',
      fechaTamizaje: '2026-01-10', etapaActual: 1, estado: 'en_seguimiento', simulado: true,
    },
  ])
  await db.avisos.bulkAdd([
    { codigoCaso: 'PON-AC-0001', usuarioId: 'USR-CAM-AC', fecha: '2026-11-10', canal: 'mensaje',
      fechaCita: '2026-11-20', lugarCita: 'Centro de Salud Agua Caliente', estado: 'pendiente', simulado: true },
    { codigoCaso: 'PON-AC-0001', usuarioId: 'USR-CAM-AC', fecha: '2026-11-12', canal: 'visita',
      fechaCita: '2026-11-20', lugarCita: 'Centro de Salud Agua Caliente', estado: 'entregado', simulado: true },
    { codigoCaso: 'PON-SPI-0001', usuarioId: 'USR-CAP-SPI', fecha: '2026-11-11', canal: 'recado',
      fechaCita: null, lugarCita: 'Centro SPI', estado: 'pendiente', simulado: true },
  ])
}

beforeEach(async () => {
  db = crearDb(`test-lista-avisos-${n++}`)
  await sembrar()
})

afterEach(async () => {
  await db.delete()
})

describe('ListaAvisosPage', () => {
  it('muestra solo los avisos del centro del usuario, más recientes primero', async () => {
    render(<ListaAvisosPage usuario={campo} hoyISO={HOY} db={db} />)
    await screen.findByRole('list', { name: /Avisos del centro/ })
    const items = within(screen.getByRole('list', { name: /Avisos del centro/ })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Entregado')
    expect(items[1]).toHaveTextContent('Pendiente de entregar')
    expect(screen.queryByText('PON-SPI-0001')).not.toBeInTheDocument()
  })

  it('cuenta los pendientes en el encabezado', async () => {
    render(<ListaAvisosPage usuario={campo} hoyISO={HOY} db={db} />)
    expect(await screen.findByText(/1 pendiente de entregar/)).toBeInTheDocument()
  })

  it('cada item monta la vista previa de AvisoFamilia (botón "Aviso a la familia")', async () => {
    render(<ListaAvisosPage usuario={campo} hoyISO={HOY} db={db} />)
    const botones = await screen.findAllByRole('button', { name: 'Aviso a la familia' })
    expect(botones).toHaveLength(2)
  })

  it('al abrir el aviso y marcarlo en el historial, cambia a entregado', async () => {
    render(<ListaAvisosPage usuario={campo} hoyISO={HOY} db={db} />)
    const botones = await screen.findAllByRole('button', { name: 'Aviso a la familia' })
    // El item pendiente es el segundo (2026-11-10 < 2026-11-12 entregado).
    fireEvent.click(botones[1])
    // El historial interno de AvisoFamilia lista los avisos del caso con
    // su botón "Marcar como entregado" para los pendientes.
    const marcar = await screen.findByRole('button', { name: 'Marcar como entregado' })
    fireEvent.click(marcar)
    await waitFor(async () => {
      const avs = await db.avisos.toArray()
      expect(avs.filter((a) => a.estado === 'entregado')).toHaveLength(2)
    })
  })

  it('cuando el centro no tiene avisos muestra estado vacío', async () => {
    const sinCasos = { id: 'USR-CAM-CHA', rol: 'campo', clues: 'PROV-CHA-01' }
    render(<ListaAvisosPage usuario={sinCasos} hoyISO={HOY} db={db} />)
    expect(await screen.findByText('Aún no hay avisos')).toBeInTheDocument()
  })

  it('no muestra códigos de avisos de otros centros', async () => {
    render(<ListaAvisosPage usuario={campo} hoyISO={HOY} db={db} />)
    await screen.findByRole('list', { name: /Avisos del centro/ })
    expect(document.body.textContent).not.toMatch(/PON-SPI-/)
  })
})
