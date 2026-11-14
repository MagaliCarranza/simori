import { liveQuery } from 'dexie'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { SemaforoBadge } from '../../components/SemaforoBadge.jsx'
import { db as dbDefault } from '../../db/index.js'
import { registrar } from '../../db/bitacora.js'
import { calcularSemaforo, edadDecimal } from '../../domain/index.js'
import { formatearFecha } from '../pendientes/formato.js'
import {
  agendarCita,
  calcularClasificacion,
  calcularValoracion,
  etapaPorRegistrar,
  lineaDeTiempo,
  NOMBRES_ESTADO,
  NOMBRES_ETAPA,
  registrarResultado,
  ultimoResultado,
  VALORES_TIRA,
} from './ruta.js'

const AVISO_NO_DIAGNOSTICA = 'Dato de apoyo: la herramienta no diagnostica. La clasificación la confirma el personal de salud.'
const TEXTO_SALIDA = {
  referido: 'Referir a nefrología pediátrica',
  vigilancia: 'Vigilancia periódica (revisión en 6 meses)',
}

function useFicha(codigo, base) {
  const [datos, setDatos] = useState({ cargando: true, error: null })
  useEffect(() => {
    const consulta = liveQuery(async () => {
      const caso = await base.casos.get(codigo)
      if (!caso) return { caso: null }
      const [nino, eventos, escuela, centro] = await Promise.all([
        base.ninos.get(caso.codigoNino),
        base.eventos.where('codigoCaso').equals(codigo).toArray(),
        base.escuelas.get(caso.cct),
        base.centrosSalud.get(caso.clues),
      ])
      const localidad = escuela ? await base.localidades.get(escuela.claveInegi) : null
      return { caso, nino, eventos, escuela, centro, localidad }
    })
    const sub = consulta.subscribe({
      next: (r) => setDatos({ cargando: false, error: null, ...r }),
      error: (error) => setDatos({ cargando: false, error }),
    })
    return () => sub.unsubscribe()
  }, [codigo, base])
  return datos
}

function Errores({ errores }) {
  if (!errores.length) return null
  return (
    <ul className="ficha__errores" role="alert">
      {errores.map((er) => (
        <li key={er}>{er}</li>
      ))}
    </ul>
  )
}

// Formulario del resultado de la etapa que sigue (2, 3 o 4).
function RegistrarResultado({ caso, nino, eventos, usuario, hoyISO, db, onGuardado }) {
  const id = useId()
  const etapa = etapaPorRegistrar(caso)
  const [datos, setDatos] = useState({ fecha: hoyISO, tiraMgL: null, creatininaMgDl: '', tallaCm: '', pesoKg: '', cocienteAlbCrea: '', salida: '', proximaCita: '' })
  const [errores, setErrores] = useState([])
  const [guardando, setGuardando] = useState(false)
  const cambiar = (c) => setDatos((d) => ({ ...d, ...c }))

  // Vista previa de los cálculos (solo informativa).
  const previaValoracion = useMemo(() => {
    const creatininaMgDl = Number(datos.creatininaMgDl)
    const tallaCm = Number(datos.tallaCm)
    if (etapa !== 3 || !nino || !(creatininaMgDl > 0) || !(tallaCm > 0)) return null
    return calcularValoracion({ nino, fecha: datos.fecha || hoyISO, creatininaMgDl, tallaCm })
  }, [etapa, nino, datos.creatininaMgDl, datos.tallaCm, datos.fecha, hoyISO])

  const previaClasificacion = useMemo(() => {
    const cociente = Number(datos.cocienteAlbCrea)
    if (etapa !== 4 || datos.cocienteAlbCrea === '' || !(cociente >= 0)) return null
    return calcularClasificacion({ valoracion: ultimoResultado(eventos, 3), cocienteAlbCrea: cociente })
  }, [etapa, eventos, datos.cocienteAlbCrea])

  const salidaElegida = datos.salida || previaClasificacion?.propuesta || ''

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const res = await registrarResultado(
        { codigoCaso: caso.codigo, datos: { ...datos, salida: salidaElegida }, usuario, hoyISO },
        db,
      )
      if (!res.ok) {
        setErrores(res.errores)
        return
      }
      setErrores([])
      const estado = NOMBRES_ESTADO[res.caso.estado] ?? res.caso.estado
      onGuardado(`Resultado de ${NOMBRES_ETAPA[etapa].toLowerCase()} guardado. Estado: ${estado}.${res.reactivado ? ' El caso se reactivó.' : ''}`)
    } catch {
      setErrores(['No se pudo guardar el resultado en este equipo. Intenta de nuevo.'])
    } finally {
      setGuardando(false)
    }
  }

  if (etapa == null) return null

  return (
    <section className="ficha__seccion" aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`}>Registrar resultado: {NOMBRES_ETAPA[etapa]}</h3>
      <form className="ficha__form" onSubmit={guardar} aria-label={`Registrar ${NOMBRES_ETAPA[etapa]}`} noValidate>
        <label className="ficha__campo" htmlFor={`${id}-fecha`}>
          Fecha del resultado
          <input id={`${id}-fecha`} type="date" value={datos.fecha} max={hoyISO} onChange={(e) => cambiar({ fecha: e.target.value })} />
        </label>

        {etapa === 2 && (
          <fieldset className="ficha__grupo">
            <legend>Segunda tira (mg/L)</legend>
            {VALORES_TIRA.map((v) => (
              <button key={v} type="button" className="boton boton--opcion" aria-pressed={Number(datos.tiraMgL) === v && datos.tiraMgL !== null} onClick={() => cambiar({ tiraMgL: v })}>
                {v}
              </button>
            ))}
            <p className="ficha__ayuda">Si es negativa (0 mg/L), el caso se cierra como &quot;No confirmado (alta)&quot;.</p>
          </fieldset>
        )}

        {etapa === 3 && (
          <>
            <label className="ficha__campo" htmlFor={`${id}-creatinina`}>
              Creatinina en sangre (mg/dL)
              <input id={`${id}-creatinina`} type="number" inputMode="decimal" step="0.01" value={datos.creatininaMgDl} onChange={(e) => cambiar({ creatininaMgDl: e.target.value })} />
            </label>
            <label className="ficha__campo" htmlFor={`${id}-talla`}>
              Talla (cm)
              <input id={`${id}-talla`} type="number" inputMode="decimal" step="0.1" value={datos.tallaCm} onChange={(e) => cambiar({ tallaCm: e.target.value })} />
            </label>
            <label className="ficha__campo" htmlFor={`${id}-peso`}>
              Peso (kg)
              <input id={`${id}-peso`} type="number" inputMode="decimal" step="0.1" value={datos.pesoKg} onChange={(e) => cambiar({ pesoKg: e.target.value })} />
            </label>
            {previaValoracion && (
              <div className="ficha__calculo" aria-live="polite">
                {previaValoracion.tfge == null ? (
                  <p>La edad queda fuera del rango de la fórmula CKiD U25.</p>
                ) : (
                  <p>
                    Filtración estimada (CKiD U25): <strong>{previaValoracion.tfge} mL/min/1.73 m²</strong> · {previaValoracion.categoriaG}
                    {previaValoracion.baja ? ' · por debajo de 90' : ''}
                  </p>
                )}
                <p className="ficha__ayuda">{AVISO_NO_DIAGNOSTICA}</p>
              </div>
            )}
          </>
        )}

        {etapa === 4 && (
          <>
            <label className="ficha__campo" htmlFor={`${id}-cociente`}>
              Cociente albúmina/creatinina en orina (mg/g)
              <input id={`${id}-cociente`} type="number" inputMode="decimal" step="0.1" value={datos.cocienteAlbCrea} onChange={(e) => cambiar({ cocienteAlbCrea: e.target.value })} />
            </label>
            {previaClasificacion && (
              <div className="ficha__calculo" aria-live="polite">
                <p>
                  Clasificación KDIGO: <strong>{previaClasificacion.categoriaG ?? 'sin TFGe'} {previaClasificacion.categoriaA}</strong>
                  {previaClasificacion.tfge != null ? ` (TFGe ${previaClasificacion.tfge})` : ''}
                </p>
                {previaClasificacion.propuesta && <p>Salida propuesta: {TEXTO_SALIDA[previaClasificacion.propuesta]}.</p>}
                <p className="ficha__ayuda">{AVISO_NO_DIAGNOSTICA}</p>
              </div>
            )}
            <fieldset className="ficha__grupo">
              <legend>Salida que decide el personal de salud</legend>
              {Object.entries(TEXTO_SALIDA).map(([valor, texto]) => (
                <label key={valor} className="ficha__opcion">
                  <input type="radio" name={`${id}-salida`} value={valor} checked={salidaElegida === valor} onChange={() => cambiar({ salida: valor })} />
                  {texto}
                </label>
              ))}
            </fieldset>
          </>
        )}

        {etapa < 4 && (
          <label className="ficha__campo" htmlFor={`${id}-cita`}>
            Próxima cita (opcional)
            <input id={`${id}-cita`} type="date" value={datos.proximaCita} onChange={(e) => cambiar({ proximaCita: e.target.value })} />
          </label>
        )}

        <Errores errores={errores} />
        <button type="submit" className="boton boton--primario" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar resultado'}
        </button>
      </form>
    </section>
  )
}

// RF02 · Agendar o cambiar la cita de la etapa que sigue.
function AgendarCita({ caso, usuario, hoyISO, db, onGuardado }) {
  const id = useId()
  const [fechaCita, setFechaCita] = useState(caso.fechaProximaCita ?? '')
  const [errores, setErrores] = useState([])

  if (etapaPorRegistrar(caso) == null && caso.estado !== 'vigilancia') return null

  const guardar = async (e) => {
    e.preventDefault()
    try {
      const res = await agendarCita({ codigoCaso: caso.codigo, fechaCita, usuario, hoyISO }, db)
      if (!res.ok) {
        setErrores(res.errores)
        return
      }
      setErrores([])
      onGuardado(`Cita agendada para el ${formatearFecha(fechaCita)}.${res.reactivado ? ' El caso se reactivó.' : ''}`)
    } catch {
      setErrores(['No se pudo guardar la cita en este equipo. Intenta de nuevo.'])
    }
  }

  return (
    <section className="ficha__seccion" aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`}>{caso.fechaProximaCita ? 'Cambiar cita' : 'Agendar cita'}</h3>
      <form className="ficha__form" onSubmit={guardar} aria-label="Agendar cita" noValidate>
        <label className="ficha__campo" htmlFor={`${id}-fecha`}>
          Fecha de la cita
          <input id={`${id}-fecha`} type="date" value={fechaCita} min={hoyISO} onChange={(e) => setFechaCita(e.target.value)} />
        </label>
        <Errores errores={errores} />
        <button type="submit" className="boton boton--secundario">
          Guardar cita
        </button>
      </form>
    </section>
  )
}

// HU02 · Ficha de seguimiento de un caso (rol captura, solo su centro).
export function FichaCasoPage({ usuario, hoyISO, db, codigo: codigoProp }) {
  const params = useParams()
  const codigo = codigoProp ?? params.codigo
  const base = db ?? dbDefault
  const ficha = useFicha(codigo, base)
  const consultaRegistrada = useRef(null)
  const [aviso, setAviso] = useState('')
  const delCentro = ficha.caso && ficha.caso.clues === usuario.clues

  // RF15: deja rastro de la consulta una vez por ficha abierta.
  useEffect(() => {
    if (!delCentro || consultaRegistrada.current === codigo) return
    consultaRegistrada.current = codigo
    registrar({ usuarioId: usuario.id, rol: usuario.rol, accion: 'consultar', entidad: 'caso', entidadId: codigo }, { db: base }).catch(() => {})
  }, [delCentro, codigo, usuario, base])

  if (ficha.cargando) return <p>Cargando ficha…</p>
  if (ficha.error) return <p role="alert">No se pudo leer la ficha en este equipo.</p>
  if (!ficha.caso || !delCentro) {
    return (
      <section className="ficha">
        <p role="alert">No se encontró el caso {codigo} en tu centro de salud.</p>
        <Link to="/tamizados">Volver a pacientes tamizados</Link>
      </section>
    )
  }

  const { caso, nino, eventos, escuela, localidad } = ficha
  const semaforo = calcularSemaforo(caso, eventos, hoyISO)
  const edad = nino ? Math.floor(edadDecimal(nino, hoyISO)) : null
  const linea = lineaDeTiempo(eventos)

  return (
    <section className="ficha" aria-labelledby="titulo-ficha">
      <header className="ficha__encabezado">
        <h2 id="titulo-ficha">Caso {caso.codigo}</h2>
        {caso.simulado && <EtiquetaSimulado />}
      </header>

      <dl className="ficha__datos">
        <dt>Semáforo</dt>
        <dd>
          <SemaforoBadge semaforo={semaforo} />
        </dd>
        <dt>Estado</dt>
        <dd>{NOMBRES_ESTADO[caso.estado] ?? caso.estado}</dd>
        <dt>Etapa alcanzada</dt>
        <dd>
          {caso.etapaActual}. {NOMBRES_ETAPA[caso.etapaActual] ?? ''}
        </dd>
        <dt>Próxima cita</dt>
        <dd>{caso.fechaProximaCita ? formatearFecha(caso.fechaProximaCita) : 'Sin cita agendada'}</dd>
        <dt>Escuela</dt>
        <dd>
          {escuela?.nombre ?? caso.cct}
          {localidad ? ` · ${localidad.nombre}` : ''}
        </dd>
        <dt>Niña o niño</dt>
        <dd>
          {nino ? `${nino.sexo === 'F' ? 'Niña' : 'Niño'}, ${edad} años` : 'Sin datos'}
        </dd>
        <dt>Tamizaje</dt>
        <dd>{formatearFecha(caso.fechaTamizaje)}</dd>
      </dl>

      {aviso && (
        <p className="ficha__mensaje" role="status">
          {aviso}
        </p>
      )}
      <RegistrarResultado key={`${caso.etapaActual}-${caso.estado}`} caso={caso} nino={nino} eventos={eventos} usuario={usuario} hoyISO={hoyISO} db={db} onGuardado={setAviso} />
      <AgendarCita key={`cita-${caso.fechaProximaCita}`} caso={caso} usuario={usuario} hoyISO={hoyISO} db={db} onGuardado={setAviso} />

      <section className="ficha__seccion" aria-labelledby="titulo-historial">
        <h3 id="titulo-historial">Historial</h3>
        <ol className="ficha__historial">
          {linea.map((e) => (
            <li key={e.id ?? `${e.tipo}-${e.fecha}`}>
              <time dateTime={e.fecha}>{formatearFecha(e.fecha)}</time> · {e.descripcion}
            </li>
          ))}
        </ol>
      </section>

      <Link to="/tamizados">Volver a pacientes tamizados</Link>
    </section>
  )
}
