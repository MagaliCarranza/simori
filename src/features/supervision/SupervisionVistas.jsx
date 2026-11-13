// Vistas del rol supervisión: Embudo (M8) y Mapa (M9).
// Contrato para M2: SupervisionVistas({ hoyISO, usuario? }).

import { lazy, Suspense, useState } from 'react'
import { SupervisionPage } from './SupervisionPage.jsx'
import './supervision.css'

// El mapa (Leaflet) va en su propio archivo JS: no se descarga hasta abrirlo,
// pero el service worker lo guarda igual para usarlo sin internet.
const MapaPage = lazy(() => import('../mapa/MapaPage.jsx').then((m) => ({ default: m.MapaPage })))

const VISTAS = [
  { id: 'embudo', nombre: 'Embudo' },
  { id: 'mapa', nombre: 'Mapa' },
]

export function SupervisionVistas({ hoyISO, usuario, db }) {
  const [vista, setVista] = useState('embudo')
  return (
    <>
      <nav className="vistas" aria-label="Vistas de supervisión">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            className="vistas__boton"
            aria-pressed={vista === v.id}
            onClick={() => setVista(v.id)}
          >
            {v.nombre}
          </button>
        ))}
      </nav>
      {vista === 'embudo' ? (
        <SupervisionPage hoyISO={hoyISO} usuario={usuario} db={db} />
      ) : (
        <Suspense fallback={<p className="supervision">Cargando mapa…</p>}>
          <MapaPage hoyISO={hoyISO} usuario={usuario} db={db} />
        </Suspense>
      )}
    </>
  )
}
