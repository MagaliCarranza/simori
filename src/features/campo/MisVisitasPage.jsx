import { liveQuery } from 'dexie'
import { useEffect, useMemo, useState } from 'react'
import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { db as dbDefault } from '../../db/index.js'
import { CasoPendiente } from '../pendientes/CasoPendiente.jsx'
import { filtrarPendientes } from '../pendientes/pendientes.js'
import { usePendientesDelCentro } from '../pendientes/usePendientesDelCentro.js'
import { AvisoFamilia } from '../avisos/AvisoFamilia.jsx'
import {
  completadasDeLaSemana,
  leToca,
  localidadDe,
  porLocalidad,
  resumenSemana,
  textoSemana,
  urgentes,
} from './misVisitas.js'
import { RegistrarVisita } from './RegistrarVisita.jsx'
import '../pendientes/pendientes.css'
import './visitas.css'

const PESTANAS = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'urgentes', texto: 'Urgentes' },
  { valor: 'localidad', texto: 'Por localidad' },
  { valor: 'completadas', texto: 'Completadas' },
]

// Visitas registradas y localidades del centro, para el resumen de la semana,
// la pestaña "Completadas" y la localidad de cada tarjeta. Solo lectura.
function useVisitasDelCentro({ clues, db }) {
  const [datos, setDatos] = useState({ visitas: [], localidades: new Map() })
  useEffect(() => {
    if (!clues) return undefined
    const sub = liveQuery(async () => {
      const casos = await db.casos.where('clues').equals(clues).toArray()
      const codigos = casos.map((c) => c.codigo)
      const eventos = codigos.length ? await db.eventos.where('codigoCaso').anyOf(codigos).toArray() : []
      const localidades = await db.localidades.toArray()
      return { visitas: eventos.filter((e) => e.tipo === 'visita'), localidades }
    }).subscribe({
      next: ({ visitas, localidades }) =>
        setDatos({ visitas, localidades: new Map(localidades.map((l) => [l.claveInegi, l])) }),
      error: () => setDatos({ visitas: [], localidades: new Map() }),
    })
    return () => sub.unsubscribe()
  }, [clues, db])
  return datos
}

// HU04 · "Mis visitas" (rol campo). Lee de la base local (funciona sin internet),
// solo pendientes del centro del usuario, del más urgente al menos urgente.
// Solo muestra códigos, localidad y escuela: nunca resultados clínicos,
// domicilios ni barrios.
export function MisVisitasPage({ usuario, hoyISO, db }) {
  const base = db ?? dbDefault
  const { cargando, error, filas, escuelas, centro } = usePendientesDelCentro({ usuario, hoyISO, db })
  const { visitas: eventosVisita, localidades } = useVisitasDelCentro({ clues: usuario?.clues, db: base })
  const [pestana, setPestana] = useState('todas')

  const visitas = useMemo(() => filtrarPendientes(filas), [filas])
  const listaUrgentes = useMemo(() => urgentes(visitas), [visitas])
  const completadas = useMemo(
    () => completadasDeLaSemana({ filas, visitas: eventosVisita, hoyISO }),
    [filas, eventosVisita, hoyISO],
  )
  const semana = useMemo(
    () => resumenSemana({ visitas: eventosVisita, porVisitar: visitas, hoyISO }),
    [eventosVisita, visitas, hoyISO],
  )
  const urgentesN = listaUrgentes.length

  const conteoPestana = {
    todas: visitas.length,
    urgentes: urgentesN,
    localidad: null,
    completadas: completadas.length,
  }

  const tarjeta = (f) => {
    const localidad = localidadDe(f, escuelas, localidades)
    return (
      <CasoPendiente key={f.codigo} fila={f} escuela={escuelas.get(f.cct)}>
        <p className="visita__le-toca">
          {leToca(f)}
          {localidad && <span className="visita__localidad"> Localidad: {localidad}.</span>}
        </p>
        <RegistrarVisita codigoCaso={f.codigo} usuario={usuario} hoyISO={hoyISO} db={db} />
        <AvisoFamilia
          fila={f}
          centro={centro}
          escuela={escuelas.get(f.cct)}
          usuario={usuario}
          hoyISO={hoyISO}
          db={db}
        />
      </CasoPendiente>
    )
  }

  const listaOVacio = (lista, vacio) =>
    lista.length === 0 ? (
      <div className="pendientes__vacio">{vacio}</div>
    ) : (
      <ul className="pendientes__lista">{lista.map(tarjeta)}</ul>
    )

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
          <p className="pendientes__sub">
            Para saber a qué casa ir, busca el código en la <strong>hoja de enlace del centro de salud</strong>. Si no
            localizas a la familia, la escuela puede ayudarte a entregarle el aviso. No escribas nombres ni domicilios en
            la app.
          </p>
        </div>
        <EtiquetaSimulado />
      </header>

      {error && <p role="alert">No se pudieron leer las visitas guardadas en este equipo.</p>}
      {cargando && !error && <p>Cargando visitas…</p>}

      {!cargando &&
        !error &&
        (visitas.length === 0 && completadas.length === 0 ? (
          <div className="pendientes__vacio">
            <strong>No tienes visitas pendientes</strong>
            Todas las familias de tu centro están al día.
          </div>
        ) : (
          <>
            <div className="visitas__semana">
              <p className="visitas__semana-titulo">Semana del {textoSemana(semana.semana)}</p>
              <p className="visitas__semana-cifras">
                <strong>{semana.visitasRegistradas}</strong>{' '}
                {semana.visitasRegistradas === 1 ? 'visita registrada' : 'visitas registradas'} ·{' '}
                <strong>{semana.familiasVisitadas}</strong>{' '}
                {semana.familiasVisitadas === 1 ? 'familia visitada' : 'familias visitadas'} · faltan{' '}
                <strong>{semana.faltan}</strong> por visitar
              </p>
            </div>

            <div className="visitas__pestanas" role="group" aria-label="Qué visitas ver">
              {PESTANAS.map((p) => (
                <button
                  key={p.valor}
                  type="button"
                  className="boton boton--opcion"
                  aria-pressed={pestana === p.valor}
                  onClick={() => setPestana(p.valor)}
                >
                  {p.texto}
                  {conteoPestana[p.valor] != null && ` (${conteoPestana[p.valor]})`}
                </button>
              ))}
            </div>

            {pestana === 'todas' && (
              <>
                <p className="pendientes__conteo">
                  {visitas.length === 1 ? '1 visita' : `${visitas.length} visitas`}
                  {urgentesN > 0 && ` · ${urgentesN === 1 ? '1 urgente' : `${urgentesN} urgentes`}`}
                </p>
                {listaOVacio(visitas, 'No tienes visitas pendientes.')}
              </>
            )}

            {pestana === 'urgentes' && listaOVacio(listaUrgentes, 'No hay visitas con retraso alto.')}

            {pestana === 'localidad' &&
              (visitas.length === 0 ? (
                <div className="pendientes__vacio">No tienes visitas pendientes.</div>
              ) : (
                porLocalidad(visitas, escuelas, localidades).map((g) => (
                  <section key={g.localidad} className="visitas__grupo" aria-label={g.localidad}>
                    <h3 className="visitas__grupo-titulo">
                      {g.localidad} <span>({g.casos.length})</span>
                    </h3>
                    <ul className="pendientes__lista">{g.casos.map(tarjeta)}</ul>
                  </section>
                ))
              ))}

            {pestana === 'completadas' &&
              listaOVacio(completadas, 'Esta semana todavía no hay familias localizadas.')}
          </>
        ))}
    </section>
  )
}
