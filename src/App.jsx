import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { HOME_POR_ROL, NavegacionRol, RUTAS_POR_ROL } from './components/NavegacionRol.jsx'
import { db } from './db/index.js'
import { inicializar } from './db/seed.js'
import { ListaAvisosPage } from './features/avisos/ListaAvisosPage.jsx'
import { MisVisitasPage } from './features/campo/MisVisitasPage.jsx'
import { GuardadosPage } from './features/captura/GuardadosPage.jsx'
import { MuestrasLabPage } from './features/captura/MuestrasLabPage.jsx'
import { TamizadosPage } from './features/captura/TamizadosPage.jsx'
import { InicioPage } from './features/inicio/InicioPage.jsx'
import { RegistrarCasoPage } from './features/registro/RegistrarCasoPage.jsx'
import { PronosticoPage } from './features/pronostico/PronosticoPage.jsx'
import { FichaCasoPage } from './features/ruta/FichaCasoPage.jsx'
import { SupervisionPage } from './features/supervision/SupervisionPage.jsx'
import { guardarRol, leerRolGuardado } from './roles/roles.js'
import './App.css'

// Mapa lazy: Leaflet es pesado y solo lo necesita supervisión.
const MapaPage = lazy(() => import('./features/mapa/MapaPage.jsx').then((m) => ({ default: m.MapaPage })))

// Fecha "hoy" fija de la demo; coincide con --hoy del generador de casos.
const HOY_DEMO = '2026-11-14'

// Devuelve el conjunto de rutas permitidas para un rol (prefijos).
function rutasPermitidasDe(rol) {
  const rutas = RUTAS_POR_ROL[rol] ?? []
  const explicitas = rutas.map((r) => r.to)
  // La ficha es parte de captura; /pendientes solo redirige a /tamizados.
  if (rol === 'captura') return [...explicitas, '/caso', '/pendientes']
  return explicitas
}

function rutaPermitida(rol, pathname) {
  if (!rol) return true
  const permitidas = rutasPermitidasDe(rol)
  return permitidas.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// "/" es la pantalla de inicio (elegir rol). Sin rol elegido, cualquier otra
// ruta vuelve al inicio. Si el rol no tiene acceso a la ruta actual, lo
// redirigimos a la home de su rol. Supervisión, por ejemplo, no puede entrar
// a /caso/:codigo porque solo ve agregados.
function GuardaPorRol({ usuario, cargado }) {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (location.pathname === '/') return
    if (!usuario) {
      if (cargado) navigate('/', { replace: true })
      return
    }
    if (!rutaPermitida(usuario.rol, location.pathname)) {
      navigate(HOME_POR_ROL[usuario.rol], { replace: true })
    }
  }, [usuario, cargado, location.pathname, navigate])
  return <Outlet />
}

// Marco: encabezado y navegación (NavegacionRol) + contenido de la pantalla.
function Shell({ usuario, cargado }) {
  return (
    <div className={`marco${usuario ? ' marco--con-menu' : ''}`}>
      <NavegacionRol usuario={usuario} />
      <main className="marco__contenido">
        <GuardaPorRol usuario={usuario} cargado={cargado} />
        <p className="app__pie">Prototipo con datos simulados. No es un sistema oficial y no diagnostica.</p>
      </main>
    </div>
  )
}

function AplicacionInterna() {
  const [usuarios, setUsuarios] = useState([])
  const [cargado, setCargado] = useState(false)
  // El rol elegido en el inicio; se recuerda al recargar si se puede.
  const [rol, setRol] = useState(() => leerRolGuardado())
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let vigente = true
    inicializar()
      .then(() => db.usuarios.toArray())
      .then((lista) => {
        if (!vigente) return
        setUsuarios(lista.filter((u) => RUTAS_POR_ROL[u.rol]))
        setCargado(true)
      })
      .catch((e) => vigente && setError(e))
    return () => {
      vigente = false
    }
  }, [])

  const usuario = rol ? usuarios.find((u) => u.rol === rol) : undefined

  // Al elegir un rol: se recuerda y se abre su primera pantalla.
  function elegirRol(nuevo) {
    if (!nuevo || !RUTAS_POR_ROL[nuevo]) return
    setRol(nuevo)
    guardarRol(nuevo)
    navigate(HOME_POR_ROL[nuevo])
  }

  if (error) {
    return (
      <main className="app">
        <p role="alert">No se pudieron cargar los datos de la demo.</p>
      </main>
    )
  }

  return (
    <div className="app">
      <Routes>
        <Route element={<Shell usuario={usuario} cargado={cargado} />}>
          <Route path="/" element={<InicioPage rolActual={rol} onElegir={elegirRol} />} />

          {/* Captura */}
          <Route path="/registrar" element={usuario ? <RegistrarCasoPage usuario={usuario} hoyISO={HOY_DEMO} /> : null} />
          <Route path="/tamizados" element={usuario ? <TamizadosPage usuario={usuario} hoyISO={HOY_DEMO} /> : null} />
          <Route path="/muestras" element={usuario ? <MuestrasLabPage usuario={usuario} hoyISO={HOY_DEMO} /> : null} />
          <Route path="/guardados" element={usuario ? <GuardadosPage /> : null} />
          {/* Pendientes ahora vive en "Pacientes tamizados" (modo "Con retraso"). */}
          <Route path="/pendientes" element={<Navigate to="/tamizados" replace />} />
          <Route path="/caso/:codigo" element={usuario ? <FichaCasoPage usuario={usuario} hoyISO={HOY_DEMO} /> : null} />

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
          <Route path="/supervision/pronostico" element={usuario ? <PronosticoPage usuario={usuario} hoyISO={HOY_DEMO} /> : null} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AplicacionInterna />
    </BrowserRouter>
  )
}
