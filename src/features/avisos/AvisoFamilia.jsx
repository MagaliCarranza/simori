import { liveQuery } from 'dexie'
import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { db as dbDefault } from '../../db/index.js'
import { formatearFecha } from '../pendientes/formato.js'
import { avisosDelCaso, crearAviso, marcarEntregado } from './avisos.js'
import { construirAviso, construirRecado } from './mensaje.js'
import { useLectorVoz } from './useLectorVoz.js'
import './avisos.css'

const CANALES = [
  {
    valor: 'mensaje',
    texto: 'WhatsApp o SMS',
    accion: 'Enviar (simulado)',
    hecho: 'Mensaje simulado: no se envió nada real.',
  },
  { valor: 'recado', texto: 'Recado escolar', accion: 'Imprimir recado', hecho: 'Recado listo para imprimir.' },
  {
    valor: 'visita',
    texto: 'Visita del promotor',
    accion: 'Registrar aviso en visita',
    hecho: 'Aviso registrado. Léelo o reprodúcelo a la familia.',
  },
]

const NOMBRE_CANAL = Object.fromEntries(CANALES.map((c) => [c.valor, c.texto]))

// HU06 · Aviso para la familia (rol campo): vista previa, audio, canal y entrega.
export function AvisoFamilia({ fila, centro, escuela, usuario, hoyISO, db = dbDefault }) {
  const [abierto, setAbierto] = useState(false)
  const [canal, setCanal] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [avisos, setAvisos] = useState([])
  const voz = useLectorVoz()

  const aviso = useMemo(() => construirAviso({ fila, centro, hoyISO }), [fila, centro, hoyISO])
  const recado = useMemo(
    () => construirRecado({ fila, centro, escuela, hoyISO }),
    [fila, centro, escuela, hoyISO],
  )

  useEffect(() => {
    if (!abierto) return undefined
    const sub = liveQuery(() => avisosDelCaso(fila.codigo, db)).subscribe({
      next: setAvisos,
      error: () => setAvisos([]),
    })
    return () => sub.unsubscribe()
  }, [abierto, fila.codigo, db])

  // El recado se imprime solo con la vista previa de este caso (ver avisos.css):
  // se marca como imprimible, se pinta de inmediato y se abre el diálogo.
  const imprimirRecado = () => {
    flushSync(() => setImprimiendo(true))
    try {
      window.print()
    } finally {
      setImprimiendo(false)
    }
  }

  const cerrar = () => {
    voz.detener()
    setAbierto(false)
    setCanal('')
    setMensaje('')
    setError('')
  }

  const registrarAviso = async () => {
    const elegido = CANALES.find((c) => c.valor === canal)
    if (!elegido) {
      setError('Elige cómo le vas a dar el aviso a la familia.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await crearAviso({ aviso, canal, usuario, hoyISO }, db)
      setMensaje(elegido.hecho)
      if (canal === 'recado') imprimirRecado()
    } catch {
      setError('No se pudo guardar el aviso en este equipo. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const entregar = async (id) => {
    try {
      await marcarEntregado({ id, usuario }, db)
    } catch {
      setError('No se pudo actualizar el aviso. Intenta de nuevo.')
    }
  }

  if (!abierto) {
    return (
      <div className="aviso">
        <button type="button" className="boton boton--secundario" onClick={() => setAbierto(true)}>
          Aviso a la familia
        </button>
      </div>
    )
  }

  const accion = CANALES.find((c) => c.valor === canal)?.accion ?? 'Registrar aviso'

  const esRecado = canal === 'recado'

  return (
    <section className="aviso aviso--abierto" aria-label={`Aviso para la familia de ${fila.codigo}`}>
      <div className="aviso__cabecera">
        <strong>{esRecado ? 'Vista previa del recado' : 'Vista previa del aviso'}</strong>
        <EtiquetaSimulado />
      </div>

      {esRecado ? (
        <article
          className={`recado${imprimiendo ? ' aviso-imprimible' : ''}`}
          aria-label={`Recado escolar para la familia del código ${recado.codigoCaso}`}
        >
          <header className="recado__cabecera">
            <h3 className="recado__titulo">Recado escolar</h3>
            <p className="recado__fecha">{recado.fechaEmisionLarga}</p>
          </header>

          <dl className="recado__meta">
            <div>
              <dt>Para</dt>
              <dd>Familia del niño o niña con código {recado.codigoCaso}</dd>
            </div>
            {recado.escuela && (
              <div>
                <dt>Escuela</dt>
                <dd>
                  {recado.escuela.nombre}
                  {recado.escuela.cct && ` (${recado.escuela.cct})`}
                </dd>
              </div>
            )}
            <div>
              <dt>De parte de</dt>
              <dd>{recado.lugarCita}</dd>
            </div>
          </dl>

          <div className="recado__cuerpo">
            <p className="recado__saludo">{recado.saludo}</p>
            {recado.cuerpo.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="recado__cierre">{recado.cierre}</p>
          </div>

          <div className="recado__firmas" aria-hidden="true">
            <div>
              <span className="recado__linea" />
              <span className="recado__firma-texto">Firma del personal de salud</span>
            </div>
            <div>
              <span className="recado__linea" />
              <span className="recado__firma-texto">Recibido por (familia)</span>
            </div>
          </div>

          <footer className="recado__pie">Datos simulados · SIMORI, prototipo de seguimiento</footer>
        </article>
      ) : (
        <div className="aviso__burbuja">
          {aviso.parrafos.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}

      <div className="aviso__audio">
        {voz.soportado ? (
          voz.hablando ? (
            <button type="button" className="boton boton--secundario" onClick={voz.detener}>
              ■ Detener audio
            </button>
          ) : (
            <button type="button" className="boton boton--secundario" onClick={() => voz.leer(aviso.textoAudio)}>
              ▶ Escuchar aviso
            </button>
          )
        ) : (
          <p className="aviso__nota">Este navegador no puede leer el aviso en voz alta.</p>
        )}
        {voz.fallo && (
          <p className="aviso__nota" role="alert">
            No se pudo reproducir el audio en este equipo. Lee el aviso en voz alta a la familia.
          </p>
        )}
      </div>

      <fieldset className="aviso__canales">
        <legend>¿Cómo le darás el aviso?</legend>
        <div className="aviso__opciones">
          {CANALES.map((c) => (
            <button
              key={c.valor}
              type="button"
              className="boton boton--opcion"
              aria-pressed={canal === c.valor}
              onClick={() => {
                setCanal(c.valor)
                setMensaje('')
                setError('')
              }}
            >
              {c.texto}
              {c.valor === 'mensaje' && ' (simulado)'}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="aviso__error" role="alert">
          {error}
        </p>
      )}
      {mensaje && (
        <p className="aviso__hecho" role="status">
          {mensaje}
        </p>
      )}

      <div className="aviso__acciones">
        <button type="button" className="boton boton--primario" onClick={registrarAviso} disabled={guardando}>
          {guardando ? 'Guardando…' : accion}
        </button>
        <button type="button" className="boton boton--texto" onClick={cerrar}>
          Cerrar
        </button>
      </div>

      {avisos.length > 0 && (
        <div className="aviso__historial">
          <strong>Avisos de este caso</strong>
          <ul>
            {avisos.map((a) => (
              <li key={a.id}>
                <span>
                  {formatearFecha(a.fecha)} · {NOMBRE_CANAL[a.canal] ?? a.canal} ·{' '}
                  {a.estado === 'entregado' ? 'Entregado' : 'Pendiente de entregar'}
                </span>
                {a.estado !== 'entregado' && (
                  <button type="button" className="boton boton--chico" onClick={() => entregar(a.id)}>
                    Marcar como entregado
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
