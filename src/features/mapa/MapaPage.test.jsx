import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  CircleMarker: ({ children, eventHandlers, pathOptions }) => (
    <div
      data-testid="marcador"
      data-color={pathOptions.color}
      data-grosor={pathOptions.weight}
      onClick={eventHandlers?.click}
    >
      {children}
    </div>
  ),
  Marker: ({ children, position, title }) => (
    <div data-testid="marcador-centro" data-lat={position[0]} title={title}>
      {children}
    </div>
  ),
  Tooltip: ({ children, permanent, direction }) => (
    <span data-testid="etiqueta-marcador" data-permanente={String(Boolean(permanent))} data-direccion={direction}>
      {children}
    </span>
  ),
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
    clues: 'JCSSA004213',
    fechaTamizaje: '2026-09-01',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: '2026-12-01',
    simulado: true,
    ...extra,
  }
}

// Imita el catálogo real (PR #19): fila "Total del Municipio" sin coordenadas,
// localidades fuera de alcance con coordenadas y un centro que atiende a una
// localidad desde otra. Agua Caliente: 5 verdes y 3 rojos. San Pedro: 6 verdes.
// Chalpicote: sin casos, atendida por un centro con ubicación aproximada.
async function sembrar() {
  await db.localidades.bulkAdd([
    { claveInegi: '140660000', nombre: 'Total del Municipio', poblacion5a14: 11635, lat: null, lng: null, enAlcance: false, cluesOperativo: null, distanciaKm: null },
    { claveInegi: '140669998', nombre: 'Localidades de una vivienda', lat: null, lng: null, enAlcance: false, cluesOperativo: null },
    { claveInegi: '140660001', nombre: 'Poncitlán', gradoMarginacion: 'Bajo', lat: 20.379, lng: -102.927, enAlcance: false, cluesOperativo: 'JCSSA004143', distanciaKm: 0 },
    { claveInegi: '140660002', nombre: 'Agua Caliente', gradoMarginacion: 'Medio', poblacion5a14: 445, im2020: 19.54, distanciaKm: 2.72, matricula: 415, pctHLI: 0, lat: 20.312568, lng: -102.928629, enAlcance: true, cluesOperativo: 'JCSSA004213' },
    { claveInegi: '140660031', nombre: 'San Pedro Itzicán', gradoMarginacion: 'Medio', poblacion5a14: 1954, im2020: 19.76, distanciaKm: 0, matricula: 1452, pctHLI: 0.033, lat: 20.315556, lng: -102.951944, enAlcance: true, cluesOperativo: 'JCSSA004213' },
    { claveInegi: '140660043', nombre: 'Chalpicote', gradoMarginacion: 'Alto', poblacion5a14: 276, im2020: 18.57, distanciaKm: 3.7, matricula: 173, pctHLI: 0.132, lat: 20.310201, lng: -102.919552, enAlcance: true, cluesOperativo: 'JCSSA004184' },
  ])
  await db.escuelas.bulkAdd([
    { cct: '14DPR1710G', nombre: 'Emiliano Zapata', turno: 'matutino', claveInegi: '140660002', matricula: 157, ubicacionAproximada: true },
    { cct: '14DPR0001A', nombre: 'Miguel Hidalgo', turno: 'matutino', claveInegi: '140660031', matricula: 90, ubicacionAproximada: true },
  ])
  await db.centrosSalud.bulkAdd([
    { clues: 'JCSSA004213', nombre: 'CENTRO DE SALUD SAN PEDRO ITZICAN', institucion: 'SSA', claveInegi: '140660031', lat: 20.31693929, lng: -102.95432655, ubicacionAproximada: false },
    { clues: 'JCSSA004184', nombre: 'CENTRO DE SALUD SANTA CRUZ', institucion: 'SSA', claveInegi: '140660025', lat: 20.33, lng: -102.9, ubicacionAproximada: true },
    { clues: 'JCSSA004143', nombre: 'CENTRO DE SALUD PONCITLAN', institucion: 'SSA', claveInegi: '140660001', lat: 20.37910216, lng: -102.92780975, ubicacionAproximada: false },
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
// Etiquetas de los marcadores de localidad (los centros tienen las suyas).
const etiquetasLocalidad = () =>
  screen.getAllByTestId('marcador').map((m) => within(m).getByTestId('etiqueta-marcador'))
const valor = (termino) => panel().getByText(termino).closest('div').querySelector('dd').textContent

beforeEach(async () => {
  db = crearDb(`test-mapa-${n++}`)
  await sembrar()
  capturado.tile = null
  capturado.mapa = null
})

afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})

async function abrir(fetchImpl) {
  render(<MapaPage hoyISO={HOY} usuario={supervisor} db={db} {...(fetchImpl ? { fetchImpl } : {})} />)
  await screen.findByRole('navigation', { name: 'Localidades' })
}

// Marco amplio ficticio pero plausible: 3 en alcance + 1 extra que amplía
// los rangos lo suficiente para que las normalizadas no colapsen a {0, 1}.
const MARCO_FICTICIO = [
  { claveInegi: '140660002', nombre: 'Agua Caliente', im2020: 19.54, distanciaKm: 2.72, matricula: 415, pctHLI: 0, gradoMarginacion: 'Medio', enAlcance: true },
  { claveInegi: '140660031', nombre: 'San Pedro Itzicán', im2020: 19.76, distanciaKm: 0, matricula: 1452, pctHLI: 0.033, gradoMarginacion: 'Medio', enAlcance: true },
  { claveInegi: '140660043', nombre: 'Chalpicote', im2020: 18.57, distanciaKm: 3.7, matricula: 173, pctHLI: 0.132, gradoMarginacion: 'Alto', enAlcance: true },
  { claveInegi: '140660099', nombre: 'Otra lejana', im2020: 24, distanciaKm: 8, matricula: 1800, pctHLI: 0.22, enAlcance: false },
]

// fetch que responde al marco con datos; el resto devuelve 404.
function fetchConMarco(datos = MARCO_FICTICIO) {
  return vi.fn(async (url) => {
    if (url === '/data/localidades_marco.json') {
      return { ok: true, json: async () => datos }
    }
    return { ok: false, status: 404, json: async () => null }
  })
}

// fetch que siempre rechaza: simula estar sin red y sin precache.
function fetchSinRed() {
  return vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
}

describe('MapaPage (HU09, RF10)', () => {
  it('solo localidades en alcance: sin "Total del Municipio" ni localidades fuera de la zona', async () => {
    await abrir()
    for (const nombre of ['Total del Municipio', 'Localidades de una vivienda', 'Poncitlán']) {
      expect(screen.queryByText(nombre)).not.toBeInTheDocument()
    }
  })

  it('marca con otro símbolo solo los centros que atienden a las localidades en alcance', async () => {
    await abrir()
    const centros = screen.getAllByTestId('marcador-centro')
    expect(centros.map((c) => c.textContent)).toEqual([
      'CENTRO DE SALUD SAN PEDRO ITZICAN · CLUES JCSSA004213',
      'CENTRO DE SALUD SANTA CRUZ · CLUES JCSSA004184',
    ])
    expect(centros[0]).toHaveAttribute('title', 'Centro de salud: CENTRO DE SALUD SAN PEDRO ITZICAN')
    expect(screen.getByRole('list', { name: 'Símbolos del mapa' })).toHaveTextContent('Centro de salud')
  })

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
    expect(panel().getByText('CENTRO DE SALUD SAN PEDRO ITZICAN')).toBeInTheDocument()
    expect(valor('CLUES')).toBe('JCSSA004213')
    expect(valor('Institución')).toBe('SSA')
    expect(valor('Distancia')).toBe('A 2.7 km')
    expect(panel().queryByText(/provisional/i)).not.toBeInTheDocument()

    expect(panel().getByText('Datos simulados')).toBeInTheDocument()
    expect(valor('Total de positivos')).toBe('8')
    expect(valor('En seguimiento')).toBe('8')
    expect(valor('Verde')).toBe('5')
    expect(valor('Amarillo')).toBe('protegido')
    expect(valor('Rojo')).toBe('protegido')
    expect(valor('Sin seguimiento')).toBe('protegido')
  })

  it('cada marcador lleva su nombre siempre visible', async () => {
    await abrir()
    const etiquetas = etiquetasLocalidad()
    expect(etiquetas.map((e) => e.textContent).sort()).toEqual(['Agua Caliente', 'Chalpicote', 'San Pedro Itzicán'])
    for (const e of etiquetas) expect(e).toHaveAttribute('data-permanente', 'true')
  })

  it('Chalpicote y San Pedro Itzicán llevan la etiqueta abajo y Agua Caliente arriba (no tapan ni se enciman)', async () => {
    await abrir()
    const direccion = Object.fromEntries(
      etiquetasLocalidad().map((e) => [e.textContent, e.dataset.direccion]),
    )
    expect(direccion).toEqual({ Chalpicote: 'bottom', 'Agua Caliente': 'top', 'San Pedro Itzicán': 'bottom' })
  })

  it('los marcadores son turquesa; el elegido, turquesa más oscuro y borde más grueso, sin naranja ni rojo', async () => {
    await abrir()
    fireEvent.click(localidad('Chalpicote'))
    const marcadores = screen.getAllByTestId('marcador')
    const elegido = marcadores.find((m) => m.textContent === 'Chalpicote')
    const otro = marcadores.find((m) => m.textContent === 'Agua Caliente')
    expect(otro.dataset.color).toBe('#0e6670')
    expect(elegido.dataset.color).toBe('#0a525a')
    expect(Number(elegido.dataset.grosor)).toBeGreaterThan(Number(otro.dataset.grosor))
    // Ni coral, ni rojo del semáforo, ni naranja.
    for (const m of marcadores) expect(m.dataset.color).not.toMatch(/^#(c93a47|e8505b|8f1414|c2410c)$/i)
  })

  it('el marcador abre el mismo panel', async () => {
    await abrir()
    const marcador = screen.getAllByTestId('marcador').find((m) => m.textContent === 'San Pedro Itzicán')
    fireEvent.click(marcador)
    expect(panel().getByRole('heading', { name: 'San Pedro Itzicán' })).toBeInTheDocument()
    expect(valor('Verde')).toBe('6')
    expect(valor('Distancia')).toBe('En la misma localidad')
    expect(localidad('San Pedro Itzicán')).toHaveAttribute('aria-pressed', 'true')
  })

  it('una localidad sin casos muestra "menos de 5"', async () => {
    await abrir()
    fireEvent.click(localidad('Chalpicote'))
    expect(valor('Total de positivos')).toBe('menos de 5')
    expect(valor('Rojo')).toBe('menos de 5')
    expect(panel().getByText('CENTRO DE SALUD SANTA CRUZ')).toBeInTheDocument()
    expect(valor('Distancia')).toBe('A 3.7 km')
    expect(panel().getByText('Ubicación aproximada')).toBeInTheDocument()
  })

  it('muestra el grupo k-means de la localidad con su nota', async () => {
    const grupos = {
      kElegida: 3,
      grupos: [{ grupo: 1, tamano: 13, descripcion: 'marginación más alta del municipio, más lejos de la unidad de salud' }],
      localidades: [{ claveInegi: '140660043', grupo: 1 }],
    }
    const fetchImpl = vi.fn((ruta) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(ruta.includes('grupos_localidades') ? grupos : []) }),
    )
    await abrir(fetchImpl)
    fireEvent.click(localidad('Chalpicote'))
    expect(
      await panel().findByText(
        'Grupo 1 de 3: marginación más alta del municipio, más lejos de la unidad de salud ' +
          '(otras 12 localidades con perfil parecido)',
      ),
    ).toBeInTheDocument()
    expect(
      panel().getByText('Agrupación con k-means (aprendizaje automático); comparada con el promedio del municipio'),
    ).toBeInTheDocument()

    fireEvent.click(localidad('Agua Caliente'))
    expect(panel().queryByText(/^Grupo \d+ de/)).not.toBeInTheDocument()
  })

  describe('índice de prioridad y marco amplio', () => {
    it('con localidades_marco.json disponible, el panel de Chalpicote pinta nivel, lugar y razón del índice', async () => {
      // El marco de prueba es ficticio; el puntaje exacto depende del marco
      // real (0.52 con el JSON de producción). La prueba fija la forma de la
      // línea y los campos que sí dependen de la lógica, no de los valores
      // numéricos del marco particular.
      await abrir(fetchConMarco())
      fireEvent.click(localidad('Chalpicote'))
      await waitFor(() => {
        expect(panel().getByText(/Prioridad media · 1\.º de 3 en el alcance · puntaje 0\.\d{2}/)).toBeInTheDocument()
      })
      expect(panel().getByText(/Marginación alta/)).toBeInTheDocument()
      expect(panel().queryByText(/Prioridad no disponible/)).not.toBeInTheDocument()
    })

    it('sin red y sin precache: el panel muestra "Prioridad no disponible sin conexión" y el resto sigue funcionando', async () => {
      const fetchImpl = fetchSinRed()
      await abrir(fetchImpl)
      fireEvent.click(localidad('Chalpicote'))
      // Espera a que el estado de carga termine y se pinte el aviso.
      await waitFor(() => expect(panel().getByText('Prioridad no disponible sin conexión')).toBeInTheDocument())
      // Nada de puntajes pintados: el índice no se calcula con las 3.
      expect(panel().queryByText(/puntaje \d/)).not.toBeInTheDocument()
      expect(panel().queryByText(/Prioridad (alta|media|baja) /)).not.toBeInTheDocument()
      // El resto del panel sigue mostrando datos.
      expect(panel().getByRole('heading', { name: 'Chalpicote' })).toBeInTheDocument()
      expect(valor('Grado de marginación')).toBe('Alto')
      expect(valor('Población de 5 a 14 años')).toBe('276')
      // Se intentó cargar el marco (confirma que no fue silencioso por omitir el fetch).
      expect(fetchImpl).toHaveBeenCalledWith('/data/localidades_marco.json')
    })

    it('mientras el marco está cargando no se muestra el aviso de "no disponible"', async () => {
      // Promesa pendiente: estado "cargando" sin resolver nunca.
      const fetchImpl = vi.fn(() => new Promise(() => {}))
      await abrir(fetchImpl)
      fireEvent.click(localidad('Chalpicote'))
      expect(panel().queryByText('Prioridad no disponible sin conexión')).not.toBeInTheDocument()
      expect(panel().queryByText(/puntaje \d/)).not.toBeInTheDocument()
    })
  })

  it('si grupos_localidades.json no carga, el panel no muestra el grupo y no falla', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('sin red')))
    await abrir(fetchImpl)
    fireEvent.click(localidad('Chalpicote'))
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledWith('/data/grupos_localidades.json'))
    expect(panel().getByRole('heading', { name: 'Chalpicote' })).toBeInTheDocument()
    expect(panel().queryByText(/^Grupo \d+ de/)).not.toBeInTheDocument()
    expect(panel().queryByText(/k-means/)).not.toBeInTheDocument()
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

  describe('aviso sin conexión', () => {
    const AVISO = 'Sin conexión: el mapa muestra solo los puntos.'
    const mosaico = (evento) => act(() => capturado.tile.eventHandlers[evento]())

    it('un solo mosaico que falla no muestra el aviso', async () => {
      await abrir()
      mosaico('tileerror')
      expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    })

    it('varios mosaicos seguidos que fallan lo muestran; uno que carga lo quita', async () => {
      await abrir()
      mosaico('tileerror')
      mosaico('tileerror')
      expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
      mosaico('tileerror')
      expect(screen.getByText(AVISO)).toBeInTheDocument()
      mosaico('tileload')
      expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    })

    it('fallos sueltos entre mosaicos que cargan no lo muestran', async () => {
      await abrir()
      mosaico('tileerror')
      mosaico('tileerror')
      mosaico('tileload')
      mosaico('tileerror')
      expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    })

    it('sin red se muestra desde el inicio y el panel sigue funcionando', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      await abrir()
      expect(screen.getByText(AVISO)).toBeInTheDocument()
      fireEvent.click(localidad('Agua Caliente'))
      expect(valor('Total de positivos')).toBe('8')
    })

    it('se actualiza con los eventos online y offline', async () => {
      const enLinea = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
      await abrir()
      expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
      enLinea.mockReturnValue(false)
      act(() => window.dispatchEvent(new Event('offline')))
      expect(screen.getByText(AVISO)).toBeInTheDocument()
      enLinea.mockReturnValue(true)
      act(() => window.dispatchEvent(new Event('online')))
      expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    })
  })
})
