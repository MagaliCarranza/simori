import { useEffect, useRef } from 'react'
import './escenarios.css'

// Modal de confirmación dentro de la app (sin window.confirm ni alert). Usa
// <dialog> nativo con fallback: si showModal no existe (navegadores viejos),
// se pinta como overlay regular con role="dialog".
export function ConfirmarCambio({
  abierto,
  destino,
  cargando,
  error,
  onConfirmar,
  onCancelar,
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (abierto) {
      if (!el.open && typeof el.showModal === 'function') el.showModal()
    } else if (el.open) {
      el.close()
    }
  }, [abierto])

  if (!abierto) return null

  const cerrar = (e) => {
    // El navegador cierra el <dialog> con Escape mandando este evento.
    e.preventDefault()
    if (!cargando) onCancelar()
  }

  return (
    <dialog
      ref={dialogRef}
      className="escenario-dialogo"
      aria-labelledby="dlg-escenario-titulo"
      onCancel={cerrar}
    >
      <h3 id="dlg-escenario-titulo" className="escenario-dialogo__titulo">
        ¿Cambiar al escenario {destino} %?
      </h3>
      <p className="escenario-dialogo__texto">
        Se recargan los casos simulados del escenario de {destino} % de pérdida.
        Los casos que registraste se mantienen.
      </p>
      {error && (
        <p className="escenario-dialogo__error" role="alert">
          No se pudo cargar el escenario sin conexión; inténtalo con internet.
        </p>
      )}
      <div className="escenario-dialogo__acciones">
        <button
          type="button"
          className="boton boton--secundario"
          onClick={onCancelar}
          disabled={cargando}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="boton boton--primario"
          onClick={onConfirmar}
          disabled={cargando}
        >
          {cargando ? 'Cambiando…' : 'Cambiar escenario'}
        </button>
      </div>
    </dialog>
  )
}
