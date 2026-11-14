import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { CasoPendiente } from './CasoPendiente.jsx'
import { filtrarPendientes, resumenPendientes } from './pendientes.js'
import { usePendientesDelCentro } from './usePendientesDelCentro.js'
import './pendientes.css'

const FILTROS_INICIALES = { color: 'todos', cct: '', soloSinCita: false, busqueda: '' }

// HU03 · "Casos con retraso y pendientes" (rol captura). Solo casos del centro
// del usuario, solo amarillo/rojo, ordenados por días de retraso.
export function PendientesPage({ usuario, hoyISO, db }) {
  const { cargando, error, filas, escuelas, centro } = usePendientesDelCentro({ usuario, hoyISO, db })
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)

  const resumen = useMemo(() => resumenPendientes(filas), [filas])
  const todosPendientes = useMemo(() => filtrarPendientes(filas), [filas])
  const visibles = useMemo(() => filtrarPendientes(filas, filtros), [filas, filtros])

  const escuelasConPendientes = useMemo(() => {
    const ccts = [...new Set(todosPendientes.map((f) => f.cct))]
    return ccts
      .map((cct) => ({ cct, nombre: escuelas.get(cct)?.nombre ?? cct }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [todosPendientes, escuelas])

  const cambiar = (cambio) => setFiltros((f) => ({ ...f, ...cambio }))
  const alternarTarjeta = (cambio, activo) => cambiar(activo ? { color: 'todos', soloSinCita: false } : cambio)

  const rojoActivo = filtros.color === 'rojo' && !filtros.soloSinCita
  const amarilloActivo = filtros.color === 'amarillo' && !filtros.soloSinCita
  const sinCitaActivo = filtros.soloSinCita && filtros.color === 'todos'

  return (
    <section className="pendientes" aria-labelledby="titulo-pendientes">
      <header className="pendientes__encabezado">
        <div>
          <h2 id="titulo-pendientes" className="pendientes__titulo">
            Casos con retraso y pendientes
          </h2>
          <p className="pendientes__sub">{centro ? centro.nombre : usuario.clues}</p>
        </div>
        <EtiquetaSimulado />
      </header>

      {error && <p role="alert">No se pudieron leer los casos guardados en este equipo.</p>}
      {cargando && !error && <p>Cargando casos…</p>}

      {!cargando && !error && (
        <>
          <div className="pendientes__resumen">
            <button
              type="button"
              className="tarjeta-resumen tarjeta-resumen--rojo"
              aria-pressed={rojoActivo}
              onClick={() => alternarTarjeta({ color: 'rojo', soloSinCita: false }, rojoActivo)}
            >
              <span className="tarjeta-resumen__numero">{resumen.rojo}</span>
              <span className="tarjeta-resumen__texto">Urgentes (rojo)</span>
            </button>
            <button
              type="button"
              className="tarjeta-resumen tarjeta-resumen--amarillo"
              aria-pressed={amarilloActivo}
              onClick={() => alternarTarjeta({ color: 'amarillo', soloSinCita: false }, amarilloActivo)}
            >
              <span className="tarjeta-resumen__numero">{resumen.amarillo}</span>
              <span className="tarjeta-resumen__texto">Con retraso (amarillo)</span>
            </button>
            <button
              type="button"
              className="tarjeta-resumen tarjeta-resumen--sin-cita"
              aria-pressed={sinCitaActivo}
              onClick={() => alternarTarjeta({ color: 'todos', soloSinCita: true }, sinCitaActivo)}
            >
              <span className="tarjeta-resumen__numero">{resumen.sinCita}</span>
              <span className="tarjeta-resumen__texto">Sin cita agendada</span>
            </button>
          </div>

          {todosPendientes.length === 0 ? (
            <div className="pendientes__vacio">
              <strong>Todo al día en tu centro</strong>
              No hay casos con retraso.
            </div>
          ) : (
            <>
              <div className="pendientes__filtros">
                <label>
                  Buscar por código
                  <input
                    type="search"
                    inputMode="text"
                    autoComplete="off"
                    placeholder="Ej. 0131 o AC-0131"
                    value={filtros.busqueda}
                    onChange={(e) => cambiar({ busqueda: e.target.value })}
                  />
                </label>
                <label>
                  Semáforo
                  <select value={filtros.color} onChange={(e) => cambiar({ color: e.target.value })}>
                    <option value="todos">Rojo y amarillo</option>
                    <option value="rojo">Solo rojo</option>
                    <option value="amarillo">Solo amarillo</option>
                  </select>
                </label>
                <label>
                  Escuela
                  <select value={filtros.cct} onChange={(e) => cambiar({ cct: e.target.value })}>
                    <option value="">Todas</option>
                    {escuelasConPendientes.map((e) => (
                      <option key={e.cct} value={e.cct}>
                        {e.nombre} ({e.cct})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="filtro-check">
                  <input
                    type="checkbox"
                    checked={filtros.soloSinCita}
                    onChange={(e) => cambiar({ soloSinCita: e.target.checked })}
                  />
                  Solo sin cita
                </label>
              </div>

              <p className="pendientes__conteo" aria-live="polite">
                {visibles.length === 1 ? '1 caso' : `${visibles.length} casos`}, del más atrasado al menos atrasado
              </p>

              {visibles.length === 0 ? (
                <div className="pendientes__vacio">Ningún caso coincide con los filtros.</div>
              ) : (
                <ul className="pendientes__lista">
                  {visibles.map((f) => (
                    <CasoPendiente key={f.codigo} fila={f} escuela={escuelas.get(f.cct)}>
                      <Link to={`/caso/${f.codigo}`} className="caso-pendiente__ficha">
                        Ver ficha
                      </Link>
                    </CasoPendiente>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
