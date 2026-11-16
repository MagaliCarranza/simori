import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { MapaPage } from './MapaPage.jsx'
import { edificiosEscolares, textoEdificio } from './panelLocalidad.js'

// jsdom no dibuja Leaflet. El mapa falso guarda su zoom y el manejador de
// zoomend para simular que la persona acerca o aleja el mapa.
const falso = vi.hoisted(() => ({ zoom: 13, zoomend: null }))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null,
  CircleMarker: ({ children }) => <div data-testid="marcador">{children}</div>,
  Marker: ({ children, title, icon, eventHandlers }) => (
    <div data-testid="marcador-icono" data-clase={icon?.options?.className} title={title} onClick={eventHandlers?.click}>
      {children}
    </div>
  ),
  Tooltip: ({ children, permanent }) => (
    <span data-testid="etiqueta" data-permanente={String(Boolean(permanent))}>
      {children}
    </span>
  ),
  useMapEvents: (manejadores) => {
    falso.zoomend = manejadores.zoomend
    return { getZoom: () => falso.zoom }
  },
}))

const HOY = '2026-11-14'
const supervisor = { id: 'USR-SUP-JAL', rol: 'supervision', clues: null }
const fetchSinDatos = () => Promise.resolve({ ok: false })

let db
let n = 0

const escuela = (cct, nombre, turno, claveInegi, lat, lng, ubicacionAproximada = false) => ({
  cct,
  nombre,
  turno,
  claveInegi,
  matricula: 100,
  lat,
  lng,
  ubicacionAproximada,
})

// Como el CSV real: en Agua Caliente las dos primarias comparten edificio y la
// telesecundaria está aparte; en Chalpicote una escuela sigue aproximada.
const ESCUELAS = [
  escuela('14DPR1710G', 'Emiliano Zapata', 'matutino', '140660002', 20.312389, -102.929),
  escuela('14DPR3931E', 'Emiliano Zapata', 'vespertino', '140660002', 20.312389, -102.929),
  escuela('14DTV0442U', 'Adolfo Lopez Mateos', 'matutino', '140660002', 20.311194, -102.925028),
  escuela('14DPR3594U', 'Emiliano Zapata', 'matutino', '140660043', 20.310201, -102.919552, true),
]

beforeEach(async () => {
  falso.zoom = 13
  falso.zoomend = null
  db = crearDb(`test-mapa-escuelas-${n++}`)
  await db.localidades.bulkAdd([
    { claveInegi: '140660002', nombre: 'Agua Caliente', lat: 20.312568, lng: -102.928629, enAlcance: true, cluesOperativo: 'JCSSA004213' },
    { claveInegi: '140660043', nombre: 'Chalpicote', lat: 20.310201, lng: -102.919552, enAlcance: true, cluesOperativo: 'JCSSA004213' },
  ])
  await db.escuelas.bulkAdd(ESCUELAS)
  await db.centrosSalud.add({ clues: 'JCSSA004213', nombre: 'CENTRO DE SALUD SAN PEDRO ITZICAN', claveInegi: '140660031', lat: 20.3169, lng: -102.9543 })
})

afterEach(async () => {
  await db.delete()
})

const rombos = () => screen.queryAllByTestId('marcador-icono').filter((m) => m.dataset.clase === 'mapa__icono-escuela')

async function abrir() {
  render(<MapaPage hoyISO={HOY} usuario={supervisor} db={db} fetchImpl={fetchSinDatos} />)
  await screen.findByRole('navigation', { name: 'Localidades' })
}

function acercar(zoom) {
  falso.zoom = zoom
  act(() => falso.zoomend())
}

describe('edificios escolares', () => {
  it('agrupa por coordenada: dos turnos en el mismo edificio son un solo punto', () => {
    const edificios = edificiosEscolares(ESCUELAS)
    expect(edificios).toHaveLength(2)
    const compartido = edificios.find((e) => e.escuelas.length === 2)
    expect(compartido.escuelas.map((e) => e.cct)).toEqual(['14DPR1710G', '14DPR3931E'])
    expect(compartido.claveInegi).toBe('140660002')
  })

  it('no incluye escuelas con ubicación aproximada ni sin coordenadas', () => {
    const edificios = edificiosEscolares([...ESCUELAS, escuela('X', 'Sin dato', 'matutino', '140660002', null, null)])
    const ccts = edificios.flatMap((e) => e.escuelas.map((x) => x.cct))
    expect(ccts).not.toContain('14DPR3594U')
    expect(ccts).not.toContain('X')
  })

  it('el texto junta turnos de la misma escuela y separa escuelas distintas', () => {
    const [compartido] = edificiosEscolares(ESCUELAS.slice(0, 2))
    expect(textoEdificio(compartido)).toBe('Emiliano Zapata (matutino y vespertino)')
    const distintas = {
      escuelas: [
        { nombre: 'Emiliano Zapata', turno: 'matutino' },
        { nombre: 'Gonzalo Chapela y Blanco', turno: 'vespertino' },
      ],
    }
    expect(textoEdificio(distintas)).toBe('Emiliano Zapata (matutino) y Gonzalo Chapela y Blanco (vespertino)')
  })
})

describe('MapaPage con escuelas', () => {
  it('con el zoom inicial no dibuja rombos; desde zoom 16 dibuja uno por edificio', async () => {
    await abrir()
    expect(rombos()).toHaveLength(0)
    acercar(15)
    expect(rombos()).toHaveLength(0)
    acercar(16)
    expect(rombos().map((r) => r.title).sort()).toEqual([
      'Escuela: Adolfo Lopez Mateos (matutino)',
      'Escuela: Emiliano Zapata (matutino y vespertino)',
    ])
  })

  it('los rombos no llevan etiqueta fija', async () => {
    await abrir()
    acercar(16)
    for (const r of rombos()) {
      expect(within(r).getByTestId('etiqueta')).toHaveAttribute('data-permanente', 'false')
    }
  })

  it('al tocar un rombo se abre el panel de su localidad', async () => {
    await abrir()
    acercar(16)
    fireEvent.click(rombos()[0])
    expect(screen.getByRole('button', { name: 'Agua Caliente' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('la leyenda muestra Escuela y el panel cita la fuente de la ubicación', async () => {
    await abrir()
    expect(screen.getByRole('list', { name: 'Símbolos del mapa' })).toHaveTextContent('Escuela (acerca el mapa para verlas)')
    fireEvent.click(screen.getByRole('button', { name: 'Agua Caliente' }))
    const panel = within(document.querySelector('.mapa__panel'))
    expect(panel.getByText(/Ubicación de las escuelas: SEP, consultado en escuelasmex\.com\./)).toBeInTheDocument()
    expect(panel.queryByText(/Ubicación aproximada: las escuelas/)).not.toBeInTheDocument()
    expect(panel.queryByText(/DENUE/)).not.toBeInTheDocument()
  })

  it('una localidad con escuelas aproximadas conserva su nota', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Chalpicote' }))
    const panel = within(document.querySelector('.mapa__panel'))
    expect(panel.getByText(/Ubicación aproximada: las escuelas se muestran en el punto de su localidad/)).toBeInTheDocument()
  })
})
