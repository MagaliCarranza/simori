import { useEffect, useState } from 'react'
import { EtiquetaSimulado } from './components/EtiquetaSimulado.jsx'
import { db } from './db/index.js'
import { inicializar } from './db/seed.js'
import { MisVisitasPage } from './features/campo/MisVisitasPage.jsx'
import { PendientesPage } from './features/pendientes/PendientesPage.jsx'
import './App.css'

// Fecha "hoy" fija de la demo; coincide con --hoy del generador de casos.
const HOY_DEMO = '2026-11-14'

// PROVISIONAL: selector de usuario demo mientras llega M2 (roles y navegación).
// Solo muestra las pantallas de captura y campo que ya existen.
function App() {
  const [usuarios, setUsuarios] = useState([])
  const [usuarioId, setUsuarioId] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    inicializar()
      .then(() => db.usuarios.toArray())
      .then((lista) => {
        if (!vigente) return
        const conPantalla = lista.filter((u) => u.rol === 'captura' || u.rol === 'campo')
        setUsuarios(conPantalla)
        if (conPantalla.length) setUsuarioId(conPantalla[0].id)
      })
      .catch((e) => vigente && setError(e))
    return () => {
      vigente = false
    }
  }, [])

  const usuario = usuarios.find((u) => u.id === usuarioId)

  return (
    <main className="app">
      <header className="app__encabezado">
        <h1>Ruta Riñón</h1>
        <EtiquetaSimulado />
      </header>
      <p className="sub">Registro de seguimiento de tamizaje renal — Poncitlán, Jalisco.</p>

      {error && <p role="alert">No se pudieron cargar los datos de la demo.</p>}

      {usuarios.length > 0 && (
        <label className="app__usuario">
          Usuario demo
          <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.rol === 'captura' ? 'Captura' : 'Campo'} · {u.clues}
              </option>
            ))}
          </select>
        </label>
      )}

      {usuario?.rol === 'captura' && <PendientesPage key={usuario.id} usuario={usuario} hoyISO={HOY_DEMO} />}
      {usuario?.rol === 'campo' && <MisVisitasPage key={usuario.id} usuario={usuario} hoyISO={HOY_DEMO} />}

      <p className="app__pie">Prototipo con datos simulados. No es un sistema oficial y no diagnostica.</p>
    </main>
  )
}

export default App
