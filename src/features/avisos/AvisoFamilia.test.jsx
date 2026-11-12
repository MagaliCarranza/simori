import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearDb } from '../../db/schema.js'
import { MisVisitasPage } from '../campo/MisVisitasPage.jsx'
import { elegirVoz } from './useLectorVoz.js'

const HOY = '2026-11-14'
const campo = { id: 'USR-CAM-AC', rol: 'campo', clues: 'PROV-AC-01' }

let db
let n = 0

class FraseFalsa {
  constructor(text) {
    this.text = text
  }
}

function instalarVoz() {
  const sintesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: () => [
      { name: 'Inglés', lang: 'en-US', localService: true },
      { name: 'España', lang: 'es-ES', localService: true },
      { name: 'México', lang: 'es-MX', localService: true },
    ],
  }
  window.speechSynthesis = sintesis
  window.SpeechSynthesisUtterance = FraseFalsa
  return sintesis
}

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
  })

  it('si el navegador no tiene voz, lo dice', async () => {
    quitarVoz()
    const a = await abrirAviso()
    expect(a.getByText('Este navegador no puede leer el aviso en voz alta.')).toBeInTheDocument()
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

describe('elegirVoz', () => {
  it('prefiere es-MX local, luego cualquier español; nunca otro idioma', () => {
    const mxRed = { lang: 'es-MX', localService: false }
    const mxLocal = { lang: 'es_MX', localService: true }
    const es = { lang: 'es-ES', localService: true }
    const en = { lang: 'en-US', localService: true }
    expect(elegirVoz([en, es, mxRed, mxLocal])).toBe(mxLocal)
    expect(elegirVoz([en, es, mxRed])).toBe(mxRed)
    expect(elegirVoz([en, es])).toBe(es)
    expect(elegirVoz([en])).toBeNull()
  })
})
