// M10 · Comparar escenarios (rol supervisión, HU10). Lee los tres archivos de
// casos simulados (11 %, 30 % y 50 %), que el service worker guarda para usarse
// sin internet, y los compara lado a lado. No escribe en la base local: el
// escenario activo del encabezado no cambia.

import { useEffect, useState } from 'react'
import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { FRASE_CIERRE, NUMEROS_ESCENARIO, resumenEscenario } from './comparar.js'
import { etiquetaEscenario } from './escenarios.js'
import './escenarios.css'

async function leerEscenario(numero, fetchImpl) {
  const respuesta = await fetchImpl(`/data/casos_${numero}.json`)
  if (!respuesta || !respuesta.ok) throw new Error(`escenario-${numero}`)
  return resumenEscenario(numero, await respuesta.json())
}

export function ComparaEscenariosPage({ fetchImpl = fetch }) {
  const [datos, setDatos] = useState({ cargando: true, error: false, escenarios: [] })

  useEffect(() => {
    let vigente = true
    Promise.all(NUMEROS_ESCENARIO.map((n) => leerEscenario(n, fetchImpl)))
      .then((escenarios) => vigente && setDatos({ cargando: false, error: false, escenarios }))
      .catch(() => vigente && setDatos({ cargando: false, error: true, escenarios: [] }))
    return () => {
      vigente = false
    }
  }, [fetchImpl])

  return (
    <section className="comparar" aria-labelledby="titulo-comparar">
      <header className="comparar__encabezado">
        <div>
          <h2 id="titulo-comparar">Escenarios de pérdida</h2>
          <p className="comparar__sub">
            Qué pasaría con los mismos casos positivos si en cada paso de la ruta se perdiera el 11 %, el 30 % o el 50 %.
            Cifras agregadas; las menores de 5 se muestran como “menos de 5”.
          </p>
        </div>
        <EtiquetaSimulado />
      </header>

      {datos.error && (
        <p role="alert" className="comparar__aviso">
          No se pudieron leer los escenarios. Abre la app una vez con internet para guardarlos en este equipo.
        </p>
      )}
      {datos.cargando && <p>Cargando escenarios…</p>}

      {!datos.cargando && !datos.error && (
        <>
          <div className="comparar__columnas">
            {datos.escenarios.map((e) => (
              <article
                key={e.numero}
                className="comparar__columna"
                aria-labelledby={`titulo-escenario-${e.numero}`}
              >
                <h3 id={`titulo-escenario-${e.numero}`} className="comparar__titulo">
                  Pérdida de {etiquetaEscenario(e.numero)} en cada paso
                </h3>
                <p className="comparar__total">{e.total} casos positivos simulados</p>

                <ol className="comparar__embudo" aria-label={`Casos por etapa con pérdida de ${etiquetaEscenario(e.numero)}`}>
                  {e.etapas.map((et) => (
                    <li key={et.etapa} className="comparar__etapa">
                      <span className="comparar__etapa-nombre">
                        {et.etapa}. {et.titulo}
                      </span>
                      <span className="comparar__etapa-cifra">
                        {et.n}
                        {et.porcentaje != null && ` (${et.porcentaje} %)`}
                      </span>
                      {et.porcentaje != null && (
                        <span className="comparar__barra" aria-hidden="true">
                          <span style={{ width: `${et.porcentaje}%` }} />
                        </span>
                      )}
                    </li>
                  ))}
                </ol>

                <p className="comparar__final">
                  {e.porcentajeFinal != null ? (
                    <>
                      <strong className="comparar__final-numero">{e.porcentajeFinal} %</strong> completa su evaluación
                      <span className="comparar__final-detalle">
                        De cada 100 positivos, {e.porcentajeFinal} terminan su evaluación: llegan a clasificación o salen con alta en la confirmación ({e.completados} casos).
                      </span>
                    </>
                  ) : (
                    'No se muestra el porcentaje: revelaría grupos de menos de 5 casos.'
                  )}
                </p>
              </article>
            ))}
          </div>

          <div className="comparar__pie">
            <p className="comparar__cierre">{FRASE_CIERRE}</p>
            <EtiquetaSimulado />
          </div>
        </>
      )}
    </section>
  )
}
