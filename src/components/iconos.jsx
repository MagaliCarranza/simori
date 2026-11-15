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

export const IconoPortapapeles = () => (
  <Icono>
    <rect x="5" y="4" width="14" height="17" rx="3" />
    <path d="M9 4.5V3h6v1.5" />
    <path d="M9 10h6M9 13.5h6M9 17h4" />
  </Icono>
)

export const IconoUbicacion = () => (
  <Icono>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icono>
)

export const IconoBarras = () => (
  <Icono>
    <rect x="4" y="12" width="4" height="8" rx="1.2" />
    <rect x="10" y="7" width="4" height="13" rx="1.2" />
    <rect x="16" y="4" width="4" height="16" rx="1.2" />
  </Icono>
)

export const IconoFlecha = () => (
  <Icono>
    <path d="M7 17 17 7M9 7h8v8" />
  </Icono>
)

export const IconoEscudo = () => (
  <Icono>
    <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z" />
    <path d="m9 12 2 2 4-4" />
  </Icono>
)

export const IconoSinConexion = () => (
  <Icono>
    <path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.6 4.2 4.2 0 0 0 7 18z" />
    <path d="m10 13.5 1.5 1.5 3-3" />
  </Icono>
)

export const IconoMuestra = () => (
  <Icono>
    <path d="M9 3h6M10 3v12a2 2 0 0 0 4 0V3" />
    <path d="M10 10h4" />
    <path d="M6 21h12" />
  </Icono>
)

export const IconoGuardado = () => (
  <Icono>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <path d="M12 8v6M9.5 11.5 12 14l2.5-2.5" />
    <path d="M11 18.5h2" />
  </Icono>
)
