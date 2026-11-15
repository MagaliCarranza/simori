// Muestras y lab (rol captura): casos del centro que esperan una muestra o
// estudio, agrupados por la etapa que sigue. Cada caso lleva a su ficha, donde
// se captura el resultado (M4). La app no diagnostica.

import { useId, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { SemaforoBadge } from '../../components/SemaforoBadge.jsx'
import { formatearFecha } from '../pendientes/formato.js'
import { filasTamizados, gruposMuestras } from './captura.js'
import { useCasosDelCentro } from './useCasosDelCentro.js'
import './captura.css'

export function MuestrasLabPage({ usuario, hoyISO, db }) {
  const id = useId()
  const { cargando, error, casos, eventos, escuelas, centro } = useCasosDelCentro({
    usuario,
    db,
    entidad: 'muestras',
  })
  const grupos = useMemo(
    () => gruposMuestras(filasTamizados({ casos, eventos, clues: usuario.clues, hoyISO })),
    [casos, eventos, usuario.clues, hoyISO],
  )

  return (
    <section className="captura" aria-labelledby={`${id}-titulo`}>
      <header className="captura__encabezado">
        <div>
          <h2 id={`${id}-titulo`} className="captura__titulo">
            Muestras y lab
          </h2>
          <p className="captura__sub">{centro ? centro.nombre : usuario.clues}</p>
        </div>
        <EtiquetaSimulado />
      </header>
      <p className="captura__ayuda">
        Casos que esperan una muestra o estudio. El resultado se registra en la ficha del caso; la clasificación la
        confirma el personal de salud.
      </p>

      {error && <p role="alert">No se pudieron leer los casos guardados en este equipo.</p>}
      {cargando && !error && <p>Cargando casos…</p>}

      {!cargando &&
        !error &&
        grupos.map((g) => (
          <section key={g.etapa} className="captura__grupo" aria-labelledby={`${id}-etapa-${g.etapa}`}>
            <h3 id={`${id}-etapa-${g.etapa}`} className="captura__grupo-titulo">
              Etapa {g.etapa}: {g.titulo}{' '}
              <span className="captura__grupo-conteo">
                ({g.casos.length === 1 ? '1 caso' : `${g.casos.length} casos`})
              </span>
            </h3>
            <p className="captura__ayuda">{g.detalle}</p>
            {g.casos.length === 0 ? (
              <div className="captura__vacio">Ningún caso espera esta muestra.</div>
            ) : (
              <ul className="captura__lista">
                {g.casos.map((f) => (
                  <li key={f.codigo} className="captura__caso">
                    <div className="captura__fila">
                      <span className="captura__codigo">{f.codigo}</span>
                      <SemaforoBadge semaforo={f.semaforo} />
                    </div>
                    <dl className="captura__detalle">
                      <div>
                        <dt>Cita:</dt>
                        <dd>{f.fechaProximaCita ? formatearFecha(f.fechaProximaCita) : 'Sin cita agendada'}</dd>
                      </div>
                      <div>
                        <dt>Escuela:</dt>
                        <dd>{escuelas.get(f.cct)?.nombre ?? f.cct}</dd>
                      </div>
                    </dl>
                    <Link to={`/caso/${f.codigo}`} className="captura__ficha">
                      Registrar resultado en la ficha
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
    </section>
  )
}
