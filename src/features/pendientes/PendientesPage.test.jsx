import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { MisVisitasPage } from '../campo/MisVisitasPage.jsx'
import { PendientesPage } from './PendientesPage.jsx'

// PendientesPage usa <Link to="/caso/:codigo">. Las pruebas la envuelven con
// MemoryRouter porque no se monta desde la App completa.
const renderPendientes = (props) =>
  render(
    <MemoryRouter>
      <PendientesPage {...props} />
    </MemoryRouter>,
  )

const HOY = '2026-11-14'
const captura = { id: 'USR-CAP-AC', rol: 'captura', clues: 'PROV-AC-01' }
const campo = { id: 'USR-CAM-AC', rol: 'campo', clues: 'PROV-AC-01' }

let db
let n = 0

function caso(codigo, extra = {}) {
  return {
    codigo,
    codigoNino: codigo.replace('PON', 'NIN'),
    cct: '14DPR1710G',
    clues: 'PROV-AC-01',
    fechaTamizaje: '2026-01-10',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: null,
    simulado: true,
    ...extra,
  }
}

async function sembrar(casos, eventos = []) {
  await db.escuelas.bulkAdd([
    { cct: '14DPR1710G', nombre: 'Emiliano Zapata', claveInegi: '140660002' },
    { cct: '14DTV0442U', nombre: 'Adolfo Lopez Mateos', claveInegi: '140660002' },
  ])
  await db.centrosSalud.add({ clues: 'PROV-AC-01', nombre: 'Centro de Salud Agua Caliente', claveInegi: '140660002' })
  await db.casos.bulkAdd(casos)
  if (eventos.length) await db.eventos.bulkAdd(eventos)
}

const codigosEnLista = () =>
  within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('.caso-pendiente__codigo').textContent)

beforeEach(() => {
  db = crearDb(`test-pendientes-page-${n++}`)
})

afterEach(async () => {
  await db.delete()
})

describe('PendientesPage (HU03)', () => {
  beforeEach(async () => {
    await sembrar(
      [
        caso('PON-AC-0001', { fechaProximaCita: '2026-11-04' }), // amarillo 10
        caso('PON-AC-0002', { fechaProximaCita: '2026-10-05' }), // rojo 40
        caso('PON-AC-0003', { fechaProximaCita: '2026-12-01' }), // verde
        caso('PON-AC-0004', { cct: '14DTV0442U', etapaActual: 2 }), // sin cita, amarillo 20
        caso('PON-AC-0005', { estado: 'alta', fechaProximaCita: '2026-01-01' }),
        caso('PON-SPI-0001', { clues: 'PROV-SPI-01', fechaProximaCita: '2026-09-01' }),
      ],
      [{ codigoCaso: 'PON-AC-0004', tipo: 'resultado', etapa: 2, fecha: '2026-10-25', usuarioId: 'USR-CAP-AC' }],
    )
  })

  it('muestra solo amarillo y rojo de mi centro, ordenados por retraso, con texto', async () => {
    renderPendientes({ usuario: captura, hoyISO: HOY, db })
    await screen.findByText('Centro de Salud Agua Caliente')
    expect(codigosEnLista()).toEqual(['PON-AC-0002', 'PON-AC-0004', 'PON-AC-0001'])
    expect(screen.getByText('Retraso alto (40 días)')).toBeInTheDocument()
    expect(screen.getByText('Sin cita (20 días)')).toBeInTheDocument()
    expect(screen.queryByText('PON-AC-0003')).not.toBeInTheDocument()
    expect(screen.queryByText('PON-SPI-0001')).not.toBeInTheDocument()
    expect(screen.getByText('Datos simulados')).toBeInTheDocument()
  })

  it('las tarjetas resumen filtran la lista', async () => {
    renderPendientes({ usuario: captura, hoyISO: HOY, db })
    const rojo = await screen.findByRole('button', { name: /Urgentes/ })
    expect(rojo).toHaveTextContent('1')
    fireEvent.click(rojo)
    expect(codigosEnLista()).toEqual(['PON-AC-0002'])
    fireEvent.click(rojo)
    expect(codigosEnLista()).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: /Sin cita agendada/ }))
    expect(codigosEnLista()).toEqual(['PON-AC-0004'])
  })

  it('filtra por escuela', async () => {
    renderPendientes({ usuario: captura, hoyISO: HOY, db })
    const select = await screen.findByLabelText('Escuela')
    fireEvent.change(select, { target: { value: '14DTV0442U' } })
    expect(codigosEnLista()).toEqual(['PON-AC-0004'])
  })

  it('deja la consulta en la bitácora', async () => {
    renderPendientes({ usuario: captura, hoyISO: HOY, db })
    await screen.findByText('Centro de Salud Agua Caliente')
    await waitFor(async () => {
      const b = await db.bitacora.where('accion').equals('consultar').toArray()
      expect(b[0]).toMatchObject({ usuarioId: 'USR-CAP-AC', entidad: 'pendientes', entidadId: 'PROV-AC-01' })
    })
  })
})

describe('PendientesPage, sin pendientes', () => {
  it('muestra "Todo al día en tu centro"', async () => {
    await sembrar([caso('PON-AC-0003', { fechaProximaCita: '2026-12-01' })])
    renderPendientes({ usuario: captura, hoyISO: HOY, db })
    expect(await screen.findByText('Todo al día en tu centro')).toBeInTheDocument()
  })
})

describe('Sin seguimiento (RF14)', () => {
  it('guarda el paso a sin seguimiento y lo muestra en la lista', async () => {
    await sembrar(
      [caso('PON-AC-0010', { fechaProximaCita: '2026-10-01' })],
      [
        { codigoCaso: 'PON-AC-0010', tipo: 'visita', etapa: 1, fecha: '2026-10-20', visitaResultado: 'no_localizada' },
        { codigoCaso: 'PON-AC-0010', tipo: 'visita', etapa: 1, fecha: '2026-11-01', visitaResultado: 'no_localizada' },
      ],
    )
    renderPendientes({ usuario: captura, hoyISO: HOY, db })
    expect(await screen.findByText('Sin seguimiento')).toBeInTheDocument()
    await waitFor(async () => {
      expect((await db.casos.get('PON-AC-0010')).estado).toBe('sin_seguimiento')
    })
    expect(screen.getByText('PON-AC-0010')).toBeInTheDocument()
  })
})

describe('MisVisitasPage (HU04)', () => {
  it('lista los pendientes del centro por urgencia, solo con códigos y sin resultados clínicos', async () => {
    await sembrar(
      [
        caso('PON-AC-0001', { fechaProximaCita: '2026-11-04' }),
        caso('PON-AC-0002', { fechaProximaCita: '2026-10-05', etapaActual: 3 }),
        caso('PON-SPI-0001', { clues: 'PROV-SPI-01', fechaProximaCita: '2026-09-01' }),
      ],
      [
        {
          codigoCaso: 'PON-AC-0002',
          tipo: 'resultado',
          etapa: 3,
          fecha: '2026-06-01',
          creatininaMgDl: 0.55,
          tallaCm: 145.7,
          tfge: 92.58,
        },
      ],
    )
    render(<MisVisitasPage usuario={campo} hoyISO={HOY} db={db} />)
    await screen.findByText(/1 urgente/)
    expect(codigosEnLista()).toEqual(['PON-AC-0002', 'PON-AC-0001'])
    expect(screen.queryByText('PON-SPI-0001')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/92\.58|0\.55|145\.7|TFGe|creatinina/i)
    expect(screen.getByText('Datos simulados')).toBeInTheDocument()
  })

  it('sin pendientes muestra el estado vacío', async () => {
    await sembrar([caso('PON-AC-0003', { fechaProximaCita: '2026-12-01' })])
    render(<MisVisitasPage usuario={campo} hoyISO={HOY} db={db} />)
    expect(await screen.findByText('No tienes visitas pendientes')).toBeInTheDocument()
  })

  it('explica que el domicilio se busca en la hoja de enlace del centro de salud', async () => {
    await sembrar([caso('PON-AC-0003', { fechaProximaCita: '2026-12-01' })])
    render(<MisVisitasPage usuario={campo} hoyISO={HOY} db={db} />)
    await screen.findByText('No tienes visitas pendientes')
    expect(document.body).toHaveTextContent('busca el código en la hoja de enlace del centro de salud')
    expect(document.body).toHaveTextContent('No escribas nombres ni domicilios en la app.')
  })
})
