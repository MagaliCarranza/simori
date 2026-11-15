import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { SEMANAS_PRONOSTICO } from '../../domain/index.js'
import { etiquetaEscenario } from '../escenarios/escenarios.js'
import { usePronostico } from './usePronostico.js'
import '../supervision/supervision.css'
import './pronostico.css'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// '2026-11-14' → '14 nov'
function diaMes(iso) {
  const [, mes, dia] = iso.split('-').map(Number)
  return `${dia} ${MESES[mes - 1]}`
}

// Anexo E · Pronóstico de demanda (rol supervisión). Solo cifras agregadas por
// centro de salud, identificado por su CLUES.
export function PronosticoPage({ hoyISO, usuario, db }) {
  const { cargando, error, escenario, pronostico } = usePronostico({ hoyISO, usuario, db })
  const etiqueta = escenario != null ? etiquetaEscenario(escenario) : null

  return (
    <section className="supervision pronostico" aria-labelledby="titulo-pronostico">
      <header className="supervision__encabezado">
        <div>
          <h2 id="titulo-pronostico" className="supervision__titulo">
            Pronóstico de demanda
          </h2>
          <p className="supervision__sub">
            Citas programadas y llegadas esperadas por centro de salud en las próximas {SEMANAS_PRONOSTICO} semanas.
          </p>
        </div>
        <EtiquetaSimulado />
      </header>

      {error && <p role="alert">No se pudieron leer los datos guardados en este equipo.</p>}
      {cargando && !error && <p>Cargando datos…</p>}

      {!cargando && !error && pronostico && (
        <>
          <div className="pronostico__escenario" aria-live="polite">
            <span className="pronostico__escenario-texto">
              Escenario activo: <strong>{etiqueta} de pérdida</strong>
            </span>
            <EtiquetaSimulado />
            <span className="pronostico__escenario-ayuda">Se cambia en el selector del encabezado.</span>
          </div>

          {pronostico.centros.length === 0 ? (
            <p>No hay centros de salud con citas en estas semanas.</p>
          ) : (
            <>
              {/* En celular no hay "pasar el mouse": el aviso sustituye a las ayudas de las columnas. */}
              <p className="supervision__nota supervision__deslizar">
                Desliza la tabla a los lados para ver todas las columnas.
              </p>
              {pronostico.centros.map((centro) => (
                <section key={centro.clues} className="supervision__tarjeta pronostico__centro">
                  <div
                    className="supervision__tabla-envoltura"
                    role="region"
                    aria-label={`Tabla del centro de salud ${centro.clues}`}
                    tabIndex={0}
                  >
                    <table className="supervision__tabla">
                      <caption className="pronostico__caption">Centro de salud {centro.clues}</caption>
                      <thead>
                        <tr>
                          <th scope="col" title="Semana del pronóstico, con sus fechas de inicio y fin">
                            Semana
                          </th>
                          <th
                            scope="col"
                            title="Citas de casos en seguimiento o en vigilancia que caen en esa semana"
                          >
                            Citas programadas
                          </th>
                          <th
                            scope="col"
                            title={`Citas programadas × (1 − ${etiqueta}), redondeado al entero más cercano`}
                          >
                            Llegadas esperadas
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {centro.semanas.map((s) => (
                          <tr key={s.numero}>
                            <th scope="row">
                              {s.numero}
                              <span className="pronostico__fechas">
                                {diaMes(s.inicio)} – {diaMes(s.fin)}
                              </span>
                            </th>
                            <td>{s.citas}</td>
                            <td>{s.llegadas}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row">Total</th>
                          <td>{centro.totalCitas}</td>
                          <td>{centro.totalLlegadas}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>
              ))}
            </>
          )}

          {/* La regla va después de las tablas: a 360 px las cifras quedan arriba. */}
          <p className="pronostico__regla">
            <strong>Cómo se calcula:</strong> llegadas esperadas = citas programadas × (1 − {etiqueta}),
            redondeado al entero más cercano. Es una cuenta con reglas fijas. Solo se cuentan los casos en
            seguimiento o en vigilancia con cita en estas semanas.
          </p>
        </>
      )}
    </section>
  )
}
