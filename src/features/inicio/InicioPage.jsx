// Pantalla de inicio: qué es SIMORI y elección del rol (tarjetas en lenguaje
// sencillo). Al elegir, App fija el usuario de ese rol y abre su primera pantalla.

import { ROLES } from '../../roles/roles.js'
import './inicio.css'

// Ilustración original: centro de salud rural, una enfermera, una madre y su
// hija. Formas simples en SVG, sin imágenes externas (funciona sin internet).
function Ilustracion() {
  return (
    <svg className="inicio__ilustracion" viewBox="0 0 320 170" aria-hidden="true" focusable="false">
      {/* Cielo y sol */}
      <rect width="320" height="170" rx="20" fill="#e6f0ff" />
      <circle cx="268" cy="36" r="18" fill="#fff4c7" />
      {/* Lomas */}
      <path d="M0 128c40-22 86-26 132-12s92 12 132-4 44-10 56-6v64H0z" fill="#cfe2ff" />
      <path d="M0 146c56-14 112-10 168 0s104 8 152-4v28H0z" fill="#b9d4fb" />
      {/* Centro de salud */}
      <rect x="34" y="70" width="104" height="66" rx="6" fill="#ffffff" />
      <path d="M26 74l60-34 60 34z" fill="#0b3c7a" />
      <rect x="74" y="98" width="24" height="38" rx="4" fill="#2f8cff" />
      <rect x="44" y="88" width="20" height="18" rx="3" fill="#cfe2ff" />
      <rect x="108" y="88" width="20" height="18" rx="3" fill="#cfe2ff" />
      <circle cx="86" cy="60" r="9" fill="#ffffff" />
      <path d="M86 54.5v11M80.5 60h11" stroke="#2f8cff" strokeWidth="3" strokeLinecap="round" />
      {/* Árbol */}
      <rect x="152" y="104" width="6" height="32" rx="3" fill="#7a5a3a" />
      <circle cx="155" cy="96" r="16" fill="#9fd36b" />
      {/* Enfermera */}
      <circle cx="196" cy="86" r="10" fill="#8a5a3c" />
      <path d="M186 82c2-9 18-9 20 0z" fill="#ffffff" />
      <path d="M182 136v-26c0-8 6-13 14-13s14 5 14 13v26z" fill="#ffffff" stroke="#0b3c7a" strokeWidth="2" />
      <path d="M196 106v12M190 112h12" stroke="#2f8cff" strokeWidth="2.5" strokeLinecap="round" />
      {/* Madre */}
      <circle cx="244" cy="84" r="10" fill="#b57a50" />
      <path d="M233 84c0-12 22-12 22 0v10h-22z" fill="#3b2a20" />
      <path d="M230 136l4-30c1-7 5-10 10-10s9 3 10 10l4 30z" fill="#b6f24a" />
      {/* Hija */}
      <circle cx="276" cy="104" r="8" fill="#b57a50" />
      <path d="M268 102c0-10 16-10 16 0v4h-16z" fill="#3b2a20" />
      <path d="M266 136l3-20c1-5 4-7 7-7s6 2 7 7l3 20z" fill="#2f8cff" />
      {/* Manos unidas */}
      <path d="M254 114c6 4 9 4 13 2" stroke="#b57a50" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function InicioPage({ rolActual, onElegir }) {
  return (
    <section className="inicio" aria-labelledby="titulo-inicio">
      <Ilustracion />
      <h2 id="titulo-inicio" className="inicio__titulo">
        Te damos la bienvenida a SIMORI
      </h2>
      <p className="inicio__texto">
        SIMORI acompaña a niñas y niños con tamizaje renal positivo en Poncitlán, desde el tamizaje hasta su
        diagnóstico, alta o referencia, y muestra en qué etapa se detiene cada caso. Organiza el seguimiento; no
        diagnostica.
      </p>

      <h3 className="inicio__pregunta">¿Con qué rol vas a entrar?</h3>
      <ul className="inicio__roles">
        {ROLES.map((r) => {
          const actual = r.rol === rolActual
          return (
            <li key={r.rol}>
              <button
                type="button"
                className={`inicio__rol${actual ? ' inicio__rol--actual' : ''}`}
                onClick={() => onElegir(r.rol)}
              >
                <span className="inicio__rol-nombre">{r.nombre}</span>
                <span className="inicio__rol-texto">{r.descripcion}</span>
                {actual && <span className="inicio__rol-marca">Rol actual</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
