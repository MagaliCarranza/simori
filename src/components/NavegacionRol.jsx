import { NavLink } from 'react-router-dom'
import { SelectorEscenario } from '../features/escenarios/SelectorEscenario.jsx'
import './navegacionRol.css'

export const ETIQUETA_ROL = { captura: 'Captura', campo: 'Campo', supervision: 'Supervisión' }

// Rutas por rol. La primera de cada rol es la "home" del rol: cuando el
// usuario cambia de rol, App redirige a ella.
export const RUTAS_POR_ROL = {
  captura: [
    { to: '/registrar', texto: 'Registrar caso' },
    { to: '/pendientes', texto: 'Pendientes' },
  ],
  campo: [
    { to: '/visitas', texto: 'Mis visitas' },
    { to: '/avisos', texto: 'Avisos' },
  ],
  supervision: [
    { to: '/supervision/embudo', texto: 'Embudo' },
    { to: '/supervision/mapa', texto: 'Mapa' },
    { to: '/supervision/pronostico', texto: 'Pronóstico' },
  ],
}

export const HOME_POR_ROL = Object.fromEntries(
  Object.entries(RUTAS_POR_ROL).map(([rol, rutas]) => [rol, rutas[0].to]),
)

// Encabezado con nombre, etiqueta simulada, selector de usuario (rol) y
// navegación por rol. Es el "shell" que envuelve a cada pantalla.
export function NavegacionRol({ usuarios, usuarioId, onCambioUsuario, usuario }) {
  const rutas = usuario ? RUTAS_POR_ROL[usuario.rol] ?? [] : []

  return (
    <header className="nav-rol">
      <div className="nav-rol__cabecera">
        <h1 className="nav-rol__titulo">SIMORI</h1>
        <SelectorEscenario usuario={usuario} />
      </div>

      {usuarios.length > 0 && (
        <label className="nav-rol__usuario">
          Usuario demo
          <select value={usuarioId} onChange={(e) => onCambioUsuario(e.target.value)}>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {ETIQUETA_ROL[u.rol] ?? u.rol}{u.clues ? ` · ${u.clues}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {rutas.length > 0 && (
        <nav className="nav-rol__menu" aria-label={`Menú de ${ETIQUETA_ROL[usuario.rol]}`}>
          {rutas.map((r) => (
            <NavLink
              key={r.to}
              to={r.to}
              className={({ isActive }) => `nav-rol__link${isActive ? ' nav-rol__link--activo' : ''}`}
            >
              {r.texto}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
