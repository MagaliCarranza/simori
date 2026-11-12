import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { MapaPage } from './MapaPage.jsx'

// jsdom no dibuja Leaflet: se sustituye por componentes simples. El marcador
// se vuelve un elemento con clic (no un botón, para no confundirlo con la lista).
const capturado = vi.hoisted(() => ({ tile: null, mapa: null }))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, ...props }) => {
    capturado.mapa = props
    return <div data-testid="mapa">{children}</div>
  },
  TileLayer: (props) => {
    capturado.tile = props
    return null
  },
  CircleMarker: ({ children, eventHandlers }) => (
    <div data-testid="marcador" onClick={eventHandlers?.click}>
      {children}
    </div>
  ),
  Tooltip: ({ children }) => <span>{children}</span>,
}))

const HOY = '2026-11-14'
const supervisor = { id: 'USR-SUP-JAL', rol: 'supervision', clues: null }

let db
let n = 0

function caso(codigo, cct, extra = {}) {
  return {
    codigo,
    codigoNino: codigo.replace('PON', 'NIN'),
    cct,
    clues: 'PROV-AC-01',
    fechaTamizaje: '2026-09-01',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: '2026-12-01',
    simulado: true,
    ...extra,
  }
}

// Agua Caliente: 5 verdes y 3 rojos. San Pedro: 6 verdes. Chalpicote: sin casos.
async function sembrar() {
  await db.localidades.bulkAdd([
    { claveInegi: '140660002', nombre: 'Agua Caliente', gradoMarginacion: 'Medio', poblacion5a14: 445, lat: 20.312568, lng: -102.928629 },
    { claveInegi: '140660031', nombre: 'San Pedro Itzicán', gradoMarginacion: 'Medio', poblacion5a14: 1954, lat: 20.315556, lng: -102.951944 },
    { claveInegi: '140660043', nombre: 'Chalpicote', gradoMarginacion: 'Alto', poblacion5a14: 276, lat: 20.310201, lng: -102.919552 },
  ])
  await db.escuelas.bulkAdd([
    { cct: '14DPR1710G', nombre: 'Emiliano Zapata', turno: 'matutino', claveInegi: '140660002', matricula: 157, ubicacionAproximada: true },
    { cct: '14DPR0001A', nombre: 'Miguel Hidalgo', turno: 'matutino', claveInegi: '140660031', matricula: 90, ubicacionAproximada: true },
  ])
  await db.centrosSalud.bulkAdd([
    { clues: 'PROV-AC-01', nombre: 'Centro de Salud Agua Caliente (provisional)', claveInegi: '140660002', provisional: true },
  ])
  await db.casos.bulkAdd([
    ...Array.from({ length: 5 }, (_, i) => caso(`PON-AC-000${i + 1}`, '14DPR1710G')),
    ...Array.from({ length: 3 }, (_, i) => caso(`PON-AC-010${i + 1}`, '14DPR1710G', { fechaProximaCita: '2026-10-01' })),
    ...Array.from({ length: 6 }, (_, i) => caso(`PON-SPI-000${i + 1}`, '14DPR0001A')),
  ])
}

const localidad = (nombre) =>
  within(screen.getByRole('navigation', { name: 'Localidades' })).getByRole('button', { name: nombre })
const panel = () => within(document.querySelector('.mapa__panel'))
const valor = (termino) => panel().getByText(termino).closest('div').querySelector('dd').textContent

beforeEach(async () => {
  db = crearDb(`test-mapa-${n++}`)
  await sembrar()
  capturado.tile = null
  capturado.mapa = null
})

afterEach(async () => {
  await db.delete()
})

async function abrir() {
  render(<MapaPage hoyISO={HOY} usuario={supervisor} db={db} />)
  await screen.findByRole('navigation', { name: 'Localidades' })
}

describe('MapaPage (HU09, RF10)', () => {
  it('lista de localidades con botones y un marcador por localidad', async () => {
    await abrir()
    const lista = within(screen.getByRole('navigation', { name: 'Localidades' }))
    expect(lista.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Agua Caliente',
      'Chalpicote',
      'San Pedro Itzicán',
    ])
    expect(screen.getAllByTestId('marcador')).toHaveLength(3)
    expect(screen.getByText('Elige una localidad en la lista o en el mapa.')).toBeInTheDocument()
  })

  it('la lista abre el panel con datos reales, fuentes y pendientes simulados', async () => {
    await abrir()
    const boton = localidad('Agua Caliente')
    fireEvent.click(boton)
    expect(boton).toHaveAttribute('aria-pressed', 'true')

    expect(panel().getByRole('heading', { name: 'Agua Caliente' })).toBeInTheDocument()
    expect(valor('Grado de marginación')).toBe('Medio')
    expect(valor('Población de 5 a 14 años')).toBe('445')
    expect(panel().getByText(/CONAPO, Índice de marginación por localidad 2020/)).toBeInTheDocument()
    expect(panel().getByText(/Censo 2020 ITER por localidad/)).toBeInTheDocument()
    expect(panel().getByText(/SEJ \/ SEP, Estadísticas educativas/)).toBeInTheDocument()

    expect(panel().getByText(/Emiliano Zapata/)).toBeInTheDocument()
    expect(panel().getByText('157')).toBeInTheDocument()
    expect(panel().getByText(/Ubicación aproximada/)).toBeInTheDocument()
    expect(panel().getByText('Centro provisional')).toBeInTheDocument()

    expect(panel().getByText('Datos simulados')).toBeInTheDocument()
    expect(valor('Total de positivos')).toBe('8')
    expect(valor('En seguimiento')).toBe('8')
    expect(valor('Verde')).toBe('5')
    expect(valor('Amarillo')).toBe('protegido')
    expect(valor('Rojo')).toBe('protegido')
    expect(valor('Sin seguimiento')).toBe('protegido')
  })

  it('el marcador abre el mismo panel', async () => {
    await abrir()
    const marcador = screen.getAllByTestId('marcador').find((m) => m.textContent === 'San Pedro Itzicán')
    fireEvent.click(marcador)
    expect(panel().getByRole('heading', { name: 'San Pedro Itzicán' })).toBeInTheDocument()
    expect(valor('Verde')).toBe('6')
    expect(localidad('San Pedro Itzicán')).toHaveAttribute('aria-pressed', 'true')
  })

  it('una localidad sin casos muestra "menos de 5"', async () => {
    await abrir()
    fireEvent.click(localidad('Chalpicote'))
    expect(valor('Total de positivos')).toBe('menos de 5')
    expect(valor('Rojo')).toBe('menos de 5')
    expect(panel().getByText('Sin centro de salud registrado.')).toBeInTheDocument()
  })

  it('no muestra códigos de caso ni de niño', async () => {
    await abrir()
    for (const nombre of ['Agua Caliente', 'Chalpicote', 'San Pedro Itzicán']) {
      fireEvent.click(localidad(nombre))
      expect(document.body.textContent).not.toMatch(/PON-|NIN-/)
    }
  })

  it('mosaicos de OpenStreetMap con atribución, CORS y zoom limitado', async () => {
    await abrir()
    expect(capturado.tile.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    expect(capturado.tile.attribution).toMatch(/OpenStreetMap/)
    expect(capturado.tile.crossOrigin).toBe(true)
    expect(capturado.mapa.minZoom).toBe(12)
    expect(capturado.mapa.maxZoom).toBe(17)
    expect(capturado.mapa.maxBounds).toBeTruthy()
  })

  it('registra una entrada de bitácora con entidadId "mapa"', async () => {
    await abrir()
    await waitFor(async () => expect(await db.bitacora.count()).toBe(1))
    const [entrada] = await db.bitacora.toArray()
    expect(entrada).toMatchObject({ rol: 'supervision', accion: 'consultar', entidad: 'supervision', entidadId: 'mapa' })
  })
})
