import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { MisVisitasPage } from '../campo/MisVisitasPage.jsx'
import { elegirVoz, LIMITE_INICIO_MS } from './useLectorVoz.js'

const HOY = '2026-11-14'
const campo = { id: 'USR-CAM-AC', rol: 'campo', clues: 'PROV-AC-01' }

let db
let n = 0

class FraseFalsa {
  constructor(text) {
    this.text = text
  }
}

const VOCES_LOCALES = [
  { name: 'Inglés', lang: 'en-US', localService: true },
  { name: 'España', lang: 'es-ES', localService: true },
  { name: 'México', lang: 'es-MX', localService: true },
]

// Simula speechSynthesis. Como Chrome, al cancelar una frase en curso dispara
// su onerror con 'interrupted'. `cargarVoces` simula el evento voiceschanged.
function instalarVoz(voces = VOCES_LOCALES) {
  let lista = voces
  let enCurso = null
  const oyentes = new Set()
  const sintesis = {
    speak: vi.fn((frase) => {
      enCurso = frase
    }),
    cancel: vi.fn(() => {
      const f = enCurso
      enCurso = null
      f?.onerror?.({ error: 'interrupted' })
    }),
    getVoices: () => lista,
    addEventListener: (tipo, fn) => tipo === 'voiceschanged' && oyentes.add(fn),
    removeEventListener: (tipo, fn) => oyentes.delete(fn),
    cargarVoces(nuevas) {
      lista = nuevas
      oyentes.forEach((fn) => fn())
    },
    frase: () => sintesis.speak.mock.calls.at(-1)?.[0],
  }
  window.speechSynthesis = sintesis
  window.SpeechSynthesisUtterance = FraseFalsa
  return sintesis
}

const MENSAJE_FALLO = 'No se pudo reproducir el audio en este equipo. Lee el aviso en voz alta a la familia.'

function quitarVoz() {
  delete window.speechSynthesis
  delete window.SpeechSynthesisUtterance
}

beforeEach(async () => {
  db = crearDb(`test-aviso-familia-${n++}`)
  await db.escuelas.add({ cct: '14DPR1710G', nombre: 'Emiliano Zapata', claveInegi: '140660002' })
  await db.centrosSalud.add({ clues: 'PROV-AC-01', nombre: 'Centro de Salud Agua Caliente', claveInegi: '140660002' })
  await db.casos.add({
    codigo: 'PON-AC-0001',
    codigoNino: 'NIN-AC-0001',
    cct: '14DPR1710G',
    clues: 'PROV-AC-01',
    fechaTamizaje: '2026-01-10',
    etapaActual: 1,
    estado: 'en_seguimiento',
    fechaProximaCita: '2026-10-01', // ya pasó: rojo
    simulado: true,
  })
})

afterEach(async () => {
  vi.useRealTimers()
  quitarVoz()
  vi.restoreAllMocks()
  await db.delete()
})

async function abrirAviso() {
  render(<MisVisitasPage usuario={campo} hoyISO={HOY} db={db} />)
  const codigo = await screen.findByText('PON-AC-0001')
  const t = within(codigo.closest('li'))
  fireEvent.click(t.getByRole('button', { name: 'Aviso a la familia' }))
  return within(t.getByRole('region', { name: /Aviso para la familia/ }))
}

describe('Aviso a la familia (HU06)', () => {
  it('muestra la vista previa con lugar y motivo, etiquetada como simulada', async () => {
    const a = await abrirAviso()
    expect(a.getByText('Hola. Le escribimos de Centro de Salud Agua Caliente.')).toBeInTheDocument()
    expect(a.getByText(/tiene pendiente repetir la prueba de orina/)).toBeInTheDocument()
    expect(a.getByText(/para acordar la fecha de su cita/)).toBeInTheDocument()
    expect(a.getByText(/Aunque su niña o niño se vea sano/)).toBeInTheDocument()
    expect(a.getByText('Datos simulados')).toBeInTheDocument()
  })

  it('lee el aviso en voz alta en es-MX y se puede detener', async () => {
    const sintesis = instalarVoz()
    const a = await abrirAviso()
    fireEvent.click(a.getByRole('button', { name: /Escuchar aviso/ }))

    expect(sintesis.speak).toHaveBeenCalledTimes(1)
    const frase = sintesis.speak.mock.calls[0][0]
    expect(frase.lang).toBe('es-MX')
    expect(frase.voice.name).toBe('México')
    expect(frase.text).not.toContain('PON-AC-0001')

    fireEvent.click(a.getByRole('button', { name: /Detener audio/ }))
    expect(sintesis.cancel).toHaveBeenCalled()
    expect(a.getByRole('button', { name: /Escuchar aviso/ })).toBeInTheDocument()
    // Detener provoca 'interrupted': no es una falla del equipo.
    expect(a.queryByText(MENSAJE_FALLO)).not.toBeInTheDocument()
  })

  it('al terminar de leer, el botón regresa a "Escuchar aviso"', async () => {
    const sintesis = instalarVoz()
    const a = await abrirAviso()
    fireEvent.click(a.getByRole('button', { name: /Escuchar aviso/ }))
    act(() => sintesis.frase().onstart())
    act(() => sintesis.frase().onend())
    expect(a.getByRole('button', { name: /Escuchar aviso/ })).toBeInTheDocument()
    expect(a.queryByText(MENSAJE_FALLO)).not.toBeInTheDocument()
  })

  it('si el navegador no tiene voz, lo dice', async () => {
    quitarVoz()
    const a = await abrirAviso()
    expect(a.getByText('Este navegador no puede leer el aviso en voz alta.')).toBeInTheDocument()
  })

  it('sin voces en español no habla con la voz por omisión y avisa', async () => {
    const sintesis = instalarVoz([{ name: 'Inglés', lang: 'en-US', localService: true }])
    const a = await abrirAviso()
    fireEvent.click(a.getByRole('button', { name: /Escuchar aviso/ }))
    expect(sintesis.speak).not.toHaveBeenCalled()
    expect(a.getByRole('alert')).toHaveTextContent(MENSAJE_FALLO)
    expect(a.getByRole('button', { name: /Escuchar aviso/ })).toBeInTheDocument()
  })

  it('espera a que carguen las voces (voiceschanged) antes de elegir', async () => {
    const sintesis = instalarVoz([])
    const a = await abrirAviso()
    fireEvent.click(a.getByRole('button', { name: /Escuchar aviso/ }))
    expect(sintesis.speak).not.toHaveBeenCalled()
    expect(a.getByRole('button', { name: /Detener audio/ })).toBeInTheDocument()

    act(() => sintesis.cargarVoces(VOCES_LOCALES))
    expect(sintesis.speak).toHaveBeenCalledTimes(1)
    expect(sintesis.frase().voice.name).toBe('México')
  })

  it('si la voz falla (onerror), regresa el botón y avisa', async () => {
    const sintesis = instalarVoz()
    const a = await abrirAviso()
    fireEvent.click(a.getByRole('button', { name: /Escuchar aviso/ }))
    act(() => sintesis.frase().onerror({ error: 'network' }))
    expect(a.getByRole('alert')).toHaveTextContent(MENSAJE_FALLO)
    expect(a.getByRole('button', { name: /Escuchar aviso/ })).toBeInTheDocument()
  })

  it('si en unos segundos no empieza a hablar, corta y avisa', async () => {
    const sintesis = instalarVoz()
    const a = await abrirAviso()
    vi.useFakeTimers()
    fireEvent.click(a.getByRole('button', { name: /Escuchar aviso/ }))

    act(() => vi.advanceTimersByTime(LIMITE_INICIO_MS - 1))
    expect(a.queryByText(MENSAJE_FALLO)).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1))
    expect(sintesis.cancel).toHaveBeenCalled()
    expect(a.getByRole('alert')).toHaveTextContent(MENSAJE_FALLO)
    expect(a.getByRole('button', { name: /Escuchar aviso/ })).toBeInTheDocument()
  })

  it('si la lista de voces nunca carga, el tiempo límite también avisa', async () => {
    instalarVoz([])
    const a = await abrirAviso()
    vi.useFakeTimers()
    fireEvent.click(a.getByRole('button', { name: /Escuchar aviso/ }))
    act(() => vi.advanceTimersByTime(LIMITE_INICIO_MS))
    expect(a.getByRole('alert')).toHaveTextContent(MENSAJE_FALLO)
  })

  it('si ya empezó a hablar (onstart), el tiempo límite no corta', async () => {
    const sintesis = instalarVoz()
    const a = await abrirAviso()
    vi.useFakeTimers()
    fireEvent.click(a.getByRole('button', { name: /Escuchar aviso/ }))
    act(() => sintesis.frase().onstart())
    act(() => vi.advanceTimersByTime(LIMITE_INICIO_MS * 3))
    expect(a.queryByText(MENSAJE_FALLO)).not.toBeInTheDocument()
    expect(a.getByRole('button', { name: /Detener audio/ })).toBeInTheDocument()
  })

  it('al volver a escuchar después de una falla, el aviso se quita', async () => {
    const sintesis = instalarVoz()
    const a = await abrirAviso()
    fireEvent.click(a.getByRole('button', { name: /Escuchar aviso/ }))
    act(() => sintesis.frase().onerror({ error: 'synthesis-failed' }))
    expect(a.getByText(MENSAJE_FALLO)).toBeInTheDocument()
    fireEvent.click(a.getByRole('button', { name: /Escuchar aviso/ }))
    expect(a.queryByText(MENSAJE_FALLO)).not.toBeInTheDocument()
  })

  it('pide elegir canal antes de registrar', async () => {
    const a = await abrirAviso()
    fireEvent.click(a.getByRole('button', { name: 'Registrar aviso' }))
    expect(a.getByRole('alert')).toHaveTextContent('Elige cómo le vas a dar el aviso a la familia.')
    expect(await db.avisos.count()).toBe(0)
  })

  it('envío simulado por WhatsApp/SMS y marcar como entregado', async () => {
    const a = await abrirAviso()
    fireEvent.click(a.getByRole('button', { name: 'WhatsApp o SMS (simulado)' }))
    fireEvent.click(a.getByRole('button', { name: 'Enviar (simulado)' }))

    expect(await a.findByRole('status')).toHaveTextContent('no se envió nada real')
    expect(await a.findByText(/Pendiente de entregar/)).toBeInTheDocument()
    const [aviso] = await db.avisos.toArray()
    expect(aviso).toMatchObject({ canal: 'mensaje', estado: 'pendiente', fechaCita: null })

    fireEvent.click(a.getByRole('button', { name: 'Marcar como entregado' }))
    expect(await a.findByText(/Entregado/)).toBeInTheDocument()
    await waitFor(async () => expect((await db.avisos.get(aviso.id)).estado).toBe('entregado'))
  })

  it('al elegir Recado escolar, la vista previa cambia a hoja formal con escuela, código, motivo y cita', async () => {
    const a = await abrirAviso()
    fireEvent.click(a.getByRole('button', { name: 'Recado escolar' }))

    const hoja = a.getByRole('article', { name: /Recado escolar para la familia del código PON-AC-0001/ })
    const h = within(hoja)
    expect(h.getByRole('heading', { name: 'Recado escolar' })).toBeInTheDocument()
    expect(h.getByText('Emiliano Zapata (14DPR1710G)')).toBeInTheDocument()
    expect(h.getByText('Centro de Salud Agua Caliente')).toBeInTheDocument()
    expect(h.getByText(/código PON-AC-0001/)).toBeInTheDocument()
    expect(h.getByText(/tiene pendiente repetir la prueba de orina/)).toBeInTheDocument()
    expect(h.getByText(/para acordar la fecha de su cita/)).toBeInTheDocument()
    expect(h.getByText(/Datos simulados · SIMORI/)).toBeInTheDocument()
    expect(h.queryByText(/Hola\. Le escribimos de/)).not.toBeInTheDocument()
  })

  it('la hoja del recado indica que se entrega en sobre cerrado', async () => {
    const a = await abrirAviso()
    fireEvent.click(a.getByRole('button', { name: 'Recado escolar' }))
    const hoja = within(a.getByRole('article', { name: /Recado escolar/ }))
    expect(hoja.getByText('Entregar en sobre cerrado.')).toBeInTheDocument()
  })

  it('recuerda que las decisiones clínicas son del personal de salud', async () => {
    const a = await abrirAviso()
    expect(
      a.getByText('La herramienta organiza el seguimiento; las decisiones clínicas son del personal de salud.'),
    ).toBeInTheDocument()
  })

  it('con WhatsApp o SMS aclara que el envío es simulado', async () => {
    const a = await abrirAviso()
    expect(a.queryByText(/Envío simulado en el prototipo/)).not.toBeInTheDocument()
    fireEvent.click(a.getByRole('button', { name: 'WhatsApp o SMS (simulado)' }))
    expect(a.getByText('Envío simulado en el prototipo: no se manda nada real.')).toBeInTheDocument()
  })

  it('el recado escolar se imprime', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {})
    const a = await abrirAviso()
    fireEvent.click(a.getByRole('button', { name: 'Recado escolar' }))
    fireEvent.click(a.getByRole('button', { name: 'Imprimir recado' }))
    await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1))
    expect((await db.avisos.toArray())[0].canal).toBe('recado')
  })

  it('aviso en visita del promotor', async () => {
    const a = await abrirAviso()
    fireEvent.click(a.getByRole('button', { name: 'Visita del promotor' }))
    fireEvent.click(a.getByRole('button', { name: 'Registrar aviso en visita' }))
    expect(await a.findByRole('status')).toHaveTextContent('Aviso registrado')
    expect((await db.avisos.toArray())[0].canal).toBe('visita')
  })
})

describe('elegirVoz (local antes que acento)', () => {
  const mxLocal = { name: 'Sabina (es-MX)', lang: 'es_MX', localService: true }
  const esLocal = { name: 'Helena (es-ES)', lang: 'es-ES', localService: true }
  const mxRed = { name: 'Dalia Online (Natural) - Spanish (Mexico)', lang: 'es-MX', localService: false }
  const esRed = { name: 'Google español', lang: 'es-ES', localService: false }
  const usRed = { name: 'Google español de Estados Unidos', lang: 'es-US', localService: false }
  const en = { name: 'English', lang: 'en-US', localService: true }

  it('1.º local es-MX', () => {
    expect(elegirVoz([en, esRed, mxRed, esLocal, mxLocal])).toBe(mxLocal)
  })

  it('2.º local en otro español, antes que es-MX de red', () => {
    expect(elegirVoz([en, esRed, mxRed, esLocal])).toBe(esLocal)
  })

  it('Edge: Dalia Online (es-MX de red) contra una local es-ES gana la local', () => {
    expect(elegirVoz([mxRed, esLocal])).toBe(esLocal)
    expect(elegirVoz([esLocal, mxRed])).toBe(esLocal)
  })

  it('3.º es-MX de red, antes que otro español de red', () => {
    expect(elegirVoz([en, esRed, usRed, mxRed])).toBe(mxRed)
  })

  it('4.º otro español de red', () => {
    expect(elegirVoz([en, usRed])).toBe(usRed)
  })

  it('nunca otro idioma; sin voces en español devuelve null', () => {
    expect(elegirVoz([en])).toBeNull()
    expect(elegirVoz([])).toBeNull()
  })
})
