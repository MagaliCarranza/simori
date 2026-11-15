import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ComparaEscenariosPage } from './ComparaEscenariosPage.jsx'

// Cohorte de 10: con 11 % llegan más casos que con 50 %.
function datos(confirmados) {
  const casos = Array.from({ length: 10 }, (_, i) => ({ codigo: `C${i + 1}`, estado: 'en_seguimiento' }))
  const eventos = [
    ...casos.map((c) => ({ codigoCaso: c.codigo, tipo: 'resultado', etapa: 1, fecha: '2026-01-10' })),
    ...casos.slice(0, confirmados).flatMap((c) => [2, 3, 4].map((etapa) => ({ codigoCaso: c.codigo, tipo: 'resultado', etapa, fecha: '2026-03-10' }))),
  ]
  return { casos, eventos }
}

const POR_ESCENARIO = { 11: datos(8), 30: datos(5), 50: datos(2) }

function fetchFalso() {
  return vi.fn(async (url) => {
    const n = Number(url.match(/casos_(\d+)\.json/)[1])
    return { ok: true, json: async () => POR_ESCENARIO[n] }
  })
}

describe('Comparar escenarios (HU10)', () => {
  it('lee los 3 archivos y muestra 3 columnas con embudo y % final', async () => {
    const f = fetchFalso()
    render(<ComparaEscenariosPage fetchImpl={f} />)
    expect(screen.getByRole('heading', { name: 'Escenarios de pérdida' })).toBeInTheDocument()
    const col11 = within(await screen.findByRole('article', { name: 'Pérdida de 11 % en cada paso' }))
    const col30 = within(screen.getByRole('article', { name: 'Pérdida de 30 % en cada paso' }))
    const col50 = within(screen.getByRole('article', { name: 'Pérdida de 50 % en cada paso' }))
    expect(f.mock.calls.map(([u]) => u)).toEqual(['/data/casos_11.json', '/data/casos_30.json', '/data/casos_50.json'])

    expect(col11.getByText('80 %')).toBeInTheDocument()
    expect(col30.getByText('50 %')).toBeInTheDocument()
    expect(col50.getByText('20 %')).toBeInTheDocument()
    expect(col11.getAllByRole('listitem')).toHaveLength(5)
    expect(col11.getByText('1. Tamizaje')).toBeInTheDocument()
    // Cifras menores de 5 enmascaradas.
    expect(col50.getAllByText(/menos de 5/).length).toBeGreaterThan(0)
  })

  it('lleva "Datos simulados" y la frase de cierre', async () => {
    render(<ComparaEscenariosPage fetchImpl={fetchFalso()} />)
    expect(await screen.findByText('Hoy no se sabe dónde se pierden. Con SIMORI, se sabría cada semana.')).toBeInTheDocument()
    expect(screen.getAllByText('Datos simulados').length).toBeGreaterThan(0)
  })

  it('sin los archivos muestra un aviso', async () => {
    render(<ComparaEscenariosPage fetchImpl={vi.fn(async () => ({ ok: false }))} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron leer los escenarios')
  })

  it('con la fecha muestra el desglose, el % de pérdida, la aclaración del % y la nota del embudo', async () => {
    render(<ComparaEscenariosPage hoyISO="2026-11-14" fetchImpl={fetchFalso()} />)
    const col = within(await screen.findByRole('article', { name: 'Pérdida de 11 % en cada paso' }))
    expect(col.getByText('De 10 positivos:')).toBeInTheDocument()
    const lista = within(col.getByRole('list', { name: 'Desglose con pérdida de 11 %' }))
    // 8 llegaron a clasificación pero siguen en seguimiento (sin evento de salida): no cuentan como completados.
    expect(lista.getByText(/completaron su evaluación/)).toBeInTheDocument()
    expect(lista.getByText(/siguen a tiempo \(aún no les toca su cita\)/)).toBeInTheDocument()
    expect(lista.getByText(/van con retraso/)).toBeInTheDocument()
    expect(lista.getByText(/sin seguimiento/)).toBeInTheDocument()
    expect(col.getByText(/Cuenta a todos los positivos, incluidos los que aún esperan su cita/)).toBeInTheDocument()
    expect(
      col.getByText('El embudo baja también por las altas en la confirmación y por los casos a los que aún no les toca su cita.'),
    ).toBeInTheDocument()
  })

  it('sin la fecha no muestra el desglose', async () => {
    render(<ComparaEscenariosPage fetchImpl={fetchFalso()} />)
    const col = within(await screen.findByRole('article', { name: 'Pérdida de 11 % en cada paso' }))
    expect(col.queryByText(/positivos:/)).not.toBeInTheDocument()
  })
})
