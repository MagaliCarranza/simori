import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { db as dbDefault } from '../../db/index.js'
import { formatearFecha } from '../pendientes/formato.js'
import { siguientePaso } from '../pendientes/pendientes.js'
import { AvisoFamilia } from './AvisoFamilia.jsx'
import '../pendientes/pendientes.css'
import '../../components/ui.css'
import './avisos.css'

const NOMBRE_CANAL = {
  mensaje: 'WhatsApp o SMS',
  recado: 'Recado escolar',
  visita: 'Visita del promotor',
}

// Arma la `fila` mínima que AvisoFamilia necesita a partir de un Caso
// (sin eventos: AvisoFamilia solo usa codigo, siguientePaso y fechaProximaCita).
function filaDeCaso(caso) {
  return {
    codigo: caso.codigo,
    siguientePaso: siguientePaso(caso),
    fechaProximaCita: caso.fechaProximaCita ?? null,
  }
}

// HU06 extendida · Listado consolidado de avisos del centro del usuario.
// Cada item abre la vista previa de M7 (AvisoFamilia) para escuchar el
// aviso y marcarlo como entregado desde su historial interno. Esta pantalla
// solo lista y navega; no modifica la lógica de AvisoFamilia.
export function ListaAvisosPage({ usuario, hoyISO, db = dbDefault }) {
  const [datos, setDatos] = useState({ avisos: [], casos: new Map(), centro: null })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    if (!usuario?.clues) {
      setCargando(false)
      return undefined
    }
    const sub = liveQuery(async () => {
      const [casos, centros, todos] = await Promise.all([
        db.casos.where('clues').equals(usuario.clues).toArray(),
        db.centrosSalud.where('clues').equals(usuario.clues).toArray(),
        db.avisos.toArray(),
      ])
      const casosPorCodigo = new Map(casos.map((c) => [c.codigo, c]))
      const avisos = todos
        .filter((a) => casosPorCodigo.has(a.codigoCaso))
        .sort((a, b) => (b.fecha === a.fecha ? b.id - a.id : b.fecha < a.fecha ? -1 : 1))
      return { avisos, casos: casosPorCodigo, centro: centros[0] ?? null }
    }).subscribe({
      next: (d) => {
        if (!vigente) return
        setDatos(d)
        setCargando(false)
      },
      error: (e) => {
        if (!vigente) return
        setError(e)
        setCargando(false)
      },
    })
    return () => {
      vigente = false
      sub.unsubscribe()
    }
  }, [usuario?.clues, db])

  const { avisos, casos, centro } = datos
  const pendientes = avisos.filter((a) => a.estado === 'pendiente').length

  return (
    <section className="pendientes" aria-labelledby="titulo-lista-avisos">
      <header className="pendientes__encabezado">
        <div>
          <h2 id="titulo-lista-avisos" className="pendientes__titulo">
            Avisos
          </h2>
          <p className="pendientes__sub">
            Historial del centro
            {pendientes > 0 && ` · ${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'} de entregar`}
          </p>
        </div>
        <EtiquetaSimulado />
      </header>

      {error && <p role="alert">No se pudieron leer los avisos de este equipo.</p>}
      {cargando && !error && <p>Cargando avisos…</p>}

      {!cargando &&
        !error &&
        (avisos.length === 0 ? (
          <div className="pendientes__vacio">
            <strong>Aún no hay avisos</strong>
            Registra uno desde Mis visitas abriendo un caso.
          </div>
        ) : (
          <ul className="pendientes__lista" aria-label="Avisos del centro">
            {avisos.map((a) => {
              const caso = casos.get(a.codigoCaso)
              return (
                <li key={a.id} className="caso-pendiente">
                  <div className="caso-pendiente__fila">
                    <span className="caso-pendiente__codigo">{a.codigoCaso}</span>
                    <span
                      className={`insignia-aviso insignia-aviso--${a.estado}`}
                      aria-label={`Estado: ${a.estado === 'entregado' ? 'Entregado' : 'Pendiente de entregar'}`}
                    >
                      {a.estado === 'entregado' ? 'Entregado' : 'Pendiente de entregar'}
                    </span>
                  </div>
                  <p className="lista-avisos__meta">
                    {formatearFecha(a.fecha)} · {NOMBRE_CANAL[a.canal] ?? a.canal}
                  </p>
                  {caso && centro && (
                    <AvisoFamilia
                      fila={filaDeCaso(caso)}
                      centro={centro}
                      usuario={usuario}
                      hoyISO={hoyISO}
                      db={db}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        ))}
    </section>
  )
}
