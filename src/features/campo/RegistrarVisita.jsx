import { useId, useState } from 'react'
import { NOTA_MAX, registrarVisita } from './visitas.js'
import './visitas.css'

const OPCIONES = [
  { valor: 'localizada', texto: 'Localizada' },
  { valor: 'no_localizada', texto: 'No localizada' },
]

// HU05 · Botón + formulario para registrar una visita a la familia.
export function RegistrarVisita({ codigoCaso, usuario, hoyISO, db }) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const [resultado, setResultado] = useState('')
  const [fecha, setFecha] = useState(hoyISO)
  const [nota, setNota] = useState('')
  const [errores, setErrores] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const reiniciar = () => {
    setResultado('')
    setFecha(hoyISO)
    setNota('')
    setErrores([])
  }

  const abrir = () => {
    reiniciar()
    setMensaje('')
    setAbierto(true)
  }

  const cancelar = () => {
    reiniciar()
    setAbierto(false)
  }

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const res = await registrarVisita(
        { codigoCaso, visitaResultado: resultado, fecha, nota, usuario, hoyISO },
        db,
      )
      if (!res.ok) {
        setErrores(res.errores)
        return
      }
      setMensaje(
        res.pasoASinSeguimiento
          ? 'Visita guardada. El caso pasó a "sin seguimiento" (2 visitas sin localizar).'
          : 'Visita guardada.',
      )
      reiniciar()
      setAbierto(false)
    } catch {
      setErrores(['No se pudo guardar la visita en este equipo. Intenta de nuevo.'])
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) {
    return (
      <div className="visita">
        <button type="button" className="boton boton--secundario" onClick={abrir}>
          Registrar visita
        </button>
        {mensaje && (
          <p className="visita__mensaje" role="status">
            {mensaje}
          </p>
        )}
      </div>
    )
  }

  return (
    <form className="visita visita--abierta" onSubmit={guardar} aria-label={`Registrar visita de ${codigoCaso}`}>
      <fieldset className="visita__resultado">
        <legend>¿Encontraste a la familia?</legend>
        <div className="visita__opciones">
          {OPCIONES.map((o) => (
            <button
              key={o.valor}
              type="button"
              className={`boton boton--opcion boton--${o.valor}`}
              aria-pressed={resultado === o.valor}
              onClick={() => setResultado(o.valor)}
            >
              {o.texto}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="visita__campo" htmlFor={`${id}-fecha`}>
        Fecha de la visita
        <input
          id={`${id}-fecha`}
          type="date"
          value={fecha}
          max={hoyISO}
          onChange={(e) => setFecha(e.target.value)}
          required
        />
      </label>

      <label className="visita__campo" htmlFor={`${id}-nota`}>
        Nota (opcional)
        <textarea
          id={`${id}-nota`}
          value={nota}
          maxLength={NOTA_MAX}
          rows={3}
          onChange={(e) => setNota(e.target.value)}
          aria-describedby={`${id}-ayuda`}
        />
        <span id={`${id}-ayuda`} className="visita__ayuda">
          No escribas nombres, CURP ni domicilios. {nota.length}/{NOTA_MAX}
        </span>
      </label>

      {errores.length > 0 && (
        <ul className="visita__errores" role="alert">
          {errores.map((er) => (
            <li key={er}>{er}</li>
          ))}
        </ul>
      )}

      <div className="visita__acciones">
        <button type="submit" className="boton boton--primario" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar visita'}
        </button>
        <button type="button" className="boton boton--texto" onClick={cancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
