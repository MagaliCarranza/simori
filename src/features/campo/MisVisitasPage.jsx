import { useMemo } from 'react'
import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { CasoPendiente } from '../pendientes/CasoPendiente.jsx'
import { filtrarPendientes } from '../pendientes/pendientes.js'
import { usePendientesDelCentro } from '../pendientes/usePendientesDelCentro.js'
import { RegistrarVisita } from './RegistrarVisita.jsx'
import '../pendientes/pendientes.css'

// HU04 · "Mis visitas" (rol campo). Lee de la base local (funciona sin internet),
// solo pendientes del centro del usuario, del más urgente al menos urgente.
// Solo muestra códigos y datos de seguimiento, nunca resultados clínicos.
export function MisVisitasPage({ usuario, hoyISO, db }) {
  const { cargando, error, filas, escuelas, centro } = usePendientesDelCentro({ usuario, hoyISO, db })
  const visitas = useMemo(() => filtrarPendientes(filas), [filas])
  const urgentes = visitas.filter((f) => f.semaforo.color === 'rojo').length

  return (
    <section className="pendientes" aria-labelledby="titulo-visitas">
      <header className="pendientes__encabezado">
        <div>
          <h2 id="titulo-visitas" className="pendientes__titulo">
            Mis visitas
          </h2>
          <p className="pendientes__sub">
            Hola. Estas familias tienen una cita pendiente
            {centro ? ` en ${centro.nombre}` : ''}.
          </p>
        </div>
        <EtiquetaSimulado />
      </header>

      {error && <p role="alert">No se pudieron leer las visitas guardadas en este equipo.</p>}
      {cargando && !error && <p>Cargando visitas…</p>}

      {!cargando &&
        !error &&
        (visitas.length === 0 ? (
          <div className="pendientes__vacio">
            <strong>No tienes visitas pendientes</strong>
            Todas las familias de tu centro están al día.
          </div>
        ) : (
          <>
            <p className="pendientes__conteo">
              {visitas.length === 1 ? '1 visita' : `${visitas.length} visitas`}
              {urgentes > 0 && ` · ${urgentes === 1 ? '1 urgente' : `${urgentes} urgentes`}`}
            </p>
            <ul className="pendientes__lista">
              {visitas.map((f) => (
                <CasoPendiente key={f.codigo} fila={f} escuela={escuelas.get(f.cct)}>
                  <RegistrarVisita codigoCaso={f.codigo} usuario={usuario} hoyISO={hoyISO} db={db} />
                </CasoPendiente>
              ))}
            </ul>
          </>
        ))}
    </section>
  )
}
