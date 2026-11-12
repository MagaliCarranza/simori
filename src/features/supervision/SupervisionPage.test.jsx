import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { SupervisionPage } from './SupervisionPage.jsx'

// jsdom no tiene canvas; el gráfico se sustituye. Los números se prueban en la lista accesible.
vi.mock('react-chartjs-2', () => ({ Bar: () => null }))

const HOY = '2026-11-14'
const supervisor = { id: 'USR-SUP-JAL', rol: 'supervision', clues: null }

let db
let n = 0

function caso(codigo, cct, clues) {
  return {
    codigo,
    codigoNino: codigo.replace('PON', 'NIN'),
    cct,
    clues,
    fechaTamizaje: '2026-09-01',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: '2026-12-01',
    simulado: true,
  }
}

// 8 casos en Agua Caliente (6 en una escuela, 2 en otra) y 3 en San Pedro.
async function sembrar() {
  await db.localidades.bulkAdd([
    { claveInegi: '140660002', nombre: 'Agua Caliente' },
    { claveInegi: '140660031', nombre: 'San Pedro Itzicán' },
  ])
  await db.escuelas.bulkAdd([
    { cct: '14DPR1710G', nombre: 'Emiliano Zapata', claveInegi: '140660002' },
    { cct: '14DTV0442U', nombre: 'Adolfo Lopez Mateos', claveInegi: '140660002' },
    { cct: '14DPR0001A', nombre: 'Miguel Hidalgo', claveInegi: '140660031' },
  ])
  await db.centrosSalud.bulkAdd([
    { clues: 'PROV-AC-01', nombre: 'Centro de Salud Agua Caliente', claveInegi: '140660002' },
    { clues: 'PROV-SPI-01', nombre: 'Centro de Salud San Pedro', claveInegi: '140660031' },
  ])
  const casos = [
    ...Array.from({ length: 6 }, (_, i) => caso(`PON-AC-000${i + 1}`, '14DPR1710G', 'PROV-AC-01')),
    caso('PON-AC-0007', '14DTV0442U', 'PROV-AC-01'),
    caso('PON-AC-0008', '14DTV0442U', 'PROV-AC-01'),
    ...Array.from({ length: 3 }, (_, i) => caso(`PON-SPI-000${i + 1}`, '14DPR0001A', 'PROV-SPI-01')),
  ]
  await db.casos.bulkAdd(casos)
  // Los 6 de Zapata completan (etapa 4) con 30 días entre tamizaje y confirmación.
  const eventos = casos.flatMap((c) => [{ codigoCaso: c.codigo, tipo: 'resultado', etapa: 1, fecha: '2026-09-01' }])
  for (const c of casos.slice(0, 6)) {
    eventos.push(
      { codigoCaso: c.codigo, tipo: 'resultado', etapa: 2, fecha: '2026-10-01' },
      { codigoCaso: c.codigo, tipo: 'resultado', etapa: 4, fecha: '2026-10-20' },
    )
  }
  await db.eventos.bulkAdd(eventos)
}

const valorDe = (titulo) => within(screen.getByRole('region', { name: titulo }))
const kpi = () => document.querySelector('.supervision__kpi')

beforeEach(async () => {
  db = crearDb(`test-supervision-${n++}`)
  await sembrar()
})

afterEach(async () => {
  await db.delete()
})

describe('SupervisionPage (HU07, HU08)', () => {
  it('muestra el indicador, el embudo y la mediana con todos los casos', async () => {
    render(<SupervisionPage hoyISO={HOY} usuario={supervisor} db={db} />)
    await screen.findByText('Casos por etapa')

    // 6 de 11 completaron → 55 %
    expect(kpi()).toHaveTextContent('55 %')
    expect(kpi()).toHaveTextContent('Positivos en la selección: 11')
    const embudo = valorDe('Casos por etapa')
    expect(embudo.getByText('1. Tamizaje').nextSibling).toHaveTextContent('11 casos')
    expect(embudo.getByText('2. Confirmación').nextSibling).toHaveTextContent('6 casos')
    expect(embudo.getByText('3. Valoración').nextSibling).toHaveTextContent('6 casos')
    expect(embudo.getByText('5. Salida').nextSibling).toHaveTextContent('menos de 5')
    const dias = valorDe('Mediana de días entre etapas')
    expect(dias.getByText('Tamizaje → Confirmación').nextSibling).toHaveTextContent('30 días')
    expect(dias.getByText('Valoración → Clasificación').nextSibling).toHaveTextContent('sin datos suficientes')
  })

  it('nunca muestra códigos de caso', async () => {
    const { container } = render(<SupervisionPage hoyISO={HOY} usuario={supervisor} db={db} />)
    await screen.findByText('Casos por etapa')
    expect(container.textContent).not.toMatch(/PON-|NIN-/)
  })

  it('tabla por localidad enmascara cifras menores de 5', async () => {
    render(<SupervisionPage hoyISO={HOY} usuario={supervisor} db={db} />)
    const tabla = await screen.findByRole('table')
    const filaSpi = within(tabla).getByRole('row', { name: /San Pedro Itzicán/ })
    expect(within(filaSpi).getAllByRole('cell')[0]).toHaveTextContent('menos de 5')
    expect(within(filaSpi).getAllByRole('cell')[1]).toHaveTextContent('No disponible')
    const filaAc = within(tabla).getByRole('row', { name: /Agua Caliente/ })
    expect(within(filaAc).getAllByRole('cell')[0]).toHaveTextContent('8')
  })

  it('con menos de 5 casos en el filtro oculta el porcentaje', async () => {
    render(<SupervisionPage hoyISO={HOY} usuario={supervisor} db={db} />)
    await screen.findByText('Casos por etapa')
    fireEvent.change(screen.getByLabelText('Escuela'), { target: { value: '14DTV0442U' } })
    await waitFor(() => expect(kpi()).toHaveTextContent('No disponible'))
    expect(kpi()).toHaveTextContent('Positivos en la selección: menos de 5')
  })

  it('el filtro de localidad limita las escuelas', async () => {
    render(<SupervisionPage hoyISO={HOY} usuario={supervisor} db={db} />)
    await screen.findByText('Casos por etapa')
    fireEvent.change(screen.getByLabelText('Localidad'), { target: { value: '140660031' } })
    const opciones = within(screen.getByLabelText('Escuela')).getAllByRole('option')
    expect(opciones.map((o) => o.textContent)).toEqual(['Todas', 'Miguel Hidalgo (14DPR0001A)'])
  })

  it('recalcula al registrar un resultado nuevo', async () => {
    render(<SupervisionPage hoyISO={HOY} usuario={supervisor} db={db} />)
    await screen.findByText('Casos por etapa')
    expect(kpi()).toHaveTextContent('55 %')
    await act(async () => {
      await db.eventos.add({ codigoCaso: 'PON-AC-0007', tipo: 'resultado', etapa: 4, fecha: '2026-11-01' })
    })
    // 7 de 11 → 64 %
    await waitFor(() => expect(kpi()).toHaveTextContent('64 %'))
  })

  it('registra una sola consulta en bitácora, sin códigos', async () => {
    render(<SupervisionPage hoyISO={HOY} usuario={supervisor} db={db} />)
    await screen.findByText('Casos por etapa')
    fireEvent.change(screen.getByLabelText('Localidad'), { target: { value: '140660002' } })
    await waitFor(async () => expect(await db.bitacora.count()).toBe(1))
    const [entrada] = await db.bitacora.toArray()
    expect(entrada).toMatchObject({
      usuarioId: 'USR-SUP-JAL',
      rol: 'supervision',
      accion: 'consultar',
      entidad: 'supervision',
      entidadId: 'embudo',
    })
  })
})
