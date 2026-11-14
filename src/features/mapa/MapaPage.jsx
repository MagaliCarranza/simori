// Mapa de la zona (M9: HU09, RF10, RNF03). Un punto por localidad: escuelas y
// centros comparten la coordenada de su localidad. Solo cifras agregadas.

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import { etiquetaPrioridad } from '../../domain/index.js'
import { EtiquetaSimulado } from '../../components/EtiquetaSimulado.jsx'
import { FILTROS_INICIALES } from '../supervision/filtros.js'
import { useSupervision } from '../supervision/useSupervision.js'
import { panelesPorLocalidad, textoAgrupacion } from './panelLocalidad.js'
import '../supervision/supervision.css'
import './mapa.css'

// Fuentes según docs/05 (datasets 17, 28 y Censo 2020 ITER).
const FUENTES = {
  marginacion: 'CONAPO, Índice de marginación por localidad 2020',
  poblacion: 'Censo 2020 ITER por localidad',
  matricula: 'SEJ / SEP, Estadísticas educativas',
}

const MOSAICOS_OSM = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}

const ZOOM_MIN = 12
const ZOOM_MAX = 17
const MARGEN_GRADOS = 0.05

// Un mosaico que falla suelto no basta para avisar: solo varios seguidos.
const FALLOS_PARA_AVISO = 3

// Solo azules: naranja o rojo se confundirían con el semáforo.
const COLOR_PUNTO = '#2563eb'
const COLOR_SELECCION = '#0b1f4d'

// Dirección de la etiqueta por localidad. Chalpicote está a menos de 1 km de
// Agua Caliente: a 360 px sus etiquetas se encimaban, así que va abajo.
const DIRECCION_ETIQUETA = { '140660043': 'bottom' }
const direccionEtiqueta = (claveInegi) => DIRECCION_ETIQUETA[claveInegi] ?? 'top'

const NOMBRE_COLOR = { verde: 'Verde', amarillo: 'Amarillo', rojo: 'Rojo' }

function limites(puntos) {
  const lats = puntos.map(([lat]) => lat)
  const lngs = puntos.map(([, lng]) => lng)
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ]
}

function ampliar([[s, o], [n, e]], margen) {
  return [
    [s - margen, o - margen],
    [n + margen, e + margen],
  ]
}

function useEnLinea() {
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine)
    window.addEventListener('online', actualizar)
    window.addEventListener('offline', actualizar)
    return () => {
      window.removeEventListener('online', actualizar)
      window.removeEventListener('offline', actualizar)
    }
  }, [])
  return enLinea
}

// Avisa si no hay red o si fallan varios mosaicos seguidos; un mosaico que
// carga reinicia la cuenta.
function useSinMosaicos() {
  const enLinea = useEnLinea()
  const fallos = useRef(0)
  const [fallan, setFallan] = useState(false)
  const eventos = useMemo(
    () => ({
      tileerror: () => {
        fallos.current += 1
        if (fallos.current >= FALLOS_PARA_AVISO) setFallan(true)
      },
      tileload: () => {
        fallos.current = 0
        setFallan(false)
      },
    }),
    [],
  )
  return { sinMosaicos: !enLinea || fallan, eventos }
}

function Par({ termino, children }) {
  return (
    <div>
      <dt>{termino}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function PanelLocalidad({ panel }) {
  const { pendientes, prioridad, agrupacion } = panel
  const aproximada = panel.escuelas.some((e) => e.ubicacionAproximada)
  return (
    <>
      <h3 id="titulo-panel">{panel.nombre}</h3>

      {prioridad && (
        <p className={`mapa__prioridad mapa__prioridad--${prioridad.nivel}`}>
          <span className="mapa__prioridad-etiqueta">{etiquetaPrioridad(prioridad)}</span>
          <span className="mapa__prioridad-razon">{prioridad.razon}</span>
        </p>
      )}

      {agrupacion && (
        <div className="mapa__agrupacion">
          <p>{textoAgrupacion(agrupacion)}</p>
          <p className="supervision__nota">
            Agrupación con k-means (aprendizaje automático); comparada con el promedio del municipio
          </p>
        </div>
      )}

      <dl className="supervision__pares">
        <Par termino="Grado de marginación">{panel.gradoMarginacion ?? 'Sin dato'}</Par>
        <Par termino="Población de 5 a 14 años">{panel.poblacion5a14 ?? 'Sin dato'}</Par>
      </dl>
      <p className="supervision__nota">
        Fuentes: {FUENTES.marginacion}; {FUENTES.poblacion}.
      </p>

      <h4 className="mapa__subtitulo">Escuelas</h4>
      {panel.escuelas.length === 0 ? (
        <p>Sin escuelas registradas.</p>
      ) : (
        <ul className="mapa__escuelas">
          {panel.escuelas.map((e) => (
            <li key={e.cct}>
              <span>
                {e.nombre}
                {e.turno ? ` (${e.turno})` : ''}
              </span>
              <span className="mapa__matricula">
                Matrícula: <strong>{e.matricula ?? 'sin dato'}</strong>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="supervision__nota">
        Matrícula: {FUENTES.matricula}.
        {aproximada && ' Ubicación aproximada: las escuelas se muestran en el punto de su localidad.'}
      </p>

      <h4 className="mapa__subtitulo">Centro de salud</h4>
      {panel.centros.length === 0 ? (
        <p>Sin centro de salud registrado.</p>
      ) : (
        <ul className="mapa__centros">
          {panel.centros.map((c) => (
            <li key={c.clues}>
              {c.nombre}
              {c.provisional && <span className="mapa__marca">Centro provisional</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="mapa__pendientes-encabezado">
        <h4 className="mapa__subtitulo">Pendientes</h4>
        <EtiquetaSimulado />
      </div>
      <dl className="supervision__pares">
        <Par termino="Total de positivos">{pendientes.total}</Par>
        <Par termino="En seguimiento">{pendientes.enSeguimiento}</Par>
      </dl>
      <dl className="supervision__pares mapa__semaforo" aria-label="En seguimiento por color del semáforo">
        {Object.entries(NOMBRE_COLOR).map(([color, nombre]) => (
          <div key={color}>
            <dt>
              <span className={`semaforo semaforo--${color}`}>{nombre}</span>
            </dt>
            <dd>{pendientes.semaforo[color]}</dd>
          </div>
        ))}
      </dl>
      <dl className="supervision__pares">
        <Par termino="Sin seguimiento">{pendientes.sinSeguimiento}</Par>
      </dl>
      <p className="supervision__nota">Se protegen las cifras menores de 5 y las que permitirían calcularlas.</p>
    </>
  )
}

// Marco amplio para normalizar el índice de prioridad: localidades_marco.json
// trae todas las reales del municipio sin las filas de totales del ITER. No
// se muestra en pantalla; si la carga falla, prioridad usa solo las 3 del
// alcance (menos informativo, pero no rompe la UI).
const RUTA_MARCO = '/data/localidades_marco.json'

function useLocalidadesMarco(fetchImpl = fetch) {
  const [marco, setMarco] = useState(null)
  useEffect(() => {
    let cancelado = false
    fetchImpl(RUTA_MARCO)
      .then((r) => (r.ok ? r.json() : []))
      .then((datos) => {
        if (!cancelado) setMarco(Array.isArray(datos) ? datos : [])
      })
      .catch(() => {
        if (!cancelado) setMarco([])
      })
    return () => {
      cancelado = true
    }
  }, [fetchImpl])
  return marco
}

// Grupos k-means de scripts/agrupar_localidades.py. Si no carga, queda en
// null y el panel no muestra la línea del grupo.
const RUTA_GRUPOS = '/data/grupos_localidades.json'

function useGruposLocalidades(fetchImpl = fetch) {
  const [grupos, setGrupos] = useState(null)
  useEffect(() => {
    let cancelado = false
    fetchImpl(RUTA_GRUPOS)
      .then((r) => (r.ok ? r.json() : null))
      .then((datos) => {
        if (!cancelado) setGrupos(datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : null)
      })
      .catch(() => {
        if (!cancelado) setGrupos(null)
      })
    return () => {
      cancelado = true
    }
  }, [fetchImpl])
  return grupos
}

export function MapaPage({ hoyISO, usuario, db, fetchImpl = fetch }) {
  const { cargando, error, catalogos, porLocalidad } = useSupervision({
    hoyISO,
    filtros: FILTROS_INICIALES,
    usuario,
    db,
    vista: 'mapa',
  })
  const marco = useLocalidadesMarco(fetchImpl)
  const gruposLocalidades = useGruposLocalidades(fetchImpl)
  const paneles = useMemo(
    () => panelesPorLocalidad(catalogos, porLocalidad, marco ?? catalogos.localidades, gruposLocalidades),
    [catalogos, porLocalidad, marco, gruposLocalidades],
  )
  const [seleccion, setSeleccion] = useState(null)
  const { sinMosaicos, eventos: eventosMosaicos } = useSinMosaicos()
  const panel = paneles.find((p) => p.claveInegi === seleccion) ?? null

  const conPunto = paneles.filter((p) => p.coordenadas)
  const caja = conPunto.length > 0 ? limites(conPunto.map((p) => p.coordenadas)) : null

  return (
    <section className="supervision mapa" aria-labelledby="titulo-mapa">
      <header className="supervision__encabezado">
        <div>
          <h2 id="titulo-mapa" className="supervision__titulo">
            Mapa de la zona
          </h2>
          <p className="supervision__sub">Localidades, escuelas y centros de salud. Elige una localidad para ver sus datos.</p>
        </div>
      </header>

      {error && <p role="alert">No se pudieron leer los datos guardados en este equipo.</p>}
      {cargando && !error && <p>Cargando datos…</p>}

      {!cargando && !error && (
        <div className="mapa__cuerpo">
          <nav className="mapa__lista" aria-label="Localidades">
            <ul>
              {paneles.map((p) => (
                <li key={p.claveInegi}>
                  <button
                    type="button"
                    className="mapa__localidad"
                    aria-pressed={p.claveInegi === seleccion}
                    onClick={() => setSeleccion(p.claveInegi)}
                  >
                    {p.nombre}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {sinMosaicos && caja && (
            <p className="mapa__aviso" role="status">
              Sin conexión: el mapa muestra solo los puntos.
            </p>
          )}

          <div className="mapa__lienzo">
            {caja ? (
              <MapContainer
                bounds={caja}
                boundsOptions={{ padding: [24, 24] }}
                maxBounds={ampliar(caja, MARGEN_GRADOS)}
                maxBoundsViscosity={1}
                minZoom={ZOOM_MIN}
                maxZoom={ZOOM_MAX}
                className="mapa__leaflet"
              >
                <TileLayer
                  url={MOSAICOS_OSM.url}
                  attribution={MOSAICOS_OSM.attribution}
                  crossOrigin
                  eventHandlers={eventosMosaicos}
                />
                {conPunto.map((p) => {
                  const elegido = p.claveInegi === seleccion
                  return (
                    <CircleMarker
                      key={p.claveInegi}
                      center={p.coordenadas}
                      radius={elegido ? 14 : 11}
                      pathOptions={{
                        color: elegido ? COLOR_SELECCION : COLOR_PUNTO,
                        fillColor: elegido ? COLOR_SELECCION : COLOR_PUNTO,
                        fillOpacity: elegido ? 0.85 : 0.5,
                        weight: elegido ? 5 : 2,
                      }}
                      eventHandlers={{ click: () => setSeleccion(p.claveInegi) }}
                    >
                      {/* Permanente: en celular no hay "pasar el mouse". */}
                      <Tooltip
                        permanent
                        direction={direccionEtiqueta(p.claveInegi)}
                        offset={direccionEtiqueta(p.claveInegi) === 'bottom' ? [0, 12] : [0, -12]}
                        className={elegido ? 'mapa__etiqueta mapa__etiqueta--elegida' : 'mapa__etiqueta'}
                      >
                        {p.nombre}
                      </Tooltip>
                    </CircleMarker>
                  )
                })}
              </MapContainer>
            ) : (
              <p className="mapa__vacio">No hay localidades con coordenadas para mostrar.</p>
            )}
          </div>

          <section
            className="supervision__tarjeta mapa__panel"
            aria-live="polite"
            aria-labelledby={panel ? 'titulo-panel' : undefined}
            aria-label={panel ? undefined : 'Datos de la localidad'}
          >
            {panel ? <PanelLocalidad panel={panel} /> : <p>Elige una localidad en la lista o en el mapa.</p>}
          </section>
        </div>
      )}
    </section>
  )
}
