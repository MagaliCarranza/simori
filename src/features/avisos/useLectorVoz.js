// Lectura en voz alta del aviso con la Web Speech API (speechSynthesis), en es-MX.
// Se prefieren voces locales del equipo porque funcionan sin internet.

import { useCallback, useEffect, useState } from 'react'

const normalizar = (lang) => (lang || '').replace('_', '-').toLowerCase()

// Elige la mejor voz disponible: es-MX local > es-MX > otra en español local > otra en español.
export function elegirVoz(voces) {
  const puntaje = (v) => {
    const lang = normalizar(v.lang)
    if (!lang.startsWith('es')) return -1
    return (lang === 'es-mx' ? 2 : 0) + (v.localService ? 1 : 0)
  }
  let mejor = null
  for (const v of voces) {
    const p = puntaje(v)
    if (p >= 0 && (!mejor || p > puntaje(mejor))) mejor = v
  }
  return mejor
}

function hayVoz() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

export function useLectorVoz() {
  const soportado = hayVoz()
  const [hablando, setHablando] = useState(false)

  const detener = useCallback(() => {
    if (!hayVoz()) return
    window.speechSynthesis.cancel()
    setHablando(false)
  }, [])

  const leer = useCallback((texto) => {
    if (!hayVoz()) return
    const sintesis = window.speechSynthesis
    sintesis.cancel()
    const frase = new window.SpeechSynthesisUtterance(texto)
    frase.lang = 'es-MX'
    frase.rate = 0.95
    const voz = elegirVoz(sintesis.getVoices())
    if (voz) frase.voice = voz
    frase.onend = () => setHablando(false)
    frase.onerror = () => setHablando(false)
    setHablando(true)
    sintesis.speak(frase)
  }, [])

  // Al cerrar el aviso, deja de hablar.
  useEffect(() => () => {
    if (hayVoz()) window.speechSynthesis.cancel()
  }, [])

  return { soportado, hablando, leer, detener }
}
