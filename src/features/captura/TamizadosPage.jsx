// Pacientes tamizados (rol captura). Integra Pendientes (M5): abre en "Con
// retraso", que es la pantalla de Pendientes tal cual (misma lista, semáforo
// y filtros), y "Todos" lista cada caso tamizado del centro, incluidos los
// cerrados. Solo códigos: nunca nombres.

import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { SemaforoBadge } from '../../components/SemaforoBadge.jsx'
import { formatearFecha } from '../pendientes/formato.js'
import { PendientesPage } from '../pendientes/PendientesPage.jsx'
import { filasTamizados, filtrarTamizados } from './captura.js'
import { useCasosDelCentro } from './useCasosDelCentro.js'
import './captura.css'

const MODOS = [
  { valor: 'retraso', texto: 'Con retraso' },
  { valor: 'todos', texto: 'Todos' },
]

function TodosTamizados({ usuario, hoyISO, db }) {
  const id = useId()
  const { cargando, error, casos, eventos, escuelas, centro } = useCasosDelCentro({
    usuario,
    db,
    entidad: 'tamizados',
  })
  const [texto, setTexto] = useState('')
  const [cct, setCct] = useState('')

  const filas = useMemo(
    () => filasTamizados({ casos, eventos, clues: usuario.clues, hoyISO }),
    [casos, eventos, usuario.clues, hoyISO],
  )
  const visibles = useMemo(() => filtrarTamizados(filas, { texto, cct }), [filas, texto, cct])
  const escuelasDelCentro = useMemo(
    () =>
      [...new Set(filas.map((f) => f.cct))]
        .map((c) => ({ cct: c, nombre: escuelas.get(c)?.nombre ?? c }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [filas, escuelas],
  )

  return (
    <section className="captura" aria-labelledby={`${id}-titulo`}>
      <header className="captura__encabezado">
        <div>
          <h2 id={`${id}-titulo`} className="captura__titulo">
            Pacientes tamizados
          </h2>
          <p className="captura__sub">{centro ? centro.nombre : usuario.clues}</p>
        </div>
        <EtiquetaSimulado />
      </header>

      {error && <p role="alert">No se pudieron leer los casos guardados en este equipo.</p>}
      {cargando && !error && <p>Cargando casos…</p>}

      {!cargando && !error && (
        <>
          <div className="captura__filtros">
            <label htmlFor={`${id}-buscar`}>
              Buscar por código
              <input
                id={`${id}-buscar`}
                type="search"
                inputMode="search"
                placeholder="Ej. 0131 o AC-0131"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </label>
            <label htmlFor={`${id}-escuela`}>
              Escuela
              <select id={`${id}-escuela`} value={cct} onChange={(e) => setCct(e.target.value)}>
                <option value="">Todas</option>
                {escuelasDelCentro.map((e) => (
                  <option key={e.cct} value={e.cct}>
                    {e.nombre} ({e.cct})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="captura__conteo" aria-live="polite">
            {visibles.length === 1 ? '1 caso' : `${visibles.length} casos`}, del tamizaje más reciente al más antiguo
          </p>

          {visibles.length === 0 ? (
            <div className="captura__vacio">Ningún caso coincide con la búsqueda.</div>
          ) : (
            <ul className="captura__lista">
              {visibles.map((f) => (
                <li key={f.codigo} className="captura__caso">
                  <div className="captura__fila">
                    <span className="captura__codigo">{f.codigo}</span>
                    <SemaforoBadge semaforo={f.semaforo} />
                  </div>
                  <dl className="captura__detalle">
                    <div>
                      <dt>Etapa:</dt>
                      <dd>{f.etapaTexto}</dd>
                    </div>
                    <div>
                      <dt>Estado:</dt>
                      <dd>{f.estadoTexto}</dd>
                    </div>
                    <div>
                      <dt>Tamizaje:</dt>
                      <dd>{formatearFecha(f.fechaTamizaje)}</dd>
                    </div>
                    <div>
                      <dt>Escuela:</dt>
                      <dd>{escuelas.get(f.cct)?.nombre ?? f.cct}</dd>
                    </div>
                  </dl>
                  <Link to={`/caso/${f.codigo}`} className="captura__ficha">
                    Ver ficha
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

export function TamizadosPage({ usuario, hoyISO, db }) {
  const [modo, setModo] = useState('retraso')
  return (
    <>
      <div className="captura__modo" role="group" aria-label="Qué pacientes ver">
        {MODOS.map((m) => (
          <button
            key={m.valor}
            type="button"
            className="boton boton--opcion"
            aria-pressed={modo === m.valor}
            onClick={() => setModo(m.valor)}
          >
            {m.texto}
          </button>
        ))}
      </div>
      {modo === 'retraso' ? (
        <PendientesPage usuario={usuario} hoyISO={hoyISO} db={db} />
      ) : (
        <TodosTamizados usuario={usuario} hoyISO={hoyISO} db={db} />
      )}
    </>
  )
}
