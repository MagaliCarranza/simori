import { useMemo, useState } from 'react'
import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { EmbudoGrafico } from './EmbudoGrafico.jsx'
import { cambiarFiltro, FILTROS_INICIALES, opcionesFiltros } from './filtros.js'
import { useSupervision } from './useSupervision.js'
import './supervision.css'

const SALIDAS_VISIBLES = [
  ['alta', 'Alta'],
  ['vigilancia', 'Vigilancia'],
  ['referido', 'Referido'],
  ['sin_seguimiento', 'Sin seguimiento'],
  ['en_seguimiento', 'En seguimiento'],
]

const TRANSICIONES = [
  ['t1->t2', 'Tamizaje → Confirmación'],
  ['t2->t3', 'Confirmación → Valoración'],
  ['t3->t4', 'Valoración → Clasificación'],
  // "Clasificación → Salida" no se muestra: no hay resultado de etapa 5 y en
  // vigilancia la salida tiene la misma fecha que la clasificación.
]

const porcentaje = (c) => (c.visible ? `${Math.round(c.porcentaje)} %` : null)
const dias = (m) => (m.suficiente ? `${Math.round(m.dias)} días` : 'sin datos suficientes')

// HU07 y HU08 · "Embudo de seguimiento" (rol supervisión). Solo cifras
// agregadas; toda cifra menor de 5 se muestra como "menos de 5".
// Solo necesita hoyISO; usuario es opcional y solo se usa para la bitácora.
export function SupervisionPage({ hoyISO, usuario, db }) {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const { cargando, error, catalogos, resumen, porLocalidad } = useSupervision({ hoyISO, filtros, usuario, db })
  const opciones = useMemo(() => opcionesFiltros(catalogos, filtros), [catalogos, filtros])
  const cambiar = (cambio) => setFiltros((f) => cambiarFiltro(f, cambio, catalogos))
  const pct = porcentaje(resumen.completado)
  const activos = Object.values(filtros).filter(Boolean).length

  return (
    <section className="supervision" aria-labelledby="titulo-supervision">
      <header className="supervision__encabezado">
        <div>
          <h2 id="titulo-supervision" className="supervision__titulo">
            Embudo de seguimiento
          </h2>
          <p className="supervision__sub">Cifras agregadas. Las menores de 5 se muestran como “menos de 5”.</p>
        </div>
        <EtiquetaSimulado />
      </header>

      {error && <p role="alert">No se pudieron leer los datos guardados en este equipo.</p>}
      {cargando && !error && <p>Cargando datos…</p>}

      {!cargando && !error && (
        <>
          <div className="supervision__kpi" aria-live="polite">
            <span className="supervision__kpi-numero">{pct ?? 'No disponible'}</span>
            <span className="supervision__kpi-texto">
              {pct
                ? 'de los positivos completó su evaluación'
                : 'No se muestra el porcentaje: revelaría grupos de menos de 5 casos'}
            </span>
            <span className="supervision__kpi-total">
              Positivos en la selección: <strong>{resumen.total}</strong>
            </span>
          </div>

          {/* Filtros plegados: el indicador queda en la primera pantalla. */}
          <details className="supervision__filtrar">
            <summary>
              Filtrar
              {activos > 0 && (
                <span className="supervision__filtrar-activos">
                  {' '}
                  · {activos} {activos === 1 ? 'activo' : 'activos'}
                </span>
              )}
            </summary>
            <div className="supervision__filtros">
              <label>
                Localidad
                <select value={filtros.localidad} onChange={(e) => cambiar({ localidad: e.target.value })}>
                  <option value="">Todas</option>
                  {opciones.localidades.map((l) => (
                    <option key={l.claveInegi} value={l.claveInegi}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Escuela
                <select value={filtros.cct} onChange={(e) => cambiar({ cct: e.target.value })}>
                  <option value="">Todas</option>
                  {opciones.escuelas.map((e) => (
                    <option key={e.cct} value={e.cct}>
                      {e.nombre} ({e.cct})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Centro de salud
                <select value={filtros.clues} onChange={(e) => cambiar({ clues: e.target.value })}>
                  <option value="">Todos</option>
                  {opciones.centros.map((c) => (
                    <option key={c.clues} value={c.clues}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>

          </details>

          <div className="supervision__rejilla">
            <section className="supervision__tarjeta" aria-labelledby="titulo-embudo">
              <h3 id="titulo-embudo">Casos por etapa</h3>
              <EmbudoGrafico embudo={resumen.embudo} />
            </section>

            <section className="supervision__tarjeta" aria-labelledby="titulo-salidas">
              <h3 id="titulo-salidas">Desglose de salidas</h3>
              <dl className="supervision__pares">
                {SALIDAS_VISIBLES.map(([clave, titulo]) => (
                  <div key={clave}>
                    <dt>{titulo}</dt>
                    <dd>{resumen.salidas[clave]}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="supervision__tarjeta" aria-labelledby="titulo-dias">
              <h3 id="titulo-dias">Mediana de días entre etapas</h3>
              <dl className="supervision__pares">
                {TRANSICIONES.map(([clave, titulo]) => (
                  <div key={clave}>
                    <dt>{titulo}</dt>
                    <dd>{dias(resumen.medianas[clave])}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <section className="supervision__tarjeta" aria-labelledby="titulo-localidades">
            <h3 id="titulo-localidades">Por localidad</h3>
            {porLocalidad.length === 0 ? (
              <p>No hay casos con los filtros elegidos.</p>
            ) : (
              <>
                <p className="supervision__nota supervision__deslizar">
                  Desliza la tabla a los lados para ver todas las columnas.
                </p>
                <div className="supervision__tabla-envoltura" role="region" aria-label="Tabla por localidad" tabIndex={0}>
                  <table className="supervision__tabla">
                    <thead>
                      <tr>
                        <th scope="col">Localidad</th>
                        <th scope="col">Positivos</th>
                        <th scope="col">Evaluación completa</th>
                        {SALIDAS_VISIBLES.slice(0, 4).map(([clave, titulo]) => (
                          <th key={clave} scope="col">
                            {titulo}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {porLocalidad.map((g) => (
                        <tr key={g.clave}>
                          <th scope="row">{g.nombre}</th>
                          <td>{g.total}</td>
                          <td>{porcentaje(g.completado) ?? 'No disponible'}</td>
                          {SALIDAS_VISIBLES.slice(0, 4).map(([clave]) => (
                            <td key={clave}>{g.salidas[clave]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="supervision__nota">
                  Se protegen las cifras menores de 5 y las que permitirían calcularlas.
                </p>
              </>
            )}
          </section>
        </>
      )}
    </section>
  )
}
