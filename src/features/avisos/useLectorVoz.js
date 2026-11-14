// Lectura en voz alta del aviso con la Web Speech API (speechSynthesis), en es-MX.
//
// Sin internet solo suenan las voces locales del equipo (localService), así que
// pesa más que la voz sea local que el acento. Si no hay voz en español, si el
// navegador avisa un error o si la voz no arranca en unos segundos, no se habla
// con la voz por omisión: se marca `fallo` para que la pantalla lo diga.

import { useCallback, useEffect, useRef, useState } from 'react'

// Tiempo para que la voz empiece (onstart) o termine (onend). Incluye la espera
// a que el navegador cargue la lista de voces (voiceschanged).
export const LIMITE_INICIO_MS = 5000

// Errores que provoca la propia app al cancelar (detener o volver a leer).
const ERRORES_POR_CANCELAR = new Set(['interrupted', 'canceled'])

const normalizar = (lang) => (lang || '').replace('_', '-').toLowerCase()

// Elige la mejor voz disponible:
// local es-MX > local otro español > red es-MX > red otro español. Nunca otro idioma.
export function elegirVoz(voces) {
  const puntaje = (v) => {
    const lang = normalizar(v.lang)
    if (!lang.startsWith('es')) return -1
    return (v.localService ? 2 : 0) + (lang === 'es-mx' ? 1 : 0)
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
  const [fallo, setFallo] = useState(false)

  // Cada lectura tiene su turno; los eventos de lecturas anteriores se ignoran.
  const turno = useRef(0)
  const temporizador = useRef(null)
  // Lectura que espera a que cargue la lista de voces.
  const pendiente = useRef(null)

  const limpiar = useCallback(() => {
    clearTimeout(temporizador.current)
    temporizador.current = null
    pendiente.current = null
  }, [])

  const fallar = useCallback(
    (t) => {
      if (t !== turno.current) return
      turno.current += 1 // el cancel de abajo no debe contar como otro evento
      limpiar()
      window.speechSynthesis.cancel()
      setHablando(false)
      setFallo(true)
    },
    [limpiar],
  )

  const hablar = useCallback(
    (t, texto, voces) => {
      if (t !== turno.current) return
      pendiente.current = null
      const voz = elegirVoz(voces)
      if (!voz) {
        fallar(t)
        return
      }
      const frase = new window.SpeechSynthesisUtterance(texto)
      frase.lang = 'es-MX'
      frase.rate = 0.95
      frase.voice = voz
      frase.onstart = () => {
        if (t !== turno.current) return
        clearTimeout(temporizador.current)
        temporizador.current = null
      }
      frase.onend = () => {
        if (t !== turno.current) return
        limpiar()
        setHablando(false)
      }
      frase.onerror = (e) => {
        if (t !== turno.current) return
        if (ERRORES_POR_CANCELAR.has(e?.error)) {
          limpiar()
          setHablando(false)
          return
        }
        fallar(t)
      }
      window.speechSynthesis.speak(frase)
    },
    [fallar, limpiar],
  )

  const detener = useCallback(() => {
    if (!hayVoz()) return
    turno.current += 1
    limpiar()
    window.speechSynthesis.cancel()
    setHablando(false)
    setFallo(false)
  }, [limpiar])

  const leer = useCallback(
    (texto) => {
      if (!hayVoz()) return
      const sintesis = window.speechSynthesis
      turno.current += 1
      const t = turno.current
      limpiar()
      sintesis.cancel()
      setFallo(false)
      setHablando(true)
      temporizador.current = setTimeout(() => fallar(t), LIMITE_INICIO_MS)

      const voces = sintesis.getVoices()
      if (voces.length === 0) {
        // Chrome carga las voces después; se elige al llegar voiceschanged.
        pendiente.current = { t, texto }
        return
      }
      hablar(t, texto, voces)
    },
    [fallar, hablar, limpiar],
  )

  // Cuando el navegador termina de cargar la lista de voces, atiende la lectura pendiente.
  useEffect(() => {
    if (!hayVoz()) return undefined
    const sintesis = window.speechSynthesis
    const alCambiarVoces = () => {
      const p = pendiente.current
      if (!p) return
      const voces = sintesis.getVoices()
      if (voces.length === 0) return
      hablar(p.t, p.texto, voces)
    }
    if (typeof sintesis.addEventListener === 'function') {
      sintesis.addEventListener('voiceschanged', alCambiarVoces)
      return () => sintesis.removeEventListener('voiceschanged', alCambiarVoces)
    }
    const anterior = sintesis.onvoiceschanged ?? null
    sintesis.onvoiceschanged = alCambiarVoces
    return () => {
      if (sintesis.onvoiceschanged === alCambiarVoces) sintesis.onvoiceschanged = anterior
    }
  }, [hablar])

  // Al cerrar el aviso, deja de hablar.
  useEffect(
    () => () => {
      turno.current += 1
      clearTimeout(temporizador.current)
      if (hayVoz()) window.speechSynthesis.cancel()
    },
    [],
  )

  return { soportado, hablando, fallo, leer, detener }
}
