import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { GuardadosPage } from './GuardadosPage.jsx'
import { MuestrasLabPage } from './MuestrasLabPage.jsx'
import { TamizadosPage } from './TamizadosPage.jsx'

const HOY = '2026-11-14'
const captura = { id: 'USR-CAP-AC', rol: 'captura', clues: 'C-AC' }

let db
let n = 0

function caso(codigo, extra = {}) {
  return {
    codigo,
    codigoNino: codigo.replace('PON', 'NIN'),
    cct: '14DPR1710G',
    clues: 'C-AC',
    fechaTamizaje: '2026-08-01',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: '2026-12-01',
    simulado: true,
    ...extra,
  }
}

beforeEach(async () => {
  db = crearDb(`test-captura-${n++}`)
  await db.escuelas.add({ cct: '14DPR1710G', nombre: 'Emiliano Zapata', claveInegi: '140660002' })
  await db.centrosSalud.add({ clues: 'C-AC', nombre: 'CENTRO DE SALUD SAN PEDRO ITZICAN', claveInegi: '140660031' })
  await db.casos.bulkAdd([
    caso('PON-AC-0001', { fechaProximaCita: '2026-10-05' }), // rojo
    caso('PON-AC-0131', { etapaActual: 2, fechaTamizaje: '2026-09-15' }), // verde
    caso('PON-AC-0003', { estado: 'alta', etapaActual: 2 }),
    caso('PON-SPI-0001', { clues: 'OTRO' }),
  ])
  await db.eventos.add({ codigoCaso: 'PON-AC-0003', tipo: 'alta', fecha: '2026-11-01' })
})

afterEach(async () => {
  await db.delete()
})

const montar = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)
const codigos = () => [...document.querySelectorAll('.captura__codigo')].map((c) => c.textContent)

describe('TamizadosPage', () => {
  it('abre en "Con retraso" con la pantalla de Pendientes', async () => {
    montar(<TamizadosPage usuario={captura} hoyISO={HOY} db={db} />)
    expect(screen.getByRole('button', { name: 'Con retraso' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { name: 'Casos con retraso y pendientes' })).toBeInTheDocument()
  })

  it('"Todos" lista cada caso del centro, incluidos los cerrados, con buscador', async () => {
    montar(<TamizadosPage usuario={captura} hoyISO={HOY} db={db} />)
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    await screen.findByRole('heading', { name: 'Pacientes tamizados' })
    await waitFor(() => expect(codigos()).toHaveLength(3))
    expect(codigos()).not.toContain('PON-SPI-0001')
    expect(screen.getByText('Cerrado: alta')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Buscar por código'), { target: { value: '0131' } })
    expect(codigos()).toEqual(['PON-AC-0131'])
    expect(screen.getByRole('link', { name: 'Ver ficha' })).toHaveAttribute('href', '/caso/PON-AC-0131')
  })

  it('deja la consulta de "Todos" en la bitácora', async () => {
    montar(<TamizadosPage usuario={captura} hoyISO={HOY} db={db} />)
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    await waitFor(async () => expect(await db.bitacora.where('entidad').equals('tamizados').count()).toBe(1))
  })
})

describe('MuestrasLabPage', () => {
  it('agrupa por la etapa que sigue y lleva a la ficha', async () => {
    montar(<MuestrasLabPage usuario={captura} hoyISO={HOY} db={db} />)
    const conf = await screen.findByRole('region', { name: /Etapa 2: Confirmación/ })
    expect(within(conf).getByText('PON-AC-0001')).toBeInTheDocument()
    const val = screen.getByRole('region', { name: /Etapa 3: Valoración/ })
    expect(within(val).getByRole('link', { name: 'Registrar resultado en la ficha' })).toHaveAttribute(
      'href',
      '/caso/PON-AC-0131',
    )
    expect(document.body.textContent).not.toMatch(/PON-AC-0003|PON-SPI-0001/)
  })
})

describe('GuardadosPage', () => {
  it('sin cambios muestra el estado vacío', async () => {
    montar(<GuardadosPage db={db} />)
    expect(await screen.findByText('Todavía no se ha guardado nada en este equipo.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar (simulado)' })).toBeDisabled()
  })

  it('lista lo guardado y el envío simulado lo marca como enviado, con "Datos simulados"', async () => {
    await db.bitacora.bulkAdd([
      { usuarioId: 'U', rol: 'captura', accion: 'consultar', entidad: 'caso', entidadId: 'PON-AC-0001', fechaHora: '2026-11-14T10:00:00Z' },
      { usuarioId: 'U', rol: 'captura', accion: 'crear', entidad: 'caso', entidadId: 'PON-AC-0001', fechaHora: '2026-11-14T10:01:00Z' },
    ])
    montar(<GuardadosPage db={db} />)
    expect(await screen.findByText('Guardado en este equipo')).toBeInTheDocument()
    expect(screen.getByText(/Caso registrado/)).toBeInTheDocument()
    const boton = screen.getByRole('button', { name: 'Enviar (simulado)' })
    expect(boton.parentElement).toHaveTextContent('Datos simulados')
    fireEvent.click(boton)
    expect(await screen.findByText('Enviado (simulado)')).toBeInTheDocument()
    expect((await db.meta.get('envioSimuladoHasta')).valor).toBeGreaterThan(0)
  })
})
