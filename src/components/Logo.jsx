// Logo de SIMORI: el archivo oficial del equipo (docs/recursos/LogoSIMORI.jpg),
// reducido a 256 px y sin el fondo blanco (PNG transparente, ~48 KB). Va en el
// precaché del service worker, así que se ve sin internet.
import logoSimori from '../assets/logo-simori.png'

const PROPORCION = 256 / 213

// Solo el símbolo. Decorativo: junto a él siempre va el nombre en texto.
export function LogoSimbolo({ tamano = 32, className }) {
  return (
    <img
      className={className ? `logo__simbolo ${className}` : 'logo__simbolo'}
      src={logoSimori}
      width={Math.round(tamano * PROPORCION)}
      height={tamano}
      alt=""
    />
  )
}

// Símbolo + nombre. El nombre es texto real (no imagen) para lectores de pantalla.
export function Logo({ tamano = 32 }) {
  return (
    <span className="logo">
      <LogoSimbolo tamano={tamano} />
      <span className="logo__nombre">SIMORI</span>
    </span>
  )
}
