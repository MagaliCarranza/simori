import './ui.css'

export function EtiquetaSimulado() {
  return (
    <span className="etiqueta-simulado">
      <svg className="etiqueta-simulado__icono" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
      </svg>
      Datos simulados
    </span>
  )
}
