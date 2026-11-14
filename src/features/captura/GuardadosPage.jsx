// Guardados en el equipo (rol captura): lo que se registró o cambió en este
// equipo, según la bitácora. El prototipo no tiene servidor: el envío es
// simulado y solo marca hasta dónde se "envió" (tabla meta).

import { liveQuery } from 'dexie'
import { useEffect, useId, useMemo, useState } from 'react'
import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { db as dbDefault } from '../../db/index.js'
import { movimientosGuardados } from './captura.js'
import './captura.css'

const CLAVE_ENVIO = 'envioSimuladoHasta'

function fechaHoraCorta(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

export function GuardadosPage({ db }) {
  const base = db ?? dbDefault
  const id = useId()
  const [datos, setDatos] = useState({ cargando: true, error: null, bitacora: [], enviadosHasta: 0 })
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const sub = liveQuery(async () => {
      const [bitacora, envio] = await Promise.all([base.bitacora.toArray(), base.meta.get(CLAVE_ENVIO)])
      return { bitacora, enviadosHasta: envio?.valor ?? 0 }
    }).subscribe({
      next: ({ bitacora, enviadosHasta }) => setDatos({ cargando: false, error: null, bitacora, enviadosHasta }),
      error: (error) => setDatos((d) => ({ ...d, cargando: false, error })),
    })
    return () => sub.unsubscribe()
  }, [base])

  const movimientos = useMemo(
    () => movimientosGuardados(datos.bitacora, datos.enviadosHasta),
    [datos.bitacora, datos.enviadosHasta],
  )
  const porEnviar = movimientos.filter((m) => !m.enviado)

  const enviar = async () => {
    if (!porEnviar.length) return
    setEnviando(true)
    try {
      const ultimo = Math.max(...movimientos.map((m) => m.id))
      await base.meta.put({ clave: CLAVE_ENVIO, valor: ultimo })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="captura" aria-labelledby={`${id}-titulo`}>
      <header className="captura__encabezado">
        <div>
          <h2 id={`${id}-titulo`} className="captura__titulo">
            Guardados en el equipo
          </h2>
          <p className="captura__sub">Funciona sin conexión: todo se guarda primero en este equipo.</p>
        </div>
        <EtiquetaSimulado />
      </header>

      {datos.error && <p role="alert">No se pudo leer lo guardado en este equipo.</p>}
      {datos.cargando && !datos.error && <p>Cargando…</p>}

      {!datos.cargando && !datos.error && (
        <>
          <div className="captura__envio">
            <p className="captura__ayuda">
              {porEnviar.length === 0
                ? 'No hay cambios por enviar.'
                : `${porEnviar.length === 1 ? '1 cambio' : `${porEnviar.length} cambios`} por enviar.`}{' '}
              En el prototipo no hay servidor: el envío es simulado.
            </p>
            <div className="captura__envio-accion">
              <button
                type="button"
                className="boton boton--primario"
                disabled={enviando || porEnviar.length === 0}
                onClick={enviar}
              >
                {enviando ? 'Enviando…' : 'Enviar (simulado)'}
              </button>
              <EtiquetaSimulado />
            </div>
          </div>

          {movimientos.length === 0 ? (
            <div className="captura__vacio">Todavía no se ha guardado nada en este equipo.</div>
          ) : (
            <ul className="captura__lista">
              {movimientos.map((m) => (
                <li key={m.id} className="captura__caso">
                  <div className="captura__fila">
                    <span className="captura__codigo">{m.codigo}</span>
                    <span className={`captura__estado${m.enviado ? ' captura__estado--enviado' : ''}`}>
                      {m.enviado ? 'Enviado (simulado)' : 'Guardado en este equipo'}
                    </span>
                  </div>
                  <p className="captura__detalle-linea">
                    {m.texto} · {fechaHoraCorta(m.fechaHora)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
