import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { cargarEscenario } from '../../db/seed.js'
import { PronosticoPage } from './PronosticoPage.jsx'

const HOY = '2026-11-14'
const CLUES = 'JCSSA004213'
const supervisor = { id: 'USR-SUP-JAL', rol: 'supervision', clues: null }

let db
let n = 0

function caso(codigo, fechaProximaCita, estado = 'en_seguimiento') {
  return {
    codigo,
    codigoNino: codigo.replace('PON', 'NIN'),
    cct: '14DPR1710G',
    clues: CLUES,
    fechaTamizaje: '2026-09-01',
    etapaActual: 1,
    estado,
    fechaProximaCita,
    simulado: true,
  }
}

// 20 citas en la semana 2 (21–27 nov) y 1 caso sin seguimiento que no cuenta.
function datosEscenario() {
  return {
    casos: [
      ...Array.from({ length: 20 }, (_, i) => caso(`PON-AC-${String(i + 1).padStart(4, '0')}`, '2026-11-23')),
      caso('PON-AC-0099', '2026-11-23', 'sin_seguimiento'),
    ],
  }
}

const tabla = () => screen.getByRole('table', { name: `Centro de salud ${CLUES}` })
const filaSemana = (numero) =>
  within(tabla())
    .getAllByRole('row')
    .find((r) => r.querySelector('th')?.textContent.startsWith(String(numero)))

beforeEach(async () => {
  db = crearDb(`test-pronostico-${n++}`)
  await db.centrosSalud.add({ clues: CLUES, nombre: 'CENTRO DE SALUD SAN PEDRO ITZICAN', claveInegi: '140660031' })
  await cargarEscenario(30, datosEscenario(), db)
})

afterEach(async () => {
  await db.delete()
})

describe('PronosticoPage', () => {
  it('muestra el escenario activo y la tabla centro × semana', async () => {
    render(<PronosticoPage hoyISO={HOY} usuario={supervisor} db={db} />)
    await screen.findByRole('table')

    expect(screen.getByText(/Escenario activo/)).toHaveTextContent('30 % de pérdida')
    expect(screen.getAllByText('Datos simulados').length).toBeGreaterThan(0)

    const filas = within(tabla()).getAllByRole('row')
    expect(filas).toHaveLength(1 + 8 + 1) // encabezado + 8 semanas + total

    const s2 = within(filaSemana(2)).getAllByRole('cell')
    expect(filaSemana(2)).toHaveTextContent('21 nov – 27 nov')
    expect(s2[0]).toHaveTextContent('20')
    expect(s2[1]).toHaveTextContent('14')
  })

  it('se actualiza al cambiar de escenario en M10', async () => {
    render(<PronosticoPage hoyISO={HOY} usuario={supervisor} db={db} />)
    await screen.findByRole('table')

    await act(() => cargarEscenario(50, datosEscenario(), db))

    await waitFor(() => expect(screen.getByText(/Escenario activo/)).toHaveTextContent('50 % de pérdida'))
    const s2 = within(filaSemana(2)).getAllByRole('cell')
    expect(s2[1]).toHaveTextContent('10')
  })

  it('solo muestra códigos: ni códigos de caso ni nombres de centro, y no se describe como IA', async () => {
    const { container } = render(<PronosticoPage hoyISO={HOY} usuario={supervisor} db={db} />)
    await screen.findByRole('table')
    const texto = container.textContent
    expect(texto).toContain(CLUES)
    expect(texto).not.toMatch(/PON-|NIN-/)
    expect(texto).not.toMatch(/CENTRO DE SALUD SAN PEDRO/i)
    expect(texto).not.toMatch(/\bIA\b|inteligencia artificial|modelo predictivo/i)
  })

  it('registra la consulta en la bitácora sin códigos de caso', async () => {
    render(<PronosticoPage hoyISO={HOY} usuario={supervisor} db={db} />)
    await screen.findByRole('table')
    await waitFor(async () => {
      const entradas = await db.bitacora.toArray()
      expect(entradas).toContainEqual(
        expect.objectContaining({ usuarioId: supervisor.id, accion: 'consultar', entidadId: 'pronostico' }),
      )
    })
  })
})
