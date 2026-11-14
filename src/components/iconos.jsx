// Íconos de la navegación: SVG propios en línea (sin dependencias ni
// imágenes externas). Decorativos: el texto del enlace siempre los acompaña.

function Icono({ children }) {
  return (
    <svg
      className="icono"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const IconoRegistrar = () => (
  <Icono>
    <rect x="4" y="3" width="16" height="18" rx="3" />
    <path d="M12 8v8M8 12h8" />
  </Icono>
)

export const IconoPendientes = () => (
  <Icono>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1.2" />
    <circle cx="4.5" cy="12" r="1.2" />
    <circle cx="4.5" cy="18" r="1.2" />
  </Icono>
)

export const IconoVisitas = () => (
  <Icono>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v10h13V10" />
    <path d="M10 20v-5h4v5" />
  </Icono>
)

export const IconoAvisos = () => (
  <Icono>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M8 9h8M8 12h5" />
  </Icono>
)

export const IconoEmbudo = () => (
  <Icono>
    <path d="M3 4h18l-7 8v6l-4 2v-8z" />
  </Icono>
)

export const IconoMapa = () => (
  <Icono>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" />
    <path d="M9 4v14M15 6v14" />
  </Icono>
)

export const IconoPronostico = () => (
  <Icono>
    <path d="M4 20V4M4 20h16" />
    <path d="m7 15 4-4 3 3 5-6" />
  </Icono>
)

export const IconoCambiar = () => (
  <Icono>
    <path d="M7 4 3 8l4 4" />
    <path d="M3 8h13a4 4 0 0 1 4 4" />
    <path d="m17 20 4-4-4-4" />
    <path d="M21 16H8a4 4 0 0 1-4-4" />
  </Icono>
)
