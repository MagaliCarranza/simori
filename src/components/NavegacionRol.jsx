import { Link, NavLink } from 'react-router-dom'
import { NOMBRE_ROL } from '../roles/roles.js'
import { EtiquetaSimulado } from './EtiquetaSimulado.jsx'
import {
  IconoAvisos,
  IconoCambiar,
  IconoEmbudo,
  IconoMapa,
  IconoPendientes,
  IconoPronostico,
  IconoRegistrar,
  IconoVisitas,
} from './iconos.jsx'
import { LogoSimbolo } from './Logo.jsx'
import './navegacionRol.css'

export const ETIQUETA_ROL = { captura: 'Captura', campo: 'Campo', supervision: 'Supervisión' }

// Pantallas "En construcción": no se muestran en el menú mientras esta
// constante sea false. Siguen registradas en App (la dirección directa
// funciona). Para publicar una, quita su `pendiente: true` o pon esto en true.
const MOSTRAR_PANTALLAS_PENDIENTES = false

const visible = (r) => MOSTRAR_PANTALLAS_PENDIENTES || !r.pendiente

// Rutas por rol. La primera visible de cada rol es la "home" del rol: cuando
// el usuario cambia de rol, App redirige a ella.
export const RUTAS_POR_ROL = {
  captura: [
    { to: '/registrar', texto: 'Registrar caso', pendiente: true },
    { to: '/pendientes', texto: 'Pendientes' },
  ],
  campo: [
    { to: '/visitas', texto: 'Mis visitas' },
    { to: '/avisos', texto: 'Avisos' },
  ],
  supervision: [
    { to: '/supervision/embudo', texto: 'Embudo' },
    { to: '/supervision/mapa', texto: 'Mapa' },
    { to: '/supervision/pronostico', texto: 'Pronóstico', pendiente: true },
  ],
}

export const HOME_POR_ROL = Object.fromEntries(
  Object.entries(RUTAS_POR_ROL).map(([rol, rutas]) => [rol, rutas.filter(visible)[0].to]),
)

// Ícono de cada sección (decorativo; el texto siempre lo acompaña).
const ICONO_POR_RUTA = {
  '/registrar': IconoRegistrar,
  '/pendientes': IconoPendientes,
  '/visitas': IconoVisitas,
  '/avisos': IconoAvisos,
  '/supervision/embudo': IconoEmbudo,
  '/supervision/mapa': IconoMapa,
  '/supervision/pronostico': IconoPronostico,
}

// Marco de la app: encabezado compacto (logo, chip del rol y la etiqueta
// "Datos simulados", que se ve en todas las pantallas) y la navegación del
// rol: barra inferior en celular y barra lateral desde 768 px.
export function NavegacionRol({ usuario }) {
  const rutas = usuario ? (RUTAS_POR_ROL[usuario.rol] ?? []).filter(visible) : []
  const nombreRol = usuario ? (NOMBRE_ROL[usuario.rol] ?? ETIQUETA_ROL[usuario.rol]) : null

  return (
    <>
      <header className="nav-rol">
        <Link to="/" className="nav-rol__inicio" aria-label="SIMORI, ir al inicio">
          <LogoSimbolo tamano={30} />
          <h1 className="nav-rol__titulo">SIMORI</h1>
        </Link>
        {nombreRol && (
          <Link to="/" className="nav-rol__chip" aria-label={`Cambiar de rol (actual: ${nombreRol})`}>
            <span className="nav-rol__chip-texto">{nombreRol}</span>
            <IconoCambiar />
          </Link>
        )}
        <span className="nav-rol__simulado">
          <EtiquetaSimulado />
        </span>
      </header>

      {rutas.length > 0 && (
        <nav className="nav-rol__menu" aria-label={`Menú de ${nombreRol}`}>
          {rutas.map((r) => {
            const Icono = ICONO_POR_RUTA[r.to]
            return (
              <NavLink
                key={r.to}
                to={r.to}
                className={({ isActive }) => `nav-rol__link${isActive ? ' nav-rol__link--activo' : ''}`}
              >
                {Icono && <Icono />}
                <span>{r.texto}</span>
              </NavLink>
            )
          })}
        </nav>
      )}
    </>
  )
}
