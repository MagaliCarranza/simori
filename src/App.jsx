import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { EnConstruccion } from './components/EnConstruccion.jsx'
import { HOME_POR_ROL, NavegacionRol, RUTAS_POR_ROL } from './components/NavegacionRol.jsx'
import { db } from './db/index.js'
import { inicializar } from './db/seed.js'
import { ListaAvisosPage } from './features/avisos/ListaAvisosPage.jsx'
import { MisVisitasPage } from './features/campo/MisVisitasPage.jsx'
import { PendientesPage } from './features/pendientes/PendientesPage.jsx'
import { SupervisionPage } from './features/supervision/SupervisionPage.jsx'
import './App.css'

// Mapa lazy: Leaflet es pesado y solo lo necesita supervisión.
const MapaPage = lazy(() => import('./features/mapa/MapaPage.jsx').then((m) => ({ default: m.MapaPage })))

// Fecha "hoy" fija de la demo; coincide con --hoy del generador de casos.
const HOY_DEMO = '2026-11-14'

// Devuelve el conjunto de rutas permitidas para un rol (prefijos).
function rutasPermitidasDe(rol) {
  const rutas = RUTAS_POR_ROL[rol] ?? []
  const explicitas = rutas.map((r) => r.to)
  if (rol === 'captura') return [...explicitas, '/caso'] // ficha es parte de captura
  return explicitas
}

function rutaPermitida(rol, pathname) {
  if (!rol) return true
  const permitidas = rutasPermitidasDe(rol)
  return permitidas.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// Si el usuario cambia a un rol que no tiene acceso a la ruta actual, lo
// redirigimos a la home de su rol. Supervisión, por ejemplo, no puede entrar
// a /caso/:codigo porque solo ve agregados.
function GuardaPorRol({ usuario }) {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (!usuario) return
    if (location.pathname === '/') {
      navigate(HOME_POR_ROL[usuario.rol], { replace: true })
      return
    }
    if (!rutaPermitida(usuario.rol, location.pathname)) {
      navigate(HOME_POR_ROL[usuario.rol], { replace: true })
    }
  }, [usuario, location.pathname, navigate])
  return <Outlet />
}

function Shell({ usuarios, usuarioId, setUsuarioId, usuario }) {
  return (
    <>
      <NavegacionRol
        usuarios={usuarios}
        usuarioId={usuarioId}
        onCambioUsuario={setUsuarioId}
        usuario={usuario}
      />
      <GuardaPorRol usuario={usuario} />
      <p className="app__pie">Prototipo con datos simulados. No es un sistema oficial y no diagnostica.</p>
    </>
  )
}

function AplicacionInterna() {
  const [usuarios, setUsuarios] = useState([])
  const [usuarioId, setUsuarioId] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    inicializar()
      .then(() => db.usuarios.toArray())
      .then((lista) => {
        if (!vigente) return
        const conPantalla = lista.filter((u) => RUTAS_POR_ROL[u.rol])
        setUsuarios(conPantalla)
        if (conPantalla.length) setUsuarioId(conPantalla[0].id)
      })
      .catch((e) => vigente && setError(e))
    return () => {
      vigente = false
    }
  }, [])

  const usuario = usuarios.find((u) => u.id === usuarioId)

  if (error) {
    return (
      <main className="app">
        <p role="alert">No se pudieron cargar los datos de la demo.</p>
      </main>
    )
  }

  return (
    <main className="app">
      <Routes>
        <Route element={<Shell usuarios={usuarios} usuarioId={usuarioId} setUsuarioId={setUsuarioId} usuario={usuario} />}>
          <Route path="/" element={null} />

          {/* Captura */}
          <Route
            path="/registrar"
            element={
              <EnConstruccion
                titulo="Registrar caso"
                descripcion="Pantalla pendiente (M3)."
              />
            }
          />
          <Route path="/pendientes" element={usuario ? <PendientesPage usuario={usuario} hoyISO={HOY_DEMO} /> : null} />
          <Route
            path="/caso/:codigo"
            element={
              <EnConstruccion
                titulo="Ficha de seguimiento"
                descripcion="Pantalla pendiente (M4)."
              />
            }
          />

          {/* Campo */}
          <Route path="/visitas" element={usuario ? <MisVisitasPage usuario={usuario} hoyISO={HOY_DEMO} /> : null} />
          <Route path="/avisos" element={usuario ? <ListaAvisosPage usuario={usuario} hoyISO={HOY_DEMO} /> : null} />

          {/* Supervisión */}
          <Route path="/supervision/embudo" element={usuario ? <SupervisionPage usuario={usuario} hoyISO={HOY_DEMO} /> : null} />
          <Route
            path="/supervision/mapa"
            element={
              usuario ? (
                <Suspense fallback={<p>Cargando mapa…</p>}>
                  <MapaPage usuario={usuario} hoyISO={HOY_DEMO} />
                </Suspense>
              ) : null
            }
          />
          <Route
            path="/supervision/pronostico"
            element={
              <EnConstruccion
                titulo="Pronóstico de demanda"
                descripcion="Pantalla pendiente (Anexo E del reporte)."
              />
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AplicacionInterna />
    </BrowserRouter>
  )
}
