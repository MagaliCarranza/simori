import '../../components/ui.css'
import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { db as dbDefault } from '../../db/index.js'
import { formatearFecha } from '../pendientes/formato.js'
import { registrarCaso, SEXOS, VALORES_TIRA } from './registro.js'
import './registro.css'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function formularioVacio(hoyISO) {
  return {
    cct: '',
    fechaTamizaje: hoyISO,
    tiraMgL: null,
    sexo: '',
    mesNacimiento: '',
    anioNacimiento: '',
    consentimientoTutor: false,
    asentimientoNino: false,
  }
}

// HU01 · Registro de un caso con tamizaje positivo (rol captura).
// Solo códigos: el formulario no pide nombre, CURP ni domicilio.
export function RegistrarCasoPage({ usuario, hoyISO, db }) {
  const base = db ?? dbDefault
  const id = useId()
  const [escuelas, setEscuelas] = useState([])
  const [localidades, setLocalidades] = useState(new Map())
  const [form, setForm] = useState(() => formularioVacio(hoyISO))
  const [errores, setErrores] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [registrado, setRegistrado] = useState(null)

  useEffect(() => {
    let vigente = true
    Promise.all([base.escuelas.toArray(), base.localidades.toArray()]).then(([es, locs]) => {
      if (!vigente) return
      setEscuelas([...es].sort((a, b) => a.nombre.localeCompare(b.nombre) || a.cct.localeCompare(b.cct)))
      setLocalidades(new Map(locs.map((l) => [l.claveInegi, l.nombre])))
    })
    return () => {
      vigente = false
    }
  }, [base])

  const cambiar = (cambio) => setForm((f) => ({ ...f, ...cambio }))

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const res = await registrarCaso({ form, usuario, hoyISO }, db)
      if (!res.ok) {
        setErrores(res.errores)
        return
      }
      setErrores([])
      setRegistrado(res.caso)
      setForm(formularioVacio(hoyISO))
    } catch {
      setErrores(['No se pudo guardar el caso en este equipo. Intenta de nuevo.'])
    } finally {
      setGuardando(false)
    }
  }

  if (registrado) {
    return (
      <section className="registro" aria-labelledby={`${id}-titulo`}>
        <h2 id={`${id}-titulo`} className="registro__titulo">Caso registrado</h2>
        <div className="registro__exito" role="status">
          <p className="registro__guardado">Guardado en este equipo</p>
          <p>
            Código del caso: <strong>{registrado.codigo}</strong>
          </p>
          <p>
            Etapa del caso: <strong>1 de 5 (Tamizaje)</strong>
          </p>
          <p>
            Cita de confirmación (segunda muestra de orina):{' '}
            <strong>{formatearFecha(registrado.fechaProximaCita)}</strong>, 12 semanas después del tamizaje.
          </p>
          <p className="registro__ayuda">Anota el código en el expediente del centro de salud; la app no guarda nombres.</p>
        </div>
        <div className="registro__acciones">
          <Link to={`/caso/${registrado.codigo}`} className="boton boton--primario registro__enlace">
            Ver ficha del caso
          </Link>
          <button type="button" className="boton boton--secundario" onClick={() => setRegistrado(null)}>
            Registrar otro caso
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="registro" aria-labelledby={`${id}-titulo`}>
      <header className="registro__encabezado">
        <h2 id={`${id}-titulo`} className="registro__titulo">Registrar caso positivo</h2>
        <EtiquetaSimulado />
      </header>
      <p className="registro__ayuda">Tamizaje con tira reactiva en la comunidad o la escuela.</p>
      <p className="registro__privacidad">
        <strong>Privacidad:</strong> no escribas nombres, CURP ni domicilios. Cada niña o niño se identifica solo con el
        código que asigna el sistema.
      </p>

      <form className="registro__form" onSubmit={guardar} aria-label="Registrar caso positivo" noValidate>
        <h3 className="registro__paso">
          <span className="registro__paso-numero" aria-hidden="true">1</span> Niña o niño y escuela
        </h3>
        <p className="registro__ayuda">El código se genera al guardar.</p>
        <label className="registro__campo" htmlFor={`${id}-escuela`}>
          Escuela
          <select id={`${id}-escuela`} value={form.cct} onChange={(e) => cambiar({ cct: e.target.value })}>
            <option value="">Elige una escuela</option>
            {escuelas.map((es) => (
              <option key={es.cct} value={es.cct}>
                {es.nombre} · {es.nivel}
                {es.turno ? ` ${es.turno}` : ''} · {localidades.get(es.claveInegi) ?? es.claveInegi} ({es.cct})
              </option>
            ))}
          </select>
        </label>

        <label className="registro__campo" htmlFor={`${id}-fecha`}>
          Fecha del tamizaje
          <input
            id={`${id}-fecha`}
            type="date"
            value={form.fechaTamizaje}
            max={hoyISO}
            onChange={(e) => cambiar({ fechaTamizaje: e.target.value })}
          />
        </label>

        <fieldset className="registro__grupo">
          <legend>Sexo</legend>
          <div className="registro__opciones">
            {SEXOS.map((s) => (
              <button
                key={s.valor}
                type="button"
                className="boton boton--opcion"
                aria-pressed={form.sexo === s.valor}
                onClick={() => cambiar({ sexo: s.valor })}
              >
                {s.texto}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="registro__grupo">
          <legend>Nacimiento (solo mes y año)</legend>
          <div className="registro__opciones">
            <label className="registro__campo" htmlFor={`${id}-mes`}>
              Mes
              <select
                id={`${id}-mes`}
                value={form.mesNacimiento}
                onChange={(e) => cambiar({ mesNacimiento: e.target.value })}
              >
                <option value="">Mes</option>
                {MESES.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="registro__campo" htmlFor={`${id}-anio`}>
              Año
              <input
                id={`${id}-anio`}
                type="number"
                inputMode="numeric"
                placeholder="AAAA"
                value={form.anioNacimiento}
                onChange={(e) => cambiar({ anioNacimiento: e.target.value })}
              />
            </label>
          </div>
        </fieldset>

        <h3 className="registro__paso">
          <span className="registro__paso-numero" aria-hidden="true">2</span> Resultado de la tira
        </h3>
        <fieldset className="registro__grupo">
          <legend>Resultado de la tira (mg/L)</legend>
          <div className="registro__opciones registro__opciones--cuatro">
            {VALORES_TIRA.map((v) => (
              <button
                key={v}
                type="button"
                className="boton boton--opcion"
                aria-pressed={form.tiraMgL === v}
                onClick={() => cambiar({ tiraMgL: v })}
              >
                {v}
              </button>
            ))}
          </div>
          <span className="registro__ayuda">Positivo: 20 mg/L o más.</span>
        </fieldset>

        <h3 className="registro__paso">
          <span className="registro__paso-numero" aria-hidden="true">3</span> Consentimiento
        </h3>
        <fieldset className="registro__grupo">
          <legend>Consentimiento</legend>
          <label className="registro__check">
            <input
              type="checkbox"
              checked={form.consentimientoTutor}
              onChange={(e) => cambiar({ consentimientoTutor: e.target.checked })}
            />
            La madre, el padre o el tutor dio su consentimiento.
          </label>
          <label className="registro__check">
            <input
              type="checkbox"
              checked={form.asentimientoNino}
              onChange={(e) => cambiar({ asentimientoNino: e.target.checked })}
            />
            La niña o el niño dio su asentimiento.
          </label>
        </fieldset>

        {errores.length > 0 && (
          <ul className="registro__errores" role="alert">
            {errores.map((er) => (
              <li key={er}>{er}</li>
            ))}
          </ul>
        )}

        <button type="submit" className="boton boton--primario" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar caso'}
        </button>
      </form>
    </section>
  )
}
