// Logo de SIMORI: un riñón sencillo con una ruta punteada que llega a una
// marca (el seguimiento de cada caso). Dibujo original en SVG, sin imágenes.

export function LogoSimbolo({ tamano = 32, className }) {
  return (
    <svg
      className={className}
      width={tamano}
      height={tamano}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="#0b3c7a" />
      <path
        d="M19.5 5.5c-4.6 0-8.4 3.2-8.4 7.3 0 1.6.7 2.6 1.6 3.4.9.8.9 2-.2 2.7-1.9 1.2-3 2.8-3 4.6 0 2.7 2.6 4.3 6 3.9 5.7-.7 9.8-6.3 9.8-12.6 0-5.6-2.3-9.3-5.8-9.3z"
        fill="#2f8cff"
      />
      <path
        d="M14.2 12.6c1.6-.4 3.1.3 3.6 1.7"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6 26.5c2.5-1.2 4.2-3 5.4-5.5"
        fill="none"
        stroke="#b6f24a"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="0.1 3"
      />
      <circle cx="5.6" cy="26.7" r="1.9" fill="#b6f24a" />
    </svg>
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
